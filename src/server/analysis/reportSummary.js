// The top-of-report summary: one paragraph diagnosis, the top 3 things to fix,
// a rough impact range, a confidence badge, and only the external factors this
// codebase can actually detect — all derived from the SAME gaps[] the report
// already computes (server/analysis/compare.js). Never a second analysis
// pass, never a new claim.
//
// Not named summary.js: that name belonged to a removed cohort-era prose
// module (see docs/architecture.md's stale references) with different
// semantics — no confidence, no impact range, no cohort. Reusing the filename
// risked exactly that confusion.
//
// Same two-function convention as parseTiers.js: one function builds data,
// a second turns it into prose — kept separate here as buildSummary() only,
// since its prose pieces are per-field rather than one block of text.

/**
 * @param {object} p
 * @param {object} p.headline report.headline (dpsGapPct, otherLabel, myDps, theirDps)
 * @param {object[]} p.gaps report.gaps, sorted desc by severity, each already carrying .confidence
 * @param {ReturnType<import('./confidence.js').assessConfidence>} p.confidence run-level confidence
 * @returns {{diagnosis:string, topImprovements:object[], confidence:object, externalFactors:string[], conclusion:string}}
 */
export function buildSummary({ headline, gaps, confidence }) {
  const top = (gaps ?? []).slice(0, 3);
  const topImprovements = top.map((g) => ({
    category: g.category,
    title: g.title,
    advice: g.advice,
    priority: g.priority,
    confidence: g.confidence ?? confidence,
    // A FUZZED range, not the raw severity number — severity was never more
    // than a rough %-DPS estimate (see compare.js), and a bare number reads
    // as exact. A +/-30% band keeps that honesty.
    impactRangePct: [round1(g.severity * 0.7), round1(g.severity * 1.3)],
  }));

  return {
    diagnosis: describeDiagnosis(headline, top),
    topImprovements,
    confidence,
    externalFactors: describeExternalFactors(confidence),
    conclusion: describeConclusion(top),
  };
}

function describeDiagnosis(headline, top) {
  const gapPct = headline?.dpsGapPct;
  const who = headline?.otherLabel ?? 'the comparison run';
  const lead = gapPct == null
    ? `Here's how this run compares to ${who}.`
    : gapPct > 0
      ? `You're ${gapPct}% behind ${who}.`
      : `You're ${Math.abs(gapPct)}% ahead of ${who}.`;
  if (!top.length) return `${lead} No significant gaps stood out against this comparison.`;
  const names = top.map((g) => g.title.replace(/\s*\(active time\)\s*/i, '')).join(', ');
  return `${lead} The largest contributors were: ${names}.`;
}

function describeConclusion(top) {
  if (!top.length) return 'Nothing stands out against this comparison run.';
  // Titles can be generic ("Casts per minute") or a proper noun (an ability
  // name like "Dark Transformation") — never case-mangle them, since lowering
  // the first letter of a proper noun mid-sentence reads as a typo.
  const names = top.map((g) => plain(g.title));
  if (names.length === 1) return `Your main issue was ${names[0]}.`;
  const rest = names.slice(1);
  const tail = rest.length > 1 ? `${rest.slice(0, -1).join(', ')} and ${rest[rest.length - 1]}` : rest[0];
  return `Your main issue was ${names[0]}, followed by ${tail}.`;
}

function describeExternalFactors(confidence) {
  // ONLY ever the reasons assessConfidence() actually detected — see
  // reportSummary's header comment and confidence.js for why nothing beyond
  // those categories belongs here (no data source for "different route" /
  // "different group comp" / "bad RNG" anywhere in this codebase).
  return confidence?.reasons ?? [];
}

function plain(title) {
  return title.replace(/\s*\(active time\)\s*/i, '');
}

function round1(v) {
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10) / 10 : v;
}
