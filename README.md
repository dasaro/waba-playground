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

- semiring family: `godel`, `tropical` (each with a polarity), plus standalone `lukasiewicz`
- polarity: `higher`, `lower` (ignored for `lukasiewicz`, which has no variants)
- effective semiring keys: `godel`, `bottleneck_cost`, `arctic`, `tropical`, `lukasiewicz`
- default policy: `legacy`, `aba`, `neutral`
- ABA recovery: `neutral` defaults + `no_discard`
- monoid: `sum`, `max`, `min`
- optimization: `minimize`, `maximize`
- budget mode: `none`, `ub`, `lb`
- semantics: `cf`, `stable`, `admissible`, `complete`, `grounded`, `preferred`
  (the four defence semantics run on the no-discard surface)
- output filter: `projection`, `standard`
- opt mode: `ignore`, `optN`

Family/polarity is a thin selector over the direct semiring module keys:

- `godel + higher` -> `godel`
- `godel + lower` -> `bottleneck_cost`
- `tropical + higher` -> `arctic`
- `tropical + lower` -> `tropical`
- `lukasiewicz` (no polarity) -> `lukasiewicz`

Bounded presets intentionally match the mature WABA support policy:

- `sum + ub`
- `max + ub`
- `min + lb`

When `budget mode = none`, the browser matches the wrapper's `no_discard` surface. The Monoid / Optimization / Opt-Mode controls only apply when a budget mode (discarding) is active. There is no separate “minimum β exploration” mode anymore.

The startup configuration is wrapper-aligned:

- legacy defaults
- `budget mode = none`
- enumerate mode
- `conflict_cycle` (Three-Way Standoff) as the initial loaded example (which applies its own budgeted preset)

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
- supported semiring modules: `godel`, `bottleneck_cost`, `arctic`, `tropical`, `lukasiewicz`
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

The curated examples are chosen to make WABA's distinctive machinery visible —
the inconsistency budget resolving conflicts that classical ABA cannot, with
several weighted resolutions at *different, non-zero* costs (not one trivial
cost-0 extension):

The four span the four algebras and several attack shapes (single-premise vs.
joint attacks, sum vs. max monoid):

- `conflict_cycle` — **Three-Way Standoff** (default, **Gödel** / weakest link): an
  odd rebuttal cycle that classical ABA cannot settle (UNSAT). WABA discards the
  cheapest rebuttal — three settlements at costs 3, 5, 8 (Gödel + sum + ub, β=8).
- `arctic_grounds` — **Accumulated Objections** (**Arctic** / max-plus): each
  rebuttal is a JOINT attack whose force is the *sum* of its grounds (⊗=+), so
  well-supported rebuttals cost more to drop — three positions at costs 5, 7, 9
  (Tropical-higher = arctic, sum + ub, β=9).
- `bottleneck_worstcase` — **Worst-Case Concession** (**Bottleneck-cost** / min-max
  + MAX monoid): a rebuttal is only as strong as its *worst* ground (⊗=max) and an
  extension costs its single worst concession, so all three decisions can be kept
  by paying just the hardest block (8) (Gödel-lower = bottleneck, max + ub, β=8).
**Scientific theory competitions** — each modelled so the accepted (consensus) theory is
resolved at **non-zero cost** (it must discard a genuine, tolerated residual objection — no
cost-0 degeneracy), with evidence as **weighted argument atoms** (weights = real quantities:
effect sizes, meta-analyses, σ/p-values, evidence strength) that accumulate along derivation
chains into the rival's refutation. Competing theories map 1:1 to assumptions; each has ≥2 models:

- `kpg_impact_vs_deccan` — **K-Pg extinction: impact vs volcanism** (**Arctic**): the Chicxulub
  impact (Alvarez et al. 1980) vs Deccan volcanism. Iridium anomaly (9) + shocked quartz (7) +
  global ejecta/crater (6) sum to 22 against a Deccan-only cause; the impact theory is accepted
  at **cost 8** — discarding the tolerated extinction-selectivity objection (Hull et al. 2020)
  that keeps a Deccan contribution alive (arctic + sum + ub, β=22).
- `higgs_boson_discovery` — **Higgs boson: 5σ discovery vs the null** (**Tropical** / surprisal):
  ATLAS 5.9σ (59) and CMS 5.0σ (50) add to 109 units of surprisal against the background-fluctuation
  null (arXiv:1207.7214/7235); the discovery is accepted at **cost 8** — discarding the
  look-elsewhere / trials-factor caveat every local 5σ carries (tropical + sum + ub, β=109).
- `out_of_africa` — **Human origins: Out-of-Africa vs multiregional** (**Arctic**): coalescence (12)
  + serial-founder decay (15) + African basal diversity (10) sum to 37; recent African origin is
  accepted at **cost 8** — discarding the archaic-admixture objection (Neanderthal/Denisovan DNA;
  Green 2010, Reich 2010) that partly vindicates gene flow (arctic + sum + ub, β=37).
- `lipid_hypothesis` — **Lipid hypothesis: LDL causal vs marker-only** (**Arctic**, meta-analytic
  effect sizes): CTT statin meta-analysis (8) + Mendelian randomization (11) + PCSK9 RCTs (6) sum to
  25; causal-LDL is accepted at **cost 5** — discarding the residual-risk objection (~70-80% of
  events remain despite LDL-lowering; CANTOS) (arctic + sum + ub, β=25).

**Cost/weakness reasoning** — the same non-zero-cost, weighted-argument contract, but the weights read
as a **cost or weakness** (not a strength), the natural home of the cost-polarity semirings:

- `detective_locked_house` — **Locked-house murder: butler vs intruder** (**Tropical** / surprisal):
  the improbability each clue forces the intruder theory to treat as coincidence *accumulates* (⊗=+):
  no forced entry (9) + knowing the alarm code (11) + zero DNA (7) = 27; the insider theory is accepted
  at **cost 5** — one unexplained footprint (Occam / inference to the best explanation) (β=27).
- `weakest_link_security` — **Weakest link: defence-in-depth vs single barrier** (**Bottleneck-cost**):
  a system is only as strong as its weakest link, so a design's exposure is its *worst* component (⊗=max),
  never a sum — the single barrier's max(9,6)=9 vs the layered design's max(1,3)=**3**, accepted (β=9).
- `deorbit_plan_risk` — **Deorbit plan: redundant vs single-string** (**Tropical** / risk): a plan's
  failure risk *accumulates* across steps (⊗=+) — valve leak (12) + attitude drift (9) + comms blackout
  (7) = 28; the redundant plan is accepted at **cost 5** (a residual sensor-crosscheck risk) (β=28).

The debate and cost/weakness examples open in the **Assumption-Branching** graph view (the Standard
set-graph is the 2ⁿ power set of assumptions, guarded off above ~8 assumptions).

Earlier examples whose weights/budget did not affect the result (classical
reference cases, the rule-less `simple_attack` smoke, trivial topology fixtures)
have been retired from the playground selector.

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
