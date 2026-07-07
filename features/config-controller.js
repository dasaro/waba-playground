import { normalizeConfig } from '../runtime/config-service.js?v=20260707-2';

export class ConfigController {
    constructor(dom) {
        this.dom = dom;
    }

    getCurrentConfig() {
        return normalizeConfig({
            semiringFamily: this.dom.semiringSelect.value,
            polarity: this.dom.polaritySelect.value,
            defaultPolicy: this.dom.defaultPolicySelect.value,
            abaRecovery: this.dom.abaRecoveryToggle.checked,
            monoid: this.dom.monoidSelect.value,
            optimization: this.dom.optimizeSelect.value,
            budgetMode: this.dom.constraintSelect.value,
            semantics: this.dom.semanticsSelect.value,
            optMode: this.dom.optModeSelect.value,
            beta: parseInt(this.dom.budgetInput.value, 10) || 0,
            numModels: parseInt(this.dom.numModelsInput.value, 10) || 0,
            timeout: (parseInt(this.dom.timeoutInput.value, 10) || 60) * 1000,
            filterType: this.dom.showSelect.value
        });
    }

    applyConfigToUI(config) {
        this.dom.semiringSelect.value = config.semiringFamily;
        this.dom.polaritySelect.value = config.polarity;
        this.dom.defaultPolicySelect.value = config.defaultPolicy;
        this.dom.abaRecoveryToggle.checked = Boolean(config.abaRecovery);
        this.dom.monoidSelect.value = config.monoid;
        this.dom.optimizeSelect.value = config.optimization;
        this.dom.constraintSelect.value = config.budgetMode;
        this.dom.semanticsSelect.value = config.semantics;
        this.dom.optModeSelect.value = config.optMode;
        this.dom.budgetInput.value = String(config.beta ?? 0);
        this.dom.showSelect.value = config.filterType || 'projection';
        // Graph mode: an example may prefer a view (e.g. debates open in the
        // assumption-level view rather than the exponential Standard set-graph).
        const graphMode = config.graphMode || 'standard';
        if (this.dom.graphModeRadios) {
            this.dom.graphModeRadios.forEach((radio) => {
                radio.checked = radio.value === graphMode;
            });
        }
        // A freshly applied config supersedes any held ABA-recovery snapshot.
        this._savedDefaultPolicy = undefined;
        this._savedBudgetMode = undefined;
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
        const semiringFamily = this.dom.semiringSelect.value;
        let budgetMode = this.dom.constraintSelect.value;
        const semantics = this.dom.semanticsSelect.value;
        const abaRecovery = this.dom.abaRecoveryToggle.checked;
        const isLukasiewicz = semiringFamily === 'lukasiewicz';
        // Defence semantics are defined on the classical no-discard surface; their
        // interaction with discarding (undefeated/affordability vs the budget) is
        // undefined, so we run them with no budget.
        const isDefence = ['admissible', 'complete', 'grounded', 'preferred'].includes(semantics);
        // Budgeted-defence (Dunne Def 6 lift) uses beta but its OWN sum budget — no monoid/budget-mode.
        const isBudgetedDefence = ['budgeted-admissible', 'budgeted-complete', 'budgeted-preferred'].includes(semantics);

        // Polarity: godel/tropical have higher/lower variants; Łukasiewicz is a
        // standalone family with no polarity, so its selector is disabled.
        const lowerOption = this.dom.polaritySelect.querySelector('option[value="lower"]');
        if (lowerOption) {
            lowerOption.disabled = false;
        }
        this.dom.polaritySelect.disabled = isLukasiewicz;
        const ALIAS_MAP = {
            godel: { higher: 'godel', lower: 'bottleneck_cost (godel_low)' },
            tropical: { higher: 'arctic (tropical_high)', lower: 'tropical' }
        };
        const polarity = this.dom.polaritySelect.value;
        this.dom.semiringAliasNote.textContent = isLukasiewicz
            ? 'Łukasiewicz (bounded-sum ⊗, ⊕=max): a standalone algebra with no polarity variants.'
            : `${polarity} polarity maps to ${(ALIAS_MAP[semiringFamily] || ALIAS_MAP.godel)[polarity]}.`;

        if (abaRecovery) {
            // Snapshot the user's selections once, then force the ABA-recovery profile.
            if (this._savedDefaultPolicy === undefined) {
                this._savedDefaultPolicy = this.dom.defaultPolicySelect.value;
                this._savedBudgetMode = this.dom.constraintSelect.value;
            }
            this.dom.defaultPolicySelect.value = 'neutral';
            this.dom.constraintSelect.value = 'none';
        } else if (this._savedDefaultPolicy !== undefined) {
            // Restore what the user had before ABA recovery was switched on.
            this.dom.defaultPolicySelect.value = this._savedDefaultPolicy;
            this.dom.constraintSelect.value = this._savedBudgetMode;
            this._savedDefaultPolicy = undefined;
            this._savedBudgetMode = undefined;
        }
        // Classical defence runs with no budget; budgeted-defence carries its own budget
        // (no monoid/budget-mode). Both pin the base discard set off (constraint = none).
        if ((isDefence || isBudgetedDefence) && !abaRecovery) {
            this.dom.constraintSelect.value = 'none';
        }
        // Re-read after the block so the monoid/budget enable logic below runs
        // against the current budget mode (restored or forced), not the stale read.
        budgetMode = this.dom.constraintSelect.value;
        this.dom.defaultPolicySelect.disabled = abaRecovery;

        if (budgetMode === 'ub') {
            ['sum', 'max'].forEach((value) => {
                this.dom.monoidSelect.querySelector(`option[value="${value}"]`).disabled = false;
            });
            this.dom.monoidSelect.querySelector('option[value="min"]').disabled = true;
            if (this.dom.monoidSelect.value === 'min') {
                this.dom.monoidSelect.value = 'sum';
            }
        } else if (budgetMode === 'lb') {
            ['sum', 'max'].forEach((value) => {
                this.dom.monoidSelect.querySelector(`option[value="${value}"]`).disabled = true;
            });
            this.dom.monoidSelect.querySelector('option[value="min"]').disabled = false;
            this.dom.monoidSelect.value = 'min';
        } else {
            Array.from(this.dom.monoidSelect.options).forEach((option) => {
                option.disabled = false;
            });
        }

        // With no discarding there is nothing to aggregate or optimise, so the
        // Monoid / Optimization / Opt-Mode controls have no effect — grey them out.
        const noDiscard = abaRecovery || budgetMode === 'none';
        // grounded/preferred enumerate ALL complete candidates then subset-filter,
        // so they require Opt-Mode = ignore (enumerate); force and lock it.
        const forceEnumerate = semantics === 'grounded' || semantics === 'preferred' || semantics === 'budgeted-preferred';
        if (forceEnumerate) {
            this.dom.optModeSelect.value = 'ignore';
        }

        // Budgeted-defence USES beta (its own sum budget) even though the budget mode is none.
        const betaDisabled = abaRecovery || (budgetMode === 'none' && !isBudgetedDefence);
        this.dom.monoidSelect.disabled = noDiscard;
        this.dom.optimizeSelect.disabled = noDiscard;
        this.dom.optModeSelect.disabled = noDiscard || forceEnumerate;
        this.dom.constraintSelect.disabled = abaRecovery || isDefence || isBudgetedDefence;
        this.dom.budgetInput.disabled = betaDisabled;
        this.dom.budgetInput.style.opacity = betaDisabled ? '0.5' : '1';

        if (this.dom.budgetInputLabel) {
            this.dom.budgetInputLabel.textContent = abaRecovery
                ? 'Budget Threshold (β disabled by ABA recovery)'
                : (isBudgetedDefence ? 'Budget Threshold (β — inconsistency budget)' : 'Budget Threshold (β)');
            this.dom.budgetInputLabel.style.opacity = betaDisabled ? '0.5' : '1';
        }

        this.updateNumModelsVisibility();
        this.updateSurfaceCopy();
    }

    updateSurfaceCopy() {
        const config = this.getCurrentConfig();
        const isDefence = ['admissible', 'complete', 'grounded', 'preferred'].includes(config.semantics);
        const isBudgetedDefence = ['budgeted-admissible', 'budgeted-complete', 'budgeted-preferred'].includes(config.semantics);
        const profile = config.abaRecovery
            ? 'ABA recovery / neutral defaults / no-discard'
            : (isBudgetedDefence
                ? 'budgeted-defence (β sum inconsistency budget)'
                : (config.budgetMode === 'none'
                    ? 'plain / no-discard'
                    : `${config.monoid} + ${config.budgetMode}`));
        const postFilterCopy = (config.semantics === 'preferred' || config.semantics === 'grounded')
            ? ` Exact ${config.semantics} uses browser-side ${config.semantics === 'grounded' ? 'subset-minimal' : 'subset-maximal'} filtering over complete candidates.`
            : (config.semantics === 'budgeted-preferred'
                ? ' Budgeted-preferred is subset-maximal filtering over budgeted-admissible candidates.'
                : '');
        const defenceCopy = isDefence
            ? ' Defence semantics (admissible/complete/grounded/preferred) run on the no-discard surface.'
            : (isBudgetedDefence
                ? ' Budgeted-defence (Dunne Def 6 lift) spends a β-bounded sum inconsistency budget to discard attacks, then applies classical defence; strength semirings only.'
                : '');

        this.dom.supportedSurfaceNote.innerHTML = `
            Supported semiring surface: <code>godel</code>, <code>bottleneck_cost</code>, <code>arctic</code>, <code>tropical</code>, <code>lukasiewicz</code> (families G&ouml;del / Tropical, plus standalone &#321;ukasiewicz).
            Canonical bounded presets are <code>sum/max + ub</code> and <code>min + lb</code>.
            Current profile: <code>${profile}</code>.${postFilterCopy}${defenceCopy}
        `;

        this.dom.budgetIntentNote.textContent = config.abaRecovery
            ? 'ABA recovery matches the wrapper: neutral defaults, no-discard, and no bounded objective/beta controls.'
            : (config.budgetMode === 'none'
                ? 'Budget mode is disabled, so the playground matches the wrapper no-discard surface.'
                : 'Budget mode is active, so the aggregate must satisfy the selected upper/lower bound against β.');

        if (this.dom.implementationNote) {
            this.dom.implementationNote.textContent =
                'Runs the mature WABA modules (semiring × monoid × budget × semantics) directly via clingo-WASM.';
        }
    }

    updateNumModelsVisibility() {
        if (!this.dom.numModelsContainer) {
            return;
        }
        this.dom.numModelsContainer.style.display = this.dom.optModeSelect.value === 'ignore' ? 'block' : 'none';
    }
}
