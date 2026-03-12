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
8. Push `main` and verify the live page with a no-cache reload.

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
