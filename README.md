# WABA Playground

`waba-playground` is the static browser frontend for the mature WABA surface.

Core references:

- architecture: [ARCHITECTURE.md](/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground/ARCHITECTURE.md)
- audit baseline: [AUDIT.md](/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground/AUDIT.md)
- testing and release gate: [TESTING.md](/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground/TESTING.md)
- deployment flow: [DEPLOYMENT.md](/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground/DEPLOYMENT.md)
- release notes: [CHANGELOG.md](/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground/CHANGELOG.md)

The app remains GitHub-Pages compatible:

- no backend
- no runtime fetch from the sibling `WABA/` repo
- committed `waba-modules.js` bundle
- static HTML/CSS/JS plus `clingo-wasm`

## Supported Surface

The main UI exposes only the mature WABA contract:

- semiring family: `godel`, `tropical`, `lukasiewicz`
- polarity: `higher`, `lower`
- default policy: `neutral` only in the browser UI
- monoid: `sum`, `max`, `count`, `min`
- optimization: `minimize`, `maximize`
- budget mode: `none`, `ub`, `lb`
- semantics: `cf`, `stable`, `admissible`, `complete`, `grounded`, `preferred`
- opt mode: `ignore`, `optN`

Alias labels remain visible in the UI:

- `tropical + higher` is labeled `Arctic`
- `godel + lower` is labeled `Bottleneck-Cost`

Bounded presets intentionally match the mature WABA support policy:

- `sum + ub`
- `max + ub`
- `count + ub`
- `min + lb`

When `budget mode = none`, the UI distinguishes:

- default `disabled / list minimum β`: omits the budget constraint and reports the minimum `budget_value/1` threshold per extension
- optional `plain / no-discard`: loads `constraint/no_discard.lp`

The startup configuration is exploration-first:

- neutral defaults
- `budget mode = none`
- enumerate mode
- a topology demo as the initial loaded example

Curated comparison examples can still override that global default with a more appropriate preset. The public `Reference Preferred` example, for instance, uses `plain / no-discard` so it remains a faithful classical ABA comparison case.

## Analysis Panel

The analysis panel is now decision-oriented rather than witness-oriented.

- extensions are grouped by their accepted assumptions before analysis
- grouped extensions are ranked by the active objective, or by minimum `β*` in exploration mode
- assumptions receive a `Decision Score` via a Borda-style aggregation over those ranked extensions
- robustness is reported as presence in the near-best set `S`
- level advantage reports whether the best extension containing an assumption outranks the best extension without it

This makes the panel more useful for “best course of action” or “best assumption” workflows, where the main question is which assumptions survive in the strongest ranked alternatives.

`preferred` is exact. The browser does not use `asprin`; it performs the same plain-`clingo` multi-pass flow as the mature CLI surface:

1. enumerate feasible `complete` candidates
2. filter them with `semantics/subset_maximal_filter.lp`
3. if `optN` is requested, apply numeric objective ranking after subset-maximal filtering

## Synced Modules

`npm run sync` regenerates [waba-modules.js](/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground/waba-modules.js) from the public WABA manifest only:

- `core/base.lp`
- `semiring/*.lp` in the mature public surface
- `defaults/*.lp`
- `monoid/*.lp`
- `optimize/*.lp`
- `constraint/{ub,lb,no_discard}.lp`
- `filter/{standard,projection}.lp`
- `semantics/{cf,stable,admissible,complete,grounded,subset_maximal_filter}.lp`
- curated public example `.lp` files

Sync fails hard on missing files. There are no placeholder fallbacks.

Schema validation for the generated bundle lives in [scripts/check-sync-schema.js](/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground/scripts/check-sync-schema.js).

## Curated Examples

The primary example selector is built from the curated public WABA examples:

- `simple_attack`
- `practical_deliberation`
- `scientific_theory`
- `aspforaba_journal_example`
- `strong_inference_bounded_lies`
- `expanding_universe_argumentation`

Older topology demos remain available in a separate playground-only section for visualization checks.

## Development

From [waba-playground](/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground):

```bash
npm run sync
npm run dev
```

The page is path-agnostic. `modules/wasm-config.js` resolves `dist/` assets relative to the current page URL, so the same build works from localhost or any GitHub Pages project subpath.

## Validation

Run the full release gate with:

```bash
npm run validate
```

That covers:

- generated-bundle schema checks
- eslint
- JSDoc type-checking
- pure-module tests
- headless browser smoke tests

The graph/output layers still consume the same semantic runtime predicates:

- `in/1`
- `out/1`
- `supported_with_weight/2`
- `attacks_successfully_with_weight/3`
- `discarded_attack/3`
- `budget_value/1` when threshold ranking is relevant
