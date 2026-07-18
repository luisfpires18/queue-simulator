import { test } from 'vitest';
import assert from 'node:assert/strict';
import { assessConfidence, gapConfidence } from '../src/server/analysis/confidence.js';

test('matching durations, no missing data, not truncated -> High confidence', () => {
  const c = assessConfidence({ myDurationMs: 300000, theirDurationMs: 302000 });
  assert.equal(c.level, 'High');
  assert.ok(c.reason.length > 0);
  assert.ok(c.reasons.length >= 1);
});

test('a large duration mismatch drops confidence and says why', () => {
  const high = assessConfidence({ myDurationMs: 300000, theirDurationMs: 300000 });
  const mismatched = assessConfidence({ myDurationMs: 300000, theirDurationMs: 300000 * 1.4 });
  assert.notEqual(mismatched.level, high.level);
  assert.ok(mismatched.reasons.some((r) => r.includes('duration')));
});

test('a truncated (wipe vs partial kill window) comparison drops confidence and says why', () => {
  const full = assessConfidence({ myDurationMs: 300000, theirDurationMs: 300000, truncated: false });
  const truncated = assessConfidence({ myDurationMs: 300000, theirDurationMs: 300000, truncated: true });
  assert.ok(truncated.score < full.score);
  assert.ok(truncated.reasons.some((r) => r.includes('wipe') || r.includes('partial')));
});

test('missing data lowers confidence and names what is missing', () => {
  const clean = assessConfidence({ myDurationMs: 300000, theirDurationMs: 300000 });
  const missing = assessConfidence({
    myDurationMs: 300000,
    theirDurationMs: 300000,
    missingData: ['death data', 'resource data'],
  });
  assert.ok(missing.score < clean.score);
  assert.ok(missing.reasons.some((r) => r.includes('death data')));
  assert.ok(missing.reasons.some((r) => r.includes('resource data')));
});

test('unknown duration on either side is treated as a confidence hit', () => {
  const c = assessConfidence({ myDurationMs: null, theirDurationMs: 300000 });
  assert.ok(c.score < 100);
  assert.ok(c.reasons.some((r) => r.includes('duration could not be determined')));
});

test('a perfect match still never reaches "certain" — single comparison run ceiling', () => {
  const c = assessConfidence({ myDurationMs: 300000, theirDurationMs: 300000 });
  assert.ok(c.score < 100, 'even a perfect match is capped below 100 by the single-sample deduction');
  assert.ok(c.reasons.some((r) => r.includes("one player's run")));
});

test('confidence level is always one of High/Medium/Low', () => {
  for (const opts of [
    {},
    { myDurationMs: 100, theirDurationMs: 100000 },
    { truncated: true, missingData: ['death data', 'resource data', 'buff-source attribution'] },
  ]) {
    const c = assessConfidence(opts);
    assert.ok(['High', 'Medium', 'Low'].includes(c.level));
  }
});

test('gapConfidence steps a thin-sample finding down one band', () => {
  const base = assessConfidence({ myDurationMs: 300000, theirDurationMs: 300000 });
  const thin = gapConfidence(base, { sampleCount: 2, minSample: 5 });
  assert.notEqual(thin.level, base.level);
  assert.ok(thin.reason.includes('small sample'));
});

test('gapConfidence leaves a solid-sample finding untouched', () => {
  const base = assessConfidence({ myDurationMs: 300000, theirDurationMs: 300000 });
  const solid = gapConfidence(base, { sampleCount: 20, minSample: 5 });
  assert.equal(solid.level, base.level);
  assert.equal(solid.reason, base.reason);
});

test('gapConfidence floors at Low, never goes negative', () => {
  const base = assessConfidence({ truncated: true, missingData: ['death data', 'resource data', 'buff-source attribution'] });
  assert.equal(base.level, 'Low');
  const thin = gapConfidence(base, { sampleCount: 1, minSample: 5 });
  assert.equal(thin.level, 'Low');
});
