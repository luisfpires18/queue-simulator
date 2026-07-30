// Unholy Death Knight rotation rules - Midnight, patch 12.0.7.
//
// Ability and aura names below are the exact strings Warcraft Logs reports (read
// off a real +20 Pit of Saron log, fixtures/comparison-10658-plus0.json), NOT the
// names used in guides or in SimulationCraft's snake_case. A mismatch here does
// not throw - it silently measures nothing - so any name added later must be
// confirmed against a log first.
//
// ---------------------------------------------------------------------------
// WHY THERE ARE NO cooldown_drift RULES IN THIS PACK
// ---------------------------------------------------------------------------
// The obvious rule - "press Army of the Dead and Dark Transformation on cooldown,
// every guide says so" - was authored, measured against a real pair of runs, and
// then deliberately dropped, because the measurement said it is backwards in M+:
//
//                        engaged time the CD sat unpressed
//   Army of the Dead     player (195k dps, 22nd pct): 15.7%   top run (273k dps): 20.8%
//   Dark Transformation  player:                      13.4%   top run:            17.0%
//
// The better player wastes MORE cooldown time, because M+ rewards holding a
// cooldown for the next pull, and their run has 14.1% idle to the player's 5.8%.
// Shipping this rule would have scolded the stronger run for the thing that made
// it stronger. The `cooldown_drift` kind still exists in the checker because it
// is sound on a single-target raid fight where there is no routing to plan
// around - it just has no business judging a dungeon.
//
// Runic Power waste came out the same way (player 3.9%, top run 8.0%), so its
// threshold is set to only catch genuinely egregious overcapping rather than to
// discriminate between these two.
//
// ---------------------------------------------------------------------------
// HOW THE THRESHOLDS BELOW WERE PICKED
// ---------------------------------------------------------------------------
// Every threshold is calibrated against a real cohort: the top 7 ranked Unholy
// parses for Algeth'ar Academy +20 (249k-283k dps) plus two of the user's own
// runs, all measured with the same code that ships. A rule only survives if the
// whole top cohort passes it. Measured spread across those 7 top parses:
//
//   Virulent Plague uptime      97.6 - 100      -> min 95
//   Dread Plague uptime         94.2 - 99.3     -> min 92
//   Icy Talons uptime           92.9 - 97.5     -> min 90
//   Festering Scythe uptime     86.6 - 97.9     -> min 85
//   Putrefy inside Dark Transf. 77.2 - 98.1     -> min 72   (user: 55-59)
//   Outbreak while plagues up   35.7 - 70       -> max 80   (user: 100)
//   Sudden Doom windows unspent  0   - 3.3      -> max 8
//   Army without Dark Transf.    0   - 7.7      -> max 15   (user: 37.5)
//   Runic Power overcapped       4   - 14.2     -> max 18
//
// The Runic Power line is why this matters: an "obvious" 12% cap would have
// flagged the #1 parse in the world for the very thing that ranked it first.
//
// Three more candidates were measured and DROPPED for measuring nothing:
//   - Death and Decay uptime: the user scored HIGHEST of everyone (61% vs a
//     44.9-53.9 top spread), so it is not a skill signal in M+.
//   - Scourge Strike with a Lesser Ghoul stack banked: ~100% for every single
//     run measured, user included. The band is always up; the rule is vacuous.
//   - Potion inside the Army of the Dead window: top parses ranged 0-50% with
//     two of them at 0. The army buff lasts 6s, so a correctly-used potion
//     legitimately lands outside it.
//
// What DID discriminate: Army of the Dead landing without Dark Transformation
// (top cohort 0-7.7% unpaired, user 37.5%) and Putrefy being spent outside the
// Dark Transformation window (top cohort 77-98% inside, user 55-59%).
import type { RotationSpec } from "./types";

const SIMC = 0;
const METHOD = 1;
const ICY = 2;

export const DEATHKNIGHT_UNHOLY: RotationSpec = {
  specId: "deathknight:unholy",
  specLabel: "Unholy Death Knight",
  patch: "12.0.7",
  sources: [
    {
      label: "SimulationCraft APL (midnight branch)",
      url: "https://github.com/simulationcraft/simc/blob/midnight/engine/class_modules/apl/apl_death_knight.cpp",
      readAt: "2026-07-29",
    },
    {
      label: "Method.gg - Unholy playstyle and rotation",
      url: "https://www.method.gg/guides/unholy-death-knight/playstyle-and-rotation",
      readAt: "2026-07-29",
    },
    {
      label: "Icy Veins - Unholy rotation, cooldowns, abilities",
      url: "https://www.icy-veins.com/wow/unholy-death-knight-pve-dps-rotation-cooldowns-abilities",
      readAt: "2026-07-29",
    },
  ],

  // Hero talent builds, detected from what the run actually cast or gained.
  // Riders is the default: it is the listed hero talent in src/game/classes.ts
  // and the build with no unique required press, so "no San'layn markers" is the
  // only reliable way to spot it.
  builds: [
    {
      id: "sanlayn",
      label: "San'layn",
      detect: {
        anyCast: ["Vampiric Strike"],
        anyBuff: ["Essence of the Blood Queen", "Gift of the San'layn", "Vampiric Strike"],
      },
    },
    {
      id: "riders",
      label: "Riders of the Apocalypse",
      detect: {
        anyCast: ["Death Charge"],
        anyBuff: ["Mograine's Might", "Apocalyptic Conquest", "Pact of the Apocalypse"],
      },
    },
  ],
  defaultBuild: "riders",

  rules: [
    // --- diseases: the single most repeated instruction in every source -------
    // These need the Debuffs table (enemy-side auras). When it is missing the
    // checker reports "not measured", never 0% - a missing fetch is not a
    // dropped disease.
    {
      kind: "aura_uptime",
      id: "virulent-plague-uptime",
      aura: "Virulent Plague",
      target: "enemy",
      minPct: 95,
      severity: "high",
      why: "Method.gg: \"You will always want to apply and maintain your Virulent Plague on your enemies.\" It is also the gate on Epidemic doing full damage, so dropping it costs both the dot and your AoE spender.",
      sourceIndex: METHOD,
    },
    {
      kind: "aura_uptime",
      id: "dread-plague-uptime",
      aura: "Dread Plague",
      target: "enemy",
      minPct: 92,
      severity: "high",
      why: "Icy Veins lists poor Dread Plague uptime as a critical mistake because it drives your Forbidden Knowledge proc rate. SimC keeps it up via the same Outbreak condition as Virulent Plague (dot.dread_plague.active_dots=0).",
      sourceIndex: ICY,
    },

    // --- self buffs that the rotation is supposed to sustain ------------------
    {
      kind: "aura_uptime",
      id: "icy-talons-uptime",
      aura: "Icy Talons",
      target: "self",
      minPct: 90,
      severity: "medium",
      why: "Method.gg: maintaining Icy Talons matters for your Sudden Doom procs, and you hold it automatically as long as you never go long without a Death Coil or Epidemic. Low uptime means you were sitting on Runic Power.",
      sourceIndex: METHOD,
    },
    {
      kind: "aura_uptime",
      id: "festering-scythe-uptime",
      aura: "Festering Scythe",
      target: "self",
      minPct: 85,
      severity: "low",
      why: "SimC spends its highest single-target priority on refreshing Festering Scythe before it falls off (buff.festering_scythe.remains<=3), so the buff is meant to be near-permanent rather than occasional.",
      sourceIndex: SIMC,
    },

    // --- the check that actually separated the two runs -----------------------
    {
      kind: "cooldown_alignment",
      id: "army-with-dark-transformation",
      a: "Army of the Dead",
      b: "Dark Transformation",
      withinMs: 5000,
      maxUnpairedPct: 15,
      severity: "high",
      why: "Method.gg calls Army of the Dead \"your biggest cooldown that you will want to overlap with as many buffs as possible\", and SimC only presses Dark Transformation when the army is already out or is more than 30s away (pet.army_ghoul.active|cooldown.army_of_the_dead.remains>30) - so every army is supposed to arrive with a transformed ghoul, via Commander of the Dead.",
      sourceIndex: METHOD,
    },

    // --- opening burst -------------------------------------------------------
    // Presence inside a window, not exact order: real openers shuffle with pull
    // timing. Outbreak is deliberately NOT required - it is conditional on not
    // being talented into Blightburst in all three sources.
    {
      kind: "opener_sequence",
      id: "opener-burst",
      expected: ["Festering Strike", "Army of the Dead", "Dark Transformation"],
      graceMs: 20000,
      severity: "medium",
      why: "All three sources open by building Lesser Ghoul stacks with Festering Strike and then stacking Army of the Dead with Dark Transformation, trinket and potion. A cooldown missing from the opener entirely is burst you never get back.",
      sourceIndex: SIMC,
    },

    // --- spending the charge cooldown inside the burst window ----------------
    // The strongest new signal in the cohort. The user casts Putrefy far more
    // often than the top parses do (86 casts against their 32-57) and lands only
    // ~55% of them inside Dark Transformation, which is Putrefy being used as a
    // filler instead of as burst.
    {
      kind: "cast_during_buff",
      id: "putrefy-in-dark-transformation",
      ability: "Putrefy",
      buff: "Dark Transformation",
      minPct: 72,
      minCasts: 10,
      severity: "high",
      why: "Both SimC priority lists spend Putrefy on `buff.dark_transformation.up`, and Method.gg's banking rule is to hold a charge for the Dark Transformation window rather than dump it on cooldown. Every top parse measured lands 77% or more of its Putrefy casts inside that window.",
      sourceIndex: SIMC,
    },

    // --- wasted globals ------------------------------------------------------
    // Note the calibrated ceiling: real top players cast a "redundant" Outbreak
    // 36-70% of the time, so this only fires well above that. Casting it while
    // both diseases are already ticking refreshes nothing.
    {
      kind: "redundant_cast",
      id: "outbreak-while-diseases-up",
      ability: "Outbreak",
      whileAnyUp: ["Virulent Plague", "Dread Plague"],
      target: "enemy",
      maxPct: 80,
      minCasts: 8,
      severity: "medium",
      why: "SimC only presses Outbreak when a disease is actually missing (dot.dread_plague.active_dots=0|dot.virulent_plague.active_dots=0). With both already ticking it is a global spent on nothing, and with Blightburst talented Putrefy is applying them for you anyway.",
      sourceIndex: SIMC,
    },

    // --- procs ---------------------------------------------------------------
    {
      kind: "proc_waste",
      id: "sudden-doom-unspent",
      buff: "Sudden Doom",
      // Necrotic Coil and Graveyard are what Forbidden Knowledge turns Death Coil
      // and Epidemic into, so they spend the proc too - omitting them would read
      // every Army of the Dead window as wasted procs.
      consumedBy: ["Death Coil", "Epidemic", "Necrotic Coil", "Graveyard"],
      maxPct: 8,
      minWindows: 20,
      severity: "low",
      why: "SimC's top single-target priority after refreshing Festering Scythe is death_coil,if=buff.sudden_doom.react, and Icy Veins lists wasting Sudden Doom procs as a critical mistake. A window that closes unspent is a free empowered spender thrown away.",
      sourceIndex: SIMC,
    },

    // --- resource ------------------------------------------------------------
    // Ceiling sits above the whole top cohort on purpose: the #1 parse overcaps
    // 14.2%, so a tighter rule would scold the best run measured.
    {
      kind: "resource_waste",
      id: "runic-power-overcap",
      resource: "Runic Power",
      maxWastePct: 18,
      severity: "low",
      why: "Icy Veins: avoid overcapping Runic Power. Capped Runic Power is a Death Coil or Epidemic you never cast, which also costs you the Runic Corruption that would have brought your runes back faster.",
      sourceIndex: ICY,
    },
  ],
};
