# WABA Playground Changelog

## Versioning

Deployment versions use `YYYYMMDD-N`.

Version bump checklist for GitHub Pages releases:

1. Pick the next deployment version.
2. Update the version header in [app.js](/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground/app.js).
3. Update cache-busting query strings in [index.html](/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground/index.html) for changed top-level assets.
4. Update changed module import query strings in [app.js](/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground/app.js) and any nested imports that point at changed files.
5. Update [version-check.html](/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground/version-check.html) with the new expected version and current smoke checks.
6. Add a new entry here summarizing user-visible changes.
7. Run local smoke checks before commit and push.
8. Push `main`.
9. Push the current GitHub Pages source branch too. At the moment the live Pages workflow is building from `waba-weak-constraints`, so a `main` push alone is not sufficient for deployment.
10. Verify the live page with a no-cache reload.

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
