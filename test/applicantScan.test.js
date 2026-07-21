import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  parseHealingTable,
  parseDamageTakenTable,
  parseInterruptsTable,
  parseDispelsTable,
  parseDamageTakenEvents,
  parseInterruptEvents,
} from '../src/server/parse/tables.js';
import { selectRuns, comparePercentile, scoreFit, dungeonScore } from '../src/server/analysis/applicant.js';

// WCL table scalars come back as { data: { totalTime, entries:[...] } } — the
// same shape the existing Casts/Damage parsers already handle.
const tbl = (entries, totalTime = 300000) => ({ data: { totalTime, entries } });

test('parseHealingTable sums effective healing, sorts desc', () => {
  const h = parseHealingTable(tbl([
    { name: 'Riptide', guid: 61295, total: 1000, overheal: 200, hitCount: 3 },
    { name: 'Healing Wave', guid: 77472, total: 5000, overheal: 100, hitCount: 5 },
  ]));
  assert.equal(h.totalHealing, 6000);
  assert.equal(h.abilities[0].name, 'Healing Wave');
  assert.equal(h.abilities[0].overheal, 100);
});

test('parseDamageTakenTable totals and keeps ability breakdown', () => {
  const d = parseDamageTakenTable(tbl([
    { name: 'Frost Bolt', guid: 1, total: 4000, hitCount: 2 },
    { name: 'Cleave', guid: 2, total: 1500, hitCount: 1 },
  ]));
  assert.equal(d.totalDamage, 5500);
  assert.equal(d.abilities.length, 2);
});

test('parseInterruptsTable counts successful interrupts only', () => {
  const i = parseInterruptsTable(tbl([
    { name: 'Fireball', guid: 10, total: 7 },
    { name: 'Heal', guid: 11, total: 5 },
  ]));
  assert.equal(i.total, 12);
  assert.equal(i.abilities[0].count, 7);
});

test('parseDispelsTable splits purges from dispels when flagged', () => {
  const d = parseDispelsTable(tbl([
    { name: 'Magic Debuff', guid: 20, total: 3 },
    { name: 'Enemy Buff', guid: 21, total: 2, type: 'purge' },
  ]));
  assert.equal(d.dispels, 3);
  assert.equal(d.purges, 2);
  assert.equal(d.total, 5);
});

test('parseDamageTakenEvents keeps damage events sorted by time', () => {
  const ev = parseDamageTakenEvents([
    { data: [
      { type: 'damage', timestamp: 200, amount: 50 },
      { type: 'heal', timestamp: 100, amount: 999 }, // ignored
      { type: 'damage', timestamp: 100, amount: 30 },
    ] },
  ]);
  assert.equal(ev.length, 2);
  assert.equal(ev[0].timestamp, 100);
  assert.equal(ev[1].amount, 50);
});

test('parseInterruptEvents counts landed interrupts from the event stream', () => {
  const i = parseInterruptEvents([
    { data: [
      { type: 'interrupt', timestamp: 100, abilityGameID: 111 },
      { type: 'interrupt', timestamp: 200, abilityGameID: 111 },
      { type: 'cast', timestamp: 150, abilityGameID: 47528 }, // ignored
      { type: 'interrupt', timestamp: 300, abilityGameID: 222 },
    ] },
  ]);
  assert.equal(i.total, 3);
  assert.equal(i.abilities[0].guid, 111);
  assert.equal(i.abilities[0].count, 2);
});

test('selectRuns picks best run at each of the top distinct key levels', () => {
  const runs = [
    { keyLevel: 22, rankPercent: 90, report: { code: 'a', fightID: 1 } },
    { keyLevel: 22, rankPercent: 80, report: { code: 'b', fightID: 1 } }, // dupe level, skipped
    { keyLevel: 21, rankPercent: 70, report: { code: 'c', fightID: 1 } },
    { keyLevel: 20, rankPercent: 60, report: { code: 'd', fightID: 1 } },
    { keyLevel: 19, rankPercent: 50, report: { code: 'e', fightID: 1 } }, // beyond count=3
    { keyLevel: 18, rankPercent: 40, report: null }, // no report, ineligible
  ];
  const chosen = selectRuns(runs, 3);
  assert.deepEqual(chosen.map((r) => r.keyLevel), [22, 21, 20]);
  assert.equal(chosen[0].report.code, 'a');
});

test('comparePercentile places applicant against the ranked field', () => {
  const field = [{ dps: 100 }, { dps: 200 }, { dps: 300 }, { dps: 400 }];
  const c = comparePercentile(350, field);
  assert.equal(c.percentile, 75); // beats 3 of 4
  assert.equal(c.fieldMedianDps, 250);
  assert.equal(c.fieldBestDps, 400);
});

test('dungeonScore is a weighted composite, not the parse', () => {
  // A clean, deep, kicking p94 run.
  const good = dungeonScore({
    maxLevel: 22, levels: [22, 21, 20],
    fieldCompare: { parsePercent: 94, applicantDps: 1 },
    runs: [{ overall: { deaths: [], interruptsLanded: 15, damage: 100, damageTaken: 30 } }],
  });
  assert.ok(good.score > 80 && good.score <= 100, `strong run high, got ${good.score}`);
  assert.equal(good.breakdown.length, 5);
  assert.equal(good.breakdown.find((b) => b.key === 'parse').value, 94);

  // Same parse, but two deaths + never kicks + eats damage -> clearly lower.
  const sloppy = dungeonScore({
    maxLevel: 22, levels: [22],
    fieldCompare: { parsePercent: 94, applicantDps: 1 },
    runs: [{ overall: { deaths: [{}, {}], interruptsLanded: 0, damage: 100, damageTaken: 95 } }],
  });
  assert.ok(sloppy.score < good.score - 15, `deaths/mechanics must cost, got ${sloppy.score} vs ${good.score}`);

  assert.equal(dungeonScore({ runs: [] }).score, null);
});

test('dungeonScore uses real avoidable damage when the dataset counted it', () => {
  const withAvoid = (avoidableDamage) => dungeonScore({
    maxLevel: 22, levels: [22],
    fieldCompare: { parsePercent: 90, applicantDps: 1 },
    runs: [{ overall: { deaths: [], interruptsLanded: 15, damage: 100, damageTaken: 90, avoidableCounted: true, avoidableDamage } }],
  });
  const clean = withAvoid(0); // no avoidable hits despite high total taken
  const bad = withAvoid(10); // 10% of output eaten as avoidable
  const dt = (r) => r.breakdown.find((b) => b.key === 'damageTaken');
  assert.equal(dt(clean).label, 'Avoidable dmg');
  assert.equal(dt(clean).value, 100); // clean = full marks even though damageTaken is high
  assert.equal(dt(bad).value, 0); // 10% avoidable = zero on that component
  assert.ok(clean.score > bad.score);
});

test('scoreFit rewards a run at the target level and consistency', () => {
  const perDungeon = [
    { maxLevel: 22, levels: [22, 21, 20], fieldCompare: { parsePercent: 80 } },
    { maxLevel: 22, levels: [22, 21], fieldCompare: { parsePercent: 70 } },
    { maxLevel: 21, levels: [21, 20], fieldCompare: { parsePercent: 60 } },
  ];
  const fit = scoreFit(perDungeon, { targetLevel: 22 });
  assert.equal(fit.verdict, 'fit');
  assert.ok(fit.reasons.some((r) => r.includes('+22')));
});

test('scoreFit flags a spread-out applicant with no target run as not-fit', () => {
  const perDungeon = [
    { maxLevel: 22, levels: [22], fieldCompare: { parsePercent: 20 } },
    { maxLevel: 18, levels: [18], fieldCompare: { parsePercent: 10 } },
    { maxLevel: 17, levels: [17], fieldCompare: { parsePercent: 5 } },
  ];
  const fit = scoreFit(perDungeon, { targetLevel: 25 });
  assert.notEqual(fit.verdict, 'fit');
});
