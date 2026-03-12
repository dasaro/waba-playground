import { normalizeConfig } from '../runtime/config-service.js?v=20260312-8';
import { wabaModules } from '../waba-modules.js?v=20260312-8';

export class ConfigController {
    constructor(dom) {
        this.dom = dom;
        this.lastBoundedBudgetMode = 'ub';
    }

    getCurrentConfig() {
        return normalizeConfig({
            semiringFamily: this.dom.semiringSelect.value,
            polarity: this.dom.polaritySelect.value,
            defaultPolicy: 'neutral',
            monoid: this.dom.monoidSelect.value,
            optimization: this.dom.optimizeSelect.value,
            budgetMode: this.dom.constraintSelect.value,
            budgetIntent: this.dom.budgetIntentSelect.value,
            semantics: this.dom.semanticsSelect.value,
            optMode: this.dom.optModeSelect.value,
            beta: parseInt(this.dom.budgetInput.value, 10) || 0,
            numModels: parseInt(this.dom.numModelsInput.value, 10) || 0,
            timeout: (parseInt(this.dom.timeoutInput.value, 10) || 60) * 1000,
            filterType: 'standard'
        });
    }

    applyConfigToUI(config) {
        this.dom.semiringSelect.value = config.semiringFamily;
        this.dom.polaritySelect.value = config.polarity;
        this.dom.defaultPolicySelect.value = 'neutral';
        this.dom.monoidSelect.value = config.monoid;
        this.dom.optimizeSelect.value = config.optimization;
        this.dom.constraintSelect.value = config.budgetMode;
        this.dom.budgetIntentSelect.value = config.budgetIntent || 'explore';
        this.dom.semanticsSelect.value = config.semantics;
        this.dom.optModeSelect.value = config.optMode;
        this.dom.budgetInput.value = String(config.beta ?? 0);

        if (config.budgetMode === 'ub' || config.budgetMode === 'lb') {
            this.lastBoundedBudgetMode = config.budgetMode;
        }
    }

    populateExampleSelect(examples, defaultKey = 'demo_complete') {
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

            this.dom.exampleSelect.appendChild(group);
        });

        this.dom.exampleSelect.value = defaultKey;
    }

    syncUi() {
        const metadata = wabaModules.metadata;
        const alias = Object.entries(metadata.aliases).find(([, value]) =>
            value.family === this.dom.semiringSelect.value && value.polarity === this.dom.polaritySelect.value
        );

        this.dom.semiringAliasNote.textContent = alias
            ? `Alias: ${alias[0].replace('_', '-')}`
            : 'Canonical ordered-semiring view.';

        const budgetMode = this.dom.constraintSelect.value;
        const semantics = this.dom.semanticsSelect.value;

        if (budgetMode === 'ub' || budgetMode === 'lb') {
            this.lastBoundedBudgetMode = budgetMode;
        }

        if (this.dom.budgetActiveToggle) {
            this.dom.budgetActiveToggle.checked = budgetMode !== 'none';
        }
        if (this.dom.budgetActiveCopy) {
            this.dom.budgetActiveCopy.textContent = budgetMode === 'none'
                ? 'Disabled / list minimum β'
                : `Enabled / ${budgetMode.toUpperCase()} bound`;
        }

        this.dom.budgetIntentSelect.disabled = budgetMode !== 'none';
        this.dom.budgetIntentSelect.style.opacity = budgetMode === 'none' ? '1' : '0.5';

        if (budgetMode === 'ub') {
            ['sum', 'max', 'count'].forEach((value) => {
                this.dom.monoidSelect.querySelector(`option[value="${value}"]`).disabled = false;
            });
            this.dom.monoidSelect.querySelector('option[value="min"]').disabled = true;
            if (this.dom.monoidSelect.value === 'min') {
                this.dom.monoidSelect.value = 'sum';
            }
        } else if (budgetMode === 'lb') {
            ['sum', 'max', 'count'].forEach((value) => {
                this.dom.monoidSelect.querySelector(`option[value="${value}"]`).disabled = true;
            });
            this.dom.monoidSelect.querySelector('option[value="min"]').disabled = false;
            this.dom.monoidSelect.value = 'min';
        } else {
            Array.from(this.dom.monoidSelect.options).forEach((option) => {
                option.disabled = false;
            });
        }

        if (semantics === 'grounded') {
            this.dom.optModeSelect.value = 'optN';
            this.dom.optModeSelect.disabled = true;
        } else {
            this.dom.optModeSelect.disabled = false;
        }

        this.updateBudgetInputState();
        this.updateNumModelsVisibility();
        this.updateSurfaceCopy();
    }

    updateSurfaceCopy() {
        const config = this.getCurrentConfig();
        const budgetDescription = config.budgetMode === 'none'
            ? (config.budgetIntent === 'no_discard' ? 'plain / no-discard' : 'beta disabled; ranking by minimum β')
            : `${config.monoid} + ${config.budgetMode}`;
        const preferredCopy = config.semantics === 'preferred'
            ? ' Exact preferred uses browser-side subset-maximal filtering over complete candidates.'
            : '';

        this.dom.supportedSurfaceNote.innerHTML = `
            Canonical bounded presets are <code>sum/max/count + ub</code> and <code>min + lb</code>.
            Current profile: <code>${budgetDescription}</code>.${preferredCopy}
        `;

        this.dom.budgetIntentNote.textContent = config.budgetMode === 'none'
            ? (config.budgetIntent === 'no_discard'
                ? 'Plain / no-discard is still available, but the default browser mode keeps beta disabled and ranks extensions by their minimum threshold.'
                : 'Beta is disabled. The playground enumerates surviving extensions and reports the minimum β needed for each one.')
            : 'Budget mode is active, so the aggregate must satisfy the selected upper/lower bound against β.';

        if (this.dom.budgetActiveNote) {
            this.dom.budgetActiveNote.textContent = config.budgetMode === 'none'
                ? 'β is off. The playground ranks extensions by the smallest threshold that would admit them.'
                : `β is active. The current ${config.monoid} aggregate must satisfy the ${config.budgetMode.toUpperCase()} bound.`;
        }
    }

    updateBudgetInputState() {
        const constraint = this.dom.constraintSelect.value;

        if (constraint === 'none') {
            this.dom.budgetInput.disabled = true;
            this.dom.budgetInput.style.opacity = '0.5';
            if (this.dom.budgetInputLabel) {
                this.dom.budgetInputLabel.textContent = this.dom.budgetIntentSelect.value === 'explore'
                    ? 'Budget (β disabled; showing minimum β per extension)'
                    : 'Budget (β disabled in plain / no-discard mode)';
                this.dom.budgetInputLabel.style.opacity = '0.5';
            }
        } else {
            this.dom.budgetInput.disabled = false;
            this.dom.budgetInput.style.opacity = '1';
            if (this.dom.budgetInputLabel) {
                this.dom.budgetInputLabel.textContent = 'Budget Threshold (β)';
                this.dom.budgetInputLabel.style.opacity = '1';
            }
        }
    }

    activateBudgetBeta() {
        if (this.dom.constraintSelect.value === 'none') {
            this.dom.constraintSelect.value = this.lastBoundedBudgetMode || 'ub';
        }
    }

    deactivateBudgetBeta() {
        if (this.dom.constraintSelect.value === 'ub' || this.dom.constraintSelect.value === 'lb') {
            this.lastBoundedBudgetMode = this.dom.constraintSelect.value;
        }
        this.dom.constraintSelect.value = 'none';
        this.dom.budgetIntentSelect.value = 'explore';
    }

    updateNumModelsVisibility() {
        if (!this.dom.numModelsContainer) {
            return;
        }
        this.dom.numModelsContainer.style.display = this.dom.optModeSelect.value === 'ignore' ? 'block' : 'none';
    }
}
