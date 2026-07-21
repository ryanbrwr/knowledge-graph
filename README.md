# Bangool Graph

Open-source TypeScript primitives for constructing, validating, and querying adaptive learning graphs.

The package models curriculum topology. It does not provide a UI, database, tutor, grading model, or curriculum. A consuming application supplies domain-specific identifiers such as levels, skills, node kinds, activity formats, and modalities.

## Why This Exists

Adaptive learning systems need more than a list of lessons. They need atomic skills, typed relationships, fine-grained prerequisites, task variants, diagnostics, provenance, interference sets, and explicit implicit-review rules. These primitives make that structure inspectable and portable across language, mathematics, programming, music, and other courses.

## Install

The initial release is distributed from the public Git repository:

```sh
npm install github:ryanbrwr/bangool-graph#v0.1.0
```

## Define A Graph

```ts
import {
  createGraphIndex,
  defineGraphSeedPack,
  getUnlockedNodeIds,
  validateGraphSeedPack,
} from '@bangool/graph';

const graph = defineGraphSeedPack({
  schemaVersion: 1,
  id: 'my-course-v1',
  // Sources, provenance, courses, nodes, edges, knowledge points,
  // task variants, diagnostics, and review rules follow here.
});

const validation = validateGraphSeedPack(graph, {
  allowedActivityFormats: ['short_answer', 'conversation'],
});

if (!validation.valid) {
  throw new Error(JSON.stringify(validation.issues, null, 2));
}

const index = createGraphIndex(graph);
const ready = getUnlockedNodeIds(index, new Set(['prerequisite-node-id']));
```

See [`examples/algebra.ts`](examples/algebra.ts) for a complete graph that can be run and validated.

## Public Primitives

- `graphSeedPackSchema`: Zod boundary for untrusted JSON or model output.
- `parseGraphSeedPack`: parse once, then use trusted graph data internally.
- `validateGraphSeedPack`: structural, provenance, topology, density, task-contract, and cycle checks.
- `assertValidGraphSeedPack`: fail fast with a typed `GraphValidationError`.
- `createGraphIndex`: deterministic adjacency and coverage indexes.
- `getUnlockedNodeIds`: strict prerequisite gating.
- `getMissingPrerequisiteIds`: recursive remediation targets.
- `rankReadyNodes`: small explainable default ranking for unlocked nodes.
- `rankDiagnosticProbes`: uncertainty and information-gain ranking.
- `calculateImplicitReviewCredits`: thresholded fractional review over explicit rules.

## Design Rules

- Canonical graph topology is separate from learner state.
- `prerequisite`, `supports`, `contrasts`, `unlocks`, and `encompasses` are different relationships.
- Atomic nodes describe observable behavior, scope, and non-goals.
- Knowledge points carry precise prerequisites for targeted remediation.
- Advanced work reviews foundations only through explicit implicit-review rules.
- Model-authored graph changes carry provenance and pass deterministic gates before promotion.
- Algorithms return reasons alongside rankings and credit.

## Scope Boundary

This package owns:

- graph and graph-authoring contracts
- runtime parsing
- graph validation and quality metrics
- deterministic indexing and traversal
- basic explainable selection primitives

Applications own:

- curriculum content and source catalogs
- persistence and migrations
- learner evidence and mastery estimation
- spaced-repetition scheduling policy
- grading, agents, model calls, and prompts
- UI and visualization

Read [`docs/architecture.md`](docs/architecture.md) for the boundary rationale and [`docs/authoring.md`](docs/authoring.md) for the promotion workflow.

## Development

```sh
npm install
npm run check
```

Requires Node.js 20 or newer. Licensed under MIT.
