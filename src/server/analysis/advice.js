// One concrete sentence per gap. Advice is derived from the data diff only —
// no hardcoded patch-specific rotation claims. Death advice used to skip
// timestamps on the theory that "dying is already obvious to the player" —
// but the count alone can't tell a battle-res trade from a careless pull, so
// it now reports what each death measurably cost (see analysis/deaths.js).
//
// ABILITY_MECHANIC_NOTE covers two abilities (Graveyard, Necrotic Coil) the
// player flagged as looking like unexplained filler in the cast data.
// Verified via web search (Warcraft Wiki / Method.gg / Maxroll, 2026-07-07),
// not guessed: the Forbidden Knowledge talent transforms Epidemic/Death Coil
// into these for 30s after Army of the Dead. Necrotic Coil genuinely cleaves
// (up to 3 targets at full damage, unlike single-target Death Coil), so
// these are real distinct abilities with their own breakpoints.
const ABILITY_MECHANIC_NOTE = {
  Graveyard: 'Epidemic transformed by Forbidden Knowledge during a 30s Army of the Dead window, used at 5+ targets',
  'Necrotic Coil': 'Death Coil transformed by Forbidden Knowledge during a 30s Army of the Dead window, cleaves up to 3 targets',
};

const sec = (ms) => Math.round(ms / 1000);

/**
 * What the death actually cost, from analysis/deaths.js - not a guess.
 *
 * This used to say every death costs "roughly 20-30s of downtime… which also
 * drags down your idle% and CPM below". Two of those claims were wrong:
 * engagedCPM excludes dead time from its denominator (so CPM is protected,
 * not dragged down), and the idle seconds were already being billed a second
 * time as their own downtime gap.
 */
function deathAdvice(gapItem) {
  const records = gapItem.deathDetail ?? [];
  const count = `You died ${gapItem.mine}× this run vs their ${gapItem.cohort}.`;
  if (!records.length) return count; // no per-death detail available

  return [count, ...records.map(describeDeath)].join(' ');
}

/** Only the two costliest are worth naming - a longer list reads as noise and
 * the third window is never the reason the death mattered. */
const MAX_WASTED_NAMED = 2;

function describeDeath(r) {
  const parts = [];

  // "Melee" on its own says nothing, so pair it with whatever actually did
  // the damage over the death window.
  if (r.killingBlow && r.topAbility && r.topAbility !== r.killingBlow) {
    parts.push(`Killed by ${r.killingBlow} (most damage taken: ${r.topAbility})`);
  } else if (r.killingBlow) {
    parts.push(`Killed by ${r.killingBlow}`);
  } else {
    parts.push('One death');
  }

  if (r.downtimeMs != null) {
    parts.push(
      r.downtimeMs > 0
        ? `${sec(r.downtimeMs)}s passed before you cast again`
        : 'you were casting again immediately'
    );
  }

  const wasted = r.wasted ?? [];
  if (wasted.length) {
    const named = wasted.slice(0, MAX_WASTED_NAMED).map((w) => `${sec(w.remainingMs)}s of ${w.name}`);
    const rest = wasted.length - named.length;
    parts.push(`and you lost ${named.join(' and ')}${rest > 0 ? ` (+${rest} more)` : ''}`);
  }

  let sentence = `${parts.join(', ')}.`;

  // The reframing bits - why this death may not be the mistake it looks like.
  if (r.afterBattleRes) {
    const who = r.battleResTarget
      ? ` on ${r.battleResTarget.name}${r.battleResTarget.spec ? ` (${r.battleResTarget.spec})` : ''}`
      : '';
    sentence += ` That was right after your ${r.battleResAbility}${who} — a life traded for someone else's, not a positioning error.`;
  } else if (r.lateInFight) {
    sentence += ' It landed in the closing seconds, so it cost almost nothing.';
  }

  const nearby = r.nearbyDeaths ?? [];
  if (nearby.length) {
    sentence += ` ${describeNearby(nearby)}`;
  }

  return sentence;
}

function describeNearby(nearby) {
  const who = nearby
    .slice(0, 3)
    .map((n) => {
      const label = `${n.name}${n.spec ? ` (${n.spec})` : ''}`;
      const when = n.offsetMs < 0 ? `${sec(-n.offsetMs)}s before` : `${sec(n.offsetMs)}s after`;
      return `${label} ${when}`;
    })
    .join(', ');
  const allBefore = nearby.every((n) => n.offsetMs < 0);
  return allBefore
    ? `The pull was already going wrong — ${who} you.`
    : `You weren't alone — ${who}.`;
}

export function adviceFor(gapItem) {
  switch (gapItem.category) {
    case 'deaths':
      return deathAdvice(gapItem);
    case 'downtime': {
      const fromDeath = gapItem.deathCausedCount ?? 0;
      // Don't tell someone to keep casting through a corpse run - that idle
      // time is already accounted for as a death above.
      const caveat = fromDeath
        ? ` ${fromDeath} of those window${fromDeath === 1 ? ' is' : 's are'} your death${fromDeath === 1 ? '' : 's'}, already counted above.`
        : '';
      return (
        `You were idle ${gapItem.mine}% of the run vs their ${gapItem.cohort}% — close the biggest gaps ` +
        `(see downtime windows): always be casting something while moving between pulls.${caveat}`
      );
    }
    case 'cpm': {
      // "cast more" is not actionable. Name the buttons that lagged, by rate.
      const behind = gapItem.behind ?? [];
      const which = behind.length
        ? ` The rate lag is mostly ${behind
            .map((b) => `${b.name} (${b.myCpm} vs their ${b.theirCpm} CPM, ${b.cpmBehindBy} behind)`)
            .join(', ')}.`
        : '';
      return (
        `You averaged ${gapItem.mine} casts/min vs their ${gapItem.cohort} (measured over active combat time).${which} ` +
        `Fewer rotation pauses and earlier pre-positioning close most of this.`
      );
    }
    case 'ability': {
      const note = ABILITY_MECHANIC_NOTE[gapItem.name];
      return (
        `Top players cast ${gapItem.name}${note ? ` (${note})` : ''} at ${gapItem.cohort} vs your ${gapItem.mine}` +
        (gapItem.damageSharePct ? ` and it carries ~${gapItem.damageSharePct}% of their damage` : '') +
        `; press it closer to on-cooldown / weave it more often.`
      );
    }
    case 'uptime':
      return (
        `Their median ${gapItem.name} uptime is ${gapItem.cohort} vs your ${gapItem.mine} ` +
        `(measured only while actively playing, idle/death windows excluded) — a genuine buff-management ` +
        `gap, not a downtime artifact; keep it rolling.`
      );
    case 'waste': {
      // the resource is whatever the log said this spec generates — no class here
      const res = gapItem.resource ?? 'resource';
      return (
        `You lost ${gapItem.mine} of your potential ${res} to overcapping (~${gapItem.wastedAmount} over the run) ` +
        `vs their ${gapItem.cohort} — spend it before it caps rather than holding it for a "better" moment. ` +
        `Every point wasted is a cast you never got to make.`
      );
    }
    default:
      return '';
  }
}
