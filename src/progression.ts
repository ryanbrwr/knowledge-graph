import { getIncomingEdges, getOutgoingEdges, type GraphIndex } from './indexing.js';
import type { DiagnosticCoverage, GraphNode } from './model.js';

export interface UnlockOptions {
  courseId?: string;
  includeNonAtomic?: boolean;
  candidateNodeIds?: readonly string[];
}

export interface RankedReadyNode {
  node: GraphNode;
  score: number;
  reasons: readonly string[];
}

export interface ReadyNodeRankingContext extends UnlockOptions {
  previousNodeId?: string;
}

export interface RankedDiagnosticProbe {
  coverage: DiagnosticCoverage;
  score: number;
  reasons: readonly string[];
}

export interface ImplicitReviewInput {
  nodeId: string;
  skillId: string;
  modalityId: string;
  evidenceScore: number;
  confidence: number;
}

export interface ImplicitReviewCredit {
  ruleId: string;
  sourceNodeId: string;
  reviewedNodeId: string;
  skillId: string;
  credit: number;
  reason: string;
}

export function getUnlockedNodeIds(
  index: GraphIndex,
  masteredNodeIds: ReadonlySet<string>,
  options: UnlockOptions = {},
): readonly string[] {
  const candidates = resolveCandidates(index, options);
  return candidates
    .filter((node) => options.includeNonAtomic === true || node.atomic)
    .filter((node) => !masteredNodeIds.has(node.id))
    .filter((node) => getIncomingEdges(index, node.id, 'prerequisite')
      .every((edge) => masteredNodeIds.has(edge.fromNodeId)))
    .map((node) => node.id);
}

export function getMissingPrerequisiteIds(
  index: GraphIndex,
  nodeId: string,
  masteredNodeIds: ReadonlySet<string>,
): readonly string[] {
  const missing = new Set<string>();
  const pending = [nodeId];
  while (pending.length > 0) {
    const currentId = pending.pop();
    if (currentId === undefined) break;
    for (const edge of getIncomingEdges(index, currentId, 'prerequisite')) {
      if (masteredNodeIds.has(edge.fromNodeId) || missing.has(edge.fromNodeId)) continue;
      missing.add(edge.fromNodeId);
      pending.push(edge.fromNodeId);
    }
  }
  return [...missing];
}

export function rankReadyNodes(
  index: GraphIndex,
  masteredNodeIds: ReadonlySet<string>,
  context: ReadyNodeRankingContext = {},
): readonly RankedReadyNode[] {
  const unlockedIds = getUnlockedNodeIds(index, masteredNodeIds, context);
  const courseWeights = new Map(
    context.courseId === undefined
      ? []
      : index.seedPack.courseNodes
        .filter((item) => item.courseId === context.courseId)
        .map((item) => [item.nodeId, item.weight]),
  );

  return unlockedIds
    .map((nodeId): RankedReadyNode | null => {
      const node = index.nodeById.get(nodeId);
      if (node === undefined) return null;
      const reasons: string[] = ['all prerequisites are mastered'];
      const dependentCount = getOutgoingEdges(index, nodeId, 'prerequisite').length;
      const taskCount = index.taskVariantsByNodeId.get(nodeId)?.length ?? 0;
      const diagnosticCount = index.diagnosticCoverageByNodeId.get(nodeId)?.length ?? 0;
      const courseWeight = courseWeights.get(nodeId) ?? 0.5;
      let score = 1 + courseWeight * 0.25 + Math.min(dependentCount, 5) * 0.04;

      if (taskCount > 0) {
        score += Math.min(taskCount, 4) * 0.03;
        reasons.push(`${taskCount} task variant${taskCount === 1 ? '' : 's'} available`);
      }
      if (diagnosticCount > 0) {
        score += Math.min(diagnosticCount, 3) * 0.02;
        reasons.push('diagnostic evidence is available');
      }
      if (dependentCount > 0) reasons.push(`unlocks ${dependentCount} dependent node${dependentCount === 1 ? '' : 's'}`);

      if (context.previousNodeId !== undefined) {
        const interferes = getOutgoingEdges(index, context.previousNodeId, 'contrasts')
          .some((edge) => edge.toNodeId === nodeId)
          || getIncomingEdges(index, context.previousNodeId, 'contrasts')
            .some((edge) => edge.fromNodeId === nodeId);
        if (interferes) {
          score -= 0.35;
          reasons.push('deprioritized to avoid immediate interference');
        }
      }

      return { node, score: round(score), reasons };
    })
    .filter((item): item is RankedReadyNode => item !== null)
    .sort((left, right) => right.score - left.score || left.node.id.localeCompare(right.node.id));
}

export function rankDiagnosticProbes(
  index: GraphIndex,
  masteryByNodeId: ReadonlyMap<string, number> = new Map(),
): readonly RankedDiagnosticProbe[] {
  return index.seedPack.diagnosticCoverage
    .map((coverage) => {
      const mastery = clamp01(masteryByNodeId.get(coverage.nodeId) ?? 0.5);
      const uncertainty = 1 - Math.abs(mastery - 0.5) * 2;
      const discrimination = Math.abs(coverage.successImpliesMastery - coverage.failureImpliesGap);
      const score = coverage.informationGain * (0.5 + uncertainty * 0.35 + discrimination * 0.15);
      return {
        coverage,
        score: round(score),
        reasons: [
          `information gain ${coverage.informationGain.toFixed(2)}`,
          `mastery uncertainty ${uncertainty.toFixed(2)}`,
          `outcome discrimination ${discrimination.toFixed(2)}`,
        ],
      };
    })
    .sort((left, right) => right.score - left.score || left.coverage.id.localeCompare(right.coverage.id));
}

export function calculateImplicitReviewCredits(
  index: GraphIndex,
  input: ImplicitReviewInput,
): readonly ImplicitReviewCredit[] {
  const score = clamp01(input.evidenceScore);
  const confidence = clamp01(input.confidence);
  return (index.implicitReviewRulesBySourceNodeId.get(input.nodeId) ?? [])
    .filter((rule) => rule.skillId === input.skillId)
    .filter((rule) => rule.modalityId === input.modalityId || rule.modalityId === 'mixed')
    .filter((rule) => score >= rule.minEvidenceScore && confidence >= rule.minConfidence)
    .map((rule) => ({
      ruleId: rule.id,
      sourceNodeId: rule.fromNodeId,
      reviewedNodeId: rule.toNodeId,
      skillId: rule.skillId,
      credit: round(rule.fractionalCredit * score * confidence),
      reason: rule.reason,
    }));
}

function resolveCandidates(index: GraphIndex, options: UnlockOptions): readonly GraphNode[] {
  const requestedIds = options.candidateNodeIds === undefined
    ? null
    : new Set(options.candidateNodeIds);
  const courseNodeIds = options.courseId === undefined
    ? null
    : new Set(
      index.seedPack.courseNodes
        .filter((item) => item.courseId === options.courseId)
        .map((item) => item.nodeId),
    );
  return index.seedPack.nodes.filter((node) => (
    (requestedIds === null || requestedIds.has(node.id))
    && (courseNodeIds === null || courseNodeIds.has(node.id))
  ));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
