# Math Academy-Inspired Operating Guide

This guide explains how to use `@ryanbrewer/knowledge-graph` to build an adaptive learning system informed by Math Academy's public writing. It is an independent interpretation of public material, not a specification of Math Academy's proprietary implementation.

The package provides deterministic graph primitives. A complete tutor still needs a learner model, evidence pipeline, calibrated scheduling policy, content, grading, and a user-facing learning loop.

## System Model

Treat an adaptive tutor as five cooperating layers:

1. **Canonical graph**: the shared structure of a subject.
2. **Learner overlay**: what one learner currently knows, retains, confuses, and can perform automatically.
3. **Diagnostic policy**: probes that reduce uncertainty about the learner's knowledge frontier.
4. **Task policy**: acquisition, review, remediation, transfer, and exam work selected for expected learning value.
5. **Authoring loop**: evidence-driven changes to graph granularity, prerequisites, tasks, rubrics, and calibration.

Only the first layer and reusable deterministic pieces of the others belong in this package. The remaining layers depend on domain data and operational evidence.

## Canonical Graph

### Courses are overlays

A course is a goal-directed subset and route through a larger graph. Keep shared skills canonical and attach them to one or more courses with `CourseNode`. Do not duplicate a skill merely because it appears in multiple courses.

Course sequence is an authoring hint, not a substitute for prerequisite readiness. At runtime, readiness comes from graph relationships and learner state.

### Nodes are assessable behaviors

Use non-atomic nodes for domains, units, and navigation. Use atomic nodes only when a task can produce evidence about a specific behavior in a short session.

An atomic node should answer:

- What can the learner do after mastering it?
- What is deliberately outside its scope?
- Which skills and modalities does it exercise?
- Which prerequisites are necessary?
- Which response demonstrates independent mastery?
- Which failure points to a specific missing foundation?
- Which later tasks genuinely exercise it?

Split a node when it combines independent decisions, regularly exceeds its cognitive-load target, or produces failures that cannot be mapped to a precise cause. Do not lower the mastery threshold to compensate for an oversized node.

### Knowledge points are instructional steps

`KnowledgePoint` records divide an atomic node into small, ordered instructional steps. A useful progression often moves through recognition, interpretation, selection, scaffolded production, unaided retrieval, contrast, and transfer, but the actual points should reflect the subject rather than a fixed template.

Use `KnowledgePointPrerequisite` to name the exact prior node or prior knowledge point needed at a specific step. This enables targeted remediation when a learner succeeds on early steps but fails later ones.

### Edge semantics are not interchangeable

| Relation | Meaning | Runtime consequence |
| --- | --- | --- |
| `prerequisite` | The source must be sufficiently mastered before acquiring the target. | Gates readiness and identifies remediation gaps. |
| `encompasses` | Work on the source genuinely exercises some skill from the target. | Can support fractional implicit review through an explicit rule. |
| `supports` | The source is helpful but not required. | Can influence ranking or scaffolding without blocking progress. |
| `contrasts` | The nodes are confusable or valuable to compare. | Avoid adjacent acquisition or deliberately schedule a contrast task. |
| `unlocks` | A course or product progression relationship. | Can influence presentation without asserting cognitive necessity. |

Never infer encompassment from transitive prerequisites. A learner may need a foundation to understand a task without practicing that foundation enough to earn review credit.

## Task Design

Every atomic node needs evidence-producing variants, not just explanatory content. `TaskVariant` records should span the stages that matter for the subject:

- worked example or model
- guided acquisition
- comprehension or selection practice
- unaided retrieval
- fluency or latency-sensitive practice
- mixed review
- transfer to a novel context
- quiz or exam probe when relevant

The variant contract records difficulty, cognitive load, estimated effort, expected response time, scaffolding, target threshold, retry policy, halt threshold, modalities, and success criteria.

Use the minimum effective explanation before active work. Fade support as soon as evidence justifies it. A correct response with heavy support is acquisition evidence, not independent mastery or automaticity.

### Failure mappings

Attach common failure patterns to likely prerequisite gaps with `FailureMapping`. Treat the confidence as a prior, then update it from real evidence. A failure mapping should route the learner to a smaller, relevant step rather than restarting an entire unit.

### Task quality

Monitor task behavior outside this package:

- first-attempt pass rate
- score and latency distributions
- scaffold usage
- retry and halt rates
- disagreement between graders
- subsequent transfer performance
- unexpected prerequisite failures
- evidence of guessing, reference use, or other invalid attempts

An anomalous task may have ambiguous wording, incorrect difficulty, missing prerequisites, excessive cognitive load, a weak rubric, or an overly broad node. Improve the task or topology instead of weakening the mastery standard.

## Learner Overlay

Do not write learner state into `GraphNode`. Store an append-only evidence history and derived per-learner state keyed by graph version, node, skill, and modality.

A useful evidence event includes:

- task and graph version
- node, knowledge point, skill, and modality
- score and grader confidence
- response latency and task duration
- scaffolds, hints, references, and retries
- task difficulty and context novelty
- error classification and suspected prerequisite gaps
- whether the response was independent, timed, and transferred
- source artifact such as response text, transcript span, or recording

Derived learner state can include mastery probability, retention strength, automaticity, conditional completion, next review time, learning speed, and misconception weights. Keep derivation versioned so a policy change can replay historical evidence.

## Adaptive Diagnostics

The diagnostic goal is to estimate the boundary between likely-known and likely-unknown nodes with as few probes as practical.

1. Build diagnostic coverage for the target course and its prerequisite closure.
2. Begin with conservative priors or prior learner evidence.
3. Rank probes by expected information gain near uncertain regions.
4. Use correct responses as weighted positive evidence for the tested behavior and justified related skills.
5. Use incorrect responses as weighted negative evidence for the tested behavior, likely dependents, and explicit failure mappings.
6. Discount otherwise correct evidence when latency, scaffolding, confidence, or response process suggests weak automaticity.
7. Mark narrow passes as conditional and permit later evidence to reopen foundations.
8. Stop when remaining uncertainty no longer changes the learner's actionable frontier.

`rankDiagnosticProbes` is a deterministic baseline, not a validated psychometric model. Production systems should calibrate inference and stopping rules against known profiles, synthetic learners, and eventually real learner outcomes.

## Mastery and Automaticity

Mastery is not a Boolean content flag. Estimate it by node, skill, and modality using repeated evidence across time and context.

Strong evidence combines:

- correctness or response quality
- independence from scaffolds and references
- acceptable latency
- successful retrieval after delay
- discrimination from confusable alternatives
- transfer to unfamiliar contexts
- consistency across task variants

Prerequisite gating should use a policy threshold appropriate to the dependent task. A learner may be ready for guided acquisition before they are ready for timed transfer. Keep conditional completion reversible.

## Spaced Review and FIRe

Each learner-node-skill state needs a retention schedule. A successful review delivered at an appropriate delay should increase retention more than an immediate repeat. An overdue failure should trigger relearning or a shorter interval.

For implicit review:

1. Author an `encompasses` relationship only when the advanced task actually exercises the component.
2. Add an `ImplicitReviewRule` for the exact skill and modality.
3. Set fractional credit, minimum evidence score, and minimum grader confidence.
4. Calculate credit from observed performance.
5. Cap and combine credit in the application before updating retention.
6. Do not grant credit when the learner bypassed the component through scaffolding or an alternate strategy.

### Repetition compression

When several reviews are due, select a small set of tasks whose explicit and valid implicit coverage addresses the most valuable due skills. This resembles a weighted coverage problem:

- benefit: due-review urgency, retention risk, prerequisite centrality, and transfer value
- cost: expected task time, cognitive load, and learner fatigue
- constraints: readiness, modality needs, interference, and evidence validity

Prefer a new task that also covers due review when it yields credible evidence. Do not use compression to hide a weak component that needs direct practice.

## Task Selection

Build a candidate pool from:

- newly unlocked acquisition nodes
- due explicit reviews
- tasks with useful implicit-review coverage
- targeted remediation
- diagnostic probes
- transfer and exam-preparation tasks

Rank candidates using an explainable expected-value function. Useful terms include:

- readiness and prerequisite confidence
- expected mastery or retention gain
- review urgency
- downstream unlock value
- transfer and course-goal relevance
- evidence value
- expected effort and response time
- cognitive load
- recent struggle and learning speed
- interference with recent work
- learner interest or momentum

Move forward as soon as prerequisites are ready. If a learner has missing foundations, allow productive work elsewhere in the target course until those foundations become blocking. Halt repetitive failure and route to precise remediation or unrelated productive work.

Interleave retrieval across skills, but do not teach highly confusable new items back-to-back unless the task explicitly trains their distinction.

## Quizzes and Exams

Keep curriculum mastery separate from exam-format readiness. Exam overlays can add timing, unfamiliar wording, composite tasks, rubric use, and test strategy without duplicating canonical content nodes.

Use low-stakes, constrained retrieval to audit knowledge. A missed item should produce immediate error analysis, an unassisted retry, targeted remediation when needed, and later spaced reassessment.

## Effort Accounting

Effort metrics should approximate productive focused time, not clicks or content consumption. Weight independent correct work, difficult retrieval, error repair, and sustained attention. Reduce or reject credit for guessing, answer copying, excessive reference use, or abandoned tasks.

Keep goals adjustable. Motivation features can support regular practice, but they do not replace mastery evidence.

## Authoring and Self-Improvement

Model-authored graphs must remain inspectable. Every proposal should include sources, provenance, confidence, validation methods, and a promotion rationale.

Use this promotion path:

1. Ground target outcomes and high-risk factual claims.
2. Decompose outcomes into atomic behaviors and knowledge points.
3. Add typed relationships, tasks, diagnostics, failure mappings, and review rules.
4. Parse the proposal through the runtime schema.
5. Run topology, provenance, density, duplicate, task-contract, and cycle checks.
6. Simulate representative learners, including zero-knowledge, advanced, inconsistent, and misconception-heavy profiles.
7. Quarantine low-confidence or unsupported mutations.
8. Version and promote accepted changes transactionally.
9. Monitor learner and task outcomes for regression.

Before real cohort data exists, use conservative priors, released benchmarks, expert or source-grounded constraints, and synthetic simulations. Label simulated calibration honestly; do not present it as empirical learner calibration.

## Package Boundary

This package should remain domain-neutral and deterministic. Add a primitive here when it is reusable across curricula and can be expressed without a product, model provider, database, or UI dependency.

Keep these in consuming applications:

- curriculum-specific identifiers and claims
- learner evidence and mastery state
- scheduling and forgetting policies
- probabilistic inference and calibration
- graders and tutor agents
- source-risk rules
- exam overlays
- persistence and analytics
- presentation

## Reference Set

The following public materials informed this guide:

- [Math Academy](https://www.mathacademy.com/)
- [How It Works](https://www.mathacademy.com/how-it-works)
- [How Our AI Works](https://www.mathacademy.com/how-our-ai-works)
- [Pedagogy](https://www.mathacademy.com/pedagogy)
- [Courses](https://www.mathacademy.com/courses)
- [Math Academy for Adult Students](https://www.mathacademy.com/adult-students)
- [FAQ](https://www.mathacademy.com/faq)
- [How To Maximize Performance on a Standardized Math Test](https://www.mathacademy.com/how-to-maximize-performance-on-a-standardized-math-test)
- [Mathematics for Machine Learning](https://www.mathacademy.com/courses/mathematics-for-machine-learning)
- [The Math Academy Way](https://www.justinmath.com/files/the-math-academy-way.pdf)
- [Individualized Spaced Repetition in Hierarchical Knowledge Structures](https://www.justinmath.com/individualized-spaced-repetition-in-hierarchical-knowledge-structures/)

Accessed July 21, 2026. The PDF identifies itself as a working draft, so consumers should record the document date when using it as provenance.
