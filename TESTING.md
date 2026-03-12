# Testing

The playground has three validation layers:

- static/schema checks
- pure-module tests
- headless browser smoke tests

## Commands

From `/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground`:

```bash
npm run sync:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:browser
```

Or run the full release gate:

```bash
npm run validate
```

## What Each Layer Covers

### Sync / Schema

Command:

```bash
npm run sync:check
```

Covers:

- `waba-modules.js` sections are present
- canonical semiring metadata is present
- alias metadata is present
- supported semantics metadata is present
- curated example manifest is present

This is the guardrail against silent drift between the WABA CLI manifest and the browser snapshot.

### Lint

Command:

```bash
npm run lint
```

Covers:

- browser ESM hygiene
- dead obvious JS mistakes
- consistency across `app.js`, `core/`, `runtime/`, `features/`, `modules/`, `scripts/`, and `tests/`

### Type Check

Command:

```bash
npm run typecheck
```

Covers:

- JSDoc contracts under `checkJs`
- config/result object shapes
- controller/service boundary mistakes

### Unit Tests

Command:

```bash
npm run test:unit
```

Covers:

- objective tuple and aggregate helpers
- simple-mode round-trip conversion
- generated bundle schema helpers
- program-builder output shape

### Browser Smoke

Command:

```bash
npm run test:browser
```

Covers:

- panel collapse/expand
- curated example loading
- `stable` and `grounded` runs
- exact `preferred`
- graph mode switching
- analysis panel rendering
- `version-check.html`

Important detail:

- graph-mode tests intentionally click the visible `.mode-option` controls, not the hidden radio inputs

## Release Gate

Before pushing a release or GitHub Pages deployment:

1. `npm run sync:check`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run test:unit`
5. `npm run test:browser`

`npm run validate` runs the full gate.
