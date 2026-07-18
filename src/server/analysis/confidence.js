// How much to trust a comparison, given the log data actually available.
//
// This can only speak to ONE thing: how comparable the two runs being diffed
// actually are (duration/route mismatch, missing event data) and how thin the
// evidence behind a single finding is. It is NOT statistical significance —
// there is no cohort yet, so every comparison is against exactly one other
// player's run. A "High" confidence here means "trust this diff", not "this
// is proven"; that distinction is why the score can never reach "certain" —
// see the flat single-sample deduction below.

const LEVELS = ['Low', 'Medium', 'High'];

function bandOf(score) {
  if (score >= 75) return 'High';
  if (score >= 50) return 'Medium';
  return 'Low';
}

/**
 * @param {object} p
 * @param {number|null} [p.myDurationMs]
 * @param {number|null} [p.theirDurationMs]
 * @param {boolean} [p.truncated] raid wipe compared against a partial window of a kill
 * @param {string[]} [p.missingData] short labels, e.g. ['death data', 'resource data']
 * @returns {{level:'High'|'Medium'|'Low', reason:string, reasons:string[], score:number, durationDiffPct:number|null}}
 */
export function assessConfidence({ myDurationMs = null, theirDurationMs = null, truncated = false, missingData = [] } = {}) {
  let score = 100;
  const reasons = [];

  let durationDiffPct = null;
  if (typeof myDurationMs === 'number' && typeof theirDurationMs === 'number' && myDurationMs > 0 && theirDurationMs > 0) {
    durationDiffPct = Math.round((100 * Math.abs(myDurationMs - theirDurationMs)) / theirDurationMs);
    if (durationDiffPct > 25) {
      score -= 40;
      reasons.push(`fight durations differ by ${durationDiffPct}% — likely a different route or pull plan`);
    } else if (durationDiffPct > 10) {
      score -= 15;
      reasons.push(`fight durations differ by ${durationDiffPct}% — pace was not identical`);
    }
  } else {
    score -= 20;
    reasons.push("one run's fight duration could not be determined");
  }

  if (truncated) {
    score -= 25;
    reasons.push('this is a wipe compared against a partial window of a kill, not the full fight');
  }

  for (const label of missingData) {
    score -= 15;
    reasons.push(`${label} was missing from the log`);
  }

  // Always present pre-cohort: this is one comparison run, not a group average.
  score -= 10;
  const sampleReason = 'compared against one player\'s run, not a group average';
  reasons.push(sampleReason);

  score = Math.max(0, Math.min(100, score));
  const level = bandOf(score);
  const reason = reasons.length ? reasons[0] : sampleReason;

  return { level, reason, reasons, score, durationDiffPct };
}

/**
 * Downgrades a baseline confidence for one finding whose OWN sample is thin
 * (e.g. an ability pressed only 2-3 times total) — run-level confidence can be
 * High while one ability-usage finding is still Low.
 *
 * @param {ReturnType<typeof assessConfidence>} base
 * @param {object} [p]
 * @param {number|null} [p.sampleCount]
 * @param {number} [p.minSample]
 */
export function gapConfidence(base, { sampleCount = null, minSample = 5 } = {}) {
  if (sampleCount == null || sampleCount >= minSample) return base;
  const idx = Math.max(0, LEVELS.indexOf(base.level) - 1);
  const level = LEVELS[idx];
  const reason = `small sample — only ${sampleCount} observed presses`;
  return { ...base, level, reason, reasons: [reason, ...base.reasons] };
}
