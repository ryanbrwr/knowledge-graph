# Graph Authoring

## Promotion Pipeline

1. Ground course outcomes and high-risk factual claims in identifiable sources.
2. Decompose outcomes into atomic, observable nodes.
3. Give each atomic node explicit scope, non-goals, skills, objectives, and task variants.
4. Add typed node edges. Do not use `prerequisite` when the relationship is support, contrast, unlock, or encompassment.
5. Add knowledge-point prerequisites for precise remediation.
6. Add diagnostics and implicit-review rules only when the evidence relationship is explicit.
7. Attach provenance claims to every new node and task.
8. Parse and validate the seed pack.
9. Run domain-specific source audits and synthetic learner simulations.
10. Promote the pack transactionally or quarantine it with its validation report.

## Atomic Node Test

An atomic node should answer:

- What behavior demonstrates this skill?
- What is intentionally outside its scope?
- Which prerequisites are necessary?
- Which task can elicit evidence?
- Which failure points to a specific prerequisite gap?
- Which later work genuinely practices it?

Broad categories remain useful as organizational nodes with `atomic: false`. They should not be treated as mastered from one task.

## Provenance

The package distinguishes external sources, model-generated pedagogy, learner evidence, synthetic evaluation, and hybrids. A provenance claim records risk, source IDs, model confidence, validation methods, and rationale.

Consumers define which node classes require external sources through `requiresExternalSourceForNode`. This keeps domain policy outside the graph kernel while making it enforceable.

## Validation Context

Seed packs can reference nodes, tasks, and sources already present in a canonical graph. Pass those IDs through `GraphValidationContext`:

```ts
validateGraphSeedPack(candidate, {
  existingNodeIds,
  existingTaskVariantIds,
  existingSourceIds,
  allowedActivityFormats,
  requiresExternalSourceForNode: (node) => highRiskKinds.has(node.kind),
});
```

Validation never writes or promotes data. The consuming application owns that transaction.
