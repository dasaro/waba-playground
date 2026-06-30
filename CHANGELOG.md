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
