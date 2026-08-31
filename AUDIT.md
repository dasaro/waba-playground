# Audit Matrix

This records the refactor baseline and the contract intentionally preserved.

## Preserved Contract

- GitHub Pages compatible static frontend
- native ES modules
- no backend
- mature WABA browser surface only
- selectable `neutral` and `aba` default policies in the UI
- exact browser-side `preferred`
- curated examples primary, topology demos secondary
- Simple Mode and Advanced ASP Mode both preserved

## Subsystem Matrix

| Subsystem | Main Files | Status | Notes |
|---|---|---|---|
| Bootstrap | `app.js` | refactored | now bootstrap-only |
| DOM access | `core/dom-registry.js` | hardened | single DOM registry replaces scattered global lookups |
| Shared state | `core/store.js` | acceptable | lightweight state only |
| Config normalization | `runtime/config-service.js` | hardened | supported-surface validation moved out of bootstrap |
| Program composition | `runtime/program-builder.js` | hardened | canonical split: semiring/default/monoid/optimize/constraint |
| Generated bundle schema | `runtime/module-schema.js` | hardened | explicit schema check added |
| Solver runtime | `modules/clingo-manager.js` | fixed | real WASM initialization and serialized solver queue |
| Preferred orchestration | `modules/clingo-manager.js` | fixed | exact per-reduct preferred over the shared beta-sigma discard witnesses |
| Result parsing | `runtime/answer-set-parser.js` | improved | explicit parsed object shape |
| Output rendering | `modules/output-manager.js` | improved | objective math delegated to runtime helpers |
| Graph rendering | `modules/graph-manager.js` | partially refactored | still large, but solver access and config dependency are explicit |
| Simple Mode conversion | `features/editor/simple-format.js` | isolated | round-trippable and unit-tested |
| Export | `modules/export-manager.js` | preserved | no scope expansion |
| GitHub Pages path handling | `modules/wasm-config.js` | fixed | asset URLs resolved relative to current page |
| Release/versioning | `core/app-version.js`, `scripts/bump-version.js` | improved | one version source plus sync script |
| Docs | root markdown files | consolidated | canonical docs now live at repo root |

## Removed Or Retired Artifacts

These do not belong to the current public architecture:

- backup app copies
- one-off debugging and investigation notes
- obsolete test HTML pages
- stale historical folders such as `backup-cytoscape/` (kept on disk, git-ignored)
- duplicate `clingo.wasm` copies at the repo root and `lib/dist/`; `dist/clingo.wasm` is the only one loaded
- dead `Semantics/` leftovers

## Residual Debt

The main remaining structural debt is `modules/graph-manager.js`, which is still larger than ideal even after boundary cleanup. It is now safer to refactor incrementally because:

- solver access is serialized
- config is passed explicitly
- DOM overlay nodes are injected instead of queried globally
