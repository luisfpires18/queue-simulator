import { test, describe } from 'vitest';
import assert from 'node:assert/strict';
import { analyzeDeaths, deathSeverity, isCooldownBuff, nearbyDeaths, wastedAt, wastedMs } from '../src/server/analysis/deaths.js';

// Fight runs 1000 -> 101000 on the report clock, i.e. 100s long, so a
// fight-relative Xs is an absolute 1000 + X*1000.
const FIGHT = { startTime: 1000, endTime: 101_000 };
const abs = (sec) => 1000 + sec * 1000;

const RAISE_ALLY = 61999;
const FILLER = 47541;
const nameOf = new Map([
  [RAISE_ALLY, 'Raise Ally'],
  [FILLER, 'Death Coil'],
]);

const cast = (sec, id = FILLER) => ({ timestamp: abs(sec), abilityGameID: id });
const death = (sec, extra = {}) => ({ atMs: sec * 1000, killingBlow: 'Dread Pulse', ...extra });

const run = (deaths, castEvents, buffWindows = []) =>
  analyzeDeaths({ deaths, castEvents, nameOf, fight: FIGHT, buffWindows });

describe('analyzeDeaths - downtime', () => {
  test('measures death to the next cast, not a hardcoded guess', () => {
    const [r] = run([death(30)], [cast(10), cast(42)]);
    assert.equal(r.downtimeMs, 12_000);
  });

  test('runs to the end of the fight when you never cast again', () => {
    const [r] = run([death(80)], [cast(10)]);
    assert.equal(r.downtimeMs, 20_000); // 100s fight - died at 80s
  });

  test('is near zero when a cast follows immediately', () => {
    const [r] = run([death(30)], [cast(30.5)]);
    assert.equal(r.downtimeMs, 500);
  });

  test('ignores casts BEFORE the death when picking the next one', () => {
    const [r] = run([death(50)], [cast(10), cast(20), cast(55)]);
    assert.equal(r.downtimeMs, 5000);
  });

  test('handles a run with no casts at all', () => {
    const [r] = run([death(40)], []);
    assert.equal(r.downtimeMs, 60_000);
  });
});

describe('analyzeDeaths - context', () => {
  test('flags a death that follows a battle-res', () => {
    const [r] = run([death(30)], [cast(27, RAISE_ALLY), cast(40)]);
    assert.equal(r.afterBattleRes, true);
    assert.equal(r.battleResAbility, 'Raise Ally');
  });

  test('does not flag a battle-res long before the death', () => {
    const [r] = run([death(60)], [cast(20, RAISE_ALLY), cast(70)]);
    assert.equal(r.afterBattleRes, false);
  });

  test('does not flag a battle-res cast AFTER the death', () => {
    const [r] = run([death(30)], [cast(35, RAISE_ALLY)]);
    assert.equal(r.afterBattleRes, false);
  });

  test('marks a death in the closing seconds', () => {
    assert.equal(run([death(99)], [])[0].lateInFight, true);
    assert.equal(run([death(50)], [])[0].lateInFight, false);
  });

  test('keeps the killing blow, falling back to the top damage source', () => {
    assert.equal(run([death(30)], [])[0].killingBlow, 'Dread Pulse');
    const [r] = run([{ atMs: 30_000, killingBlow: null, topAbility: 'Torrent of Misery' }], []);
    assert.equal(r.killingBlow, 'Torrent of Misery');
  });

  test('skips deaths with no usable timestamp', () => {
    assert.equal(run([{ atMs: null }], []).length, 0);
  });
});

describe('wastedAt', () => {
  const army = { name: 'Army of the Dead', bands: [{ startMs: 20_000, endMs: 50_000 }] };

  test('reports only the unused tail, not the whole window', () => {
    assert.deepEqual(wastedAt([army], 32_000), [{ name: 'Army of the Dead', remainingMs: 18_000 }]);
  });

  test('ignores a window that had already ended', () => {
    assert.deepEqual(wastedAt([army], 60_000), []);
  });

  test('ignores a window that had not started', () => {
    assert.deepEqual(wastedAt([army], 10_000), []);
  });

  test('sorts the biggest loss first', () => {
    const short = { name: 'Short', bands: [{ startMs: 0, endMs: 35_000 }] };
    const names = wastedAt([short, army], 30_000).map((w) => w.name);
    assert.deepEqual(names, ['Army of the Dead', 'Short']);
  });
});

describe('deathSeverity', () => {
  const plain = (downtimeMs) => ({ downtimeMs, wasted: [], afterBattleRes: false, lateInFight: false });

  test('a long death outranks a short one', () => {
    assert.ok(deathSeverity([plain(40_000)], 1) > deathSeverity([plain(5000)], 1));
  });

  test('the same death costs less when it bought a battle-res', () => {
    const careless = deathSeverity([plain(40_000)], 1);
    const traded = deathSeverity([{ ...plain(40_000), afterBattleRes: true }], 1);
    assert.ok(traded < careless);
  });

  test('a wasted cooldown raises it', () => {
    const bare = deathSeverity([plain(10_000)], 1);
    const withArmy = deathSeverity(
      [{ ...plain(10_000), wasted: [{ name: 'Army of the Dead', remainingMs: 18_000 }] }],
      1
    );
    assert.ok(withArmy > bare);
  });

  test('a death in the closing seconds barely scores', () => {
    assert.ok(deathSeverity([{ ...plain(20_000), lateInFight: true }], 1) < deathSeverity([plain(20_000)], 1));
  });

  test('dying alongside the party scores lower than dying alone', () => {
    const alone = deathSeverity([plain(20_000)], 1);
    const together = deathSeverity(
      [{ ...plain(20_000), nearbyDeaths: [{ name: 'Ironclad', spec: 'Blood', offsetMs: -3000 }] }],
      1
    );
    assert.ok(together < alone);
  });

  test('never scores zero - an extra death always shows up', () => {
    assert.ok(deathSeverity([{ ...plain(0), lateInFight: true }], 1) > 0);
  });

  test('falls back to the old flat weighting with no per-death detail', () => {
    assert.equal(deathSeverity([], 2), 8);
  });

  test('the battle-res death from the reported bug lands under Medium', () => {
    // Died at ~6s of downtime right after a Raise Ally, nothing wasted.
    // priorityOf() bands >=3 as Medium, so this must come in below 3.
    const severity = deathSeverity(
      [{ downtimeMs: 6000, wasted: [], afterBattleRes: true, lateInFight: false }],
      1
    );
    assert.ok(severity < 3, `expected Low, got severity ${severity}`);
  });
});

// The bug the real report exposed: it announced "79s of Find Lumber and 79s
// of Sign of the Skirmisher … to the grave". Those are world/profession buffs
// the player never cast and could not waste. selectBuffWindows returns every
// self-applied impermanent aura, so the cooldown test has to happen here.
describe('isCooldownBuff', () => {
  const casts = new Map([
    ['Army of the Dead', { casts: 2, cpm: 0.6 }],
    ['Death Coil', { casts: 90, cpm: 27 }],
  ]);

  test('accepts a rarely-cast ability - that is what a cooldown is', () => {
    assert.equal(isCooldownBuff('Army of the Dead', casts), true);
  });

  test('rejects a buff the player never cast (world/profession/seasonal)', () => {
    assert.equal(isCooldownBuff('Sign of the Skirmisher', casts), false);
    assert.equal(isCooldownBuff('Find Lumber', casts), false);
    assert.equal(isCooldownBuff('Touch of Elune - Night', casts), false);
  });

  test('rejects a rotational button - being a buff does not make it a cooldown', () => {
    assert.equal(isCooldownBuff('Death Coil', casts), false);
  });

  test('is not fooled by an empty or missing cast map', () => {
    assert.equal(isCooldownBuff('Army of the Dead', new Map()), false);
    assert.equal(isCooldownBuff('Army of the Dead', undefined), false);
  });
});

describe('analyzeDeaths - only real cooldowns count as wasted', () => {
  const windows = [
    { name: 'Army of the Dead', bands: [{ startMs: 20_000, endMs: 50_000 }] },
    { name: 'Sign of the Skirmisher', bands: [{ startMs: 0, endMs: 110_000 }] },
  ];
  const castsByName = new Map([['Army of the Dead', { casts: 1, cpm: 0.6 }]]);

  test('drops the world buff and keeps the cooldown', () => {
    const [r] = analyzeDeaths({
      deaths: [death(30)],
      castEvents: [],
      nameOf,
      fight: FIGHT,
      buffWindows: windows,
      castsByName,
    });
    assert.deepEqual(r.wasted.map((w) => w.name), ['Army of the Dead']);
  });

  test('drops a window with only a moment left', () => {
    const [r] = analyzeDeaths({
      deaths: [death(49)], // 1s of Army remaining
      castEvents: [],
      nameOf,
      fight: FIGHT,
      buffWindows: windows,
      castsByName,
    });
    assert.deepEqual(r.wasted, []);
  });
});

describe('nearbyDeaths', () => {
  const partyById = new Map([
    [2, { id: 2, name: 'Ironclad', spec: 'Blood' }],
    [3, { id: 3, name: 'Leafy', spec: 'Restoration' }],
  ]);
  const others = [
    { atMs: 27_000, name: 'Ironclad', id: 2 },
    { atMs: 34_000, name: 'Leafy', id: 3 },
    { atMs: 90_000, name: 'Faraway', id: 4 },
  ];

  test('finds party deaths on either side, nearest first', () => {
    const out = nearbyDeaths(others, 30_000, partyById);
    assert.deepEqual(out.map((n) => n.name), ['Ironclad', 'Leafy']);
    assert.equal(out[0].offsetMs, -3000); // they died first
    assert.equal(out[0].spec, 'Blood');
  });

  test('excludes deaths outside the window', () => {
    assert.equal(nearbyDeaths(others, 30_000, partyById).some((n) => n.name === 'Faraway'), false);
  });

  test('excludes your own death from the party list', () => {
    assert.deepEqual(nearbyDeaths([{ atMs: 30_000, name: 'Me', id: 1 }], 30_000, partyById), []);
  });

  test('is empty when nobody else died nearby', () => {
    assert.deepEqual(nearbyDeaths([], 30_000, partyById), []);
  });
});

describe('analyzeDeaths - battle-res target', () => {
  test('names who you ressed and their spec', () => {
    const [r] = analyzeDeaths({
      deaths: [death(30)],
      castEvents: [{ timestamp: abs(27), abilityGameID: RAISE_ALLY, targetID: 2 }],
      nameOf,
      fight: FIGHT,
      party: [{ id: 2, name: 'Ironclad', spec: 'Blood' }],
    });
    assert.deepEqual(r.battleResTarget, { name: 'Ironclad', spec: 'Blood' });
  });

  test('survives a battle-res with no resolvable target', () => {
    const [r] = analyzeDeaths({
      deaths: [death(30)],
      castEvents: [{ timestamp: abs(27), abilityGameID: RAISE_ALLY, targetID: 99 }],
      nameOf,
      fight: FIGHT,
      party: [{ id: 2, name: 'Ironclad', spec: 'Blood' }],
    });
    assert.equal(r.afterBattleRes, true);
    assert.equal(r.battleResTarget, null);
  });
});

describe('wastedMs', () => {
  test('sums every unused window', () => {
    assert.equal(wastedMs({ wasted: [{ remainingMs: 1000 }, { remainingMs: 2500 }] }), 3500);
  });

  test('is zero with nothing wasted', () => {
    assert.equal(wastedMs({}), 0);
  });
});
