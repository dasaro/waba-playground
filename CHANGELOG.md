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

## 20260706-2

- **Replaced the scientific examples with literature theory-competitions that resolve at NON-ZERO
  cost.** Removed `big_bang_steady_state`, `smoking_lung_cancer`, `solar_neutrino`, `age_of_earth`,
  `plate_tectonics` (all resolved at cost 0, and their chain intermediates were unweighted) and the
  `probabilistic` demo. Added four new curated examples, each clingo-verified against five criteria:
  resolved at non-zero cost (no cost-0 extension), some rule bodies are non-assumptions, some rule
  heads are non-contraries, every non-assumption/non-contrary atom is weighted, and ≥2 stable models.
  Competing theories map 1:1 to assumptions; evidence enters as **weighted argument atoms** whose
  weights encode real quantities and accumulate along chains into the rival's refutation. The accepted
  (consensus) theory wins the min-cost extension only after discarding a genuine tolerated objection:
  - `kpg_impact_vs_deccan` (Arctic) — Chicxulub impact vs Deccan volcanism; iridium 9 + shocked quartz
    7 + ejecta/crater 6 = 22 vs Deccan; impact accepted @8 (extinction-selectivity objection). β=22.
  - `higgs_boson_discovery` (Tropical) — 5σ discovery vs the null; ATLAS 59 + CMS 50 = 109 surprisal;
    Higgs accepted @8 (look-elsewhere / trials-factor caveat). β=109. The σ/p-value example.
  - `out_of_africa` (Arctic) — recent African origin vs multiregional; coalescence 12 + serial-founder
    15 + diversity 10 = 37; OoA accepted @8 (Neanderthal/Denisovan admixture objection). β=37.
  - `lipid_hypothesis` (Arctic) — LDL causal vs marker-only; CTT 8 + Mendelian-randomization 11 +
    PCSK9 6 = 25; causal-LDL accepted @5 (residual-risk objection). β=25. Meta-analytic effect sizes.
  Each carries a detailed, reference-bearing description. The three algebra demos are unchanged.
- Weighted argument atoms now display their weight on the Assumption-Branching graph node label.

## 20260706-1

- **Scientific-debate examples now use DERIVATION CHAINS** (no evidence assumption attacks a
  stance directly). Each debate's evidence combines into intermediate CLAIM atoms, which combine
  into the refutation of the rival — exposing the inferential structure and exercising WABA's
  chain reasoning + semiring propagation. All five re-verified in clingo: because ⊗ is associative
  (arctic/tropical `+`, gödel `min`) the propagated weights and β thresholds are unchanged
  (big_bang 5, smoking 54, solar 53, age_of_earth 80, tectonics cost-7 / holdout-19). The
  flagship is `age_of_earth`, where gödel ⊗=min drags Kelvin's multi-step chain down to strength
  5 at the false "no internal heat" premise (`secular_cooling=60 → young_age_estimate=5`).
- **Assumption-Branching graph now renders the full derivation DAG.** Intermediate derived atoms
  become their own indigo "Derived Claim" nodes; multi-premise steps are AND-junctions (⬥); grey
  "Derivation step" edges carry support (not attacks) and stay neutral under extension highlighting.
  A chain `evidence → claim → … → contrary → (attacks) stance` is now drawn as a visible path.
  Assumption-Direct mode is unchanged (still flattens to leaf assumptions) for contrast.
- Legend gains the Derived Claim node + Derivation step edge; single-premise derived attacks still
  show their leaf weight (⊗ of one element), multi-leaf attacks show none (semiring-dependent).

## 20260702-1

- **four more scientific-debate curated examples**, each designed + clingo-verified so the
  accepted (min-cost) extension reproduces the modern consensus, and each mapping to the
  algebra whose operation matches the debate's reasoning:
  - `smoking_lung_cancer` — Bradford-Hill CONSILIENCE (Arctic, ⊗=+ sums 8 independent
    criteria → weight 54) vs Fisher's confounding hypothesis. Consensus at cost 0; holdout at β=54.
  - `solar_neutrino` — combined statistical significance (Tropical; SNO's two channels add
    surprisal ≈5.3σ). Consensus (oscillation) at cost 0; SSM-error holdout at β=53.
  - `age_of_earth` — WEAKEST-LINK (Gödel, ⊗=min): Kelvin's cooling estimate collapses on its
    false "no internal heat" premise (strength 5). Consensus (~4.54 Gyr) at cost 0; holdout at β=80.
  - `plate_tectonics` — consilience with a TOLERATED objection (Arctic): the accepted mobilist
    extension pays a NONZERO cost 7 (discarding the "no mechanism" objection, as history did),
    still beating the fixist holdout (cost 19). β<7 is UNSAT.
  Chosen + designed by two web-researched, adversarially-QA'd workflows; each framework
  independently re-verified in clingo, and every `contrary` is a total function (single contrary
  per assumption). Weights are labelled as modelling encodings, not physical constants.
- these five debate examples carry a `graphMode` preset and open in the **Assumption-Branching**
  view (the meaningful view for a debate); presets can now set the graph mode.
- **fix (latent): the Standard set-graph is the 2ⁿ power set of assumptions** and would stall the
  solver queue on load for large frameworks (smoking has 10 → 1024 sets). `updateGraphStandard`
  now guards frameworks with >8 assumptions, showing a message directing to the assumption views
  instead of enumerating. Also made `showGraphEmptyState` re-inject its element (vis.Network wipes
  #cy's children on render), so the empty-state message actually appears.

## 20260701-2

- new curated example **`big_bang_steady_state` — Big Bang vs Steady-State**, a real
  scientific debate cast as **Arctic evidential consilience**. A weight counts
  independent converging lines of evidence (one unit each), and Arctic's ⊗=+ SUMS them,
  so the joint case `not_steady <- {CMB exists, CMB blackbody, primordial He-4,
  deuterium, evolving radio counts}` has weight 5. Contraries respect the total-function
  requirement (one per assumption). Verified in clingo (β-sweep): the accepted, cost-0
  extension is `in(big_bang), out(steady_state)` — today's settled consensus — for all
  β<5; a Steady-State extension appears only at β≥5 and costs exactly 5 (you must discard
  all five lines). Ships at β=5 so both stances enumerate (Big Bang at cost 0 is the
  optimum). Weights are a modelling count, not physical constants; the lithium-7
  discrepancy is flagged as a tolerated within-model anomaly. (Candidate debate chosen by
  an 8-way web-researched + adversarially-judged workflow; runner-up: the solar neutrino
  problem.)

## 20260701-1

Implemented the remaining deferred GUI-audit fixes:

- **Łukasiewicz is now selectable** (semiring-select option + `SEMIRING_POLARITY`
  entry; polarity selector disabled since it has no variants). It composes + solves.
- **Defence semantics run on the no-discard surface.** admissible/complete/grounded/
  preferred now force Budget Mode = none and disable the budget control (their
  interaction with discarding is undefined). Surface copy notes it.
- **Inert controls are greyed out.** With no discarding (Budget = none / ABA recovery /
  defence), the Monoid / Optimization / Opt-Mode controls have no effect and are now
  disabled. grounded/preferred force + lock Opt-Mode = ignore (replacing a dead no-op).
- **Failed / timed-out runs no longer leave stale results.** Output + graph highlight
  are cleared before solving.
- **A re-selected 📁 uploaded example is restored** instead of doing nothing.
- **Empty / degenerate frameworks show the graph empty-state** instead of a blank canvas.
- **Config changes no longer un-highlight the active extension** (restore re-applies
  the highlight instead of toggling it off).
- **Standard-mode highlight is exact** — only the set-node equal to the selected
  extension is highlighted, not every set sharing an assumption (#18).
- **PrismEditor no longer yanks the caret** from another editor/input (guards the
  global selection to this editor) (#15).
- **Async graph race guard**: a slow standard-mode build can no longer clobber a newer
  graph after an example/mode switch (#16).
- **Derived-atom weights** show `+inf`/`-inf` instead of raw `#sup`/`#inf`.
- Docs: corrected the stale "Supported Surface" in README.md and ARCHITECTURE.md
  (real families/keys godel/bottleneck_cost/arctic/tropical/lukasiewicz; sum/max/min;
  no `count`); fixed the Optimization vs Opt-Mode help entry.

Deferred (low value / contested): ParserUtils nested-term-comma parsing (#30; simple
atoms only in practice, and the user-facing discarded-attack display is already
nested-safe); grounded/preferred 2× solver-timeout sharing; a program-builder change
for Optimization-in-enumerate-mode (it still affects ranking, so not a true no-op —
clarified in the help copy instead).

## 20260630-10

GUI audit pass (multi-agent audit, fixes applied + independently re-verified):

- **fix [high]: the Polarity selector was half-dead — "lower" was silently ignored.**
  `resolveSemiringModuleKey` short-circuited on `wabaModules.semiring[semiringFamily]`,
  but `godel`/`tropical` are themselves valid module keys, so it returned the family
  name before consulting `canonicalSemiring` — `godel+lower` stayed **godel** instead
  of **bottleneck_cost**, and `tropical+higher` stayed **tropical** instead of
  **arctic**. Bottleneck-cost and Arctic were therefore unreachable from the UI, and
  the `bottleneck_worstcase` / `arctic_grounds` curated examples were actually running
  as godel/tropical. Fixed by resolving canonical families by polarity FIRST (concrete
  keys passed directly still resolve to themselves). Verified end-to-end:
  `bottleneck_worstcase` now reads costs 5/6/8 (bottleneck), not 2/3/4 (godel).
- **fix [high]: Simple-mode typing rebuilt the graph (and ran clingo in standard mode)
  on every keystroke.** Debounced the framework-changed callback (300 ms) in
  editor-controller; the description update stays immediate.
- **fix [high]: non-flat frameworks showed a bare "No extensions found".** The core
  rejects non-flat ABA (an assumption that is a rule head) as UNSAT; the Results panel
  now detects it and explains which assumption is non-flat and why (flat-only).
- **fix: discarded-attack weights rendered raw `#sup`/`#inf`** — now shown as
  `+inf`/`-inf` via `displayValue` (#29); and the fragile `discarded_attack(...)`
  regexes were replaced with a nested-paren-safe `splitTopLevelArgs` parser so atoms
  like `p(x,y)` are no longer mis-split (#30).

Deferred (documented for a focused follow-up): expose Łukasiewicz in the UI; guard the
defence semantics (admissible/complete/grounded/preferred) against discarding budget
modes where they are unsound; disable inert Monoid/Optimization/Opt-Mode controls when
Budget Mode = None; async graph-rebuild generation guard + stale-results clearing on
error; PrismEditor caret-preservation; standard-mode set-node over-highlight; doc
(README/ARCHITECTURE) surface drift.

## 20260630-9

- **fix: assumption-graph never showed in/out assumptions or active attacks.** Two
  gaps in extension highlighting (`modules/graph-highlighting.js`):
  - **In/out node colouring was dead in the assumption views** (both projection and
    standard): the matcher keyed off `node.assumptions`, an array only set-mode nodes
    have — an assumption-mode node *is* a single assumption (`node.id`), so `hasIn`
    was always false and no node was ever coloured. Now assumption nodes are coloured
    by membership: **IN → green, OUT → grey**; ⊤/junction nodes are left untouched.
  - **Active attacks were invisible in projection mode** (the default): they were
    matched from `attacks_successfully_with_weight`, which projection's `#show`
    doesn't emit, so every non-discarded edge fell through to the faded "Inactive"
    style. Active is now also derived client-side from the in-set + each edge's
    supporting assumptions (`attackSupportedByIn`), so **active attacks turn red** in
    every show mode (joint attacks need all contributors IN; fact/⊤ attacks are
    always active). No core change / re-sync needed.
  Legend updated with In/Out node states. 5 new unit tests
  (`tests/unit/graph-highlighting.test.js`), incl. the projection case (active edge
  detected with an empty `successfulAttacks`).

## 20260630-8

- **fix: assumption-graph (Direct + Branching) could misrepresent the semantics.**
  The builder was static (one rule deep, assumption-typed body atoms only, no
  semiring), so four things diverged from the real framework. Rewrote it around a
  recursive **minimal-support computation** (`computeSupportSets`: the DNF of the
  AND-OR derivation tree, tracing chains through non-assumption atoms + nested
  disjunction, with a cycle guard and a blow-up cap). Now:
  - **#1 Indirect attacks no longer vanish.** A contrary derived through a chain
    (`c ← x ← b`) now draws `b → a`; the attacked assumption is no longer shown as
    isolated/unattacked (verified vs clingo: `b` defeats `a` with weight 7).
  - **#2 Joint attacks include conjuncts reached through chains.** `c ← b1, x` with
    `x ← b2` now draws the junction over `{b1, b2}`; `b2` is no longer isolated.
  - **#3 Direct mode distinguishes joint (AND) from disjunctive (OR).** Joint
    contributions are green and marked `∧`; disjunctive attacks stay amber and carry
    their weights — previously the two differed only by edge colour. Branching keeps
    the junction node. Legend updated to state the AND semantics.
  - **#4 Edge weights are no longer fabricated.** Single-premise edges show the leaf
    assumption's weight (correct under every semiring — conflict_cycle now reads
    8/3/5, matching the Results panel, instead of a fixed `1`); joint/junction edges
    omit the numeric label because the ⊗-aggregate is semiring-dependent (shown in
    the tooltip + Results). Fact-based attacks (incl. those reached through a chain
    bottoming at a fact) still render as `⊤`.
  Both modes now fold into one shared core (`buildAssumptionGraph({ branching })`);
  highlight/popup fields (`contrary`, `targetAssumption`, `attackingElement`,
  `weight`) preserved — extension highlighting still greys/dashes the right edges.
  8 new unit tests lock in the support-set logic and each fix.

## 20260630-7

- **fix: Results panel showed every attack as coming from `⊤`** (e.g.
  `⊤ ⊬ against_growth [growth] (w: 5)`) in **projection mode**, regardless of the
  real attacker. Root cause: projection mode's `#show` emits only in/out/
  discarded_attack, so the witness carries no head/body/assumption facts —
  `findSupportingAssumptions` could neither trace the attacking element to its rule
  nor bottom out at an assumption, so it always took the `⊤` fallback. Fix: thread
  the framework source into `displayResults` and parse its rules + assumptions
  (`ParserUtils`) as the provenance fallback. Derived attacks now name their
  supporting assumption(s) — `welfare ⊬ against_growth [growth] (w: 5)` — and joint
  attacks list every ground (`eco, ground_a ⊬ against_jobs [jobs] (w: 9)`), while
  genuine empty-body facts still correctly render `⊤`. Applies to both the Active
  and Discarded attack lists, in both projection and standard modes. Regression
  guard added (conflict_cycle in projection must show no `⊤`-prefixed attack line).

## 20260630-6

- curated examples: broadened for **variety across the four algebras and attack
  shapes**. Replaced the redundant second odd-cycle (`dispute_chain`) with two new
  inline examples that exercise the previously-unshowcased algebras:
  - **Accumulated Objections** (`arctic_grounds`) — Arctic / max-plus: each rebuttal
    is a JOINT attack whose force is the *sum* of its grounds (⊗=+); three settlements
    at costs 5, 7, 9 (Tropical-higher = arctic, sum + ub, β=9). Joint attacks render
    as ⬥ junction nodes.
  - **Worst-Case Concession** (`bottleneck_worstcase`) — Bottleneck-cost (min-max) +
    MAX monoid: a rebuttal is only as strong as its *worst* ground (⊗=max) and an
    extension costs its single worst concession, so all three decisions can be kept
    by paying just the hardest block (8) (Gödel-lower = bottleneck, max + ub, β=8).
  The curated set is now Gödel (single-premise cycle), Arctic (joint cycle), Bottleneck
  (joint + max monoid), Tropical (probabilities) — verified end-to-end (3/4/3/2
  settlements; correct family+polarity → semiring resolution; 0 page errors).

## 20260630-5

- re-synced the bundle from the refactored WABA core, propagating all recent core
  work to the live playground: centralized monoid aggregate, the arctic infinity
  fixes, the Łukasiewicz semiring, the fold of support/undefeated propagation into
  the 2-skeleton (_idempotent/_additive) structure, and the **flatness guard**
  (non-flat frameworks — an assumption that is also a rule head — are now rejected;
  weighted WABA is defined for flat ABA only). The inlined refactored godel verifies
  to the same 3/5/8 on the conflict cycle; all browser tests pass.
- sync: skip `_`-prefixed include fragments (semiring/_phase.lp, _idempotent.lp,
  _additive.lp) so they are inlined into the real shims rather than appearing as
  bogus standalone semirings in the bundle / supportedSemiringKeys.

## 20260630-4

- **Mode-aware graph legend.** The legend now matches the active graph mode. The
  Assumption-Direct/Branching modes show the assumption-level legend (Assumption /
  Joint Attack Node / ⊤ Facts; Attack / Joint Attack / Fact-based Attack). The
  Standard mode shows a set-level legend instead: "Assumption set (extension
  candidate)" nodes and edges coloured by weight (finite = amber, #sup = red,
  #inf = grey) — which is what Standard mode actually renders. Both variants share
  the Active/Discarded attack-state key. Switches automatically on mode change
  (features/docs-controller.js setLegendMode, wired from playground-controller).
- **Hover tooltips now show attack state.** When an extension is selected, each
  edge's hover panel gains a "State" row — Active (defeats its target), Discarded
  (overridden against the budget), or Inactive (attacker not supported) — coloured
  to match the legend. The base tooltip is restored when the selection is cleared.

## 20260630-3

Audit: does the Argumentation Graph render correctly and match its legend? Two
graph-correctness/consistency bugs found and fixed in the assumption-level modes
(Assumption-Direct / Assumption-Branching):

- **Unattacked assumptions were drawn as ⊤ fact-based attacks.** The builder
  computed `hasNonFactRules = derivingRules.some(r => r.body.length > 0)`, which is
  false both for a genuine empty-body fact *and* for a contrary with no deriving
  rule at all. So every unattacked assumption (its contrary never derivable — and
  since `contrary` is total, that's common) got a spurious amber `⊤ → assumption`
  edge. Now a fact edge is drawn only when the contrary is actually derived by a
  rule; otherwise the assumption is correctly shown unattacked (no edge).
- **⊤ (Facts) node shape** was an ellipse but the legend depicts a triangle —
  changed the node to a triangle so it matches the legend symbol.

Verified by rendering a joint-attack + fact-attack framework: ⊤ (blue triangle)
now attacks only the genuinely fact-attacked assumption, joint premises feed the
green diamond junction, and unattacked premises have no incoming edge.

Known, not changed here (design decision): the **Standard** graph mode (the
default) shows a *set-level* power-set attack graph — uniform blue set-nodes with
weight-colored edges (amber/red/grey) — which does NOT match the legend's
assumption-level node/edge types. The legend is accurate for the Assumption-*
modes. Options for a follow-up: make the legend mode-aware, or default to an
assumption mode.

## 20260630-2

Audit: do the displayed controls all map to real implementation, with no legacy
leftovers? Findings — every dropdown/button/graph-mode is backed by a real module
or handler, and the semiring (4 algebras, no Łukasiewicz) and monoid (SUM/MAX/MIN,
no Count) doc tables are accurate. Two gaps found and fixed:

- **Grounded semantics was broken.** It runs complete candidates then keeps the
  subset-minimal one via `wabaModules.semantics.subset_minimal_filter`, but that
  module never existed (only `subset_maximal_filter`, used by preferred). Selecting
  Grounded produced `Clingo returned ERROR: syntax error` (the missing module was
  injected into the program as the literal `undefined`). Added a
  `subset_minimal_filter.lp` (the dual of the maximal filter) to the WABA modules,
  re-synced the bundle, and verified Grounded now runs (returns the empty extension
  for the conflict-cycle example, as expected). The existing browser test masked
  this because an errored run leaves the previous run's answers on screen.
- **Semantics reference table** advertised "Semi-Stable" (never an offered option)
  and omitted "Conflict-free" (which IS offered). Aligned the table with the actual
  Semantics dropdown.

stable / complete / admissible / preferred were re-verified working end to end.

## 20260630-1

GUI bug-fix pass (multi-agent audit across ~10 UI dimensions; 35 bugs confirmed,
23 fixed here — all 10 high-severity plus 13 medium/low). Highlights:

- **Config (high):** the ABA-recovery toggle overwrote Default Policy + Budget
  Mode and never restored them, leaving the Budget Threshold permanently greyed
  out after a single on→off toggle. Now snapshots and restores the user's
  selections (and re-reads budget mode so the monoid/budget enable logic is right).
- **Simple↔Advanced editor (high):** rules with 2+ premises were corrupted on
  every mode switch — `extractSimpleFields` swallowed the compact pool
  `body(r1, a; r1, b; r1, c)` as one atom and a second pass produced spurious
  `body(r1, r1)`. Now parses the pool form correctly (regression test added).
- **`.waba` files (high):** export→re-import silently dropped all contraries
  (`(a, c)` vs `a: c`) and all rules (Unicode `←` vs ASCII `<-`); and loading a
  `.waba` then switching to Advanced injected raw shorthand into the ASP editor,
  wiping the fields on the way back. Unified the format (parenthesized contraries,
  ASCII arrow, compact-body aware) and stopped treating `.waba` text as ASP.
- **Cost badge (high):** maximize runs showed a negative cost (clingo reports a
  negated objective for `#maximize`); the sign is now flipped for display.
- **Graph fullscreen (high):** the CSS targeted a non-existent `#graph-container`,
  so fullscreen left the graph tiny in a blank panel. Now targets `.graph-panel`
  and flexes the panel body so the canvas fills the screen.
- **Medium/low:** theme toggle during Clingo load no longer throws (resolves the
  network getter/object either way); `runWABA` is now re-entrancy-guarded
  (Ctrl+Enter spam / double-run); deselecting an extension restores node/edge
  colors (originals are now preserved); an unsupported file upload no longer wipes
  the previous run before validation; "Clear Output" restores the empty-state
  placeholder; "Export PDF" now produces a real PDF (jsPDF) instead of a PNG; the
  loading overlay's "Elapsed" counter actually ticks; Clingo ERROR/UNKNOWN now
  surfaces the underlying detail; derived-atom chips get a color fallback; and the
  metrics CSV no longer embeds `%` in numeric columns.

Remaining lower-priority items (debounce of per-keystroke solver runs, caret
preservation, projection-mode derivation roots, atom HTML-escaping, a few parser
edge cases) are documented for a follow-up.

## 20260629-5

- replaced the curated example set with examples that actually exercise WABA's
  distinctive machinery. The previous set was trivial: classical/preferred cases
  where weights never mattered (cost 0), and `scientific_theory` where β equalled
  Σ(attack weights) so the only extension discarded *every* attack. None showed a
  genuine weighted tradeoff.
- new set, each with several stable extensions at *different, non-zero* costs and
  no trivial cost-0 extension (odd cycles forbid the empty extension):
  - **Three-Way Standoff** (`conflict_cycle`, default) — an odd rebuttal cycle.
    Classical ABA is UNSAT (a deadlock); WABA discards the cheapest rebuttal,
    yielding three settlements at costs 3, 5, 8 (Gödel + sum + ub, β=8).
  - **Dispute Chain** (`dispute_chain`) — a five-claim cycle; five settlements at
    costs 2, 4, 6, 7, 9 (Gödel + sum + ub, β=9).
  - **Weights as Probabilities** (`probabilistic`) — now budgeted (ub, β=800) so
    the budget acts as a probability threshold: the improbable "slippery"
    objection (surprisal 798 ≈ p 0.45) can be overridden — stances at cost 0/798.
- default example is now `conflict_cycle`; updated the browser spec, controller
  defaults, and README accordingly. Verified end to end: 5/5 browser tests, and a
  headless run showing the default produces 3 settlements at costs 3/5/8.

## 20260629-4

- retired the rule-less `simple_attack` smoke example from the playground selector
  (it had no rules and only uniform weights — trivial as a curated example). The
  four remaining curated examples all have rules and weighted assumptions:
  Reference Preferred, Practical Deliberation, Scientific Theory, Weights as
  Probabilities, each loading its appropriate semiring/monoid/budget/semantics
  config on selection (uploaded frameworks keep the user's config).
- changed the default loaded example to `scientific_theory` (rules + weighted
  assumptions + a budget where the weights drive the result).
- fixed two stale references in the browser test that pointed at removed examples
  (`simple_attack`, `subset_closure_counterattack`); refreshed README example list.

## 20260629-3

- fixed weights (and assumptions) being wiped when loading an example: the
  Simple-mode parser (extractSimpleFields) matched one anchored statement per
  line, so any source line holding multiple statements (e.g.
  `assumption(rain). weight(rain, 105).`) dropped both. It now splits each line
  into statements before matching, so multi-statement lines (and pasted
  frameworks) round-trip their weights/assumptions/contraries/rules. Verified in
  the browser: loading Weights-as-Probabilities now shows rain:105 / sprinkler:357
  / cold_night:693; switching examples no longer wipes weights.

## 20260629-2

- curated the example set down to five illustrative WABA examples, removing six
  trivial topology "visualization fixtures" (no_discard, weights unused, cost 0)
- fixed Practical Deliberation: under sum-min it degenerated to the empty
  (cost-0) extension; switched to budgeted enumeration (ub, β=20) so it shows the
  11 ways to retain defaults by overriding disruptions within the budget
- the five kept examples each illustrate a distinct feature: classical recovery
  (Simple Attack), preferred multi-extension (Reference Preferred), budgeted
  optimum with real cost (Scientific Theory), budgeted enumeration (Practical
  Deliberation), and weights-as-probabilities (Weights as Probabilities)
- skip empty example optgroups; corrected the stale empty-body "mismatch" note
  (that issue is fixed in the synced bundle)

## 20260629-1

- synced the bundle to the fixed WABA core (semiring soundness fixes: empty-body multiplicative identity, arctic/tropical_high non-flat guard, min+ub empty-discard)
- replaced the stale hand-maintained sync manifest with an auto-discovering `scripts/sync-modules.js` (scans the WABA tree; can no longer silently drift)
- surface change: removed the Łukasiewicz family and the COUNT monoid; exposed the four clean algebras across two families — Gödel (`godel` / `bottleneck_cost`) and Tropical (`arctic` / `tropical`), both polarities selectable
- reconciled the runtime/UI to the new surface: `config-service.js` (objective map, semiring allow-list/polarities, `sum-min` default), `index.html` dropdowns + doc tables, `config-controller.js` family-aware polarity, `examples.js` (curated examples now practical_deliberation / scientific_theory / probabilistic), `core/types.js`, and the unit/browser tests
- re-ran the full lint, type-check, unit, schema, and browser validation gate

## 20260312-10

- restored the Analysis & Export panel as a visibly populated section on first load instead of leaving it blank until a solver run
- added a persistent panel home state with:
  - decision-analysis guidance
  - always-available graph export actions
- wired panel proxy buttons for PNG/PDF export so the export side of the panel remains useful before results exist
- restored the placeholder after clearing output, instead of leaving the panel empty again
- added a browser regression check that the analysis panel is visibly present on load
- re-ran the full lint, type-check, unit, and Playwright validation gate

## 20260312-9

- restored informative graph hover panels across the visualization modes
- made assumption-node hover panels explain:
  - explicit vs default weight status
  - declared contrary
  - incoming attack sources
  - outgoing attack roles
- made attack-edge hover panels explain:
  - attack type
  - attacking element and target assumption
  - derived contrary
  - derivation rule or joint contributors
  - semantic role of the edge
- made junction-node hover panels explain:
  - the joint rule behind the junction
  - required contributors
  - derived contrary and target
  - resulting attack weight
- improved standard graph hover panels so extension nodes and set-attack edges describe what they represent instead of only showing raw support lists
- aligned click popups with the richer hover content instead of duplicating a thinner legacy summary
- added unit coverage for the tooltip builders and re-ran the full lint, type-check, unit, and Playwright browser validation gate

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
