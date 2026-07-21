import { z } from 'zod';

const idSchema = z.string().trim().min(1).max(240);
const textSchema = z.string().trim().min(1);
const unitIntervalSchema = z.number().finite().min(0).max(1);
const jsonObjectSchema = z.record(z.string(), z.unknown());

export const standardEdgeRelations = [
  'prerequisite',
  'supports',
  'contrasts',
  'unlocks',
  'encompasses',
] as const;

export const taskVariantKinds = [
  'lesson',
  'worked_example',
  'practice',
  'review',
  'quiz',
  'placement',
  'exam_probe',
] as const;

export const taskStages = [
  'acquisition',
  'retrieval',
  'fluency',
  'mixed_review',
  'transfer',
  'exam',
] as const;

export const scaffoldingLevels = ['model', 'guided', 'cued', 'unaided', 'timed'] as const;

export const provenanceKinds = [
  'external_source',
  'model_generated',
  'learner_evidence',
  'synthetic_eval',
  'hybrid',
] as const;

export const riskLevels = ['low', 'medium', 'high', 'critical'] as const;

export const provenanceTargetTypes = [
  'seed_pack',
  'node',
  'edge',
  'objective',
  'task',
  'knowledge_point',
  'failure_mapping',
  'diagnostic_coverage',
  'implicit_review_rule',
] as const;

export const graphSourceSchema = z.object({
  id: idSchema,
  title: textSchema,
  url: z.url().nullable(),
  license: z.string().trim().min(1).nullable(),
  notes: z.string(),
}).strict();

export const localizedTitleSchema = z.object({
  primary: textSchema,
  secondary: z.string().trim().min(1).nullable(),
}).strict();

export const graphNodeSchema = z.object({
  id: idSchema,
  kind: idSchema,
  levelId: idSchema,
  granularity: idSchema,
  parentNodeId: idSchema.nullable(),
  domainId: idSchema,
  atomic: z.boolean(),
  title: localizedTitleSchema,
  description: textSchema,
  canonicalScope: textSchema,
  nonGoals: z.array(textSchema),
  skillIds: z.array(idSchema).min(1),
}).strict();

export const graphEdgeSchema = z.object({
  fromNodeId: idSchema,
  toNodeId: idSchema,
  relation: z.enum(standardEdgeRelations),
  weight: z.number().finite().positive().max(1),
  reason: textSchema,
  confidence: unitIntervalSchema,
}).strict();

export const courseSchema = z.object({
  id: idSchema,
  title: textSchema,
  description: textSchema,
  targetLevelId: idSchema,
  goal: jsonObjectSchema,
}).strict();

export const courseNodeSchema = z.object({
  courseId: idSchema,
  nodeId: idSchema,
  sequence: z.number().int().nonnegative(),
  required: z.boolean(),
  weight: unitIntervalSchema,
}).strict();

export const interferenceSetSchema = z.object({
  id: idSchema,
  levelId: idSchema.nullable(),
  title: textSchema,
  description: textSchema,
}).strict();

export const interferenceSetNodeSchema = z.object({
  setId: idSchema,
  nodeId: idSchema,
  interferenceWeight: unitIntervalSchema,
}).strict();

export const knowledgePointSchema = z.object({
  id: idSchema,
  nodeId: idSchema,
  sequence: z.number().int().positive(),
  title: textSchema,
  description: textSchema,
  keyPrerequisiteNodeIds: z.array(idSchema),
  targetSkillIds: z.array(idSchema).min(1),
}).strict();

export const knowledgePointPrerequisiteSchema = z.object({
  knowledgePointId: idSchema,
  prerequisiteNodeId: idSchema,
  prerequisiteKnowledgePointId: idSchema.nullable(),
  skillId: idSchema,
  weight: unitIntervalSchema,
  distance: z.number().int().positive(),
  rationale: textSchema,
}).strict();

export const learningObjectiveSchema = z.object({
  id: idSchema,
  nodeId: idSchema,
  skillId: idSchema,
  levelId: idSchema,
  prompt: textSchema,
  successCriteria: textSchema,
}).strict();

export const taskVariantSchema = z.object({
  id: idSchema,
  nodeId: idSchema,
  kind: z.enum(taskVariantKinds),
  stage: z.enum(taskStages),
  scaffoldingLevel: z.enum(scaffoldingLevels),
  activityFormat: idSchema,
  levelId: idSchema,
  difficulty: unitIntervalSchema,
  cognitiveLoad: unitIntervalSchema,
  estimatedMinutes: z.number().finite().positive(),
  expectedResponseTimeMs: z.number().int().positive().nullable(),
  effortValue: z.number().finite().nonnegative(),
  targetScoreThreshold: unitIntervalSchema,
  retryPolicy: jsonObjectSchema,
  haltThreshold: z.number().int().positive(),
  allowedScaffolds: z.array(idSchema),
  modalityWeights: z.record(idSchema, unitIntervalSchema),
  quizzable: z.boolean(),
  examLike: z.boolean(),
  taskFamilyId: idSchema,
  nearDuplicateTaskIds: z.array(idSchema),
  inputSkillIds: z.array(idSchema),
  outputSkillIds: z.array(idSchema),
  interactionContract: jsonObjectSchema,
  offlineCalibration: jsonObjectSchema,
  promptTemplate: jsonObjectSchema,
  successCriteria: textSchema,
}).strict();

export const failureMappingSchema = z.object({
  id: idSchema,
  failedNodeId: idSchema,
  suspectedPrerequisiteNodeId: idSchema,
  skillId: idSchema,
  confidence: unitIntervalSchema,
  rationale: textSchema,
}).strict();

export const diagnosticCoverageSchema = z.object({
  id: idSchema,
  taskVariantId: idSchema,
  nodeId: idSchema,
  skillId: idSchema,
  successImpliesMastery: unitIntervalSchema,
  failureImpliesGap: unitIntervalSchema,
  informationGain: unitIntervalSchema,
  notes: z.string(),
}).strict();

export const implicitReviewRuleSchema = z.object({
  id: idSchema,
  fromNodeId: idSchema,
  toNodeId: idSchema,
  skillId: idSchema,
  modalityId: idSchema,
  fractionalCredit: unitIntervalSchema,
  minEvidenceScore: unitIntervalSchema,
  minConfidence: unitIntervalSchema,
  reason: textSchema,
}).strict();

export const graphQualityTargetsSchema = z.object({
  minimumNodes: z.number().int().nonnegative(),
  minimumEdgesPerNode: z.number().finite().nonnegative(),
  minimumKnowledgePointsPerAtomicNode: z.number().finite().nonnegative(),
  minimumTaskVariantsPerAtomicNode: z.number().finite().nonnegative(),
  minimumDiagnosticCoverage: unitIntervalSchema,
}).strict();

export const seedPackAuthorSchema = z.object({
  kind: z.enum(['llm', 'human', 'hybrid']),
  model: textSchema,
  promptVersion: textSchema,
  generatedAt: z.iso.datetime({ offset: true }),
}).strict();

export const provenancePolicySchema = z.object({
  policyVersion: textSchema,
  externalSourceRequiredFor: z.array(idSchema).min(1),
  modelGeneratedAllowedFor: z.array(idSchema).min(1),
  promoteModelGeneratedWhen: z.array(idSchema).min(1),
  quarantineWhen: z.array(idSchema).min(1),
}).strict();

export const provenanceClaimSchema = z.object({
  targetType: z.enum(provenanceTargetTypes),
  targetId: idSchema,
  provenanceKind: z.enum(provenanceKinds),
  riskLevel: z.enum(riskLevels),
  requiresExternalSource: z.boolean(),
  sourceIds: z.array(idSchema),
  modelConfidence: unitIntervalSchema,
  validationMethods: z.array(idSchema),
  rationale: textSchema,
}).strict();

export const graphSeedPackSchema = z.object({
  schemaVersion: z.literal(1),
  id: idSchema,
  title: textSchema,
  description: textSchema,
  author: seedPackAuthorSchema,
  sources: z.array(graphSourceSchema),
  sourceIds: z.array(idSchema),
  provenancePolicy: provenancePolicySchema,
  provenanceClaims: z.array(provenanceClaimSchema),
  courses: z.array(courseSchema),
  courseNodes: z.array(courseNodeSchema),
  nodes: z.array(graphNodeSchema),
  interferenceSets: z.array(interferenceSetSchema),
  interferenceSetNodes: z.array(interferenceSetNodeSchema),
  knowledgePoints: z.array(knowledgePointSchema),
  knowledgePointPrerequisites: z.array(knowledgePointPrerequisiteSchema),
  edges: z.array(graphEdgeSchema),
  objectives: z.array(learningObjectiveSchema),
  taskVariants: z.array(taskVariantSchema),
  failureMappings: z.array(failureMappingSchema),
  diagnosticCoverage: z.array(diagnosticCoverageSchema),
  implicitReviewRules: z.array(implicitReviewRuleSchema),
  qualityTargets: graphQualityTargetsSchema.nullable(),
}).strict();

export type StandardEdgeRelation = (typeof standardEdgeRelations)[number];
export type TaskVariantKind = (typeof taskVariantKinds)[number];
export type TaskStage = (typeof taskStages)[number];
export type ScaffoldingLevel = (typeof scaffoldingLevels)[number];
export type GraphSource = z.infer<typeof graphSourceSchema>;
export type LocalizedTitle = z.infer<typeof localizedTitleSchema>;
export type GraphNode = z.infer<typeof graphNodeSchema>;
export type GraphEdge = z.infer<typeof graphEdgeSchema>;
export type Course = z.infer<typeof courseSchema>;
export type CourseNode = z.infer<typeof courseNodeSchema>;
export type InterferenceSet = z.infer<typeof interferenceSetSchema>;
export type InterferenceSetNode = z.infer<typeof interferenceSetNodeSchema>;
export type KnowledgePoint = z.infer<typeof knowledgePointSchema>;
export type KnowledgePointPrerequisite = z.infer<typeof knowledgePointPrerequisiteSchema>;
export type LearningObjective = z.infer<typeof learningObjectiveSchema>;
export type TaskVariant = z.infer<typeof taskVariantSchema>;
export type FailureMapping = z.infer<typeof failureMappingSchema>;
export type DiagnosticCoverage = z.infer<typeof diagnosticCoverageSchema>;
export type ImplicitReviewRule = z.infer<typeof implicitReviewRuleSchema>;
export type GraphQualityTargets = z.infer<typeof graphQualityTargetsSchema>;
export type SeedPackAuthor = z.infer<typeof seedPackAuthorSchema>;
export type ProvenancePolicy = z.infer<typeof provenancePolicySchema>;
export type ProvenanceClaim = z.infer<typeof provenanceClaimSchema>;
export type GraphSeedPack = z.infer<typeof graphSeedPackSchema>;
export type GraphSeedPackInput = z.input<typeof graphSeedPackSchema>;

export function defineGraphSeedPack(seedPack: GraphSeedPack): GraphSeedPack {
  return seedPack;
}

export function parseGraphSeedPack(input: unknown): GraphSeedPack {
  return graphSeedPackSchema.parse(input);
}

export function safeParseGraphSeedPack(input: unknown) {
  return graphSeedPackSchema.safeParse(input);
}
