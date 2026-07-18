import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeRunMetrics, median } from '../src/server/analysis/metrics.js';
import { buildReport } from '../src/server/analysis/compare.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundle = JSON.parse(readFileSync(path.join(ROOT, 'fixtures', 'comparison-10658-plus0.json'), 'utf8'));

test('computeRunMetrics on my real Pit run', () => {
  const m = computeRunMetrics(bundle.mine.detail);
  assert.ok(m.totalCPM > 20 && m.totalCPM < 80, `CPM plausible, got ${m.totalCPM}`);
  assert.equal(m.deaths.length, 0);
  assert.ok(m.downtime.idlePct > 0 && m.downtime.idlePct < 50);
  assert.ok(m.downtime.windows.length > 0);
  assert.ok(m.abilities.get('Death Coil').casts > 0);
  for (const [, aura] of m.auras) {
    assert.ok(aura.uptimePct >= 0 && aura.uptimePct <= 100.5);
  }
});

test('median', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([]), null);
  assert.equal(median([1, null, 3, undefined]), 2);
});

// The report is 1:1 now. There is no cohort and no median — the whole
// "median across 5-7 players" apparatus is gone, along with the six extra run
// fetches it cost and the mislabelling it caused (picking a player from the
// dropdown silently turned every "cohort median" into that one player's number).
test('buildReport compares against exactly one opponent', () => {
  const report = buildReport(bundle);
  assert.equal(report.headline.title, 'Pit of Saron');
  assert.equal(report.headline.otherLabel, bundle.other.meta.name);
  assert.ok(report.headline.myDps > 0 && report.headline.theirDps > 0);
});

test('buildReport produces ranked gaps with advice', () => {
  const report = buildReport(bundle);
  // On this fixture the two biggest per-ability differences (Graveyard, Scourge
  // Strike) are also the top two names in the cpm gap's own behind list, so the
  // ability<->cpm dedup correctly folds them into one bullet instead of three —
  // fewer gaps here is the fix working, not a regression.
  assert.ok(report.gaps.length >= 2);
  for (let i = 1; i < report.gaps.length; i++) {
    assert.ok(report.gaps[i - 1].severity >= report.gaps[i].severity, 'sorted by severity');
  }
  for (const g of report.gaps) assert.ok(g.advice.length > 20, `advice for ${g.title}`);
});

test('every gap carries a valid confidence level and a reason', () => {
  const report = buildReport(bundle);
  for (const g of report.gaps) {
    assert.ok(g.confidence, `gap ${g.title} has a confidence field`);
    assert.ok(['High', 'Medium', 'Low'].includes(g.confidence.level));
    assert.ok(g.confidence.reason.length > 0);
  }
});

// engagedMs <= activeMs always, so the same cast count spread over the smaller
// denominator can never produce a LOWER rate.
test('engagedCPM is never lower than totalCPM', () => {
  for (const file of ['comparison-10658-plus0.json', 'comparison-112526-plus0.json', 'comparison-12811-plus0.json']) {
    const b = JSON.parse(readFileSync(path.join(ROOT, 'fixtures', file), 'utf8'));
    for (const detail of [b.mine.detail, b.other.detail]) {
      const m = computeRunMetrics(detail);
      assert.ok(m.engagedCPM >= m.totalCPM, `${file}: engagedCPM ${m.engagedCPM} >= totalCPM ${m.totalCPM}`);
    }
  }
});

test('the cpm gap behind list uses rate fields, not raw cast counts', () => {
  const report = buildReport(bundle);
  const cpmGap = report.gaps.find((g) => g.category === 'cpm');
  if (!cpmGap?.behind?.length) return; // no cpm gap on this fixture — nothing to assert
  for (const b of cpmGap.behind) {
    assert.equal(typeof b.myCpm, 'number');
    assert.equal(typeof b.theirCpm, 'number');
    assert.equal(typeof b.cpmBehindBy, 'number');
    assert.equal(b.mine, undefined);
    assert.equal(b.them, undefined);
    assert.equal(b.behindBy, undefined);
  }
});

test('an ability gap never duplicates a name already in the cpm gap behind list', () => {
  const report = buildReport(bundle);
  const cpmGap = report.gaps.find((g) => g.category === 'cpm');
  const behindNames = new Set((cpmGap?.behind ?? []).map((b) => b.name));
  const abilityGapNames = report.gaps.filter((g) => g.category === 'ability').map((g) => g.name);
  for (const name of abilityGapNames) {
    assert.ok(!behindNames.has(name), `${name} should not appear as both a cpm-behind entry and a standalone ability gap`);
  }
});

// A buff a groupmate applied is not a rotation mistake. Flagging one as a "gap"
// sends the player hunting for a habit that never existed — those belong in the
// consumables/party-buffs section instead.
test('a groupmate-applied buff is never ranked as an actionable gap', () => {
  const report = buildReport(bundle);
  const gapNames = report.gaps.map((g) => g.title);
  for (const external of ['Mark of the Wild uptime', 'Ebon Might uptime', 'Prescience uptime']) {
    assert.ok(!gapNames.some((t) => t.startsWith(external.split(' uptime')[0])), `${external} is someone else's buff`);
  }
  // …and it shows up where it belongs
  assert.ok(report.consumables.partyBuffs.mine.length >= 1);
});

test('the picker carries top players and similar parses', () => {
  const report = buildReport(bundle);
  assert.ok(report.compare.top.length >= 1);
  assert.ok(report.compare.selected);
  assert.equal(report.compare.selected, bundle.other.meta.name);
});

test('the resource panel is 1:1 and names the real resource, read off the log', () => {
  const report = buildReport(bundle);
  const r = report.resources;
  assert.equal(r.name, 'Runic Power'); // derived, not hardcoded per class
  assert.ok(r.mine.wastePct >= 0);
  assert.ok(r.mine.waste >= 0 && r.mine.gain >= 0);
  assert.ok(r.them, 'the opponent ran the same resource, so it is comparable');
});

// One per-ability table, casts AND damage, against the one opponent. This replaced
// two overlapping tables that listed the same abilities against two different
// baselines (a "cohort median" CPM table and a 1:1 damage table).
test('the ability table is a single 1:1 view with both casts and damage', () => {
  const report = buildReport(bundle);
  const a = report.abilities;
  assert.equal(a.otherLabel, bundle.other.meta.name);
  assert.ok(a.rows.length > 5);
  for (const row of a.rows.slice(0, 5)) {
    assert.ok(typeof row.myCasts === 'number' && typeof row.theirCasts === 'number');
    assert.ok(typeof row.myAmount === 'number' && typeof row.theirAmount === 'number');
    assert.equal(row.castDiff, row.myCasts - row.theirCasts);
  }
  assert.ok(a.totals.myDamage > 0 && a.totals.theirDamage > 0);
});
