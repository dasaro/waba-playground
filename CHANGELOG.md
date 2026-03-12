# WABA Playground Changelog

## Versioning

Deployment versions use `YYYYMMDD-N`.

Version bump checklist for GitHub Pages releases:

1. Add a new entry here summarizing the release.
2. Bump the version from the single source of truth:

```bash
npm run version:bump
```

3. Run the release gate:

```bash
npm run validate
```

4. Commit the release.
5. Push `main`.
6. Push the current GitHub Pages source branch too. At the moment the live Pages workflow is building from `waba-weak-constraints`, so a `main` push alone is not sufficient for deployment.
7. Verify the live page with a no-cache reload.

Do not hand-edit scattered `?v=` cache-busting fragments. The version scripts update:
- [core/app-version.js](/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground/core/app-version.js)
- [index.html](/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground/index.html)
- [version-check.html](/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground/version-check.html)
- changed module import references across the app

## 20260312-8

- polished the visual surface after the larger architecture refactor
- improved the light theme so editor and framework surfaces are actually light instead of inheriting dark styling
- added time-based theme defaults when no user preference is saved:
  - light in daytime
  - dark in the evening
- reduced always-visible instructional clutter:
  - configuration notes remain hover/focus help
  - simple-editor field guidance now also lives in hover/focus help
- added an explicit `β` activation toggle:
  - when off, the playground disables budget filtering and ranks extensions by minimum `β`
  - when on, it restores the current bounded profile
- moved simple-mode descriptions out of the main layout:
  - descriptions now live behind a compact hover preview chip
  - editing remains available through explicit edit/remove actions
- verified the release with the full browser/headless validation gate

## 20260312-7

- narrowed the post-refactor cleanup instead of starting another architecture wave
- split graph view-state logic out of [modules/graph-manager.js](/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground/modules/graph-manager.js) into:
  - [modules/graph-highlighting.js](/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground/modules/graph-highlighting.js)
  - [modules/graph-assumption-builder.js](/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground/modules/graph-assumption-builder.js)
- reduced [modules/graph-manager.js](/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground/modules/graph-manager.js) from 1348 lines to 565 lines and left it focused on orchestration
- removed remaining debug console noise from the graph, output, popup, and fullscreen UI paths
- re-ran the full release gate, including Playwright headless browser checks

## 20260312-6

- refactored the app into explicit `core/`, `runtime/`, and `features/` layers while keeping the existing static frontend architecture
- made `app.js` bootstrap-only and moved config/program composition into runtime helpers
- introduced shared JSDoc contracts plus `eslint`, `tsconfig checkJs`, unit tests, and Playwright browser smoke tests
- fixed Clingo startup so the worker is actually initialized with the correct WASM URL before the app reports success
- serialized browser-side solver calls to avoid graph/run races in `clingo-wasm`
- stabilized exact `preferred` in the browser:
  - no-discard preset for the curated reference example
  - subset-maximal multi-pass flow no longer races graph recomputation
  - output rendering no longer calls removed legacy cost helpers
- replaced the old manual deployment notes with version-script driven release docs
- added architecture, testing, and audit documents
- removed stale troubleshooting/backup artifacts from the maintained repo surface

## 20260312-4

- changed the default browser profile to neutral defaults, enumerate mode, and beta-disabled exploration
- made the initial example an interesting topology demo instead of the simple smoke case
- restored missing browser modules that the app still imported
- replaced the old analysis stub with a decision-oriented panel:
  - unique-extension grouping
  - Borda-style assumption ranking
  - robustness over the near-best set `S`
  - level-advantage diagnostics
  - CSV export for summary and assumption ranking
- updated the version-check page to verify the decision-analysis surface

## 20260312-5

- restored the missing panel component CSS, so the +/- collapse controls work again
- restored `GraphManager.initFullscreen()` so app startup no longer aborts before panel handlers are attached
- verified panel collapse/expand with a headless Chromium check against a local static server
- updated the version-check page to cover the fullscreen hook regression
