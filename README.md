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

- semiring family: `godel`, `lukasiewicz`
- polarity: `higher`, `lower`
- effective semiring keys: `godel`, `lukasiewicz`, `lukasiewicz_low`
- default policy: `legacy`, `aba`, `neutral`
- ABA recovery: `neutral` defaults + `no_discard`
- monoid: `sum`, `max`, `count`, `min`
- optimization: `minimize`, `maximize`
- budget mode: `none`, `ub`, `lb`
- semantics: `cf`, `stable`, `admissible`, `complete`, `grounded`, `preferred`
- output filter: `projection`, `standard`
- opt mode: `ignore`, `optN`

Family/polarity stays in the browser UI only as a thin selector over the supported direct semiring keys:

- `godel + higher` -> `godel`
- `lukasiewicz + higher` -> `lukasiewicz`
- `lukasiewicz + lower` -> `lukasiewicz_low`

Bounded presets intentionally match the mature WABA support policy:

- `sum + ub`
- `max + ub`
- `count + ub`
- `min + lb`

When `budget mode = none`, the browser matches the wrapper's `no_discard` surface. There is no separate “minimum β exploration” mode anymore.

The startup configuration is wrapper-aligned:

- legacy defaults
- `budget mode = none`
- enumerate mode
- `simple_attack` as the initial loaded example

Curated comparison examples can still override that global default with a more appropriate preset. The public `Reference Preferred` example, for instance, keeps `budget mode = none` so it remains a faithful classical ABA comparison case.

## Analysis Panel

The analysis panel is now decision-oriented rather than witness-oriented.

- extensions are grouped by their accepted assumptions before analysis
- grouped extensions are ranked by the active objective, or by minimum `β*` in exploration mode
- assumptions receive a `Decision Score` via a Borda-style aggregation over those ranked extensions
- robustness is reported as presence in the near-best set `S`
- level advantage reports whether the best extension containing an assumption outranks the best extension without it

This makes the panel more useful for “best course of action” or “best assumption” workflows, where the main question is which assumptions survive in the strongest ranked alternatives.

`grounded` and `preferred` are exact. The browser does not use `asprin`; it performs the same plain-`clingo` multi-pass flow as the mature CLI surface:

1. enumerate feasible `complete` candidates
2. filter them with `semantics/subset_minimal_filter.lp` for grounded or `semantics/subset_maximal_filter.lp` for preferred
3. if `optN` is requested in a bounded run, apply numeric objective ranking after subset filtering

## Synced Modules

`npm run sync` regenerates [waba-modules.js](/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground/waba-modules.js) from the public WABA manifest only:

- `core/base.lp`
- supported semiring modules only: `godel`, `lukasiewicz`, `lukasiewicz_low`
- `defaults/*.lp`
- `monoid/*.lp`
- `optimize/*.lp`
- `constraint/{ub,lb,no_discard}.lp`
- `filter/{standard,projection}.lp`
- `semantics/{cf,stable,admissible,complete,subset_minimal_filter,subset_maximal_filter}.lp`
- curated public example `.lp` files

Sync fails hard on missing files. There are no placeholder fallbacks.

Schema validation for the generated bundle lives in [scripts/check-sync-schema.js](/Users/fdasaro/Desktop/WABA-claude/ABA-variants/waba-playground/scripts/check-sync-schema.js).

## Curated Examples

The primary example selector is built from the curated public WABA examples:

- `simple_attack`
- `aspforaba_journal_example`
- `strong_inference_bounded_lies`
- `expanding_universe_argumentation`
- `sem_subset_closure_counterattack`

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
- `budget_value/1` in bounded runs

The live browser surface also inherits one documented implementation limit from the mature WABA repo:

- empty-body weighted rules remain a known paper/code mismatch
