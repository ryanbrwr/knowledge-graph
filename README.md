# Knowledge Graph

Open-source TypeScript primitives by Ryan Brewer for constructing, validating, and querying adaptive learning graphs.

[![CI](https://github.com/ryanbrwr/knowledge-graph/actions/workflows/quality.yml/badge.svg)](https://github.com/ryanbrwr/knowledge-graph/actions/workflows/quality.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-black.svg)](LICENSE)

This package models curriculum topology: atomic skills, typed relationships, knowledge points, task variants, diagnostic coverage, provenance, interference, and explicit implicit-review rules. It is domain-neutral and contains no curriculum, learner database, tutor, grading model, or UI.

The design is informed by Math Academy's public descriptions of its knowledge graph and pedagogy. This is an independent implementation, is not affiliated with or endorsed by Math Academy, and does not reproduce its proprietary algorithms, content, wording, or branding.

## Install

The package is distributed as an immutable GitHub release artifact:

```sh
npm install https://github.com/ryanbrwr/knowledge-graph/releases/download/v0.2.0/ryanbrewer-knowledge-graph-0.2.0.tgz
```

```ts
import {
  createGraphIndex,
  getUnlockedNodeIds,
  parseGraphSeedPack,
  validateGraphSeedPack,
} from '@ryanbrewer/knowledge-graph';

export function loadGraph(candidate: unknown) {
  const graph = parseGraphSeedPack(candidate);

  const validation = validateGraphSeedPack(graph, {
    allowedActivityFormats: ['short_answer', 'conversation'],
  });

  if (!validation.valid) {
    throw new Error(JSON.stringify(validation.issues, null, 2));
  }

  const index = createGraphIndex(graph);
  return getUnlockedNodeIds(index, new Set(['prerequisite-node-id']));
}
```

See [`examples/algebra.ts`](examples/algebra.ts) for a complete, executable seed pack.

## Public Primitives

| Primitive | Purpose |
| --- | --- |
| `GraphSeedPack` | Portable graph fragment containing courses, nodes, edges, knowledge points, tasks, diagnostics, provenance, and review rules. |
| `graphSeedPackSchema` | Strict Zod boundary for untrusted JSON, imports, or model-authored output. |
| `validateGraphSeedPack` | Structural, provenance, topology, density, task-contract, and cycle validation. |
| `createGraphIndex` | Deterministic adjacency, task, course, diagnostic, and review indexes. |
| `getUnlockedNodeIds` | Mastery-gated candidates whose required prerequisites are complete. |
| `getMissingPrerequisiteIds` | Recursive prerequisite gaps for targeted remediation. |
| `rankReadyNodes` | Small, explainable baseline ranker for unlocked nodes, including immediate interference avoidance. |
| `rankDiagnosticProbes` | Baseline uncertainty and information-gain ranking for diagnostic probes. |
| `calculateImplicitReviewCredits` | Performance-weighted fractional credit over explicit encompassment rules. |

These are inspectable building blocks, not a complete adaptive tutor. The selection and diagnostic rankers are deliberately conservative reference implementations that applications can replace with calibrated policies.

## Math Academy-Inspired Design

Math Academy publicly describes an expert system built from four cooperating layers: a canonical knowledge graph, a student model over that graph, an adaptive diagnostic, and task selection that seeks to maximize learning per unit time. Its published pedagogy adds mastery learning, automaticity, active learning, deliberate practice, spaced repetition, interleaving, layering, non-interference, and cognitive-load reduction.

This package translates those ideas into domain-neutral contracts:

| Public principle | Representation in this package | Operational rule |
| --- | --- | --- |
| A course is a route through a larger graph | `Course` and `CourseNode` are overlays on shared `GraphNode` records | Reuse canonical nodes across courses instead of cloning course-specific graphs. |
| Topics must be granular and assessable | Atomic `GraphNode` records have scope, non-goals, skills, objectives, and tasks | Keep broad subjects as non-atomic organizers; mastery belongs to observable behaviors. |
| Hard topics are learned in small steps | `KnowledgePoint` and `KnowledgePointPrerequisite` | Encode the exact sub-step and foundation implicated by an error. |
| Prerequisites gate progression | `prerequisite` edges and `getUnlockedNodeIds` | Require demonstrated prerequisite mastery before dependent acquisition work. |
| Advanced work can reinforce foundations | `encompasses` edges and `ImplicitReviewRule` | Award partial review only when a component is actually exercised, never to every ancestor. |
| Related items can interfere | `contrasts`, `InterferenceSet`, and `InterferenceSetNode` | Separate confusable acquisition tasks unless the task explicitly trains the contrast. |
| Diagnostics infer a knowledge frontier | `DiagnosticCoverage` and `rankDiagnosticProbes` | Prefer probes that reduce uncertainty across the graph; keep marginal conclusions conditional. |
| Practice should be active and measurable | `TaskVariant`, `LearningObjective`, and `FailureMapping` | Elicit a response quickly, grade a defined behavior, and map failure to remediation. |
| Scaffolding should fade toward transfer | task stages and scaffolding levels | Progress from modelled and guided work to unaided, timed, mixed, and novel contexts. |
| Graph authoring must improve from evidence | `GraphSource`, `ProvenanceClaim`, and quality targets | Validate every candidate mutation and quarantine unsupported or low-confidence changes. |

### FIRe and review compression

Math Academy distinguishes prerequisites from skills genuinely practiced inside a harder task. Its public name for weighted, partial review credit is Fractional Implicit Repetition (FIRe). This package models that distinction explicitly:

1. Use `prerequisite` when knowledge is required to start a node.
2. Use `encompasses` when completing the harder task actually exercises a component skill.
3. Add an `ImplicitReviewRule` with skill, modality, confidence thresholds, and fractional credit.
4. Call `calculateImplicitReviewCredits` only after grading real learner evidence.
5. Let the application update its retention schedule and choose a small set of tasks that covers the most due skills.

The package calculates eligible credit. It intentionally does not prescribe a forgetting curve, mastery posterior, review interval, or repetition-compression optimizer because those policies require learner and cohort calibration.

### Diagnostic and progression loop

A production tutor can compose the primitives in this order:

1. Parse and validate a canonical graph version.
2. Store learner evidence and mastery as a separate overlay keyed by node and skill.
3. Use diagnostic coverage to select high-information probes near the uncertain frontier.
4. Propagate evidence conservatively through relationships defined by the application policy.
5. Find unlocked acquisition nodes and recursive remediation gaps.
6. Add due reviews, exam probes, and valid implicit-review opportunities to the candidate pool.
7. Rank candidates by expected learning value per unit effort, while accounting for readiness, retention, transfer value, motivation, and interference.
8. Run a task variant, grade it, update learner state, and repeat.

See [`docs/math-academy-way.md`](docs/math-academy-way.md) for the full authoring and runtime playbook.

## What Applications Must Own

Canonical structure and learner state are separate on purpose. A consuming application owns:

- curriculum content and source policy
- persistence, graph versioning, and migrations
- evidence events and learner mastery estimates
- forgetting curves and spaced-review scheduling
- calibrated diagnostic inference and task selection
- grading, model calls, agents, and prompts
- effort accounting, quiz policy, and exam readiness
- analytics, pass-rate monitoring, and graph refinement
- UI and visualization

Do not mutate canonical topology from one learner's result. Repeated evidence should create a versioned graph proposal that passes provenance, validation, simulation, and rollout gates.

## Source Map

These are the public Math Academy materials used to derive the design guidance. The summaries below are interpretations, not reproductions.

| Source | What it contributes |
| --- | --- |
| [Math Academy](https://www.mathacademy.com/) | The overall adaptive-learning system, broad curriculum scale, individualized pacing, and progress reporting. |
| [How It Works](https://www.mathacademy.com/how-it-works) | The operating loop: adaptive diagnostic, knowledge frontier, scaffolded knowledge points, worked examples, active practice, continuous graph updates, quizzes, layering, non-interference, and spaced review. |
| [How Our AI Works](https://www.mathacademy.com/how-our-ai-works) | The clearest public architecture for the graph, student model, diagnostics, task selection, FIRe, repetition compression, conditional completion, and learning-per-unit-time objective. |
| [Pedagogy](https://www.mathacademy.com/pedagogy) | Mastery learning, cognitive-load constraints, active learning, deliberate practice, spaced repetition, mixed review, layering, and non-interference. |
| [Courses](https://www.mathacademy.com/courses) | Evidence that courses are goal-oriented paths with explicit prerequisites rather than isolated content catalogs. |
| [Math Academy for Adult Students](https://www.mathacademy.com/adult-students) | Prerequisite-only foundation paths, minimum effective practice, and individualized pacing for learners with uneven prior knowledge. |
| [FAQ](https://www.mathacademy.com/faq) | Self-paced progression, regular effort, comprehensive mastery, and adaptation to learner speed. |
| [Standardized Test Preparation](https://www.mathacademy.com/how-to-maximize-performance-on-a-standardized-math-test) | The separation of curriculum mastery from timed exam-format readiness, plus immediate remediation and spaced retesting. |
| [Mathematics for Machine Learning](https://www.mathacademy.com/courses/mathematics-for-machine-learning) | A visible example of course hierarchy and fine topic density across a broad target outcome. |
| [The Math Academy Way](https://www.justinmath.com/files/the-math-academy-way.pdf) | The highest-resolution public account of the system's learning science, graph structure, knowledge points, key prerequisites, encompassment, diagnostics, task refinement, and operational standards. |
| [Individualized Spaced Repetition in Hierarchical Knowledge Structures](https://www.justinmath.com/individualized-spaced-repetition-in-hierarchical-knowledge-structures/) | A technical motivation for graph-aware repetition and fractional credit in hierarchical curricula. |

Source pages and the working-draft PDF can change. Record the access date and source version in your own curriculum provenance when a graph decision depends on them.

## Design Rules

- Keep canonical graph topology separate from learner state.
- Keep `prerequisite`, `supports`, `contrasts`, `unlocks`, and `encompasses` semantically distinct.
- Give atomic nodes observable behavior, explicit scope, non-goals, and evidence-producing tasks.
- Use knowledge-point prerequisites for precise remediation.
- Award implicit review only through explicit, skill-specific rules.
- Preserve provenance for model-authored graph changes.
- Return reasons with rankings and credit so decisions remain auditable.
- Prefer deterministic validation around probabilistic authoring and grading.

## Documentation

- [`docs/architecture.md`](docs/architecture.md): package and application boundaries
- [`docs/authoring.md`](docs/authoring.md): graph proposal and promotion workflow
- [`docs/math-academy-way.md`](docs/math-academy-way.md): pedagogy-to-implementation playbook
- [`CONTRIBUTING.md`](CONTRIBUTING.md): contribution workflow
- [`SECURITY.md`](SECURITY.md): vulnerability reporting

## Development

```sh
npm install
npm run check
```

Requires Node.js 20 or newer. Licensed under the [MIT License](LICENSE).
