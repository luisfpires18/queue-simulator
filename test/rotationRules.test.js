import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkRotation, detectBuild } from '../src/server/analysis/rotationRules.js';
import { buildReport } from '../src/server/analysis/compare.js';
import { DEATHKNIGHT_UNHOLY } from '../src/game/rotations/deathknight-unholy.ts';
import { rotationSpecFor, specIdFromWcl } from '../src/game/rotations/index.ts';
import { REPORT_ENEMY_DEBUFF_TABLE } from '../src/server/wcl/queries.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundle = JSON.parse(
  readFileSync(path.join(ROOT, 'fixtures', 'comparison-10658-plus0.json'), 'utf8')
);

const MINE = bundle.mine.detail;
const OTHER = bundle.other.detail;

test('specIdFromWcl bridges WCL class/spec strings to a pack id', () => {
  assert.equal(specIdFromWcl('DeathKnight', 'Unholy'), 'deathknight:unholy');
  assert.equal(specIdFromWcl(null, 'Unholy'), null);
  assert.ok(rotationSpecFor(specIdFromWcl('DeathKnight', 'Unholy')));
  // no pack yet — must be null, not a throw, so every other spec's report is intact
  assert.equal(rotationSpecFor('mage:fire'), null);
  assert.equal(rotationSpecFor(undefined), null);
});

test('checkRotation returns null rather than throwing when there is no pack or no fight', () => {
  assert.equal(checkRotation(MINE, null), null);
  assert.equal(checkRotation(null, DEATHKNIGHT_UNHOLY), null);
  assert.equal(checkRotation({ fight: {} }, DEATHKNIGHT_UNHOLY), null);
});

test('build detection reads the hero talent off the real run', () => {
  // The fixture player casts Death Charge and holds Mograine's Might / Pact of
  // the Apocalypse — Riders, and detected rather than defaulted.
  const build = detectBuild(MINE, DEATHKNIGHT_UNHOLY);
  assert.equal(build.id, 'riders');
  assert.equal(build.detected, true);

  const sanlayn = detectBuild(
    { casts: { abilities: [{ guid: 1, name: 'Vampiric Strike' }] }, buffs: { auras: [] } },
    DEATHKNIGHT_UNHOLY
  );
  assert.equal(sanlayn.id, 'sanlayn');

  // nothing recognisable -> the default build, flagged as not detected
  const unknown = detectBuild({ casts: { abilities: [] }, buffs: { auras: [] } }, DEATHKNIGHT_UNHOLY);
  assert.equal(unknown.id, DEATHKNIGHT_UNHOLY.defaultBuild);
  assert.equal(unknown.detected, false);
});

test('a real run produces a well-formed review with sourced findings', () => {
  const review = checkRotation(MINE, DEATHKNIGHT_UNHOLY);
  assert.ok(review);
  assert.equal(review.specId, 'deathknight:unholy');
  assert.equal(review.patch, '12.0.7');
  assert.ok(review.rulesChecked > 0);

  const fightMs = MINE.fight.endTime - MINE.fight.startTime;
  for (const f of review.findings) {
    assert.ok(f.id && f.ruleKind && f.title, 'finding is labelled');
    assert.ok(['high', 'medium', 'low'].includes(f.severity), `severity ${f.severity}`);
    assert.ok(f.why && f.why.length > 20, 'every finding carries the guide justification');
    assert.ok(f.source && f.source.url, 'every finding is traceable to a source URL');
    assert.ok(f.detail && !f.detail.includes('undefined'), `detail reads cleanly: ${f.detail}`);
    assert.ok(!f.detail.includes('—'), 'no em dash in user-visible text');
    for (const at of f.atMs) {
      assert.ok(at >= 0 && at <= fightMs, `marker ${at} inside [0, ${fightMs}]`);
    }
  }
  // findings are ordered most severe first
  const ranks = review.findings.map((f) => ['low', 'medium', 'high'].indexOf(f.severity));
  assert.deepEqual(ranks, [...ranks].sort((a, b) => b - a));
});

test('the enemy debuff query asks the enemy side and never filters by sourceID', () => {
  // Regression guard. The first version of this used the generic
  // table(dataType: Debuffs, sourceID: <player>), which returns the debuffs
  // sitting ON the player - Exhaustion, Mana Bomb, boss mechanics, zero diseases
  // - so both plague rules reported "never went up at all" against a run whose
  // real Virulent Plague uptime was 98.2%. Verified live: hostilityType: Enemies
  // is what moves the view to the enemy side, and adding sourceID back returns 0
  // auras because there it means the enemy actor.
  assert.match(REPORT_ENEMY_DEBUFF_TABLE, /dataType:\s*Debuffs/);
  assert.match(REPORT_ENEMY_DEBUFF_TABLE, /hostilityType:\s*Enemies/);
  assert.ok(!/sourceID/.test(REPORT_ENEMY_DEBUFF_TABLE), 'sourceID would empty the table');
});

test('missing debuff data is reported as not measured, never as a dropped disease', () => {
  // The fixture predates the Debuffs fetch, so it has no `debuffs` key at all —
  // exactly the case that must not turn into a "0% uptime" accusation.
  assert.equal(MINE.debuffs, undefined);
  const review = checkRotation(MINE, DEATHKNIGHT_UNHOLY);

  for (const id of ['virulent-plague-uptime', 'dread-plague-uptime']) {
    assert.ok(
      !review.findings.some((f) => f.id === id),
      `${id} must not produce a finding without debuff data`
    );
    const s = review.skipped.find((x) => x.ruleId === id);
    assert.ok(s, `${id} is reported as skipped`);
    assert.match(s.reason, /debuff data/i);
  }
});

test('enemy-side uptime IS measured once debuff bands exist', () => {
  const fight = MINE.fight;
  const span = fight.endTime - fight.startTime;
  // A disease up for only the first fifth of the fight must fail an 85% rule.
  const withDebuffs = {
    ...MINE,
    debuffs: {
      totalTimeMs: span,
      auras: [
        {
          name: 'Virulent Plague',
          guid: 191587,
          uptimeMs: Math.round(span / 5),
          uses: 1,
          bands: [{ startTime: fight.startTime, endTime: fight.startTime + Math.round(span / 5) }],
        },
      ],
    },
  };
  const review = checkRotation(withDebuffs, DEATHKNIGHT_UNHOLY);
  const finding = review.findings.find((f) => f.id === 'virulent-plague-uptime');
  assert.ok(finding, 'a genuinely dropped disease is caught');
  assert.equal(finding.severity, 'high');
  assert.ok(finding.evidence.measured < 95);
  assert.equal(finding.evidence.expected, 95);
  assert.ok(finding.atMs.length > 0, 'the gaps are marked on the timeline');

  // ...and a disease held all fight produces no finding at all
  const held = {
    ...MINE,
    debuffs: {
      totalTimeMs: span,
      auras: [
        { name: 'Virulent Plague', guid: 191587, uptimeMs: span, uses: 1, bands: [{ startTime: fight.startTime, endTime: fight.endTime }] },
        { name: 'Dread Plague', guid: 1, uptimeMs: span, uses: 1, bands: [{ startTime: fight.startTime, endTime: fight.endTime }] },
      ],
    },
  };
  const clean = checkRotation(held, DEATHKNIGHT_UNHOLY);
  assert.ok(!clean.findings.some((f) => f.ruleKind === 'aura_uptime' && f.id.includes('plague')));
});

test('real enemy-debuff bands from a live log pass the plague rules', () => {
  // Values copied from an actual Algeth'ar Academy pull (report mrHXM9JczyVvhaZW
  // fight 1, hostilityType: Enemies), which is what the screenshot that exposed
  // the bug was showing. Both plagues were at 98.2%, so neither may produce a
  // finding. Bands are absolute report timestamps, same basis as the Buffs table.
  const startTime = 8557688;
  const endTime = 10406055;
  // Dense casts so there are no >5s idle gaps: engaged time is the whole pull.
  const castEvents = [];
  for (let t = startTime; t < endTime; t += 2000) castEvents.push({ timestamp: t, abilityGameID: 55090, targetID: null });

  const detail = {
    fight: { startTime, endTime, name: "Algeth'ar Academy", keystoneLevel: 12, kill: true },
    player: { id: 4, name: 'Unreally', class: 'DeathKnight' },
    casts: { totalTimeMs: endTime - startTime, totalCasts: castEvents.length, abilities: [{ guid: 55090, name: 'Scourge Strike', casts: castEvents.length }] },
    buffs: { totalTimeMs: endTime - startTime, auras: [] },
    debuffs: {
      totalTimeMs: endTime - startTime,
      auras: [
        { name: 'Virulent Plague', guid: 191587, uptimeMs: 1815794, uses: 244, bands: [{ startTime: 8590261, endTime: 10406055 }] },
        {
          name: 'Dread Plague',
          guid: 1240996,
          uptimeMs: 1815784,
          uses: 39,
          bands: [
            { startTime: 8590261, endTime: 8671527 },
            { startTime: 8671530, endTime: 8913558 },
            { startTime: 8913565, endTime: 10406055 },
          ],
        },
      ],
    },
    castEvents,
    resourceEvents: [],
  };

  const review = checkRotation(detail, DEATHKNIGHT_UNHOLY);
  const plagues = review.findings.filter((f) => f.ruleKind === 'aura_uptime' && f.id.includes('plague'));
  assert.deepEqual(plagues, [], `98.2% uptime must not be flagged: ${plagues.map((f) => f.detail).join(' | ')}`);
  // and they are genuinely measured now, not silently skipped
  assert.ok(!review.skipped.some((s) => s.ruleId.includes('plague')));
});

test('an aura that never went up is downgraded and caveated, not asserted as neglect', () => {
  // Untalented and neglected are indistinguishable in a log, so the finding has
  // to hedge. Debuff table present but with no Virulent Plague row at all.
  const fight = MINE.fight;
  const noPlague = {
    ...MINE,
    debuffs: {
      totalTimeMs: fight.endTime - fight.startTime,
      auras: [{ name: 'Frost Fever', guid: 55095, uptimeMs: 1000, uses: 1, bands: [{ startTime: fight.startTime, endTime: fight.startTime + 1000 }] }],
    },
  };
  const finding = checkRotation(noPlague, DEATHKNIGHT_UNHOLY).findings.find(
    (f) => f.id === 'virulent-plague-uptime'
  );
  assert.ok(finding);
  assert.equal(finding.severity, 'medium', 'a "high" rule drops to medium when the aura never appeared');
  assert.match(finding.detail, /never went up at all/);
  assert.match(finding.detail, /not talented into it/);
});

test('the alignment rule separates the two real runs - it is the pack\'s load-bearing check', () => {
  // Measured: the player leaves 6 of 16 Army of the Dead casts without a Dark
  // Transformation; the stronger comparison run pairs 14 of 14. If this ever
  // stops holding, the rule (or the name strings) broke.
  const mine = checkRotation(MINE, DEATHKNIGHT_UNHOLY);
  const theirs = checkRotation(OTHER, DEATHKNIGHT_UNHOLY);

  const mineHit = mine.findings.find((f) => f.id === 'army-with-dark-transformation');
  assert.ok(mineHit, 'the weaker run trips the alignment rule');
  assert.equal(mineHit.severity, 'high');
  assert.ok(mineHit.evidence.measured > 15);

  assert.ok(
    !theirs.findings.some((f) => f.id === 'army-with-dark-transformation'),
    'the top parse must NOT trip it'
  );
});

test('cast_during_buff measures presses landing inside a window', () => {
  // 12 Putrefy casts (over the rule's minCasts of 10), only 3 inside the single
  // Dark Transformation window -> 25%, well under the 72% target.
  const start = 1_000_000;
  const inside = [105_000, 115_000, 125_000];
  const outside = [200_000, 240_000, 280_000, 320_000, 360_000, 400_000, 440_000, 480_000, 520_000];
  const detail = {
    fight: { startTime: start, endTime: start + 600_000 },
    casts: { totalTimeMs: 600_000, totalCasts: 12, abilities: [{ guid: 1247378, name: 'Putrefy', casts: 12 }] },
    buffs: { totalTimeMs: 600_000, auras: [{ name: 'Dark Transformation', guid: 1233448, uptimeMs: 30_000, uses: 1, bands: [{ startTime: start + 100_000, endTime: start + 130_000 }] }] },
    castEvents: [...inside, ...outside].sort((a, b) => a - b).map((o) => ({ timestamp: start + o, abilityGameID: 1247378, targetID: null })),
    resourceEvents: [],
  };
  const f = checkRotation(detail, DEATHKNIGHT_UNHOLY).findings.find((x) => x.id === 'putrefy-in-dark-transformation');
  assert.ok(f, 'a run spending Putrefy outside the burst window is flagged');
  assert.equal(f.evidence.measured, 25);
  assert.equal(f.severity, 'high');
  assert.ok(f.atMs.length > 0 && f.atMs.length <= outside.length, 'casts outside the window are marked');

  // Too few casts to read as a habit -> skipped, not flagged.
  const thin = { ...detail, castEvents: detail.castEvents.slice(0, 4), casts: { ...detail.casts, abilities: [{ guid: 1247378, name: 'Putrefy', casts: 4 }] } };
  const thinReview = checkRotation(thin, DEATHKNIGHT_UNHOLY);
  assert.ok(!thinReview.findings.some((x) => x.id === 'putrefy-in-dark-transformation'));
  assert.ok(thinReview.skipped.some((s) => s.ruleId === 'putrefy-in-dark-transformation'));
});

test('redundant_cast only counts presses where EVERY named aura was already up', () => {
  const start = 2_000_000;
  const band = (from, to) => ({ startTime: start + from, endTime: start + to });
  // 10 Outbreaks: the first lands while only Virulent Plague is up (a real
  // reapplication of Dread Plague), the other 9 while both are up.
  const detail = {
    fight: { startTime: start, endTime: start + 600_000 },
    casts: { totalTimeMs: 600_000, totalCasts: 10, abilities: [{ guid: 77575, name: 'Outbreak', casts: 10 }] },
    buffs: { totalTimeMs: 600_000, auras: [] },
    debuffs: {
      totalTimeMs: 600_000,
      auras: [
        { name: 'Virulent Plague', guid: 191587, uptimeMs: 600_000, uses: 1, bands: [band(0, 600_000)] },
        { name: 'Dread Plague', guid: 1240996, uptimeMs: 500_000, uses: 1, bands: [band(100_000, 600_000)] },
      ],
    },
    castEvents: [10_000, 150_000, 200_000, 250_000, 300_000, 350_000, 400_000, 450_000, 500_000, 550_000].map((o) => ({ timestamp: start + o, abilityGameID: 77575, targetID: null })),
    resourceEvents: [],
  };
  const f = checkRotation(detail, DEATHKNIGHT_UNHOLY).findings.find((x) => x.id === 'outbreak-while-diseases-up');
  assert.ok(f);
  assert.equal(f.evidence.measured, 90, 'the cast made while Dread Plague was down is not counted as wasted');
});

test('proc_waste counts only windows with no spender inside them', () => {
  const start = 3_000_000;
  // 25 Sudden Doom windows, 5 of them with no spender -> 20%, over the 8% cap.
  const auras = [];
  const castEvents = [];
  for (let i = 0; i < 25; i++) {
    const from = start + i * 20_000;
    auras.push({ startTime: from, endTime: from + 5_000 });
    if (i % 5 !== 0) castEvents.push({ timestamp: from + 1_000, abilityGameID: 47541, targetID: null });
  }
  const detail = {
    fight: { startTime: start, endTime: start + 600_000 },
    casts: { totalTimeMs: 600_000, totalCasts: castEvents.length, abilities: [{ guid: 47541, name: 'Death Coil', casts: castEvents.length }] },
    buffs: { totalTimeMs: 600_000, auras: [{ name: 'Sudden Doom', guid: 81340, uptimeMs: 125_000, uses: 25, bands: auras }] },
    castEvents,
    resourceEvents: [],
  };
  const f = checkRotation(detail, DEATHKNIGHT_UNHOLY).findings.find((x) => x.id === 'sudden-doom-unspent');
  assert.ok(f);
  assert.equal(f.evidence.measured, 20);
});

test('the top parse trips no high-severity rule - the acceptance test for the whole pack', () => {
  const theirs = checkRotation(OTHER, DEATHKNIGHT_UNHOLY);
  const high = theirs.findings.filter((f) => f.severity === 'high');
  assert.deepEqual(
    high.map((f) => f.id),
    [],
    `a 273k-dps run should not be scolded: ${high.map((f) => f.detail).join(' | ')}`
  );
});

test('ability names in the pack match the log, so rules measure something', () => {
  // A typo in a pack name measures nothing and fails silently, so assert the
  // names the rules depend on actually exist in the real run.
  const castNames = new Set(MINE.casts.abilities.map((a) => a.name));
  const buffNames = new Set(MINE.buffs.auras.map((a) => a.name));
  for (const name of ['Army of the Dead', 'Dark Transformation', 'Festering Strike']) {
    assert.ok(castNames.has(name), `${name} is a real cast name`);
  }
  for (const name of ['Icy Talons', 'Festering Scythe']) {
    assert.ok(buffNames.has(name), `${name} is a real aura name`);
  }
});

test('unmeasurable rules skip cleanly on a stripped-down run', () => {
  const bare = { fight: MINE.fight, casts: { abilities: [] }, buffs: { auras: [] }, castEvents: [], resourceEvents: [] };
  const review = checkRotation(bare, DEATHKNIGHT_UNHOLY);
  assert.ok(review);
  assert.equal(review.findings.length, 0, 'no data means no accusations');
  assert.ok(review.skipped.length > 0);
  for (const s of review.skipped) assert.ok(s.reason && s.title);
});

test('buildReport exposes rotationReview alongside the existing sections', () => {
  const report = buildReport(bundle);
  assert.ok(report.rotationReview, 'the M+ report carries a rotation review for Unholy DK');
  assert.equal(report.rotationReview.specId, 'deathknight:unholy');
  assert.equal(report.rotationReview.build.id, 'riders');
  // the rest of the report is untouched
  assert.ok(report.timeline && report.gaps && report.abilities);
});
