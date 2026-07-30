import { normalizeConfig } from '../runtime/config-service.js?v=20260730-15';

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
            beta: parseInt(this.dom.budgetInput.value, 10) || 0,
            lukK: parseInt(this.dom.lukKInput?.value, 10) || 10,
            numModels: parseInt(this.dom.numModelsInput.value, 10) || 0,
            timeout: (parseInt(this.dom.timeoutInput.value, 10) || 60) * 1000,
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
        const isDefence = ['admissible', 'complete', 'preferred'].includes(semantics);
        const isLukasiewicz = algebra === 'lukasiewicz';

        // Choosing an algebra preselects the canonical (monoid, bound) pairing for its
        // polarity. oplus = max reads a weight as STRENGTH (bigger = harder to overrule), so
        // the natural bound is on the total conceded; oplus = min reads it as COST, where a
        // bigger weight means WORSE support and therefore an easier concession, so the natural
        // bound is a floor on each concession. These are exactly the pairings bin/waba's
        // CANONICAL_PRESETS admits. It fires only on an actual algebra change, so a manual
        // budget choice (or a preset's) is never overwritten by an unrelated syncUi.
        const RECOMMENDED_BUDGET = {
            godel: 'sum-ub',
            arctic: 'sum-ub',
            lukasiewicz: 'sum-ub',
            tropical: 'min-lb',
            bottleneck_cost: 'min-lb'
        };
        if (this._lastAlgebra !== undefined && this._lastAlgebra !== algebra) {
            const previousReading = this.dom.budgetSelect.value;
            const reading = RECOMMENDED_BUDGET[algebra] || 'sum-ub';
            this.dom.budgetSelect.value = reading;
            // The two bounds run in OPPOSITE directions: under `ub` a bigger beta is more
            // permissive, under `lb` a bigger beta is more restrictive (every concession must
            // be worth at least beta). So carrying a beta tuned for one across to the other
            // silently yields nothing -- switching to a cost algebra with the presets' beta=8
            // returned zero extensions. When the reading flips, move beta to that reading's
            // permissive end so the run still shows something to tighten from.
            const flipped = previousReading !== 'none'
                && previousReading.split('-')[1] !== reading.split('-')[1];
            if (flipped && reading.endsWith('-lb')) {
                this.dom.budgetInput.value = '0';
            }
        }
        this._lastAlgebra = algebra;

        // k only exists for Lukasiewicz.
        if (this.dom.lukKContainer) {
            this.dom.lukKContainer.style.display = isLukasiewicz ? 'block' : 'none';
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
        if (isDefence || abaRecovery) {
            // Snapshot before the FIRST pin, whichever of the two pins it. The restore arm
            // previously lacked this guard, so toggling ABA recovery while a defence semantics
            // was selected ran after the recovery block and un-pinned the budget it had just
            // set -- yielding a config validateConfig rejects ("ABA recovery cannot be combined
            // with a bounded budget mode") while the greyed select still displayed the offender.
            if (this._savedReading === undefined) {
                this._savedReading = this.dom.budgetSelect.value;
            }
            this.dom.budgetSelect.value = 'none';
        } else if (this._savedReading !== undefined) {
            this.dom.budgetSelect.value = this._savedReading;
            this._savedReading = undefined;
        }

        const budgetActive = !abaRecovery && (isDefence || this.dom.budgetSelect.value !== 'none');

        // `preferred` is computed by subset-maximal filtering over enumerated candidates,
        // so it needs every candidate rather than the optimal ones.
        const forceEnumerate = semantics === 'preferred';
        if (forceEnumerate) {
            this.dom.resultsSelect.value = 'all';
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
            const POLARITY = {
                godel: 'strength — an objection is only as strong as its weakest premise',
                arctic: 'strength — independent premises accumulate',
                lukasiewicz: 'strength — a chain of premises erodes toward 0',
                tropical: 'cost — a cheaply derived objection is a well-supported one',
                bottleneck_cost: 'cost — an objection costs as much as its dearest premise'
            };
            this.dom.semiringAliasNote.textContent = POLARITY[algebra] || '';
        }

        this.updateNumModelsVisibility();
        this.updateSurfaceCopy();
    }

    updateSurfaceCopy() {
        const config = this.getCurrentConfig();
        const isDefence = ['admissible', 'complete', 'preferred'].includes(config.semantics);
        const READING = {
            'sum-ub': 'The concessions must sum to no more than β.',
            'max-ub': 'No single concession may exceed β.',
            'min-lb': 'Every concession must be worth at least β.'
        };
        if (this.dom.budgetIntentNote) {
            this.dom.budgetIntentNote.textContent = config.abaRecovery
                ? 'Every discard is forbidden, so this is plain ABA.'
                : (isDefence
                    ? 'This semantics carries its own budget (the objections it declines to answer must sum to no more than β), so this control does not apply.'
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
