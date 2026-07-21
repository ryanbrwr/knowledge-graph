import assert from 'node:assert/strict';
import test from 'node:test';

import { algebraSeedPack } from '../examples/algebra.js';
import {
  calculateImplicitReviewCredits,
  createGraphIndex,
  getMissingPrerequisiteIds,
  getUnlockedNodeIds,
  rankDiagnosticProbes,
  rankReadyNodes,
  safeParseGraphSeedPack,
  validateGraphSeedPack,
} from '../src/index.js';

test('validates a domain-neutral course graph', () => {
  const result = validateGraphSeedPack(algebraSeedPack, {
    allowedActivityFormats: ['short_answer'],
  });

  assert.equal(result.valid, true, JSON.stringify(result.issues, null, 2));
  assert.equal(result.metrics.nodes, 2);
  assert.equal(result.metrics.edgesPerNode, 0.5);
  assert.equal(result.metrics.taskVariantsPerAtomicNode, 1);
});

test('rejects malformed runtime input before graph algorithms see it', () => {
  const invalid = structuredClone(algebraSeedPack) as Record<string, unknown>;
  invalid.schemaVersion = 2;

  const parsed = safeParseGraphSeedPack(invalid);
  assert.equal(parsed.success, false);
});

test('reports missing endpoints and prerequisite cycles', () => {
  const invalid = structuredClone(algebraSeedPack);
  invalid.edges.push({
    fromNodeId: 'solve-one-step-addition',
    toNodeId: 'recognize-variable',
    relation: 'prerequisite',
    weight: 0.5,
    reason: 'Invalid reverse dependency for cycle testing.',
    confidence: 1,
  });
  invalid.failureMappings[0]!.suspectedPrerequisiteNodeId = 'missing-node';

  const result = validateGraphSeedPack(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === 'prerequisite_cycle'));
  assert.ok(result.issues.some((issue) => issue.code === 'missing_endpoint'));
});

test('unlocks nodes only after their prerequisites are mastered', () => {
  const index = createGraphIndex(algebraSeedPack);

  assert.deepEqual(getUnlockedNodeIds(index, new Set()), ['recognize-variable']);
  assert.deepEqual(
    getUnlockedNodeIds(index, new Set(['recognize-variable'])),
    ['solve-one-step-addition'],
  );
  assert.deepEqual(
    getMissingPrerequisiteIds(index, 'solve-one-step-addition', new Set()),
    ['recognize-variable'],
  );
});

test('ready-node rankings remain explainable', () => {
  const index = createGraphIndex(algebraSeedPack);
  const ranked = rankReadyNodes(index, new Set(), { courseId: 'course-intro-algebra' });

  assert.equal(ranked[0]?.node.id, 'recognize-variable');
  assert.ok(ranked[0]?.reasons.includes('all prerequisites are mastered'));
});

test('diagnostics favor uncertain, high-information probes', () => {
  const index = createGraphIndex(algebraSeedPack);
  const ranked = rankDiagnosticProbes(index, new Map([['recognize-variable', 0.5]]));

  assert.equal(ranked[0]?.coverage.id, 'diagnostic-recognize-variable');
  assert.ok((ranked[0]?.score ?? 0) > 0);
  assert.equal(ranked[0]?.reasons.length, 3);
});

test('implicit review is fractional, thresholded, and explicit', () => {
  const index = createGraphIndex(algebraSeedPack);
  const credits = calculateImplicitReviewCredits(index, {
    nodeId: 'solve-one-step-addition',
    skillId: 'recognition',
    modalityId: 'written',
    evidenceScore: 0.9,
    confidence: 0.8,
  });

  assert.deepEqual(credits, [
    {
      ruleId: 'review-variable-through-equation',
      sourceNodeId: 'solve-one-step-addition',
      reviewedNodeId: 'recognize-variable',
      skillId: 'recognition',
      credit: 0.18,
      reason: 'Solving the equation exercises variable recognition.',
    },
  ]);
});
