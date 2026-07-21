import {
  safeParseGraphSeedPack,
  type GraphNode,
  type GraphSeedPack,
  type StandardEdgeRelation,
} from './model.js';

export type GraphValidationSeverity = 'error' | 'warning';

export interface GraphValidationIssue {
  severity: GraphValidationSeverity;
  code: string;
  message: string;
  path: string | null;
}

export interface GraphMetrics {
  nodes: number;
  atomicNodes: number;
  edges: number;
  courses: number;
  knowledgePoints: number;
  taskVariants: number;
  diagnosticCoverage: number;
  implicitReviewRules: number;
  edgesPerNode: number;
  knowledgePointsPerAtomicNode: number;
  taskVariantsPerAtomicNode: number;
  diagnosticNodeCoverage: number;
}

export interface GraphValidationResult {
  valid: boolean;
  issues: readonly GraphValidationIssue[];
  metrics: GraphMetrics;
  seedPack: GraphSeedPack | null;
}

export interface GraphValidationContext {
  existingNodeIds?: readonly string[];
  existingTaskVariantIds?: readonly string[];
  existingSourceIds?: readonly string[];
  allowedActivityFormats?: readonly string[];
  requiresExternalSourceForNode?: (node: GraphNode) => boolean;
  maximumDirectPrerequisites?: number;
  maximumKnowledgePointPrerequisites?: number;
}

export class GraphValidationError extends Error {
  readonly result: GraphValidationResult;

  constructor(result: GraphValidationResult) {
    const errorCount = result.issues.filter((issue) => issue.severity === 'error').length;
    super(`Learning graph validation failed with ${errorCount} error(s).`);
    this.name = 'GraphValidationError';
    this.result = result;
  }
}

const emptyMetrics: GraphMetrics = {
  nodes: 0,
  atomicNodes: 0,
  edges: 0,
  courses: 0,
  knowledgePoints: 0,
  taskVariants: 0,
  diagnosticCoverage: 0,
  implicitReviewRules: 0,
  edgesPerNode: 0,
  knowledgePointsPerAtomicNode: 0,
  taskVariantsPerAtomicNode: 0,
  diagnosticNodeCoverage: 0,
};

export function validateGraphSeedPack(
  input: unknown,
  context: GraphValidationContext = {},
): GraphValidationResult {
  const parsed = safeParseGraphSeedPack(input);
  if (!parsed.success) {
    const issues: GraphValidationIssue[] = parsed.error.issues.map((zodIssue) => ({
      severity: 'error',
      code: 'invalid_shape',
      message: zodIssue.message,
      path: zodIssue.path.join('.') || null,
    }));
    return { valid: false, issues, metrics: emptyMetrics, seedPack: null };
  }

  const seedPack = parsed.data;
  const issues: GraphValidationIssue[] = [];
  const maximumDirectPrerequisites = context.maximumDirectPrerequisites ?? 4;
  const maximumKnowledgePointPrerequisites = context.maximumKnowledgePointPrerequisites ?? 4;
  const packNodeIds = new Set(seedPack.nodes.map((node) => node.id));
  const allNodeIds = new Set([...(context.existingNodeIds ?? []), ...packNodeIds]);
  const allTaskVariantIds = new Set([
    ...(context.existingTaskVariantIds ?? []),
    ...seedPack.taskVariants.map((variant) => variant.id),
  ]);
  const availableSourceIds = new Set([
    ...(context.existingSourceIds ?? []),
    ...seedPack.sources.map((source) => source.id),
  ]);
  const courseIds = new Set(seedPack.courses.map((course) => course.id));
  const interferenceSetIds = new Set(seedPack.interferenceSets.map((set) => set.id));
  const knowledgePointIds = new Set(seedPack.knowledgePoints.map((point) => point.id));
  const objectiveNodeIds = new Set(seedPack.objectives.map((objective) => objective.nodeId));
  const taskNodeIds = new Set(seedPack.taskVariants.map((variant) => variant.nodeId));
  const provenanceClaimKeys = new Set(
    seedPack.provenanceClaims.map((claim) => `${claim.targetType}:${claim.targetId}`),
  );

  addDuplicateIssues(issues, 'source', seedPack.sources.map((source) => source.id));
  addDuplicateIssues(issues, 'source reference', seedPack.sourceIds);
  addDuplicateIssues(issues, 'course', seedPack.courses.map((course) => course.id));
  addDuplicateIssues(
    issues,
    'course node',
    seedPack.courseNodes.map((courseNode) => `${courseNode.courseId}:${courseNode.nodeId}`),
  );
  addDuplicateIssues(issues, 'node', seedPack.nodes.map((node) => node.id));
  addDuplicateIssues(issues, 'edge', seedPack.edges.map(edgeKey));
  addDuplicateIssues(issues, 'knowledge point', seedPack.knowledgePoints.map((point) => point.id));
  addDuplicateIssues(
    issues,
    'knowledge point prerequisite',
    seedPack.knowledgePointPrerequisites.map(
      (item) => `${item.knowledgePointId}:${item.prerequisiteNodeId}:${item.skillId}`,
    ),
  );
  addDuplicateIssues(issues, 'objective', seedPack.objectives.map((objective) => objective.id));
  addDuplicateIssues(issues, 'task variant', seedPack.taskVariants.map((variant) => variant.id));
  addDuplicateIssues(issues, 'interference set', seedPack.interferenceSets.map((set) => set.id));
  addDuplicateIssues(
    issues,
    'interference set node',
    seedPack.interferenceSetNodes.map((item) => `${item.setId}:${item.nodeId}`),
  );
  addDuplicateIssues(issues, 'failure mapping', seedPack.failureMappings.map((mapping) => mapping.id));
  addDuplicateIssues(issues, 'diagnostic coverage', seedPack.diagnosticCoverage.map((item) => item.id));
  addDuplicateIssues(issues, 'implicit review rule', seedPack.implicitReviewRules.map((rule) => rule.id));
  addDuplicateIssues(
    issues,
    'provenance claim',
    seedPack.provenanceClaims.map((claim) => `${claim.targetType}:${claim.targetId}`),
  );

  for (const sourceId of seedPack.sourceIds) {
    if (!availableSourceIds.has(sourceId)) {
      addIssue(issues, 'error', 'missing_source', `Seed pack references unavailable source ${sourceId}.`, `sourceIds.${sourceId}`);
    }
  }

  validateProvenance(issues, seedPack, availableSourceIds);
  if (!provenanceClaimKeys.has(`seed_pack:${seedPack.id}`)) {
    addIssue(issues, 'error', 'missing_provenance', `Seed pack ${seedPack.id} has no provenance claim.`, 'provenanceClaims');
  }

  const childCountByNode = countChildren(seedPack.nodes);
  for (const node of seedPack.nodes) {
    if (!provenanceClaimKeys.has(`node:${node.id}`)) {
      addIssue(issues, 'error', 'missing_provenance', `Node ${node.id} has no provenance claim.`, `nodes.${node.id}`);
    }
    if (context.requiresExternalSourceForNode?.(node) && !hasExternalSourceClaim(seedPack, 'node', node.id)) {
      addIssue(
        issues,
        'error',
        'external_source_required',
        `Node ${node.id} requires an external-source or hybrid provenance claim.`,
        `nodes.${node.id}`,
      );
    }
    if (node.parentNodeId !== null && !allNodeIds.has(node.parentNodeId)) {
      addIssue(issues, 'error', 'missing_endpoint', `Node ${node.id} references missing parent ${node.parentNodeId}.`, `nodes.${node.id}.parentNodeId`);
    }
    if (node.atomic && (childCountByNode.get(node.id) ?? 0) > 0) {
      addIssue(issues, 'warning', 'atomic_node_has_children', `Atomic node ${node.id} has child nodes.`, `nodes.${node.id}.atomic`);
    }
    if (node.atomic && node.nonGoals.length === 0) {
      addIssue(issues, 'warning', 'atomic_scope_unclear', `Atomic node ${node.id} has no explicit non-goals.`, `nodes.${node.id}.nonGoals`);
    }
    if (node.atomic && !objectiveNodeIds.has(node.id)) {
      addIssue(issues, 'error', 'missing_objective', `Atomic node ${node.id} has no learning objective.`, `nodes.${node.id}`);
    }
    if (node.atomic && !taskNodeIds.has(node.id)) {
      addIssue(issues, 'warning', 'missing_task_variant', `Atomic node ${node.id} has no task variant.`, `nodes.${node.id}`);
    }
  }

  for (const courseNode of seedPack.courseNodes) {
    if (!courseIds.has(courseNode.courseId)) {
      addIssue(issues, 'error', 'missing_endpoint', `Course node references missing course ${courseNode.courseId}.`, `courseNodes.${courseNode.nodeId}`);
    }
    if (!allNodeIds.has(courseNode.nodeId)) {
      addIssue(issues, 'error', 'missing_endpoint', `Course ${courseNode.courseId} references missing node ${courseNode.nodeId}.`, `courseNodes.${courseNode.nodeId}`);
    }
  }

  for (const item of seedPack.interferenceSetNodes) {
    if (!interferenceSetIds.has(item.setId)) {
      addIssue(issues, 'error', 'missing_endpoint', `Interference membership references missing set ${item.setId}.`, `interferenceSetNodes.${item.nodeId}`);
    }
    if (!allNodeIds.has(item.nodeId)) {
      addIssue(issues, 'error', 'missing_endpoint', `Interference set ${item.setId} references missing node ${item.nodeId}.`, `interferenceSetNodes.${item.nodeId}`);
    }
  }

  const prerequisiteCountByPoint = new Map<string, number>();
  for (const point of seedPack.knowledgePoints) {
    if (!allNodeIds.has(point.nodeId)) {
      addIssue(issues, 'error', 'missing_endpoint', `Knowledge point ${point.id} references missing node ${point.nodeId}.`, `knowledgePoints.${point.id}`);
    }
    for (const prerequisiteNodeId of point.keyPrerequisiteNodeIds) {
      if (!allNodeIds.has(prerequisiteNodeId)) {
        addIssue(issues, 'error', 'missing_endpoint', `Knowledge point ${point.id} references missing prerequisite ${prerequisiteNodeId}.`, `knowledgePoints.${point.id}`);
      }
    }
    if (point.keyPrerequisiteNodeIds.length > maximumKnowledgePointPrerequisites) {
      addIssue(issues, 'warning', 'excessive_fan_in', `Knowledge point ${point.id} has ${point.keyPrerequisiteNodeIds.length} key prerequisites.`, `knowledgePoints.${point.id}`);
    }
  }

  for (const prerequisite of seedPack.knowledgePointPrerequisites) {
    prerequisiteCountByPoint.set(
      prerequisite.knowledgePointId,
      (prerequisiteCountByPoint.get(prerequisite.knowledgePointId) ?? 0) + 1,
    );
    if (!knowledgePointIds.has(prerequisite.knowledgePointId)) {
      addIssue(issues, 'error', 'missing_endpoint', `Knowledge-point prerequisite references missing point ${prerequisite.knowledgePointId}.`, `knowledgePointPrerequisites.${prerequisite.knowledgePointId}`);
    }
    if (!allNodeIds.has(prerequisite.prerequisiteNodeId)) {
      addIssue(issues, 'error', 'missing_endpoint', `Knowledge-point prerequisite references missing node ${prerequisite.prerequisiteNodeId}.`, `knowledgePointPrerequisites.${prerequisite.knowledgePointId}`);
    }
    if (prerequisite.prerequisiteKnowledgePointId !== null && !knowledgePointIds.has(prerequisite.prerequisiteKnowledgePointId)) {
      addIssue(issues, 'error', 'missing_endpoint', `Knowledge-point prerequisite references missing point ${prerequisite.prerequisiteKnowledgePointId}.`, `knowledgePointPrerequisites.${prerequisite.knowledgePointId}`);
    }
  }
  for (const [pointId, count] of prerequisiteCountByPoint) {
    if (count > maximumKnowledgePointPrerequisites) {
      addIssue(issues, 'warning', 'excessive_fan_in', `Knowledge point ${pointId} has ${count} explicit prerequisites.`, `knowledgePointPrerequisites.${pointId}`);
    }
  }

  const directPrerequisites = new Map<string, number>();
  for (const edge of seedPack.edges) {
    if (!allNodeIds.has(edge.fromNodeId)) {
      addIssue(issues, 'error', 'missing_endpoint', `Edge references missing source node ${edge.fromNodeId}.`, `edges.${edgeKey(edge)}`);
    }
    if (!allNodeIds.has(edge.toNodeId)) {
      addIssue(issues, 'error', 'missing_endpoint', `Edge references missing target node ${edge.toNodeId}.`, `edges.${edgeKey(edge)}`);
    }
    if (edge.fromNodeId === edge.toNodeId) {
      addIssue(issues, 'error', 'self_edge', `Edge ${edgeKey(edge)} points to itself.`, `edges.${edgeKey(edge)}`);
    }
    if (edge.relation === 'prerequisite') {
      directPrerequisites.set(edge.toNodeId, (directPrerequisites.get(edge.toNodeId) ?? 0) + 1);
    }
  }
  for (const [nodeId, count] of directPrerequisites) {
    if (count > maximumDirectPrerequisites) {
      addIssue(issues, 'warning', 'excessive_fan_in', `Node ${nodeId} has ${count} direct prerequisites.`, `nodes.${nodeId}`);
    }
  }

  for (const cycle of findDirectedCycles(seedPack.nodes.map((node) => node.id), seedPack.edges.filter((edge) => edge.relation === 'prerequisite'))) {
    addIssue(issues, 'error', 'prerequisite_cycle', `Prerequisite cycle detected: ${cycle.join(' -> ')}.`, 'edges');
  }
  const parentEdges = seedPack.nodes
    .filter((node): node is GraphNode & { parentNodeId: string } => node.parentNodeId !== null && packNodeIds.has(node.parentNodeId))
    .map((node) => ({ fromNodeId: node.parentNodeId, toNodeId: node.id, relation: 'unlocks' as const }));
  for (const cycle of findDirectedCycles(seedPack.nodes.map((node) => node.id), parentEdges)) {
    addIssue(issues, 'error', 'parent_cycle', `Parent hierarchy cycle detected: ${cycle.join(' -> ')}.`, 'nodes');
  }

  for (const objective of seedPack.objectives) {
    if (!allNodeIds.has(objective.nodeId)) {
      addIssue(issues, 'error', 'missing_endpoint', `Objective ${objective.id} references missing node ${objective.nodeId}.`, `objectives.${objective.id}`);
    }
  }

  const allowedActivityFormats = context.allowedActivityFormats === undefined
    ? null
    : new Set(context.allowedActivityFormats);
  for (const variant of seedPack.taskVariants) {
    if (!provenanceClaimKeys.has(`task:${variant.id}`)) {
      addIssue(issues, 'error', 'missing_provenance', `Task variant ${variant.id} has no provenance claim.`, `taskVariants.${variant.id}`);
    }
    if (variant.examLike && !hasExternalSourceClaim(seedPack, 'task', variant.id)) {
      addIssue(issues, 'error', 'external_source_required', `Exam-like task ${variant.id} requires external-source or hybrid provenance.`, `taskVariants.${variant.id}`);
    }
    if (!allNodeIds.has(variant.nodeId)) {
      addIssue(issues, 'error', 'missing_endpoint', `Task variant ${variant.id} references missing node ${variant.nodeId}.`, `taskVariants.${variant.id}`);
    }
    if (allowedActivityFormats !== null && !allowedActivityFormats.has(variant.activityFormat)) {
      addIssue(issues, 'error', 'unsupported_activity_format', `Task variant ${variant.id} uses unsupported format ${variant.activityFormat}.`, `taskVariants.${variant.id}.activityFormat`);
    }
    if (Object.keys(variant.interactionContract).length === 0) {
      addIssue(issues, 'warning', 'missing_task_contract', `Task variant ${variant.id} has an empty interaction contract.`, `taskVariants.${variant.id}`);
    }
    if (Object.keys(variant.offlineCalibration).length === 0) {
      addIssue(issues, 'warning', 'missing_calibration_prior', `Task variant ${variant.id} has no offline calibration prior.`, `taskVariants.${variant.id}`);
    }
    if (variant.kind === 'exam_probe' && !variant.examLike) {
      addIssue(issues, 'warning', 'exam_contract_mismatch', `Exam probe ${variant.id} is not marked examLike.`, `taskVariants.${variant.id}`);
    }
    if (variant.kind === 'quiz' && !variant.quizzable) {
      addIssue(issues, 'warning', 'quiz_contract_mismatch', `Quiz ${variant.id} is not marked quizzable.`, `taskVariants.${variant.id}`);
    }
    for (const nearDuplicateId of variant.nearDuplicateTaskIds) {
      if (!allTaskVariantIds.has(nearDuplicateId)) {
        addIssue(issues, 'warning', 'missing_near_duplicate', `Task variant ${variant.id} references unavailable near-duplicate ${nearDuplicateId}.`, `taskVariants.${variant.id}`);
      }
    }
  }

  for (const mapping of seedPack.failureMappings) {
    if (!allNodeIds.has(mapping.failedNodeId) || !allNodeIds.has(mapping.suspectedPrerequisiteNodeId)) {
      addIssue(issues, 'error', 'missing_endpoint', `Failure mapping ${mapping.id} references an unavailable node.`, `failureMappings.${mapping.id}`);
    }
  }

  for (const coverage of seedPack.diagnosticCoverage) {
    if (!allTaskVariantIds.has(coverage.taskVariantId)) {
      addIssue(issues, 'error', 'missing_endpoint', `Diagnostic coverage ${coverage.id} references missing task ${coverage.taskVariantId}.`, `diagnosticCoverage.${coverage.id}`);
    }
    if (!allNodeIds.has(coverage.nodeId)) {
      addIssue(issues, 'error', 'missing_endpoint', `Diagnostic coverage ${coverage.id} references missing node ${coverage.nodeId}.`, `diagnosticCoverage.${coverage.id}`);
    }
  }

  for (const rule of seedPack.implicitReviewRules) {
    if (!allNodeIds.has(rule.fromNodeId) || !allNodeIds.has(rule.toNodeId)) {
      addIssue(issues, 'error', 'missing_endpoint', `Implicit review rule ${rule.id} references an unavailable node.`, `implicitReviewRules.${rule.id}`);
    }
    if (rule.fromNodeId === rule.toNodeId) {
      addIssue(issues, 'error', 'self_edge', `Implicit review rule ${rule.id} reviews its own source node.`, `implicitReviewRules.${rule.id}`);
    }
  }

  const metrics = calculateGraphMetrics(seedPack);
  validateQualityTargets(issues, seedPack, metrics);

  return {
    valid: !issues.some((issue) => issue.severity === 'error'),
    issues,
    metrics,
    seedPack,
  };
}

export function assertValidGraphSeedPack(
  input: unknown,
  context: GraphValidationContext = {},
): GraphSeedPack {
  const result = validateGraphSeedPack(input, context);
  if (!result.valid || result.seedPack === null) throw new GraphValidationError(result);
  return result.seedPack;
}

export function calculateGraphMetrics(seedPack: GraphSeedPack): GraphMetrics {
  const atomicNodeIds = new Set(seedPack.nodes.filter((node) => node.atomic).map((node) => node.id));
  const atomicNodes = atomicNodeIds.size;
  const diagnosedAtomicNodes = new Set(
    seedPack.diagnosticCoverage
      .map((coverage) => coverage.nodeId)
      .filter((nodeId) => atomicNodeIds.has(nodeId)),
  ).size;
  return {
    nodes: seedPack.nodes.length,
    atomicNodes,
    edges: seedPack.edges.length,
    courses: seedPack.courses.length,
    knowledgePoints: seedPack.knowledgePoints.length,
    taskVariants: seedPack.taskVariants.length,
    diagnosticCoverage: seedPack.diagnosticCoverage.length,
    implicitReviewRules: seedPack.implicitReviewRules.length,
    edgesPerNode: ratio(seedPack.edges.length, seedPack.nodes.length),
    knowledgePointsPerAtomicNode: ratio(seedPack.knowledgePoints.length, atomicNodes),
    taskVariantsPerAtomicNode: ratio(seedPack.taskVariants.length, atomicNodes),
    diagnosticNodeCoverage: ratio(diagnosedAtomicNodes, atomicNodes),
  };
}

function validateProvenance(
  issues: GraphValidationIssue[],
  seedPack: GraphSeedPack,
  availableSourceIds: ReadonlySet<string>,
): void {
  const validTargetKeys = new Set<string>([
    `seed_pack:${seedPack.id}`,
    ...seedPack.nodes.map((node) => `node:${node.id}`),
    ...seedPack.edges.map((edge) => `edge:${edgeKey(edge)}`),
    ...seedPack.objectives.map((objective) => `objective:${objective.id}`),
    ...seedPack.taskVariants.map((variant) => `task:${variant.id}`),
    ...seedPack.knowledgePoints.map((point) => `knowledge_point:${point.id}`),
    ...seedPack.failureMappings.map((mapping) => `failure_mapping:${mapping.id}`),
    ...seedPack.diagnosticCoverage.map((coverage) => `diagnostic_coverage:${coverage.id}`),
    ...seedPack.implicitReviewRules.map((rule) => `implicit_review_rule:${rule.id}`),
  ]);

  for (const claim of seedPack.provenanceClaims) {
    const key = `${claim.targetType}:${claim.targetId}`;
    if (!validTargetKeys.has(key)) {
      addIssue(issues, 'error', 'missing_provenance_target', `Provenance claim references missing target ${key}.`, `provenanceClaims.${key}`);
    }
    for (const sourceId of claim.sourceIds) {
      if (!availableSourceIds.has(sourceId)) {
        addIssue(issues, 'error', 'missing_source', `Provenance claim ${key} references unavailable source ${sourceId}.`, `provenanceClaims.${key}`);
      }
    }
    if (claim.requiresExternalSource && claim.sourceIds.length === 0) {
      addIssue(issues, 'error', 'external_source_required', `Provenance claim ${key} requires a source but has no source IDs.`, `provenanceClaims.${key}`);
    }
    if (claim.requiresExternalSource && claim.provenanceKind === 'model_generated') {
      addIssue(issues, 'error', 'external_source_required', `Provenance claim ${key} cannot be model-generated only.`, `provenanceClaims.${key}`);
    }
    if (!claim.requiresExternalSource && claim.provenanceKind === 'model_generated' && claim.modelConfidence < 0.65) {
      addIssue(issues, 'warning', 'low_model_confidence', `Model-generated claim ${key} should remain quarantined at confidence ${claim.modelConfidence}.`, `provenanceClaims.${key}`);
    }
    if ((claim.riskLevel === 'high' || claim.riskLevel === 'critical') && claim.validationMethods.length === 0) {
      addIssue(issues, 'error', 'missing_validation_method', `High-risk provenance claim ${key} has no validation method.`, `provenanceClaims.${key}`);
    }
  }
}

function validateQualityTargets(
  issues: GraphValidationIssue[],
  seedPack: GraphSeedPack,
  metrics: GraphMetrics,
): void {
  const targets = seedPack.qualityTargets;
  if (targets === null) return;
  const checks: readonly [keyof GraphMetrics, number, string][] = [
    ['nodes', targets.minimumNodes, 'minimum nodes'],
    ['edgesPerNode', targets.minimumEdgesPerNode, 'edges per node'],
    ['knowledgePointsPerAtomicNode', targets.minimumKnowledgePointsPerAtomicNode, 'knowledge points per atomic node'],
    ['taskVariantsPerAtomicNode', targets.minimumTaskVariantsPerAtomicNode, 'task variants per atomic node'],
    ['diagnosticNodeCoverage', targets.minimumDiagnosticCoverage, 'diagnostic node coverage'],
  ];
  for (const [metric, minimum, label] of checks) {
    if (metrics[metric] < minimum) {
      addIssue(issues, 'error', 'quality_target_missed', `Graph has ${metrics[metric]} ${label}; target is at least ${minimum}.`, `qualityTargets.${metric}`);
    }
  }
}

function hasExternalSourceClaim(
  seedPack: GraphSeedPack,
  targetType: 'node' | 'task',
  targetId: string,
): boolean {
  return seedPack.provenanceClaims.some(
    (claim) => claim.targetType === targetType
      && claim.targetId === targetId
      && claim.requiresExternalSource
      && claim.sourceIds.length > 0
      && (claim.provenanceKind === 'external_source' || claim.provenanceKind === 'hybrid'),
  );
}

function countChildren(nodes: readonly GraphNode[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const node of nodes) {
    if (node.parentNodeId === null) continue;
    result.set(node.parentNodeId, (result.get(node.parentNodeId) ?? 0) + 1);
  }
  return result;
}

function edgeKey(edge: { fromNodeId: string; toNodeId: string; relation: StandardEdgeRelation }): string {
  return `${edge.fromNodeId}:${edge.toNodeId}:${edge.relation}`;
}

function addDuplicateIssues(
  issues: GraphValidationIssue[],
  label: string,
  values: readonly string[],
): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      addIssue(issues, 'error', 'duplicate_id', `Duplicate ${label} ID ${value}.`, null);
    }
    seen.add(value);
  }
}

function addIssue(
  issues: GraphValidationIssue[],
  severity: GraphValidationSeverity,
  code: string,
  message: string,
  path: string | null,
): void {
  issues.push({ severity, code, message, path });
}

function ratio(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 10_000) / 10_000;
}

function findDirectedCycles(
  nodeIds: readonly string[],
  edges: readonly { fromNodeId: string; toNodeId: string }[],
): string[][] {
  const nodeIdSet = new Set(nodeIds);
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    if (!nodeIdSet.has(edge.fromNodeId) || !nodeIdSet.has(edge.toNodeId)) continue;
    const values = outgoing.get(edge.fromNodeId) ?? [];
    values.push(edge.toNodeId);
    outgoing.set(edge.fromNodeId, values);
  }

  const state = new Map<string, 'visiting' | 'visited'>();
  const stack: string[] = [];
  const cycles: string[][] = [];
  const cycleKeys = new Set<string>();

  const visit = (nodeId: string): void => {
    state.set(nodeId, 'visiting');
    stack.push(nodeId);
    for (const targetId of outgoing.get(nodeId) ?? []) {
      if (state.get(targetId) === 'visiting') {
        const start = stack.lastIndexOf(targetId);
        const cycle = [...stack.slice(start), targetId];
        const key = [...new Set(cycle)].sort().join(':');
        if (!cycleKeys.has(key)) {
          cycles.push(cycle);
          cycleKeys.add(key);
        }
        continue;
      }
      if (state.get(targetId) !== 'visited') visit(targetId);
    }
    stack.pop();
    state.set(nodeId, 'visited');
  };

  for (const nodeId of nodeIds) {
    if (state.has(nodeId)) continue;
    visit(nodeId);
  }
  return cycles;
}
