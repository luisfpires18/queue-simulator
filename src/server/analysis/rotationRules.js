// Rotation review: judge one run against the spec's published rotation.
//
// This is the ONLY module in the analysis engine that carries patch-specific
// rotation knowledge, and it carries none of it itself - every claim comes from a
// rule pack in src/game/rotations/, which stores the source URL and read date
// alongside each rule. Everything else here (compare.js, advice.js, spikes.js) is
// deliberately comparison-only so it survives patches untouched; see the header
// of advice.js. Keeping the two apart is the point: a data diff can say "they
// pressed this more than you", but only a rule pack can say "your disease fell
// off", and only a rule pack can be WRONG about the game.
//
// Three rules this module follows so it never invents an accusation:
//
//   1. Missing data is reported as missing, never as a failure. No Debuffs table
//      means "not measured", not "0% uptime".
//   2. Everything is measured against ENGAGED time (fight minus >5s no-cast
//      gaps, from metrics.js), because seconds spent walking between M+ pulls are
//      not seconds you played badly.
//   3. A marginal miss is downgraded a severity step. Being 1% under a threshold
//      that a human picked off a guide is not a "high" finding.
import { computeRunMetrics, engagedWindows, intersectMs, IGNORED_ABILITIES } from './metrics.js';

/** Relative slack under which a miss counts as marginal and gets downgraded. */
const MARGINAL_RATIO = 0.1;
/** Timeline markers per finding - more than this is a smear, not a signal. */
const MAX_MARKERS = 6;

const SEVERITY_ORDER = ['low', 'medium', 'high'];

/** One step down the severity ladder, floored at 'low'. */
function downgrade(severity) {
  const i = SEVERITY_ORDER.indexOf(severity);
  return i > 0 ? SEVERITY_ORDER[i - 1] : severity;
}

function soften(severity, measured, threshold) {
  if (!threshold) return severity;
  const missRatio = Math.abs(measured - threshold) / threshold;
  return missRatio > MARGINAL_RATIO ? severity : downgrade(severity);
}

const round1 = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10) / 10 : null);
const sec = (ms) => Math.round(ms / 1000);

/**
 * Judge a run against a rule pack.
 *
 * @param detail  a fetchRunDetail() result
 * @param spec    a RotationSpec from src/game/rotations, or null
 * @returns null when there is no pack for the spec (every spec but Unholy DK
 *          today), otherwise { specId, patch, build, sources, findings, skipped }
 */
export function checkRotation(detail, spec) {
  if (!spec || !detail) return null;

  const fight = detail.fight ?? {};
  if (fight.startTime == null || fight.endTime == null) return null;

  const metrics = computeRunMetrics(detail);
  const engaged = engagedWindows(fight, metrics.downtime.allWindows);
  const engagedMs = metrics.engagedMs;
  const nameByGuid = abilityNames(detail);
  const build = detectBuild(detail, spec, nameByGuid);

  const ctx = { detail, fight, metrics, engaged, engagedMs, nameByGuid };

  const findings = [];
  const skipped = [];

  for (const rule of spec.rules) {
    if (rule.build && rule.build !== build.id) continue;
    const result = evaluate(rule, ctx);
    if (!result) continue;
    if (result.skipped) {
      skipped.push({ ruleId: rule.id, title: result.title, reason: result.reason });
    } else {
      findings.push({ ...result, source: spec.sources[rule.sourceIndex] ?? null });
    }
  }

  findings.sort(
    (a, b) => SEVERITY_ORDER.indexOf(b.severity) - SEVERITY_ORDER.indexOf(a.severity) || a.id.localeCompare(b.id)
  );

  return {
    specId: spec.specId,
    specLabel: spec.specLabel,
    patch: spec.patch,
    build,
    sources: spec.sources,
    rulesChecked: spec.rules.filter((r) => !r.build || r.build === build.id).length,
    findings,
    skipped,
  };
}

function evaluate(rule, ctx) {
  switch (rule.kind) {
    case 'aura_uptime':
      return checkAuraUptime(rule, ctx);
    case 'cooldown_drift':
      return checkCooldownDrift(rule, ctx);
    case 'cooldown_alignment':
      return checkCooldownAlignment(rule, ctx);
    case 'opener_sequence':
      return checkOpener(rule, ctx);
    case 'resource_waste':
      return checkResourceWaste(rule, ctx);
    case 'cast_during_buff':
      return checkCastDuringBuff(rule, ctx);
    case 'redundant_cast':
      return checkRedundantCast(rule, ctx);
    case 'proc_waste':
      return checkProcWaste(rule, ctx);
    default:
      return null;
  }
}

/** Merged bands for one aura name, from whichever side of the fight it lives on. */
function auraBands(ctx, name, target = 'self') {
  const table = target === 'enemy' ? ctx.detail.debuffs : ctx.detail.buffs;
  if (!table || !Array.isArray(table.auras) || table.auras.length === 0) return null;
  return mergeBands(table.auras.filter((a) => a.name === name).flatMap((a) => a.bands ?? []));
}

const inAnyBand = (t, bands) => bands.some((b) => t >= b.start && t <= b.end);

// --- rule kinds --------------------------------------------------------------

/**
 * Uptime of a buff (self) or debuff (enemy) as a share of engaged time.
 *
 * The absent-row case is the delicate one. An aura with no row at all can mean
 * either "you never kept it up" or "you aren't talented into it", and the log
 * cannot tell those apart - so it still reports, but softened and with an
 * explicit caveat rather than as a confident accusation.
 *
 * Enemy-side auras come from a table covering EVERY player's debuffs (WCL offers
 * no way to narrow an aura table to one caster - see REPORT_ENEMY_DEBUFF_TABLE),
 * so `target: "enemy"` rules must name an aura only this spec can apply. Uptime
 * there means "at least one enemy had it", which is the right question for a
 * disease you are meant to keep out.
 */
function checkAuraUptime(rule, ctx) {
  const enemySide = rule.target === 'enemy';
  const table = enemySide ? ctx.detail.debuffs : ctx.detail.buffs;
  const title = `${rule.aura} uptime`;

  if (!table || !Array.isArray(table.auras) || table.auras.length === 0) {
    return {
      skipped: true,
      title,
      reason: enemySide
        ? 'No enemy debuff data for this run. Reload the report to pull it.'
        : 'No buff data for this run.',
    };
  }
  if (!ctx.engagedMs) {
    return { skipped: true, title, reason: 'No engaged time could be measured for this run.' };
  }

  const rows = table.auras.filter((a) => a.name === rule.aura);
  const bands = mergeBands(rows.flatMap((r) => r.bands ?? []));
  const measured = round1((100 * intersectMs(bands, ctx.engaged)) / ctx.engagedMs);
  if (measured >= rule.minPct) return null;

  const neverApplied = rows.length === 0;
  const downWindows = subtractBands(ctx.engaged, bands)
    .sort((a, b) => b.end - b.start - (a.end - a.start))
    .slice(0, MAX_MARKERS);
  const longest = downWindows[0];

  const caveat = neverApplied
    ? ' It never went up at all in this run, so if you are not talented into it you can ignore this.'
    : '';

  return {
    id: rule.id,
    ruleKind: rule.kind,
    // An aura with no row at all is ambiguous - untalented and neglected look
    // identical in a log - so it always reports one step down from an aura that
    // demonstrably went up and then fell off.
    severity: neverApplied ? downgrade(rule.severity) : soften(rule.severity, measured, rule.minPct),
    title,
    detail:
      `${rule.aura} was up ${measured}% of your engaged time, against a target of ${rule.minPct}%.` +
      (longest ? ` The longest gap was ${sec(longest.end - longest.start)}s at ${fmtClock(longest.start - ctx.fight.startTime)}.` : '') +
      caveat,
    why: rule.why,
    evidence: { measured, expected: rule.minPct, unit: '% of engaged time' },
    atMs: downWindows.map((w) => w.start - ctx.fight.startTime),
  };
}

/**
 * Engaged time an ability sat off cooldown and unpressed, as a share of engaged
 * time.
 *
 * No pack ships this rule for a dungeon on purpose - measured against a real
 * pair of Pit of Saron runs it ranked the stronger player WORSE, because holding
 * a cooldown for the next pull is correct play in M+ (see the header note in
 * src/game/rotations/deathknight-unholy.ts). It is kept because it is sound on a
 * single-target raid fight, where there is no route to plan around.
 */
function checkCooldownDrift(rule, ctx) {
  const title = `${rule.ability} usage`;
  const times = castTimes(ctx, rule.ability);
  if (!times.length) {
    return { skipped: true, title, reason: `${rule.ability} was never cast in this run.` };
  }
  if (!ctx.engagedMs || !rule.cooldownMs) {
    return { skipped: true, title, reason: 'No engaged time could be measured for this run.' };
  }

  // Windows where it was available and unused: from the pull to the first cast,
  // from each cast + cooldown to the next, and from the last cast + cooldown to
  // the end. Only the engaged slice of each window counts.
  const idleWindows = [{ start: ctx.fight.startTime, end: times[0] }];
  for (let i = 1; i < times.length; i++) {
    const readyAt = times[i - 1] + rule.cooldownMs;
    if (times[i] > readyAt) idleWindows.push({ start: readyAt, end: times[i] });
  }
  const tailReady = times[times.length - 1] + rule.cooldownMs;
  if (ctx.fight.endTime > tailReady) idleWindows.push({ start: tailReady, end: ctx.fight.endTime });

  const engagedIdle = idleWindows
    .map((w) => ({ ...w, ms: intersectMs([{ startTime: w.start, endTime: w.end }], ctx.engaged) }))
    .filter((w) => w.ms > 0);
  const wastedMs = engagedIdle.reduce((acc, w) => acc + w.ms, 0);
  const measured = round1((100 * wastedMs) / ctx.engagedMs);
  if (measured <= rule.maxWastePct) return null;

  const worst = [...engagedIdle].sort((a, b) => b.ms - a.ms).slice(0, MAX_MARKERS);

  return {
    id: rule.id,
    ruleKind: rule.kind,
    severity: soften(rule.severity, measured, rule.maxWastePct),
    title,
    detail:
      `${rule.ability} was available and unpressed for ${sec(wastedMs)}s of your engaged time (${measured}%, ` +
      `target under ${rule.maxWastePct}%) across ${times.length} casts.` +
      (worst[0] ? ` The longest was ${sec(worst[0].ms)}s at ${fmtClock(worst[0].start - ctx.fight.startTime)}.` : ''),
    why: rule.why,
    evidence: { measured, expected: rule.maxWastePct, unit: '% of engaged time wasted' },
    atMs: worst.map((w) => w.start - ctx.fight.startTime),
  };
}

/** Share of `a` casts with no `b` cast within `withinMs` either side. */
function checkCooldownAlignment(rule, ctx) {
  const title = `${rule.a} with ${rule.b}`;
  const aTimes = castTimes(ctx, rule.a);
  const bTimes = castTimes(ctx, rule.b);
  if (!aTimes.length) {
    return { skipped: true, title, reason: `${rule.a} was never cast in this run.` };
  }
  if (!bTimes.length) {
    return { skipped: true, title, reason: `${rule.b} was never cast in this run, so there is nothing to pair against.` };
  }

  const unpaired = aTimes.filter((t) => !bTimes.some((u) => Math.abs(u - t) <= rule.withinMs));
  const measured = round1((100 * unpaired.length) / aTimes.length);
  if (measured <= rule.maxUnpairedPct) return null;

  return {
    id: rule.id,
    ruleKind: rule.kind,
    severity: soften(rule.severity, measured, rule.maxUnpairedPct),
    title,
    detail:
      `${unpaired.length} of your ${aTimes.length} ${rule.a} casts had no ${rule.b} within ${sec(rule.withinMs)}s ` +
      `(${measured}%, target under ${rule.maxUnpairedPct}%). Unpaired at ${unpaired
        .slice(0, MAX_MARKERS)
        .map((t) => fmtClock(t - ctx.fight.startTime))
        .join(', ')}.`,
    why: rule.why,
    evidence: { measured, expected: rule.maxUnpairedPct, unit: '% of casts unpaired' },
    atMs: unpaired.slice(0, MAX_MARKERS).map((t) => t - ctx.fight.startTime),
  };
}

/**
 * Expected abilities present within `graceMs` of the FIRST cast (not the pull -
 * a dungeon timer starts before you reach anything).
 *
 * Presence only, never order: real openers legitimately shuffle around pull
 * timing, but a cooldown absent from the opener entirely is burst you never get.
 */
function checkOpener(rule, ctx) {
  const title = 'Opener';
  const events = (ctx.detail.castEvents ?? []).filter((e) => {
    const name = ctx.nameByGuid.get(e.abilityGameID);
    return name && !IGNORED_ABILITIES.has(name);
  });
  if (!events.length) {
    return { skipped: true, title, reason: 'No cast events for this run.' };
  }

  const firstCast = events[0].timestamp;
  const deadline = firstCast + rule.graceMs;
  const present = new Set(
    events.filter((e) => e.timestamp <= deadline).map((e) => ctx.nameByGuid.get(e.abilityGameID))
  );
  const missing = rule.expected.filter((n) => !present.has(n));
  if (!missing.length) return null;

  // Every expected ability missing usually means the pack's names are stale
  // rather than that the player opened with nothing at all - say so instead of
  // accusing them of it.
  const allMissing = missing.length === rule.expected.length;

  return {
    id: rule.id,
    ruleKind: rule.kind,
    severity: allMissing ? 'low' : rule.severity,
    title,
    detail:
      `${missing.join(', ')} ${missing.length === 1 ? 'was' : 'were'} missing from your first ` +
      `${sec(rule.graceMs)}s of casting (from ${fmtClock(firstCast - ctx.fight.startTime)}).` +
      (allMissing ? ' None of the expected opener abilities appeared, which more likely means this rule pack is out of date than that you opened with nothing.' : ''),
    why: rule.why,
    evidence: { measured: rule.expected.length - missing.length, expected: rule.expected.length, unit: 'opener abilities used' },
    atMs: [firstCast - ctx.fight.startTime],
  };
}

/** Overcap waste on the spec's primary resource, from WCL's own `waste` field. */
function checkResourceWaste(rule, ctx) {
  const title = `${rule.resource} overcap`;
  const res = ctx.metrics.resource;
  if (!res || !res.known || !res.events) {
    return { skipped: true, title, reason: 'No resource data for this run.' };
  }
  if (res.name !== rule.resource) {
    return {
      skipped: true,
      title,
      reason: `This run's main resource reads as ${res.name}, not ${rule.resource}.`,
    };
  }
  const measured = round1(res.wastePct);
  if (measured == null || measured <= rule.maxWastePct) return null;

  return {
    id: rule.id,
    ruleKind: rule.kind,
    severity: soften(rule.severity, measured, rule.maxWastePct),
    title,
    detail:
      `You overcapped ${measured}% of the ${rule.resource} you generated (target under ${rule.maxWastePct}%) - ` +
      `${Math.round(res.waste)} of ${Math.round(res.gain + res.waste)} wasted.`,
    why: rule.why,
    evidence: { measured, expected: rule.maxWastePct, unit: '% of generation wasted' },
    atMs: [],
  };
}

/** Share of an ability's casts that landed inside a buff window. */
function checkCastDuringBuff(rule, ctx) {
  const title = `${rule.ability} during ${rule.buff}`;
  const times = castTimes(ctx, rule.ability);
  if (times.length < (rule.minCasts ?? 1)) {
    return {
      skipped: true,
      title,
      reason: times.length
        ? `Only ${times.length} ${rule.ability} cast${times.length === 1 ? '' : 's'} in this run - too few to read as a habit.`
        : `${rule.ability} was never cast in this run.`,
    };
  }
  const bands = auraBands(ctx, rule.buff, 'self');
  if (!bands) return { skipped: true, title, reason: 'No buff data for this run.' };
  if (!bands.length) {
    return { skipped: true, title, reason: `${rule.buff} never went up in this run, so there is no window to land inside.` };
  }

  const outside = times.filter((t) => !inAnyBand(t, bands));
  const measured = round1((100 * (times.length - outside.length)) / times.length);
  if (measured >= rule.minPct) return null;

  return {
    id: rule.id,
    ruleKind: rule.kind,
    severity: soften(rule.severity, measured, rule.minPct),
    title,
    detail:
      `${times.length - outside.length} of your ${times.length} ${rule.ability} casts landed inside a ${rule.buff} ` +
      `window (${measured}%, target at least ${rule.minPct}%). Outside it at ${outside
        .slice(0, MAX_MARKERS)
        .map((t) => fmtClock(t - ctx.fight.startTime))
        .join(', ')}.`,
    why: rule.why,
    evidence: { measured, expected: rule.minPct, unit: '% of casts in window' },
    atMs: outside.slice(0, MAX_MARKERS).map((t) => t - ctx.fight.startTime),
  };
}

/** Presses made while what they apply was already up - pure wasted globals. */
function checkRedundantCast(rule, ctx) {
  const title = `Wasted ${rule.ability} casts`;
  const times = castTimes(ctx, rule.ability);
  if (times.length < (rule.minCasts ?? 1)) {
    return {
      skipped: true,
      title,
      reason: times.length ? `Only ${times.length} ${rule.ability} cast(s) in this run.` : `${rule.ability} was never cast in this run.`,
    };
  }

  // Every named aura must be readable, or "already up" can't be decided.
  const bandSets = [];
  for (const name of rule.whileAnyUp) {
    const bands = auraBands(ctx, name, rule.target);
    if (!bands) {
      return {
        skipped: true,
        title,
        reason: rule.target === 'enemy' ? 'No enemy debuff data for this run. Reload the report to pull it.' : 'No buff data for this run.',
      };
    }
    bandSets.push({ name, bands });
  }

  // Redundant only when EVERY named aura was already up: with one missing, the
  // cast is the reapplication the rotation asks for.
  const redundant = times.filter((t) => bandSets.every((s) => inAnyBand(t, s.bands)));
  const measured = round1((100 * redundant.length) / times.length);
  if (measured <= rule.maxPct) return null;

  return {
    id: rule.id,
    ruleKind: rule.kind,
    severity: soften(rule.severity, measured, rule.maxPct),
    title,
    detail:
      `${redundant.length} of your ${times.length} ${rule.ability} casts went out while ${rule.whileAnyUp.join(' and ')} ` +
      `${rule.whileAnyUp.length === 1 ? 'was' : 'were'} already up (${measured}%, target under ${rule.maxPct}%), so they refreshed ` +
      `nothing that needed refreshing. At ${redundant
        .slice(0, MAX_MARKERS)
        .map((t) => fmtClock(t - ctx.fight.startTime))
        .join(', ')}.`,
    why: rule.why,
    evidence: { measured, expected: rule.maxPct, unit: '% of casts redundant' },
    atMs: redundant.slice(0, MAX_MARKERS).map((t) => t - ctx.fight.startTime),
  };
}

/** Proc windows that closed with nothing spending them. */
function checkProcWaste(rule, ctx) {
  const title = `${rule.buff} procs`;
  const bands = auraBands(ctx, rule.buff, 'self');
  if (!bands) return { skipped: true, title, reason: 'No buff data for this run.' };
  if (bands.length < (rule.minWindows ?? 1)) {
    return { skipped: true, title, reason: `Only ${bands.length} ${rule.buff} window(s) in this run.` };
  }

  const spenders = rule.consumedBy.flatMap((a) => castTimes(ctx, a)).sort((a, b) => a - b);
  const wasted = bands.filter((b) => !spenders.some((t) => t >= b.start && t <= b.end));
  const measured = round1((100 * wasted.length) / bands.length);
  if (measured <= rule.maxPct) return null;

  return {
    id: rule.id,
    ruleKind: rule.kind,
    severity: soften(rule.severity, measured, rule.maxPct),
    title,
    detail:
      `${wasted.length} of your ${bands.length} ${rule.buff} windows expired without a ` +
      `${rule.consumedBy.join(' or ')} inside them (${measured}%, target under ${rule.maxPct}%). ` +
      `Wasted at ${wasted
        .slice(0, MAX_MARKERS)
        .map((b) => fmtClock(b.start - ctx.fight.startTime))
        .join(', ')}.`,
    why: rule.why,
    evidence: { measured, expected: rule.maxPct, unit: '% of procs unspent' },
    atMs: wasted.slice(0, MAX_MARKERS).map((b) => b.start - ctx.fight.startTime),
  };
}

// --- helpers -----------------------------------------------------------------

function abilityNames(detail) {
  const m = new Map();
  for (const a of detail.casts?.abilities ?? []) m.set(a.guid, a.name);
  return m;
}

/**
 * Which hero-talent build this run played, from what it cast or gained. WCL's
 * talent payload is an undecoded loadout blob, but the abilities and auras a
 * build grants are right there in the tables.
 */
export function detectBuild(detail, spec, nameByGuid = null) {
  const names = nameByGuid ?? abilityNames(detail);
  const castNames = new Set(names.values());
  const buffNames = new Set((detail.buffs?.auras ?? []).map((a) => a.name));

  for (const build of spec.builds ?? []) {
    const byCast = (build.detect?.anyCast ?? []).some((n) => castNames.has(n));
    const byBuff = (build.detect?.anyBuff ?? []).some((n) => buffNames.has(n));
    if (byCast || byBuff) return { id: build.id, label: build.label, detected: true };
  }
  const fallback = (spec.builds ?? []).find((b) => b.id === spec.defaultBuild);
  return { id: spec.defaultBuild, label: fallback?.label ?? spec.defaultBuild, detected: false };
}

/** Absolute cast timestamps for one ability name, ascending. */
function castTimes(ctx, ability) {
  return (ctx.detail.castEvents ?? [])
    .filter((e) => ctx.nameByGuid.get(e.abilityGameID) === ability)
    .map((e) => e.timestamp)
    .sort((a, b) => a - b);
}

/**
 * Union of aura bands into sorted non-overlapping windows. Duplicate aura rows
 * with the same name are real in WCL payloads (two "Lesser Ghoul" rows appear in
 * the Pit of Saron fixture), and for "was it up" the answer is the union.
 */
function mergeBands(bands) {
  const sorted = bands
    .filter((b) => b && typeof b.startTime === 'number' && typeof b.endTime === 'number' && b.endTime > b.startTime)
    .map((b) => ({ start: b.startTime, end: b.endTime }))
    .sort((a, b) => a.start - b.start);
  const out = [];
  for (const b of sorted) {
    const last = out[out.length - 1];
    if (last && b.start <= last.end) last.end = Math.max(last.end, b.end);
    else out.push({ ...b });
  }
  // intersectMs takes the WCL band shape, so hand back both spellings
  return out.map((w) => ({ start: w.start, end: w.end, startTime: w.start, endTime: w.end }));
}

/** `windows` minus `bands` (both sorted, non-overlapping) -> the gaps. */
function subtractBands(windows, bands) {
  const out = [];
  for (const w of windows) {
    let cursor = w.start;
    for (const b of bands) {
      if (b.end <= cursor) continue;
      if (b.start >= w.end) break;
      if (b.start > cursor) out.push({ start: cursor, end: Math.min(b.start, w.end) });
      cursor = Math.max(cursor, b.end);
      if (cursor >= w.end) break;
    }
    if (cursor < w.end) out.push({ start: cursor, end: w.end });
  }
  return out;
}

/** Fight-relative ms -> m:ss, matching how the timeline reads. */
function fmtClock(relMs) {
  const total = Math.max(0, Math.round(relMs / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
