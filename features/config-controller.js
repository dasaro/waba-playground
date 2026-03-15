import { normalizeConfig } from '../runtime/config-service.js?v=20260315-1';

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
    }

    populateExampleSelect(examples, defaultKey = 'simple_attack') {
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
        const semiringFamily = this.dom.semiringSelect.value;
        const budgetMode = this.dom.constraintSelect.value;
        const semantics = this.dom.semanticsSelect.value;
        const abaRecovery = this.dom.abaRecoveryToggle.checked;

        if (semiringFamily === 'godel') {
            this.dom.polaritySelect.value = 'higher';
            this.dom.polaritySelect.querySelector('option[value="lower"]').disabled = true;
            this.dom.semiringAliasNote.textContent = 'Supported surface: higher-only, mapped directly to godel.';
        } else {
            this.dom.polaritySelect.querySelector('option[value="lower"]').disabled = false;
            this.dom.semiringAliasNote.textContent = this.dom.polaritySelect.value === 'lower'
                ? 'Lower polarity maps directly to lukasiewicz_low.'
                : 'Higher polarity maps directly to lukasiewicz.';
        }

        if (abaRecovery) {
            this.dom.defaultPolicySelect.value = 'neutral';
            this.dom.constraintSelect.value = 'none';
        }
        this.dom.defaultPolicySelect.disabled = abaRecovery;

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

        this.dom.monoidSelect.disabled = abaRecovery;
        this.dom.optimizeSelect.disabled = abaRecovery;
        this.dom.constraintSelect.disabled = abaRecovery;
        this.dom.budgetInput.disabled = abaRecovery || budgetMode === 'none';
        this.dom.budgetInput.style.opacity = (abaRecovery || budgetMode === 'none') ? '0.5' : '1';

        if (this.dom.budgetInputLabel) {
            this.dom.budgetInputLabel.textContent = abaRecovery
                ? 'Budget Threshold (β disabled by ABA recovery)'
                : 'Budget Threshold (β)';
            this.dom.budgetInputLabel.style.opacity = abaRecovery || budgetMode === 'none' ? '0.5' : '1';
        }

        this.dom.optModeSelect.disabled = false;
        if ((semantics === 'grounded' || semantics === 'preferred') && this.dom.optModeSelect.value === 'ignore') {
            this.dom.optModeSelect.value = 'ignore';
        }

        this.updateNumModelsVisibility();
        this.updateSurfaceCopy();
    }

    updateSurfaceCopy() {
        const config = this.getCurrentConfig();
        const profile = config.abaRecovery
            ? 'ABA recovery / neutral defaults / no-discard'
            : (config.budgetMode === 'none'
                ? 'plain / no-discard'
                : `${config.monoid} + ${config.budgetMode}`);
        const postFilterCopy = (config.semantics === 'preferred' || config.semantics === 'grounded')
            ? ` Exact ${config.semantics} uses browser-side ${config.semantics === 'grounded' ? 'subset-minimal' : 'subset-maximal'} filtering over complete candidates.`
            : '';

        this.dom.supportedSurfaceNote.innerHTML = `
            Supported semiring surface: <code>godel</code>, <code>lukasiewicz</code>, <code>lukasiewicz_low</code>.
            Canonical bounded presets are <code>sum/max/count + ub</code> and <code>min + lb</code>.
            Current profile: <code>${profile}</code>.${postFilterCopy}
        `;

        this.dom.budgetIntentNote.textContent = config.abaRecovery
            ? 'ABA recovery matches the wrapper: neutral defaults, no-discard, and no bounded objective/beta controls.'
            : (config.budgetMode === 'none'
                ? 'Budget mode is disabled, so the playground matches the wrapper no-discard surface.'
                : 'Budget mode is active, so the aggregate must satisfy the selected upper/lower bound against β.');

        if (this.dom.implementationNote) {
            this.dom.implementationNote.textContent =
                'Empty-body weighted rules remain a documented paper/code mismatch in the live implementation.';
        }
    }

    updateNumModelsVisibility() {
        if (!this.dom.numModelsContainer) {
            return;
        }
        this.dom.numModelsContainer.style.display = this.dom.optModeSelect.value === 'ignore' ? 'block' : 'none';
    }
}
