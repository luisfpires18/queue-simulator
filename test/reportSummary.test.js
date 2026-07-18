import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReport } from '../src/server/analysis/compare.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundle = JSON.parse(readFileSync(path.join(ROOT, 'fixtures', 'comparison-10658-plus0.json'), 'utf8'));

test('buildReport produces a top-of-report summary derived from the same gaps', () => {
  const report = buildReport(bundle);
  const s = report.summary;
  assert.ok(s, 'summary is present');
  assert.equal(typeof s.diagnosis, 'string');
  assert.ok(s.diagnosis.length > 0);
  assert.ok(Array.isArray(s.topImprovements));
  assert.ok(s.topImprovements.length <= 3);
  assert.equal(typeof s.conclusion, 'string');
  assert.ok(Array.isArray(s.externalFactors));
  assert.ok(['High', 'Medium', 'Low'].includes(s.confidence.level));
});

test('topImprovements follow the same severity order as report.gaps', () => {
  const report = buildReport(bundle);
  const top = report.summary.topImprovements;
  const expectedTitles = report.gaps.slice(0, top.length).map((g) => g.title);
  assert.deepEqual(top.map((t) => t.title), expectedTitles);
});

test('each topImprovement carries a confidence badge and a fuzzed impact range', () => {
  const report = buildReport(bundle);
  for (const t of report.summary.topImprovements) {
    assert.ok(['High', 'Medium', 'Low'].includes(t.confidence.level));
    assert.equal(t.impactRangePct.length, 2);
    assert.ok(t.impactRangePct[0] <= t.impactRangePct[1]);
  }
});

test('externalFactors only ever contains reasons the confidence assessment actually detected', () => {
  const report = buildReport(bundle);
  const s = report.summary;
  for (const factor of s.externalFactors) {
    assert.ok(s.confidence.reasons.includes(factor));
  }
});

// A comparison against a much shorter opponent run is inherently less trustworthy
// — the summary's confidence should reflect that, and say why.
test('a mismatched-duration opponent run yields lower summary confidence, with reason', () => {
  const mutated = JSON.parse(JSON.stringify(bundle));
  const fight = mutated.other.detail.fight;
  // fightDurationMs() prefers keystoneTime over endTime-startTime for M+ fights
  // (see compare.js), so that's the field that actually needs mutating here.
  fight.keystoneTime = Math.round(fight.keystoneTime * 0.6); // ~40% shorter
  const mutatedReport = buildReport(mutated);

  assert.notEqual(mutatedReport.summary.confidence.level, 'High');
  assert.ok(mutatedReport.summary.confidence.reasons.some((r) => r.includes('duration')));
});
