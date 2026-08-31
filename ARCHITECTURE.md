# Architecture

`waba-playground` is a static browser frontend over a generated snapshot of the mature WABA CLI surface.

## Source Of Truth

- Logical source of truth: `../WABA`
- Browser snapshot: `waba-modules.js`
- Snapshot generator: `scripts/sync-modules.js`

The playground does not fetch logic from the sibling `WABA/` repo at runtime.

## Layers

### 1. Core

Files:

- `core/app-version.js`
- `core/dom-registry.js`
- `core/store.js`
- `core/types.js`

Responsibilities:

- single DOM registry creation
- lightweight app state
- shared JSDoc contracts
- one version source for cache-busting and release checks

### 2. Runtime

Files:

- `runtime/config-service.js`
- `runtime/program-builder.js`
- `runtime/answer-set-parser.js`
- `runtime/objective-utils.js`
- `runtime/module-schema.js`

Responsibilities:

- normalize and validate the supported browser config
- resolve canonical semiring family + polarity into concrete modules
- compose the browser solver program
- parse answer sets into explicit data objects
- compare objective tuples and compute aggregate values
- validate the generated `waba-modules.js` schema

Rule:

- runtime modules are DOM-free

### 3. Features

Files:

- `features/config-controller.js`
- `features/docs-controller.js`
- `features/editor-controller.js`
- `features/examples-controller.js`
- `features/playground-controller.js`
- `features/editor/simple-format.js`

Responsibilities:

- bind UI state to runtime configuration
- keep curated examples and presets coherent
- convert between Simple Mode fields and ASP source
- orchestrate page startup, pending loads, graph refresh, and solver runs

Rule:

- feature modules consume the DOM registry and runtime helpers
- feature modules do not perform ad hoc global DOM lookups

### 4. Modules

Files under `modules/`

Responsibilities:

- long-lived browser services
- Clingo WASM integration
- vis.js graph rendering
- output rendering
- metrics/analysis
- exports, theming, panels, popups, files

These remain “manager” style modules, but their responsibilities are narrower than before the refactor:

- `clingo-manager.js` owns solver initialization, solver queueing, and exact relational-semantics orchestration
- `graph-manager.js` owns vis.js graph construction and graph highlighting
- `output-manager.js` owns result rendering and delegates parsing/objective math to runtime helpers

## Supported Contract

The browser preserves exactly this public surface:

- algebra: direct selection of `godel`, `arctic`, `tropical`, `bottleneck_cost`, or
  `lukasiewicz` (polarity is derived from the selected algebra)
- default policy: `aba`, `neutral` (`legacy` retired: provably redundant)
- monoid: `sum`, `max`, `min`
- optimization: `minimize`, `maximize`
- budget mode: `none`, `ub`, `lb`
- semantics: `cf`, `stable`, `admissible`, `complete`, `preferred`, `grounded`,
  `naive`, `semi-stable`, `stage`, `ideal`, `eager`
- exact subset- and range-induced semantics via browser-side multi-pass plain `clingo`

Every semantics shares one beta-sigma pipeline: choose an affordable `D` with the external
monoid/bound modules, then apply ordinary sigma semantics to `Att \ D`.

Supported bounded presets:

- `sum + ub`
- `max + ub`
- `min + lb`

## Solver Flow

Normal semantics:

1. UI config is normalized by `runtime/config-service.js`
2. `runtime/program-builder.js` composes the ASP program from synced modules
3. `modules/clingo-manager.js` runs plain `clingo-wasm`
4. discard-witness duplicates are collapsed by accepted `in/1` set while retaining one receipt
5. `runtime/answer-set-parser.js` and `modules/output-manager.js` render extensions

Exact post-filtered semantics:

1. enumerate the declared `(S,D)` candidate family without numeric post-filtering
2. generate `candidate/1`, `member/2`, `discarded_member/4`, and, when needed,
   `range_member/2` facts
3. run the declared exact filter, comparing candidates only when their `D` sets are equal
4. existentially forget `D` and deduplicate equal `S` values
5. if needed, apply numeric post-filtering only after per-reduct semantic selection

## Concurrency Rule

All browser-side Clingo calls must go through `ClingoManager`.

Reason:

- `clingo-wasm` calls are not safely concurrent in the current frontend
- graph recomputation and extension solving can otherwise race each other

Implementation:

- `modules/clingo-manager.js` keeps a single solver queue
- `graph-manager.js` uses `clingoManager.runRaw(...)` instead of calling `clingo.run(...)` directly

## Startup Flow

`app.js` is bootstrap only:

1. create DOM registry
2. create store
3. create `PlaygroundController`
4. initialize Clingo worker
5. initialize graph and controllers
6. load the selected example as part of startup, not via a delayed timer

That last point matters because the initial example load must finish before the user can run semantics against it.
