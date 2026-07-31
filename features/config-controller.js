import {
    normalizeConfig, isBudgetedDefence, selectableSemirings, semiringConstants, SEMIRING_INFO
} from '../runtime/config-service.js?v=20260731-4';
import { wabaModules } from '../waba-modules.js?v=20260731-4';

export class ConfigController {
    constructor(dom) {
        this.dom = dom;
    }

    /** 'none' | 'sum-ub' | 'max-ub' | 'min-lb'  ->  [monoid, budgetMode] */
    static readBudget(value) {
        if (!value || value === 'none') return ['sum', 'none'];
        const [monoid, bound] = value.split('-');
        return [monoid, bound];
    }

    /** 'all' | 'min' | 'max'  ->  { optMode, optimization } */
    static readResults(value) {
        if (value === 'min') return { optMode: 'optN', optimization: 'minimize' };
        if (value === 'max') return { optMode: 'optN', optimization: 'maximize' };
        return { optMode: 'ignore', optimization: 'minimize' };
    }

    static writeBudget(monoid, budgetMode) {
        return budgetMode === 'none' || !budgetMode ? 'none' : `${monoid}-${budgetMode}`;
    }

    static writeResults(optMode, optimization) {
        if (optMode !== 'optN') return 'all';
        return optimization === 'maximize' ? 'max' : 'min';
    }

    /**
     * `min`/`max` on a number input are only enforced by native form validation, which this
     * page never runs -- typing 999999 into Timeout, or clearing beta entirely, went straight
     * to the solver (or silently became the `|| default` fallback, which for beta meant a
     * typed "-" ran as 0 with no sign that anything had been ignored). Clamp against the
     * field's own declared range and write the clamped value BACK, so the control always
     * shows what actually ran.
     */
    static readNumber(input, fallback) {
        if (!input) return fallback;
        const raw = parseInt(input.value, 10);
        let value = Number.isFinite(raw) ? raw : fallback;
        const min = parseInt(input.min, 10);
        const max = parseInt(input.max, 10);
        if (Number.isFinite(min)) value = Math.max(min, value);
        if (Number.isFinite(max)) value = Math.min(max, value);
        if (String(value) !== input.value) input.value = String(value);
        return value;
    }

    getCurrentConfig() {
        // The two composite selectors below replaced five interlocking ones. `budget-select`
        // offers only the three canonical (monoid, bound) pairings, so an invalid pairing is
        // now unreachable rather than something syncUi had to disable after the fact.
        const [monoid, budgetMode] = ConfigController.readBudget(this.dom.budgetSelect.value);
        const { optMode, optimization } = ConfigController.readResults(this.dom.resultsSelect.value);
        return normalizeConfig({
            semiring: this.dom.semiringSelect.value,
            defaultPolicy: this.dom.defaultPolicySelect.value,
            abaRecovery: this.dom.abaRecoveryToggle.checked,
            monoid,
            optimization,
            budgetMode,
            semantics: this.dom.semanticsSelect.value,
            optMode,
            // normalizeConfig zeroes this under ABA recovery, so the raw field is read here.
            beta: ConfigController.readNumber(this.dom.budgetInput, 0),
            // The empty-field fallback is 10; bin/waba's own default is 1000. Neither is a
            // universal right answer -- k has to sit at the framework's weight scale, and a
            // preset that needs a particular k carries it (testimony_erosion ships k = 1000
            // over weights of 900, where the erosion it demonstrates only exists). Do NOT
            // describe 10 as "the playground default for small-integer examples": the one
            // Lukasiewicz example shipped is not small-integer, and at k = 10 it does not
            // even terminate.
            lukK: ConfigController.readNumber(this.dom.lukKInput, 10),
            numModels: ConfigController.readNumber(this.dom.numModelsInput, 0),
            timeout: ConfigController.readNumber(this.dom.timeoutInput, 60) * 1000,
            filterType: 'projection'
        });
    }

    applyConfigToUI(config) {
        this.dom.semiringSelect.value = config.semiringKey || config.semiring || 'godel';
        // Seed the algebra-change detector so applying a preset does not look like a user
        // switching algebra, which would overwrite the preset's own budget reading.
        this._lastAlgebra = this.dom.semiringSelect.value;
        this.dom.defaultPolicySelect.value = config.defaultPolicy;
        this.dom.abaRecoveryToggle.checked = Boolean(config.abaRecovery);
        this.dom.semanticsSelect.value = config.semantics;
        this.dom.budgetSelect.value = ConfigController.writeBudget(config.monoid, config.budgetMode);
        this.dom.resultsSelect.value = ConfigController.writeResults(config.optMode, config.optimization);
        this.dom.budgetInput.value = String(config.beta ?? 0);
        if (this.dom.lukKInput) {
            // Only a Lukasiewicz preset carries k; leave the field alone otherwise so a
            // user-chosen k is not clobbered by an unrelated example.
            if (Number.isFinite(config.lukK)) this.dom.lukKInput.value = String(config.lukK);
        }
        // Graph mode: an example may prefer a view (e.g. debates open in the
        // assumption-level view rather than the exponential Standard set-graph).
        const graphMode = config.graphMode || 'standard';
        if (this.dom.graphModeRadios) {
            this.dom.graphModeRadios.forEach((radio) => {
                radio.checked = radio.value === graphMode;
            });
        }
        // A freshly applied config supersedes any held ABA-recovery snapshot.
        this._savedPolicy = undefined;
        this._savedReading = undefined;
        this._savedResults = undefined;
        // The preset owns beta, so per-direction memory from before it is stale.
        this._betaFor = undefined;
    }

    /**
     * Build the Algebra and Semantics option lists from the module bundle.
     *
     * These were hand-written <option> lists in index.html, duplicating what the .lp sources
     * already declare. Adding an algebra to WABA/ therefore meant editing this list, the
     * polarity table, the recommended-pairing table, the prose table and an `isLukasiewicz`
     * special case -- and any one of them left stale produced a control that looked correct and
     * computed something else. Everything below is read from
     * waba-modules.js -> metadata, which the generator extracts from the .lp files themselves.
     */
    populateFromBundle() {
        const OPLUS_LABEL = {
            higher: 'Strength (⊕ = max: a bigger weight is a harder objection)',
            lower: 'Cost (⊕ = min: a smaller weight is better supported)'
        };
        const PRETTY = {
            godel: 'Gödel', arctic: 'Arctic', lukasiewicz: 'Łukasiewicz',
            tropical: 'Tropical', bottleneck_cost: 'Bottleneck'
        };
        const doc = this.dom.document;
        const select = this.dom.semiringSelect;
        if (select) {
            select.innerHTML = '';
            for (const polarity of ['higher', 'lower']) {
                const inGroup = selectableSemirings().filter((s) => s.polarity === polarity);
                if (inGroup.length === 0) continue;
                const group = doc.createElement('optgroup');
                group.label = OPLUS_LABEL[polarity];
                for (const algebra of inGroup) {
                    const option = doc.createElement('option');
                    option.value = algebra.key;
                    // A new algebra with no entry in PRETTY still appears, under its module key.
                    option.textContent = `${PRETTY[algebra.key] || algebra.key} (⊗ = ${algebra.otimes})`;
                    group.appendChild(option);
                }
                select.appendChild(group);
            }
            if ([...select.options].some((o) => o.value === 'godel')) select.value = 'godel';
        }

        const SEMANTICS_LABEL = {
            cf: 'Conflict-free', stable: 'Stable', admissible: 'Admissible',
            complete: 'Complete', preferred: 'Preferred'
        };
        const semanticsSelect = this.dom.semanticsSelect;
        if (semanticsSelect) {
            semanticsSelect.innerHTML = '';
            for (const key of wabaModules.metadata.supportedSemantics) {
                const option = doc.createElement('option');
                option.value = key;
                option.textContent = SEMANTICS_LABEL[key] || key;
                semanticsSelect.appendChild(option);
            }
            if ([...semanticsSelect.options].some((o) => o.value === 'stable')) {
                semanticsSelect.value = 'stable';
            }
        }
    }

    populateExampleSelect(examples, defaultKey = 'conflict_cycle') {
        this.dom.exampleSelect.innerHTML = '<option value="">-- Select Example --</option>';

        [
            { key: 'curated', label: 'Curated WABA Examples' },
            { key: 'demos', label: 'Playground Demos' }
        ].forEach(({ key, label }) => {
            const group = this.dom.document.createElement('optgroup');
            group.label = label;

            Object.entries(examples)
                .filter(([, example]) => example.section === key)
                .forEach(([exampleKey, example]) => {
                    const option = this.dom.document.createElement('option');
                    option.value = exampleKey;
                    option.textContent = example.label;
                    group.appendChild(option);
                });

            // Skip empty groups (e.g. no demos) so no blank optgroup is shown.
            if (group.children.length > 0) {
                this.dom.exampleSelect.appendChild(group);
            }
        });

        this.dom.exampleSelect.value = defaultKey;
    }

    syncUi() {
        const algebra = this.dom.semiringSelect.value;
        const semantics = this.dom.semanticsSelect.value;
        const abaRecovery = this.dom.abaRecoveryToggle.checked;

        // Defence semantics carry their own SUM inconsistency budget and take beta directly,
        // exactly as bin/waba does; they reject a monoid/bound pairing.
        const isDefence = isBudgetedDefence(semantics);
        // Which algebras carry a tunable constant is declared by the modules (`#const k = ...`),
        // not by a name check here.
        const constants = semiringConstants(algebra);

        // Choosing an algebra preselects the canonical (monoid, bound) pairing for its
        // polarity. oplus = max reads a weight as STRENGTH (bigger = harder to overrule), so
        // the natural bound is on the total conceded; oplus = min reads it as COST, where a
        // bigger weight means WORSE support and therefore an easier concession, so the natural
        // bound is a floor on each concession. These are exactly the pairings bin/waba's
        // CANONICAL_PRESETS admits. It fires only on an actual algebra change, so a manual
        // budget choice (or a preset's) is never overwritten by an unrelated syncUi.
        // Derived from the polarity rather than listed per algebra: strength bounds the total
        // conceded ABOVE, cost bounds each concession BELOW. These are exactly bin/waba's
        // CANONICAL_PRESETS, and a new algebra gets the right pairing with no edit here.
        const recommendedFor = (key) =>
            (SEMIRING_INFO[key]?.polarity === 'lower' ? 'min-lb' : 'sum-ub');
        // The reading selector is pinned to 'none' while a defence semantics or ABA recovery
        // is active, and the user's own choice lives in `_savedReading`. Snapshot BEFORE the
        // preselect so the preselect can write through to whichever slot currently holds it:
        // it used to write the pinned select, which the pin below immediately overwrote, so
        // changing algebra while on `admissible` and then returning to `stable` restored the
        // reading from before the defence detour and the preselect was silently lost.
        const readingPinned = isDefence || abaRecovery;
        if (readingPinned && this._savedReading === undefined) {
            this._savedReading = this.dom.budgetSelect.value;
        }

        if (this._lastAlgebra !== undefined && this._lastAlgebra !== algebra) {
            const previousReading = readingPinned ? this._savedReading : this.dom.budgetSelect.value;
            const reading = recommendedFor(algebra);
            if (readingPinned) {
                this._savedReading = reading;
            } else {
                this.dom.budgetSelect.value = reading;
            }
            // The two bounds run in OPPOSITE directions: under `ub` a bigger beta is more
            // permissive, under `lb` a bigger beta is more restrictive (every concession must
            // be worth at least beta). So carrying a beta tuned for one across to the other
            // silently yields nothing -- switching to a cost algebra with the presets' beta=8
            // returned zero extensions. When the reading flips, move beta to that reading's
            // permissive end so the run still shows something to tighten from.
            const previousBound = previousReading === 'none' ? null : previousReading.split('-')[1];
            const bound = reading.split('-')[1];
            if (previousBound && previousBound !== bound) {
                // Remember beta PER DIRECTION and restore it, rather than only forcing the new
                // direction's permissive end. Forcing alone was one-way: leaving a strength
                // algebra reset beta to 0 and coming back left it at 0, which under `ub` (and
                // under a defence semantics, whose own bound follows the same polarity) means
                // nothing is affordable -- so a there-and-back trip through Tropical silently
                // turned a working beta=8 into an empty result.
                this._betaFor = this._betaFor || {};
                this._betaFor[previousBound] = this.dom.budgetInput.value;
                const remembered = this._betaFor[bound];
                if (remembered !== undefined) {
                    this.dom.budgetInput.value = remembered;
                } else if (bound === 'lb') {
                    // Nothing remembered yet: 0 is the permissive end of a lower bound, so the
                    // run still shows something to tighten from.
                    this.dom.budgetInput.value = '0';
                }
            }
        }
        this._lastAlgebra = algebra;

        // k only exists for Lukasiewicz.
        if (this.dom.lukKContainer) {
            this.dom.lukKContainer.style.display = constants.length > 0 ? 'block' : 'none';
            if (constants.length > 0 && this.dom.lukKLabel) {
                this.dom.lukKLabel.textContent = `Bound ${constants[0].name}`;
                // Seed from the MODULE's own default the first time this algebra is chosen, so
                // the playground and bin/waba agree. The field used to default to a hardcoded
                // 10 while the module says 1000 -- a divergence that was survivable when an
                // off-grid weight merely computed something odd, and is not now that the
                // carrier guard rejects it outright.
                if (this._seededConstant !== algebra) {
                    this._seededConstant = algebra;
                    if (this.dom.lukKInput) this.dom.lukKInput.value = String(constants[0].default);
                }
            }
        }

        // ABA recovery pins transparent defaults and forbids discarding.
        // Only the delta policy is snapshotted here; the budget reading is handled by the single
        // snapshot below, so the two cannot restore different values.
        if (abaRecovery) {
            if (this._savedPolicy === undefined) {
                this._savedPolicy = this.dom.defaultPolicySelect.value;
            }
            this.dom.defaultPolicySelect.value = 'neutral';
        } else if (this._savedPolicy !== undefined) {
            this.dom.defaultPolicySelect.value = this._savedPolicy;
            this._savedPolicy = undefined;
        }

        // A defence semantics owns its budget, so the reading selector is not applicable.
        // Snapshot the user's choice while it is pinned, or switching to admissible and back
        // silently leaves the reading on "No discarding" -- and then cf/stable report no cost,
        // which looks like the cost regression all over again.
        if (readingPinned) {
            this.dom.budgetSelect.value = 'none';
        } else if (this._savedReading !== undefined) {
            this.dom.budgetSelect.value = this._savedReading;
            this._savedReading = undefined;
        }

        const budgetActive = !abaRecovery && (isDefence || this.dom.budgetSelect.value !== 'none');

        // `preferred` is computed by subset-maximal filtering over enumerated candidates, so
        // it needs every candidate rather than the optimal ones. The other two defence
        // semantics compose with no_discard, so program-builder emits no monoid and no
        // objective: optN would hand clingo `--quiet=1` with nothing to optimise, printing
        // only the last model. The control was inert at best and lossy at worst.
        const forceEnumerate = isDefence;
        if (forceEnumerate) {
            // Snapshot and restore, exactly as the budget reading does. Overwriting outright
            // meant a look at a defence semantics permanently discarded the user's choice:
            // Stable -> Admissible -> Stable came back on "All extensions" with no way to know
            // it had been changed.
            if (this._savedResults === undefined) {
                this._savedResults = this.dom.resultsSelect.value;
            }
            this.dom.resultsSelect.value = 'all';
        } else if (this._savedResults !== undefined) {
            this.dom.resultsSelect.value = this._savedResults;
            this._savedResults = undefined;
        }

        this.dom.defaultPolicySelect.disabled = abaRecovery;
        this.dom.budgetSelect.disabled = abaRecovery || isDefence;
        this.dom.resultsSelect.disabled = !budgetActive || forceEnumerate;
        this.dom.budgetInput.disabled = !budgetActive;
        this.dom.budgetInput.style.opacity = budgetActive ? '1' : '0.5';

        if (this.dom.budgetInputLabel) {
            this.dom.budgetInputLabel.textContent = 'Inconsistency budget (β)';
            this.dom.budgetInputLabel.style.opacity = budgetActive ? '1' : '0.5';
        }
        if (this.dom.semanticsNote) {
            this.dom.semanticsNote.textContent = isDefence
                ? 'Defence semantics: β pays for the objections this set declines to answer.'
                : 'Conflict-based: β pays for the attacks this set supports.';
        }
        if (this.dom.semiringAliasNote) {
            // The gloss is per-algebra prose, but the POLARITY word comes from the module, so
            // a new algebra always gets a truthful first clause even with no gloss written yet.
            const GLOSS = {
                godel: 'an objection is only as strong as its weakest premise',
                arctic: 'independent premises accumulate',
                lukasiewicz: 'a chain of premises erodes toward 0',
                tropical: 'a cheaply derived objection is a well-supported one',
                bottleneck_cost: 'an objection costs as much as its dearest premise'
            };
            const info = SEMIRING_INFO[algebra];
            const word = info?.polarity === 'lower' ? 'cost' : 'strength';
            this.dom.semiringAliasNote.textContent = GLOSS[algebra]
                ? `${word} — ${GLOSS[algebra]}`
                : `${word} — ⊗ = ${info?.otimes}, ⊕ = ${info?.oplus}`;
        }

        this.updateNumModelsVisibility();
        this.updateSurfaceCopy();
    }

    updateSurfaceCopy() {
        const config = this.getCurrentConfig();
        const isDefence = isBudgetedDefence(config.semantics);
        const READING = {
            'sum-ub': 'The concessions must sum to no more than β.',
            'max-ub': 'No single concession may exceed β.',
            'min-lb': 'Every concession must be worth at least β.'
        };
        if (this.dom.budgetIntentNote) {
            this.dom.budgetIntentNote.textContent = config.abaRecovery
                ? 'Every discard is forbidden, so this is plain ABA.'
                : (isDefence
                    // The DIRECTION follows the polarity, exactly as semantics/admissible.lp
                    // derives it: oplus=max bounds the sum ABOVE, oplus=min bounds the minimum
                    // BELOW. Saying "must sum to no more than β" for every algebra told a
                    // Tropical user to lower β for a stricter result, when β=0 is that
                    // semantics' most PERMISSIVE setting -- and the stats line after the run
                    // said the opposite on the same screen.
                    ? (config.polarity === 'lower'
                        ? 'This semantics carries its own budget: every objection it declines to answer must be worth at least β, so a BIGGER β is more restrictive. This control does not apply.'
                        : 'This semantics carries its own budget (the objections it declines to answer must sum to no more than β), so this control does not apply.')
                    : (READING[this.dom.budgetSelect.value]
                        || 'Nothing may be conceded, so this is plain ABA.'));
        }
    }

    updateNumModelsVisibility() {
        if (!this.dom.numModelsContainer) {
            return;
        }
        const enumerating = this.dom.resultsSelect.disabled || this.dom.resultsSelect.value === 'all';
        this.dom.numModelsContainer.style.display = enumerating ? 'block' : 'none';
    }
}
