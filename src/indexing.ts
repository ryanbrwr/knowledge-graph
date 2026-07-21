import type {
  DiagnosticCoverage,
  GraphEdge,
  GraphNode,
  GraphSeedPack,
  ImplicitReviewRule,
  KnowledgePoint,
  StandardEdgeRelation,
  TaskVariant,
} from './model.js';

export interface GraphIndex {
  readonly seedPack: GraphSeedPack;
  readonly nodeById: ReadonlyMap<string, GraphNode>;
  readonly incomingEdgesByNodeId: ReadonlyMap<string, readonly GraphEdge[]>;
  readonly outgoingEdgesByNodeId: ReadonlyMap<string, readonly GraphEdge[]>;
  readonly knowledgePointsByNodeId: ReadonlyMap<string, readonly KnowledgePoint[]>;
  readonly taskVariantsByNodeId: ReadonlyMap<string, readonly TaskVariant[]>;
  readonly diagnosticCoverageByNodeId: ReadonlyMap<string, readonly DiagnosticCoverage[]>;
  readonly implicitReviewRulesBySourceNodeId: ReadonlyMap<string, readonly ImplicitReviewRule[]>;
}

export function createGraphIndex(seedPack: GraphSeedPack): GraphIndex {
  return {
    seedPack,
    nodeById: new Map(seedPack.nodes.map((node) => [node.id, node])),
    incomingEdgesByNodeId: groupBy(seedPack.edges, (edge) => edge.toNodeId),
    outgoingEdgesByNodeId: groupBy(seedPack.edges, (edge) => edge.fromNodeId),
    knowledgePointsByNodeId: groupBy(seedPack.knowledgePoints, (point) => point.nodeId),
    taskVariantsByNodeId: groupBy(seedPack.taskVariants, (variant) => variant.nodeId),
    diagnosticCoverageByNodeId: groupBy(seedPack.diagnosticCoverage, (coverage) => coverage.nodeId),
    implicitReviewRulesBySourceNodeId: groupBy(
      seedPack.implicitReviewRules,
      (rule) => rule.fromNodeId,
    ),
  };
}

export function getIncomingEdges(
  index: GraphIndex,
  nodeId: string,
  relation?: StandardEdgeRelation,
): readonly GraphEdge[] {
  const edges = index.incomingEdgesByNodeId.get(nodeId) ?? [];
  return relation === undefined ? edges : edges.filter((edge) => edge.relation === relation);
}

export function getOutgoingEdges(
  index: GraphIndex,
  nodeId: string,
  relation?: StandardEdgeRelation,
): readonly GraphEdge[] {
  const edges = index.outgoingEdgesByNodeId.get(nodeId) ?? [];
  return relation === undefined ? edges : edges.filter((edge) => edge.relation === relation);
}

export function getPrerequisiteClosure(index: GraphIndex, nodeId: string): readonly string[] {
  const result = new Set<string>();
  const pending = [nodeId];
  while (pending.length > 0) {
    const currentId = pending.pop();
    if (currentId === undefined) break;
    for (const edge of getIncomingEdges(index, currentId, 'prerequisite')) {
      if (result.has(edge.fromNodeId)) continue;
      result.add(edge.fromNodeId);
      pending.push(edge.fromNodeId);
    }
  }
  return [...result];
}

export function getDependentClosure(index: GraphIndex, nodeId: string): readonly string[] {
  const result = new Set<string>();
  const pending = [nodeId];
  while (pending.length > 0) {
    const currentId = pending.pop();
    if (currentId === undefined) break;
    for (const edge of getOutgoingEdges(index, currentId, 'prerequisite')) {
      if (result.has(edge.toNodeId)) continue;
      result.add(edge.toNodeId);
      pending.push(edge.toNodeId);
    }
  }
  return [...result];
}

function groupBy<T>(values: readonly T[], keyFor: (value: T) => string): ReadonlyMap<string, readonly T[]> {
  const result = new Map<string, T[]>();
  for (const value of values) {
    const key = keyFor(value);
    const group = result.get(key) ?? [];
    group.push(value);
    result.set(key, group);
  }
  return result;
}
