/**
 * ClingoManager - Handles Clingo WASM integration and WABA program building
 */
import { wabaModules } from '../waba-modules.js';

export class ClingoManager {
    constructor(runBtn) {
        this.runBtn = runBtn;
        this.clingoReady = false;
    }

    async initClingo() {
        // Wait for clingo to be available (CDN loading)
        const maxAttempts = 20; // 10 seconds max
        let attempts = 0;

        while (attempts < maxAttempts) {
            if (typeof clingo !== 'undefined') {
                try {
                    // Test that clingo.run is available
                    if (typeof clingo.run === 'function') {
                        this.clingoReady = true;
                        // Update intro status
                        const introStatus = document.getElementById('intro-status');
                        if (introStatus) {
                            introStatus.textContent = '✅ Clingo WASM loaded successfully';
                            introStatus.style.color = 'var(--success-color)';
                        }
                        return true;
                    }
                } catch (e) {
                    // Continue waiting
                }
            }

            // Wait 500ms before next attempt
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
        }

        // If we get here, clingo didn't load
        const introStatus = document.getElementById('intro-status');
        if (introStatus) {
            introStatus.textContent = '❌ Failed to load Clingo - Please refresh the page';
            introStatus.style.color = 'var(--error-color)';
        }
        if (this.runBtn) {
            this.runBtn.disabled = true;
        }
        return false;
    }

    async runWABA(framework, config, onLog) {
        if (!this.clingoReady) {
            onLog('⚠️ Clingo not ready. Please wait for initialization.', 'warning');
            return null;
        }

        try {
            // Build the complete program
            const program = this.buildProgram(framework, config);

            console.log('Running WABA with program:', program);

            // Determine number of models to find
            let numModels = config.numModels || 0;

            // Run Clingo
            const startTime = performance.now();
            const result = await clingo.run(program, numModels, config.clingoArgs || []);
            const elapsed = ((performance.now() - startTime) / 1000).toFixed(3);

            console.log('Clingo result:', result);

            return { result, elapsed };

        } catch (error) {
            console.error('Error running WABA:', error);
            onLog(`❌ Error: ${error.message}`, 'error');
            return null;
        }
    }

    buildProgram(framework, config) {
        const {
            semiring,
            monoid,
            direction,
            semantics,
            constraint,
            budget,
            filterType
        } = config;

        // Get modules from waba-modules.js
        const coreModule = this.getCoreModule();
        const semiringModule = this.getSemiringModule(semiring);
        const monoidModule = this.getMonoidModule(monoid, direction);
        const filterModule = this.getFilterModule(filterType);
        const semanticsModule = this.getSemanticsModule(semantics);

        // Build program components
        let program = `
%% Framework
${framework}

%% Core module
${coreModule}

%% Semiring module
${semiringModule}

%% Constraint module (if using constraints)
`;

        // Add constraint module if specified
        if (constraint && constraint !== 'none' && budget !== undefined) {
            const constraintModule = this.getConstraintModule(monoid, constraint);
            program += `
%% Budget constraint (${constraint} ${monoid})
#const beta = ${budget}.
${constraintModule}
`;
        }

        // Add monoid module
        program += `
%% Monoid module (${monoid} ${direction})
${monoidModule}

%% Filter module
${filterModule}

%% Semantics module
${semanticsModule}
`;

        return program;
    }

    // ===================================
    // Module Getters (from waba-modules.js)
    // ===================================

    getCoreModule() {
        return wabaModules.core.base;
    }

    getSemiringModule(semiring) {
        return wabaModules.semiring[semiring] || wabaModules.semiring.godel;
    }

    getMonoidModule(monoid, direction = 'minimization') {
        const key = `${monoid}_${direction}`;
        return wabaModules.monoid[key] || wabaModules.monoid.max_minimization;
    }

    getSemanticsModule(semantics) {
        return wabaModules.semantics[semantics] || wabaModules.semantics.stable;
    }

    getConstraintModule(monoid, bound = 'ub') {
        const key = `${bound}_${monoid}`;
        return wabaModules.constraint[key] || wabaModules.constraint.ub_max;
    }

    getFilterModule(filterType = 'standard') {
        return wabaModules.filter[filterType] || wabaModules.filter.standard;
    }
}
