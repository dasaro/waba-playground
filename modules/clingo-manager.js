/**
 * ClingoManager - Handles Clingo WASM integration and WABA program building
 */
import { wabaModules } from '../waba-modules.js?v=20260101-1';

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

            // Build clingo arguments based on optimization mode
            const args = [];
            const optMode = config.optMode || 'ignore'; // Default to enumerate all

            if (optMode === 'ignore') {
                // Tell Clingo to ignore weak constraints and enumerate all models
                args.push('--opt-mode=ignore');
            } else {
                // Find and enumerate only optimal models
                args.push('--opt-mode=' + optMode);
                args.push('--quiet=1');
                args.push('--project');
            }

            console.log('Clingo args:', args);

            // Run Clingo with timeout protection
            const startTime = performance.now();
            const timeout = config.timeout || 60000; // Default 60 seconds

            const result = await this.runWithTimeout(
                clingo.run(program, numModels, args),
                timeout,
                'Clingo execution timed out. Try simplifying the framework or increasing the timeout.'
            );

            const elapsed = ((performance.now() - startTime) / 1000).toFixed(3);

            console.log('Clingo result:', result);

            // Validate result before returning
            if (!result || typeof result !== 'object') {
                throw new Error('Clingo returned an invalid result. The solver may have crashed or timed out.');
            }

            // Check if result indicates an error state
            if (result.Result === 'ERROR' || result.Result === 'UNKNOWN') {
                throw new Error(`Clingo encountered an error: ${result.Result}. The problem may be too complex or contain syntax errors.`);
            }

            return { result, elapsed };

        } catch (error) {
            console.error('Error running WABA:', error);

            // Provide specific error messages based on error type
            if (error.message.includes('timed out')) {
                onLog(`⏱️ ${error.message}`, 'error');
                onLog('💡 Tip: Reduce framework complexity, increase timeout, or try a simpler semantics', 'info');
            } else if (error.message.includes('invalid result') || error.message.includes('crashed')) {
                onLog(`❌ ${error.message}`, 'error');
                onLog('💡 Tip: Check for syntax errors in your framework or try refreshing the page', 'info');
            } else {
                onLog(`❌ Error: ${error.message}`, 'error');
            }

            return null;
        }
    }

    /**
     * Runs a promise with a timeout
     * @param {Promise} promise - The promise to run
     * @param {number} timeoutMs - Timeout in milliseconds
     * @param {string} timeoutMessage - Error message if timeout occurs
     * @returns {Promise} The promise result or throws timeout error
     */
    async runWithTimeout(promise, timeoutMs, timeoutMessage) {
        let timeoutHandle;

        const timeoutPromise = new Promise((_, reject) => {
            timeoutHandle = setTimeout(() => {
                reject(new Error(timeoutMessage));
            }, timeoutMs);
        });

        try {
            const result = await Promise.race([promise, timeoutPromise]);
            clearTimeout(timeoutHandle);
            return result;
        } catch (error) {
            clearTimeout(timeoutHandle);
            throw error;
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
            filterType,
            optMode
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

%% Constraint module (only in enumeration mode)
`;

        // Add constraint module ONLY in enumeration mode (optMode === 'ignore')
        // In optimization mode, weak constraints guide the search
        if (optMode === 'ignore' && constraint && constraint !== 'none' && budget !== undefined) {
            const constraintModule = this.getConstraintModule(monoid, constraint);
            program += `
%% Budget constraint (${constraint} ${monoid}) - enumeration mode only
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
