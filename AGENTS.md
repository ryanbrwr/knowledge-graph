# Repository Instructions

This repository is the domain-neutral graph kernel used by Bangool and other adaptive learning products.

## Boundary

- Keep the package independent of React, React Native, Expo, databases, model providers, and any specific curriculum.
- Do not add Korean, TOPIK, Math Academy, or Bangool-specific values to the runtime model.
- Represent course-specific levels, skills, node kinds, formats, and modalities as string identifiers supplied by consumers.
- Keep public algorithms pure and deterministic. Persistence and agent orchestration belong in consuming applications.
- Validate untrusted graph-authoring output at the package boundary before treating it as `GraphSeedPack`.

## API Design

- Prefer named exports, plain functions, stable object contracts, and discriminated results.
- Add generics only when one public type genuinely depends on another.
- Preserve explainability: ranking functions must return scores and reasons, not only IDs.
- Keep prerequisite, support, contrast, unlock, and encompasses edges semantically distinct.
- Treat learner state as an overlay; never mutate canonical graph topology from one learner's evidence.

## Verification

Run `npm run check` after changing source, public types, examples, or tests.
