# Audit Matrix

This records the refactor baseline and the contract intentionally preserved.

## Preserved Contract

- GitHub Pages compatible static frontend
- native ES modules
- no backend
- mature WABA browser surface only
- neutral-only default policy in the UI
- exact browser-side `preferred`
- curated examples primary, topology demos secondary
- Simple Mode and Advanced ASP Mode both preserved

## Subsystem Matrix

| Subsystem | Main Files | Status | Notes |
|---|---|---|---|
| Bootstrap | `/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground/app.js` | refactored | now bootstrap-only |
| DOM access | `/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground/core/dom-registry.js` | hardened | single DOM registry replaces scattered global lookups |
| Shared state | `/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground/core/store.js` | acceptable | lightweight state only |
| Config normalization | `/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground/runtime/config-service.js` | hardened | supported-surface validation moved out of bootstrap |
| Program composition | `/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground/runtime/program-builder.js` | hardened | canonical split: semiring/default/monoid/optimize/constraint |
| Generated bundle schema | `/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground/runtime/module-schema.js` | hardened | explicit schema check added |
| Solver runtime | `/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground/modules/clingo-manager.js` | fixed | real WASM initialization and serialized solver queue |
| Preferred orchestration | `/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground/modules/clingo-manager.js` | fixed | exact preferred stable again after queueing and no-discard preset |
| Result parsing | `/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground/runtime/answer-set-parser.js` | improved | explicit parsed object shape |
| Output rendering | `/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground/modules/output-manager.js` | improved | objective math delegated to runtime helpers |
| Graph rendering | `/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground/modules/graph-manager.js` | partially refactored | still large, but solver access and config dependency are explicit |
| Simple Mode conversion | `/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground/features/editor/simple-format.js` | isolated | round-trippable and unit-tested |
| Analysis panel | `/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground/modules/metrics-manager.js` | improved | extension-grouped decision scoring |
| Export | `/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground/modules/export-manager.js` | preserved | no scope expansion |
| GitHub Pages path handling | `/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground/modules/wasm-config.js` | fixed | asset URLs resolved relative to current page |
| Release/versioning | `/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground/core/app-version.js`, `/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground/scripts/bump-version.js` | improved | one version source plus sync script |
| Docs | root markdown files | consolidated | canonical docs now live at repo root |

## Removed Or Retired Artifacts

These do not belong to the current public architecture:

- backup app copies
- one-off debugging and investigation notes
- obsolete test HTML pages
- stale historical folders such as `backup-cytoscape/`
- dead `Semantics/` leftovers

## Residual Debt

The main remaining structural debt is `modules/graph-manager.js`, which is still larger than ideal even after boundary cleanup. It is now safer to refactor incrementally because:

- solver access is serialized
- config is passed explicitly
- DOM overlay nodes are injected instead of queried globally
