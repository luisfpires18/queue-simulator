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

// The comparison fixture is a clean run (0 deaths), so the deaths gap and its
// advice went completely untested - which is how the prose came to claim a
// flat "20-30s of downtime" that nothing measured. Inject a death into a copy
// of the real bundle and check the report describes THAT death.
function bundleWithDeath({ atRelMs, raiseAllyAtRelMs = null, raiseAllyTargetID = null, partyDeaths = null, worldBuff = false }) {
  const b = structuredClone(bundle);
  const start = b.mine.detail.fight.startTime;
  b.mine.detail.fight.kill = true;
  b.mine.detail.deaths = {
    deaths: [{ timestamp: start + atRelMs, killingBlow: 'Dread Pulse', topAbility: 'Torrent of Misery' }],
  };
  b.other.detail.deaths = { deaths: [] };
  b.mine.detail.party = [{ id: 2, name: 'Ironclad', spec: 'Blood' }];
  if (raiseAllyAtRelMs != null) {
    const guid = 61999;
    b.mine.detail.casts.abilities.push({ name: 'Raise Ally', guid, casts: 1 });
    b.mine.detail.castEvents.push({
      timestamp: start + raiseAllyAtRelMs,
      abilityGameID: guid,
      targetID: raiseAllyTargetID,
    });
    b.mine.detail.castEvents.sort((x, y) => x.timestamp - y.timestamp);
  }
  if (partyDeaths) {
    b.mine.detail.partyDeaths = partyDeaths.map((p) => ({ ...p, timestamp: start + p.atRelMs }));
  }
  if (worldBuff) {
    // A long self-applied aura that was never cast - exactly the shape of the
    // "Sign of the Skirmisher"/"Find Lumber" rows that polluted the report.
    b.mine.detail.buffs.auras.push({
      name: 'Sign of the Skirmisher',
      uptimeMs: 80_000,
      uses: 1,
      bands: [{ startTime: start, endTime: start + atRelMs + 79_000 }],
    });
    b.mine.detail.buffSources['Sign of the Skirmisher'] = { self: 1, foreign: 0 };
  }
  return b;
}

const deathGapOf = (b) => buildReport(b).gaps.find((g) => g.category === 'deaths');

test('deaths gap reports the measured cost, not a hardcoded 20-30s', () => {
  const g = deathGapOf(bundleWithDeath({ atRelMs: 60_000 }));
  assert.ok(g, 'a deaths gap exists');
  assert.ok(!/20-30s/.test(g.advice), 'the invented range is gone');
  assert.ok(/before you cast again/.test(g.advice), `says what it cost: ${g.advice}`);
  assert.ok(/Dread Pulse/.test(g.advice), 'names the killing blow');
  assert.equal(g.deathDetail.length, 1);
  assert.ok(g.deathDetail[0].downtimeMs >= 0);
});

test('deaths advice no longer claims CPM is dragged down (engagedCPM excludes dead time)', () => {
  const g = deathGapOf(bundleWithDeath({ atRelMs: 60_000 }));
  assert.ok(!/CPM/.test(g.advice), `should not mention CPM: ${g.advice}`);
});

test('a death right after a battle-res is reported as a trade and ranks lower', () => {
  const careless = deathGapOf(bundleWithDeath({ atRelMs: 60_000 }));
  const traded = deathGapOf(bundleWithDeath({ atRelMs: 60_000, raiseAllyAtRelMs: 57_000 }));

  assert.ok(/Raise Ally/.test(traded.advice), `explains the trade: ${traded.advice}`);
  assert.ok(traded.severity < careless.severity, 'a traded life outranks nothing');
  assert.equal(traded.deathDetail[0].afterBattleRes, true);
});

test('the battle-res names who it landed on', () => {
  const g = deathGapOf(
    bundleWithDeath({ atRelMs: 60_000, raiseAllyAtRelMs: 57_000, raiseAllyTargetID: 2 })
  );
  assert.ok(/Ironclad/.test(g.advice), `names the target: ${g.advice}`);
  assert.ok(/Blood/.test(g.advice), 'includes their spec, so tank/healer is obvious');
});

// The reported bug: "you took 79s of Find Lumber and 79s of Sign of the
// Skirmisher … to the grave". Those are world buffs, not wasted cooldowns.
test('world buffs are never reported as wasted cooldowns', () => {
  const g = deathGapOf(bundleWithDeath({ atRelMs: 60_000, worldBuff: true }));
  assert.ok(!/Sign of the Skirmisher/.test(g.advice), `world buff must not appear: ${g.advice}`);
  assert.equal(
    g.deathDetail[0].wasted.some((w) => w.name === 'Sign of the Skirmisher'),
    false
  );
});

test('a death alongside the party says so, and ranks lower than dying alone', () => {
  const alone = deathGapOf(bundleWithDeath({ atRelMs: 60_000 }));
  const together = deathGapOf(
    bundleWithDeath({
      atRelMs: 60_000,
      partyDeaths: [{ atRelMs: 57_000, name: 'Ironclad', id: 2 }],
    })
  );

  assert.ok(/Ironclad/.test(together.advice), `mentions the nearby death: ${together.advice}`);
  assert.ok(together.severity < alone.severity, 'a group wipe is not your positioning');
  assert.equal(together.deathDetail[0].nearbyDeaths.length, 1);
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
