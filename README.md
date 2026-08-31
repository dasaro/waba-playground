# WABA Playground

`waba-playground` is the static browser frontend for the mature WABA surface.

Core references:

- architecture: [ARCHITECTURE.md](ARCHITECTURE.md)
- audit baseline: [AUDIT.md](AUDIT.md)
- testing and release gate: [TESTING.md](TESTING.md)
- deployment flow: [DEPLOYMENT.md](DEPLOYMENT.md)
- release notes: [CHANGELOG.md](CHANGELOG.md)

The app remains GitHub-Pages compatible:

- no backend
- no runtime fetch from the sibling `WABA/` repo
- committed `waba-modules.js` bundle
- static HTML/CSS/JS plus `clingo-wasm`

## Supported Surface

The UI offers one control per real choice, and nothing that can be set to an
unsupported combination. Eight controls, down from eleven:

| control | options | notes |
|---|---|---|
| Algebra | `godel`, `arctic`, `lukasiewicz` (strength); `tropical`, `bottleneck_cost` (cost) | named directly; the polarity is a property of the algebra, not a separate knob |
| Łukasiewicz bound `k` | integer | shown only for `lukasiewicz`; passed as `-c k=N` |
| Semantics | `cf`, `stable`, `admissible`, `complete`, `preferred`, `grounded`, `naive`, `semi-stable`, `stage`, `ideal`, `eager` | all eleven share beta-sigma; seven use exact per-reduct post-filters |
| Unweighted assumptions (δ) | `aba`, `neutral` | which default weight an unweighted assumption carries; `legacy` was retired as provably redundant (it equalled `neutral` for four algebras and `aba` for tropical) |
| ABA recovery | on/off | pins transparent δ and forbids every discard |
| Budget reading | none, total ≤ β, worst ≤ β, every ≥ β | exactly the three canonical (monoid, bound) pairings |
| Results | all, cheapest, dearest | enumerate or optimise |
| β | integer | the inconsistency budget |

Only the canonical pairings are offered, so an unsupported one is unreachable rather
than merely discouraged:

- `sum + ub` — total conceded ≤ β
- `max + ub` — worst single concession ≤ β
- `min + lb` — every concession ≥ β

The five algebras are the direct module keys; `godel_low` and `tropical_high` remain as
aliases for `bottleneck_cost` and `arctic` in saved configurations.

All eleven semantics use one beta-sigma mechanism. The core chooses an affordable discard set
`D` using the selected monoid and bound; the selected ordinary semantics is then evaluated in
the fixed reduced attack framework `Att \ D`. There is no semantics-specific `pay` relation,
private SUM budget, or recovery threshold. ABA recovery loads `no_discard`, which forbids the
same `D` for every semantics.

β is passed to the solver as `-c beta=N`, exactly as `bin/waba` does, so it overrides a
framework that declares its own `#const beta`. The output filter is always `projection`.

The startup configuration is wrapper-aligned:

- `neutral` default policy (δ = the algebra's ⊗-identity)
- `budget mode = none`
- enumerate mode
- `conflict_cycle` (Three-Way Standoff) as the initial loaded example (which applies its own budgeted preset)

Curated comparison examples override that global default when their intended algebra or
budget requires a specific preset.

The seven higher-order semantics are exact. The browser does not use `asprin`; it performs the
same metadata-driven plain-`clingo` multi-pass flow as the CLI surface:

1. enumerate `(S,D)` witnesses from the declared kernel (`cf`, `admissible`, or `complete`)
2. apply the declared subset/range filter separately inside each exact `D`
3. existentially forget `D`, deduplicate equal extensions, and retain one deterministic
   representative receipt (least aggregate for an upper bound, greatest floor for a lower
   bound, with the discard key breaking ties)
4. apply an optional numeric result filter only after semantic filtering

The filters implement preferred (maximal admissible), grounded (least complete), naive
(maximal conflict-free), semi-stable (complete with maximal assumption range), stage
(conflict-free with maximal assumption range), ideal (largest admissible subset of every
preferred extension), and eager (largest admissible subset of every semi-stable extension;
computed from complete candidates because it is complete). `CF2`/`stage2` are not offered:
their ASPARTIX encodings recurse over SCCs in a binary Dung graph, whereas an ABA attack may
require a set of assumptions jointly. The native flat-ABA SCC schema of
[Blümel et al. (2025)](https://doi.org/10.24963/ijcai.2025/488) is the appropriate basis for
a direct implementation, but still requires a CF2 base case and a proof that its recursion
remains local to each budget reduct.

## Synced Modules

`npm run sync` regenerates [waba-modules.js](waba-modules.js) from the public WABA manifest only:

- `core/base.lp`
- `validate.lp`, used as the same pre-flight program as the CLI
- supported semiring modules: `godel`, `bottleneck_cost`, `arctic`, `tropical`, `lukasiewicz`
- `defaults/*.lp`
- `monoid/*.lp`
- `optimize/*.lp`
- `constraint/{ub,lb,no_discard}.lp`
- `filter/{standard,projection}.lp`
- four semantics kernels plus the generated subset/range filters and private range projection
- curated public example `.lp` files

Sync fails hard on missing files. There are no placeholder fallbacks.

Schema validation for the generated bundle lives in [scripts/check-sync-schema.js](scripts/check-sync-schema.js).

## Curated Examples

The curated examples are chosen to make WABA's distinctive machinery visible —
the inconsistency budget resolving conflicts that classical ABA cannot, with
several weighted resolutions at *different, non-zero* costs (not one trivial
cost-0 extension):

The suite spans all five algebras and several attack shapes (single-premise vs.
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

**Cost/weakness reasoning** — the same non-zero-cost, weighted-argument contract, but the weights read
as a **cost or weakness** (not a strength), the natural home of the cost-polarity semirings:

- `detective_locked_house` — **Locked-house murder: butler vs intruder** (**Tropical** / surprisal):
  the improbability each clue forces the intruder theory to treat as coincidence *accumulates* (⊗=+):
  no forced entry (9) + knowing the alarm code (11) + zero DNA (7) = 27; the insider theory is accepted
  at **cost 5** — one unexplained footprint (Occam / inference to the best explanation) (β=27).
- `weakest_link_security` — **Weakest link: defence-in-depth vs single barrier** (**Bottleneck-cost**):
  a system is only as strong as its weakest link, so a design's exposure is its *worst* component (⊗=max),
  never a sum — the single barrier's max(9,6)=9 vs the layered design's max(1,3)=**3**, accepted (β=9).
- `testimony_erosion` — **Testimony erosion: eyewitness vs long-chain legend** (**Łukasiewicz
  t-norm**): each transmission path is represented by the conjunction of its link-reliability leaves,
  so ⊗ = max(0, Σw − (n−1)·k), k=1000, erodes as links are added. With the same
  90%-faithful links (weight 900), 2 copies retain 900⊗900 = 800, but 7 retellings
  collapse to max(0, 6300−6000) = **300** (the "telephone game"). The eyewitness account is accepted at
  **cost 300** (dismissing the eroded legend); the legend holdout costs 800 (β=800).

### Credibility

The **⚖️ Credibility** button grades every assumption by the ω-discounted share of
budget-feasible standpoints it stands in. Two readings, because a cost means different things
in different frameworks:

| discount | ω(c) | decay | read it as | use when |
|---|---|---|---|---|
| harmonic *(default)* | κ/(κ+c) | ~1/c, **saturating** | affordability share | weights are ordinal ratings |
| exponential | e^(−c/K) | geometric | odds / probability | weights are surprisals (tropical, w = −K ln p) |

The scale auto-fits the framework (ω = ½ at the median paid standpoint) unless you type one.
The families differ in the **tail**: harmonic's ratio is bounded by the cost ratio, so on the
Higgs example (costs 8 vs 109) no κ pushes the pair past 0.94/0.13 — right for a 3-point rating
scale, wrong for a 5σ result. At the encoding scale (K=10, one σ per 10 units) the exponential
gives 0.99996 / 0.00008. Exponential is also the family that satisfies **independence** across
disconnected frameworks; that coincidence is not accidental — independence and the
log-probability reading are the same factorisation.

**Real corpus data** — nothing invented: the framework, the attack structure and every weight come
from a published annotated corpus.

- `persuade_essay` — **Student essay: the objection the writer forgot** (**Arctic**): one essay from
  the PERSUADE 2.0 corpus (Crossley et al. 2024, CC BY 4.0), with Position/Claim/Evidence support,
  Counterclaims attacking the position and a Rebuttal reinstating against one of them — reinstatement
  is native to the annotation. Weights are the corpus's own double-blind expert effectiveness ratings
  (Ineffective 333 / Adequate 667 / Effective 1000). The writer answered one objection and forgot the
  other, so the position **falls classically**; **β=667** buys it back for exactly the price of the
  forgotten objection. The algebras disagree visibly about case strength here (arctic 3334, Gödel 333,
  Łukasiewicz 0), and **Credibility** grades the forgotten objection above the answered one.

The debate and cost/weakness examples open in the **Assumption-Branching** graph view (the Standard
set-graph is the 2ⁿ power set of assumptions, guarded off above ~8 assumptions).

Earlier examples whose weights/budget did not affect the result (classical
reference cases, the rule-less `simple_attack` smoke, trivial topology fixtures)
have been retired from the playground selector.

## Development

From [waba-playground](.):

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

The output filter is always `projection`, so a witness carries exactly:

- `in/1`
- `out/1`
- `discarded_attack/3`
- `budget_value/1` in bounded runs

`supported_with_weight/2` and `attacks_successfully_with_weight/3` are **not** among them:
`filter/standard.lp` is never loaded. Anything the UI wants to say about derivations or
attack provenance is reconstructed from the framework SOURCE, not read out of the witness
(see `OutputManager.frameworkRules` / `findSupportingAssumptions`). Framework well-formedness
is checked separately by the bundled `validate.lp` before this semantic program is run.
