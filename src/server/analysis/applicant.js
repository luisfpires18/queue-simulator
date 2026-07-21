// Applicant scan engine: for ANY character, walk the season's dungeons, pull the
// top few keystone runs of each, gather full combat detail, merge into an OVERALL
// block, and score "is this a fit for a +N apply" from cheap signals (DPS
// percentile vs the ranked field + key-level consistency + rating proximity).
//
// Pure orchestration over the WCL fetch layer — all game data (dungeon list,
// class defensive/interrupt spellIds, rating) is passed in by the TS route so
// this JS engine stays data-free and unit-testable with fixtures.
import { fetchMyEncounterRuns, fetchTopRuns, fetchApplicantRun } from '../wcl/api.js';
import { dumpDebug } from '../wcl/client.js';

/**
 * From a character's runs on one encounter (already best-first: highest key,
 * then highest parse), pick the best run at each of the top `count` distinct key
 * levels — i.e. max, then the next lower levels that were actually logged
 * (22,21,20; or 22,20,19 when 21 was never run). Only runs with a report are
 * eligible (a detail fetch needs code+fightID).
 */
export function selectRuns(runs, count = 3) {
  const withReport = (runs ?? []).filter((r) => r.report?.code && r.report?.fightID != null);
  const chosen = [];
  const seen = new Set();
  for (const r of withReport) {
    if (r.keyLevel == null || seen.has(r.keyLevel)) continue;
    seen.add(r.keyLevel);
    chosen.push(r);
    if (chosen.length >= count) break;
  }
  return chosen;
}

/**
 * Cheap field comparison: where the applicant's DPS lands against the ranked
 * spec field at that key level. percentile = share of the field the applicant
 * beats. No field combat detail is fetched — this is the one ranked page only.
 */
export function comparePercentile(applicantDps, fieldEntries) {
  const dpsList = (fieldEntries ?? []).map((e) => e.dps).filter((v) => typeof v === 'number' && v > 0);
  if (applicantDps == null || !dpsList.length) return null;
  const below = dpsList.filter((d) => d < applicantDps).length;
  const sorted = [...dpsList].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return {
    percentile: Math.round((below / dpsList.length) * 100),
    fieldMedianDps: median,
    fieldBestDps: sorted[sorted.length - 1],
    fieldSize: dpsList.length,
    applicantDps,
  };
}

/** Sum the best (max-level) run of each dungeon into one OVERALL block. */
function mergeOverall(perDungeon) {
  const acc = {
    damage: 0, healing: 0, damageTaken: 0, durationMs: 0,
    interrupts: 0, dispels: 0, purges: 0, deaths: 0,
    defensiveUses: 0, defensiveMitigated: 0, externalUses: 0,
    dungeonsWithData: 0, canDispel: false,
  };
  for (const d of perDungeon) {
    const best = d.runs[0];
    if (!best) continue;
    acc.dungeonsWithData += 1;
    const o = best.overall;
    acc.damage += o.damage;
    acc.healing += o.healing;
    acc.damageTaken += o.damageTaken;
    acc.durationMs += best.durationMs || 0;
    acc.interrupts += o.interrupts;
    // dispels/purges are null for classes that can't dispel — keep the overall
    // null too rather than summing to a misleading 0.
    if (o.dispels != null) { acc.dispels += o.dispels; acc.canDispel = true; }
    if (o.purges != null) acc.purges += o.purges;
    acc.deaths += o.deaths.length;
    acc.defensiveUses += o.defensives.reduce((s, x) => s + x.uses, 0);
    acc.defensiveMitigated += o.defensives.filter((x) => x.mitigated).length;
    acc.externalUses += o.externals.reduce((s, x) => s + x.casts, 0);
  }
  const sec = acc.durationMs / 1000 || 1;
  return {
    ...acc,
    dispels: acc.canDispel ? acc.dispels : null,
    purges: acc.canDispel ? acc.purges : null,
    dps: acc.damage / sec,
    hps: acc.healing / sec,
  };
}

const clamp = (lo, hi, v) => Math.max(lo, Math.min(hi, v));

// A distinct scoring entity — NOT the parse. Five weighted 0-100 components,
// blended into one 0-100 dungeon score. Tune weights here in one place.
export const SCORE_WEIGHTS = {
  parse: 0.4, // dps performance (population parse %) — biggest single input
  depth: 0.2, // key level reached + repeated at depth (reliability)
  survival: 0.2, // deaths — expensive
  damageTaken: 0.1, // damage taken vs own output (avoidable-damage proxy)
  interrupts: 0.1, // kicks landed — a benefit
};

/**
 * Composite performance score for one dungeon, with a per-component breakdown so
 * the UI can explain WHY. Deliberately its own entity: the parse is only 40% of
 * it, so a purple parser who dies twice, eats mechanics and never kicks does NOT
 * score purple.
 *
 * Components (each normalised 0-100, then weighted by SCORE_WEIGHTS):
 *  - parse:       real WCL parse % (population-relative), or a dps-vs-field
 *                 fallback (top-field median=50 .. best=95) when no parse exists.
 *  - depth:       key level reached (+14→0 .. +23→100) plus a reliability bonus
 *                 for also having runs logged at lower levels of this dungeon.
 *  - survival:    100 minus 30 per death — deaths hurt hard.
 *  - damageTaken: damage taken relative to the player's OWN damage done (WCL's
 *                 API has no true "avoidable" flag, so this ratio is the proxy:
 *                 low taken:done = clean, high = standing in stuff).
 *  - interrupts:  landed interrupts, saturating at ~15.
 *
 * @returns {{score:number|null, breakdown:{key,label,weight,value,points}[]}}
 */
export function dungeonScore(dungeon) {
  const best = dungeon.runs?.[0];
  const fc = dungeon.fieldCompare;
  if (!best) return { score: null, breakdown: [] };
  const o = best.overall;

  // 1. Parse (dps performance).
  let parse;
  if (fc?.parsePercent != null) {
    parse = fc.parsePercent;
  } else if (fc?.applicantDps != null && fc?.fieldMedianDps != null && fc?.fieldBestDps != null) {
    const { applicantDps, fieldMedianDps, fieldBestDps } = fc;
    parse = applicantDps >= fieldMedianDps
      ? 50 + 45 * Math.min(1, (applicantDps - fieldMedianDps) / (fieldBestDps - fieldMedianDps || 1))
      : 50 * (applicantDps / (fieldMedianDps || 1));
  } else {
    parse = 50;
  }

  // 2. Key depth + reliability (repeated at lower levels of THIS dungeon).
  const lvl = dungeon.maxLevel ?? 0;
  const depthBase = clamp(0, 100, ((lvl - 14) / 9) * 100); // +14→0, +23→100
  const lowerRuns = (dungeon.levels || []).filter((l) => l != null && l < lvl).length;
  const depth = clamp(0, 100, depthBase + Math.min(15, lowerRuns * 7));

  // 3. Survival — deaths.
  const deaths = o.deaths.length;
  const survival = clamp(0, 100, 100 - deaths * 30);

  // 4. Avoidable damage. If the dataset flagged avoidable hits for this dungeon,
  //    score off THAT (avoidable taken vs own output: 0% -> 100, >=10% -> 0).
  //    Otherwise fall back to the total-taken-vs-output proxy.
  let damageTaken;
  let damageTakenLabel;
  if (o.avoidableCounted) {
    const aRatio = o.damage > 0 ? o.avoidableDamage / o.damage : 0;
    damageTaken = clamp(0, 100, 100 - (aRatio / 0.1) * 100);
    damageTakenLabel = 'Avoidable dmg';
  } else {
    const ratio = o.damage > 0 ? o.damageTaken / o.damage : null;
    damageTaken = ratio == null ? 60 : clamp(0, 100, 100 - ((ratio - 0.35) / (0.9 - 0.35)) * 100);
    damageTakenLabel = 'Damage taken';
  }

  // 5. Interrupts landed (saturate at 15).
  const interrupts = clamp(0, 100, (o.interruptsLanded / 15) * 100);

  const breakdown = [
    { key: 'parse', label: 'Parse (dps)', weight: SCORE_WEIGHTS.parse, value: Math.round(parse) },
    { key: 'depth', label: `Key depth (+${lvl})`, weight: SCORE_WEIGHTS.depth, value: Math.round(depth) },
    { key: 'survival', label: `Survival (${deaths} death${deaths === 1 ? '' : 's'})`, weight: SCORE_WEIGHTS.survival, value: Math.round(survival) },
    { key: 'damageTaken', label: damageTakenLabel, weight: SCORE_WEIGHTS.damageTaken, value: Math.round(damageTaken) },
    { key: 'interrupts', label: `Interrupts (${o.interruptsLanded})`, weight: SCORE_WEIGHTS.interrupts, value: Math.round(interrupts) },
  ].map((p) => ({ ...p, points: Math.round(p.weight * p.value * 10) / 10 }));

  const score = Math.round(breakdown.reduce((s, p) => s + p.weight * p.value, 0));
  return { score, breakdown };
}

/**
 * Recruiting verdict from cheap signals. `targetLevel` is the key level being
 * applied for (e.g. 22); when given, "has a run at targetLevel-1" is the single
 * most important gate (the user's ask). Consistency rewards a tight level spread
 * ("22 21 21 21…" over "22 20 20 20…"); rating proximity uses the raider.io
 * season rating vs the tier a target key implies.
 */
export function scoreFit(perDungeon, { targetLevel = null, rating = null } = {}) {
  const reasons = [];
  const withData = perDungeon.filter((d) => d.maxLevel != null);
  const maxLevels = withData.map((d) => d.maxLevel);
  const overallMax = maxLevels.length ? Math.max(...maxLevels) : null;
  const ref = targetLevel ?? overallMax;

  let score = 0;

  // 1. Done at (target-1)? — most important. Any dungeon timed at ref-1 or above.
  if (ref != null) {
    const hasBelow = withData.some((d) => d.levels.some((l) => l != null && l >= ref - 1));
    const hasAtRef = withData.some((d) => d.maxLevel >= ref);
    if (hasAtRef) { score += 40; reasons.push(`Has run(s) at +${ref} or above`); }
    else if (hasBelow) { score += 25; reasons.push(`Has run(s) at +${ref - 1} (one below target)`); }
    else { reasons.push(`No runs near +${ref}`); }
  }

  // 2. Consistency: how many dungeons are within 1 level of the applicant's peak.
  if (overallMax != null && withData.length) {
    const nearPeak = withData.filter((d) => d.maxLevel >= overallMax - 1).length;
    const frac = nearPeak / withData.length;
    score += Math.round(frac * 35);
    if (frac >= 0.75) reasons.push(`Consistent: ${nearPeak}/${withData.length} dungeons within 1 level of peak (+${overallMax})`);
    else reasons.push(`Spread: only ${nearPeak}/${withData.length} dungeons near peak (+${overallMax})`);
  }

  // 3. WCL parse percentile (average of per-dungeon parse % that exist).
  const pcts = withData.map((d) => d.fieldCompare?.parsePercent).filter((v) => typeof v === 'number');
  if (pcts.length) {
    const avgPct = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
    score += Math.round((avgPct / 100) * 25);
    reasons.push(`Avg WCL parse: p${avgPct}`);
  }

  // 4. Rating note (informational, small nudge).
  if (rating != null) reasons.push(`Season rating ${Math.round(rating)}`);

  const verdict = score >= 70 ? 'fit' : score >= 45 ? 'borderline' : 'no';
  return { verdict, score, reasons, referenceLevel: ref, overallMax };
}

/**
 * Full scan for one character. `dungeons` = [{encounterID, id, name, abbr}] for
 * the season pool (encounterIDs resolved live from the zone). `className`/
 * `specName` are the WCL slugs; `personalDefensives`/`externalDefensives` are
 * [{spellId,name}] for the class.
 */
export async function analyzeApplicant({
  name, serverSlug, serverRegion, zoneID,
  className, specName = null,
  dungeons,
  personalDefensives = [],
  providedExternals = [],
  interruptSpellId = null,
  canDispel = true,
  targetLevel = null,
  rating = null,
  runsPerDungeon = 3,
  refresh = false,
}) {
  const perDungeon = [];
  for (const d of dungeons) {
    if (!d.encounterID) continue;
    let chosen = [];
    try {
      const er = await fetchMyEncounterRuns({ name, serverSlug, serverRegion, encounterID: d.encounterID, specName, refresh });
      chosen = selectRuns(er.runs, runsPerDungeon);
    } catch (err) {
      dumpDebug('applicant-encounter-failed', { dungeon: d.id, error: String(err) });
      perDungeon.push({ dungeon: d, maxLevel: null, levels: [], runs: [], fieldCompare: null });
      continue;
    }

    const runs = [];
    for (const r of chosen) {
      try {
        const detail = await fetchApplicantRun({
          code: r.report.code,
          fightID: r.report.fightID,
          playerName: name,
          server: serverSlug,
          className,
          personalDefensives,
          providedExternals,
          interruptSpellId,
          canDispel,
          avoidable: d.avoidable ?? [],
          refresh,
        });
        runs.push({ ...detail, keyLevel: r.keyLevel ?? detail.keyLevel, rankPercent: r.rankPercent });
      } catch (err) {
        dumpDebug('applicant-run-failed', { dungeon: d.id, code: r.report.code, error: String(err) });
      }
    }

    const maxLevel = chosen[0]?.keyLevel ?? null;
    let fieldCompare = null;
    if (maxLevel != null && specName && runs[0]) {
      try {
        const top = await fetchTopRuns({ encounterID: d.encounterID, zoneID, keyLevel: maxLevel, className, specName, refresh });
        const cmp = comparePercentile(runs[0].overall.dps, top.entries);
        // The headline percentile is the player's REAL WCL parse % for this run
        // (rankPercent — a population-wide bracket rank, the same number the WCL
        // character page shows), NOT "beats the top-100 page" (which reads ~0 for
        // anyone outside the top parses). The #1 ranked parser is the top-player
        // comparison. cmp.* stay for the field median/best reference numbers.
        const best = runs[0];
        const topEntry = top.entries?.[0] ?? null;
        fieldCompare = {
          parsePercent: best.rankPercent != null ? Math.round(best.rankPercent) : (cmp?.percentile ?? null),
          applicantDps: best.overall.dps,
          topName: topEntry?.name ?? null,
          topDps: topEntry?.dps ?? null,
          fieldMedianDps: cmp?.fieldMedianDps ?? null,
          fieldBestDps: cmp?.fieldBestDps ?? null,
          fieldSize: cmp?.fieldSize ?? null,
        };
      } catch (err) {
        dumpDebug('applicant-field-failed', { dungeon: d.id, error: String(err) });
      }
    }

    const entry = { dungeon: d, maxLevel, levels: chosen.map((r) => r.keyLevel), runs, fieldCompare };
    const sc = dungeonScore(entry);
    entry.score = sc.score;
    entry.scoreBreakdown = sc.breakdown;
    perDungeon.push(entry);
  }

  const overall = mergeOverall(perDungeon);
  const scores = perDungeon.map((d) => d.score).filter((v) => typeof v === 'number');
  overall.score = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const fit = scoreFit(perDungeon, { targetLevel, rating });
  return { character: { name, serverSlug, serverRegion }, dungeons: perDungeon, overall, fit };
}
