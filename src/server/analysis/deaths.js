// What a death actually cost, instead of a flat "roughly 20-30s".
//
// Every number here is measured from the run's own data. Nothing in this file
// names a spell, a class or a patch: which buffs count as "cooldowns" is
// derived from what the player CAST and how often (see isCooldownBuff), the
// same frequency-based rule timeline.js uses to pick its cooldown lanes. That
// survives ability reworks; a hardcoded buff list would not.
//
// Deliberately pure: takes plain arrays, returns plain objects, so the whole
// thing is testable without a log (see test/deaths.test.js).

/** How long before a death a battle-res still counts as the cause of it. */
const BATTLE_RES_WINDOW_MS = 10_000;
/** A death inside the last slice of a fight costs almost nothing. */
const LATE_FIGHT_FRACTION = 0.95;
/** Someone else dying this close to you is the same event, not a coincidence. */
const NEARBY_DEATH_WINDOW_MS = 10_000;
/**
 * Casts-per-minute at or below which an ability is a cooldown rather than a
 * rotational button. Same ceiling and same reasoning as timeline.js's lane
 * selection: off-GCD cooldowns are gated by their own recharge, not the GCD.
 */
const COOLDOWN_CPM_CEILING = 1.5;
/** Ignore a wasted window with less than this left - it was nearly spent. */
const MIN_WASTED_MS = 3000;

/**
 * A battle-res is the one cast whose TARGET matters to this analysis, and
 * there is no way to recognise it from frequency alone - a 10-minute-cooldown
 * raid ability looks exactly like any other rarely-cast button in the data.
 *
 * This is a list of game ability names, not rotation knowledge: these five
 * have been the combat-res spells for many expansions and don't change with
 * tuning patches. Anything not on it simply isn't reported as a trade.
 */
export const BATTLE_RES_ABILITIES = new Set([
  'Raise Ally', // Death Knight
  'Rebirth', // Druid
  'Soulstone Resurrection', // Warlock
  'Soulstone', // Warlock (pre-cast form in some logs)
  'Intercession', // Paladin
]);

/**
 * Is this buff a cooldown the player actually pressed?
 *
 * The filter that was missing: selectBuffWindows() returns every
 * self-applied, impermanent aura, which sweeps up world buffs, seasonal
 * blessings and profession auras ("Sign of the Skirmisher", "Find Lumber")
 * that the player never cast and cannot waste. A real cooldown has a matching
 * cast in the run at cooldown frequency.
 */
export function isCooldownBuff(name, castsByName) {
  const c = castsByName?.get(name);
  return Boolean(c) && c.casts > 0 && c.cpm <= COOLDOWN_CPM_CEILING;
}

/**
 * One enriched record per death.
 *
 * @param deaths       computeRunMetrics()-shaped [{ atMs, killingBlow, ... }] (fight-relative)
 * @param castEvents   detail.castEvents - [{ timestamp, abilityGameID, targetID }], absolute
 * @param nameOf       Map<abilityGameID, name>
 * @param fight        detail.fight (needs startTime/endTime)
 * @param buffWindows  selectBuffWindows() output - fight-relative bands
 * @param castsByName  Map<name, {casts, cpm}> from computeRunMetrics().abilities
 * @param party        detail.party - [{ id, name, spec }]
 * @param partyDeaths  detail.partyDeaths - [{ name, id, timestamp }], absolute
 */
export function analyzeDeaths({
  deaths = [],
  castEvents = [],
  nameOf = new Map(),
  fight = {},
  buffWindows = [],
  castsByName = new Map(),
  party = [],
  partyDeaths = [],
}) {
  const start = fight.startTime ?? null;
  const end = fight.endTime ?? null;
  const fightDurMs = start != null && end != null && end > start ? end - start : null;
  const partyById = new Map(party.map((p) => [p.id, p]));

  // Fight-relative cast times, so everything below is in one clock.
  const casts =
    start == null
      ? []
      : castEvents
          .filter((e) => typeof e?.timestamp === 'number')
          .map((e) => ({ atMs: e.timestamp - start, name: nameOf.get(e.abilityGameID) ?? null, targetID: e.targetID ?? null }))
          .sort((a, b) => a.atMs - b.atMs);

  const others =
    start == null
      ? []
      : partyDeaths
          .filter((d) => typeof d?.timestamp === 'number')
          .map((d) => ({ atMs: d.timestamp - start, name: d.name ?? null, id: d.id ?? null }));

  const cooldownWindows = buffWindows.filter((w) => isCooldownBuff(w.name, castsByName));

  return deaths
    .filter((d) => d && typeof d.atMs === 'number')
    .map((d) => {
      const next = casts.find((c) => c.atMs > d.atMs) ?? null;
      // No cast after the death means you never came back - the cost runs to
      // the end of the fight.
      const downtimeMs = next ? next.atMs - d.atMs : fightDurMs != null ? Math.max(0, fightDurMs - d.atMs) : null;

      const battleRes = casts.find(
        (c) => c.name && BATTLE_RES_ABILITIES.has(c.name) && c.atMs <= d.atMs && d.atMs - c.atMs <= BATTLE_RES_WINDOW_MS
      );
      const resTarget = battleRes?.targetID != null ? partyById.get(battleRes.targetID) ?? null : null;

      return {
        atMs: d.atMs,
        killingBlow: d.killingBlow ?? d.topAbility ?? null,
        // WCL reports melee hits under a generic name, which says nothing on
        // its own - pair it with the biggest damage source over the window.
        topAbility: d.topAbility ?? null,
        downtimeMs,
        wasted: wastedAt(cooldownWindows, d.atMs).filter((w) => w.remainingMs >= MIN_WASTED_MS),
        afterBattleRes: Boolean(battleRes),
        battleResAbility: battleRes?.name ?? null,
        battleResTarget: resTarget ? { name: resTarget.name, spec: resTarget.spec } : null,
        // Who else went down around the same moment. A death alongside the
        // tank is a different story from dying alone.
        nearbyDeaths: nearbyDeaths(others, d.atMs, partyById),
        lateInFight: fightDurMs != null && d.atMs >= fightDurMs * LATE_FIGHT_FRACTION,
      };
    });
}

/** Party members who died within the window around `atMs`, nearest first.
 * Excludes the death itself by matching on the same instant + name. */
export function nearbyDeaths(others, atMs, partyById = new Map(), selfId = null) {
  return others
    .filter((o) => o.atMs !== atMs && Math.abs(o.atMs - atMs) <= NEARBY_DEATH_WINDOW_MS && o.id !== selfId)
    .map((o) => ({
      name: o.name,
      spec: partyById.get(o.id)?.spec ?? null,
      // Negative = they died first.
      offsetMs: o.atMs - atMs,
    }))
    .sort((a, b) => Math.abs(a.offsetMs) - Math.abs(b.offsetMs));
}

/**
 * Cooldowns still running when you died, with the tail you never used.
 *
 * Only the remainder counts as waste - dying with 2s left on a window is
 * nothing, dying 12s into a 30s Army of the Dead is often the expensive part
 * of the death, more than the corpse run itself.
 */
export function wastedAt(buffWindows, atMs) {
  const out = [];
  for (const w of buffWindows ?? []) {
    for (const band of w.bands ?? []) {
      if (band.startMs <= atMs && atMs < band.endMs) {
        out.push({ name: w.name, remainingMs: band.endMs - atMs });
        break; // one band per buff can contain a given instant
      }
    }
  }
  return out.sort((a, b) => b.remainingMs - a.remainingMs);
}

// ~1 severity point per 5s lost, so a 40s death outweighs an 8s one instead
// of both scoring a flat 4.
const SEVERITY_PER_MS = 1 / 5000;
/** A traded life is still a death, but not the same mistake. */
const BATTLE_RES_MULTIPLIER = 0.5;
/** A death in the fight's last moments barely happened. */
const LATE_FIGHT_MULTIPLIER = 0.15;
/** Dying with the party is a wipe-in-progress, not your positioning. */
const NEARBY_DEATH_MULTIPLIER = 0.6;
/** Floor on the raw cost, so an extra death never scores zero and vanishes
 * from the report even when it cost no measurable time. Applied BEFORE the
 * multipliers above - see deathSeverity. */
const MIN_SEVERITY_PER_DEATH = 1;

/**
 * Severity for the deaths gap, from what the deaths actually cost.
 *
 * Replaces a flat `extraDeaths * 4`, which rated a 4-second battle-res trade
 * exactly the same as a 40-second corpse run.
 */
export function deathSeverity(records, extraDeaths) {
  if (!records?.length) return Math.max(0, extraDeaths) * 4; // no per-death detail - old behaviour
  let total = 0;
  for (const r of records) {
    const lostMs = (r.downtimeMs ?? 0) + wastedMs(r);
    // Floor the raw COST first, then discount for cause. Clamping after the
    // multipliers instead would let a cheap death bottom out at the floor and
    // silently discard the context - a 1s battle-res trade would score
    // exactly the same as a 1s careless death.
    let points = Math.max(MIN_SEVERITY_PER_DEATH, lostMs * SEVERITY_PER_MS);
    if (r.afterBattleRes) points *= BATTLE_RES_MULTIPLIER;
    if (r.nearbyDeaths?.length) points *= NEARBY_DEATH_MULTIPLIER;
    if (r.lateInFight) points *= LATE_FIGHT_MULTIPLIER;
    total += points;
  }
  // Scale to the deaths the comparison run DIDN'T have - matching one for one
  // isn't a gap, however costly your own death was.
  const share = records.length ? Math.min(1, Math.max(0, extraDeaths) / records.length) : 0;
  return round1(total * share);
}

export function wastedMs(record) {
  return (record.wasted ?? []).reduce((acc, w) => acc + w.remainingMs, 0);
}

const round1 = (v) => Math.round(v * 10) / 10;
