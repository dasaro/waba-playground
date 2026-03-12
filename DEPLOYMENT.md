# Deployment

GitHub Pages releases are versioned from one source:

- `/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground/core/app-version.js`

Every cache-busting `?v=` reference is synchronized from that file by:

- `/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground/scripts/bump-version.js`
- `/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground/scripts/sync-version-refs.js`

## Release Flow

From `/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground`:

1. Sync the browser bundle if the WABA logic snapshot changed.

```bash
npm run sync
```

2. Bump the deployment version.

Automatic next version:

```bash
npm run version:bump
```

Explicit version:

```bash
npm run version:bump -- 20260312-7
```

3. Run the release gate.

```bash
npm run validate
```

4. Commit the changes.

5. Push `main`.

```bash
git push origin main
```

6. Push the current Pages source branch too.

At the moment, the live GitHub Pages build is sourced from `waba-weak-constraints`, so deployment is not complete until that branch is pushed as well.

```bash
git push origin waba-weak-constraints
```

7. Verify the deployed site.

- open `https://dasaro.github.io/waba-playground/`
- open `https://dasaro.github.io/waba-playground/version-check.html`
- confirm the reported version matches `core/app-version.js`

## Notes

- Do not hand-edit scattered `?v=` fragments.
- Use the version scripts instead.
- `version-check.html` is part of the release gate and should be updated through the same version-sync workflow.
