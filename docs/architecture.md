# Architecture

## Canonical Graph

`GraphSeedPack` is an appendable, reviewable graph fragment. It contains:

- courses and their node memberships
- atomic and organizational nodes
- typed node edges
- knowledge points and their prerequisite links
- measurable objectives
- task variants
- failure mappings
- diagnostic coverage
- interference sets
- implicit-review rules
- sources and provenance claims

The package deliberately uses string identifiers for levels, skills, node kinds, formats, and modalities. The graph kernel should not know whether `levelId` means Grade 6, TOPIK 2, chapter 4, or an internal competency band.

## Learner Overlay

Learner evidence, mastery, retention, and scheduling state do not belong in canonical graph records. A consuming application can attach those records by node and skill ID without mutating shared topology.

This separation prevents one learner's misconception from changing the curriculum for everyone. Repeated learner evidence can propose a graph change, but that proposal must re-enter the authoring and validation path.

## Trust Boundary

JSON files, model output, and third-party imports enter as `unknown`. Parse them with `graphSeedPackSchema` or `parseGraphSeedPack`. Validation then applies relationships that a schema alone cannot prove: endpoint existence, duplicate IDs, cycles, provenance targets, task coverage, and graph density.

Inside an application, use the parsed `GraphSeedPack` and a `GraphIndex`. Do not repeat defensive shape checks in every algorithm.

## Persistence Boundary

The package has no database adapter. Consumers can normalize a seed pack into SQL, document storage, a graph database, or flat files. Keeping persistence out of the kernel makes deterministic algorithms easy to test and lets each product choose transactional and migration guarantees appropriate to its workload.

## Algorithm Boundary

The included algorithms are conservative primitives, not a complete adaptive tutor:

- prerequisite unlock checks
- prerequisite-gap tracing
- explainable ready-node ranking
- information-gain diagnostic ranking
- explicit fractional implicit-review credit

Mastery updates, forgetting curves, cohort calibration, exam readiness, and model-driven tutoring require evidence and policy owned by the consuming application.
