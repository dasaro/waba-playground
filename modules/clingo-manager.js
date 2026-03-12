/**
 * ClingoManager - Handles Clingo WASM integration and mature WABA program execution.
 */
import { wabaModules } from '../waba-modules.js?v=20260312-9';
import {
    normalizeConfig,
    resolveSemiringModuleKey,
    getAliasLabel,
    shouldApplyNumericPostFilter,
    validateConfig
} from '../runtime/config-service.js?v=20260312-9';
import { buildProgram, buildSolverArgs, getConstraintModule, getCoreModule, getDefaultPolicyModule, getFilterModule, getMonoidModule, getOptimizeModule, getSemanticsModule, getSemiringModule } from '../runtime/program-builder.js?v=20260312-9';
import { compareTuples, computeAggregateFromDiscarded, formatSyntheticOptimization, getObjectiveTuple } from '../runtime/objective-utils.js?v=20260312-9';

export class ClingoManager {
    constructor(runBtn, introStatus = null) {
        this.runBtn = runBtn;
        this.introStatus = introStatus;
        this.clingoReady = false;
        this.solverQueue = Promise.resolve();
    }

    async initClingo() {
        const maxAttempts = 20;
        let attempts = 0;
        const wasmUrl = this.resolveWasmUrl();

        while (attempts < maxAttempts) {
            if (typeof clingo !== 'undefined') {
                try {
                    if (typeof clingo.run === 'function') {
                        if (typeof clingo.restart === 'function') {
                            await clingo.restart(wasmUrl);
                        } else if (typeof clingo.init === 'function') {
                            await clingo.init(wasmUrl);
                        }
                        this.clingoReady = true;
                        if (this.introStatus) {
                            this.introStatus.textContent = 'Clingo WASM loaded successfully';
                            this.introStatus.style.color = 'var(--success-color)';
                        }
                        return true;
                    }
                } catch {
                    // Continue waiting.
                }
            }

            await new Promise((resolve) => setTimeout(resolve, 500));
            attempts += 1;
        }

        if (this.introStatus) {
            this.introStatus.textContent = 'Failed to load Clingo. Refresh the page and try again.';
            this.introStatus.style.color = 'var(--error-color)';
        }
        if (this.runBtn) {
            this.runBtn.disabled = true;
        }
        return false;
    }

    resolveWasmUrl() {
        if (typeof window !== 'undefined' && window.Module && typeof window.Module.locateFile === 'function') {
            return window.Module.locateFile('clingo.wasm');
        }
        if (typeof window !== 'undefined' && window.location) {
            return new URL('dist/clingo.wasm', window.location.href).toString();
        }
        return 'dist/clingo.wasm';
    }

    async runWABA(framework, config, onLog) {
        if (!this.clingoReady) {
            onLog('Clingo is still loading.', 'warning');
            return null;
        }

        const normalized = normalizeConfig(config);
        const validationError = validateConfig(normalized);
        if (validationError) {
            throw new Error(validationError);
        }

        try {
            const startTime = performance.now();
            const result = normalized.semantics === 'preferred'
                ? await this.runExactPreferred(framework, normalized, onLog)
                : await this.runDirect(framework, normalized);
            const elapsed = ((performance.now() - startTime) / 1000).toFixed(3);
            return { result, elapsed, effectiveConfig: normalized };
        } catch (error) {
            console.error('Error running WABA:', error);
            throw error;
        }
    }

    async runDirect(framework, config) {
        const program = buildProgram(framework, config);
        const args = buildSolverArgs(config);
        const result = await this.runSolver(program, config.numModels, args, config.timeout);
        this.assertSolverResult(result);
        return result;
    }

    async runExactPreferred(framework, config, onLog) {
        onLog('Enumerating complete candidates for exact preferred semantics…', 'info');

        const candidateConfig = {
            ...config,
            semantics: 'complete',
            optMode: 'ignore'
        };
        const candidateProgram = buildProgram(framework, candidateConfig, {
            includeObjective: false
        });
        const candidateResult = await this.runSolver(candidateProgram, 0, ['--opt-mode=ignore'], config.timeout);
        this.assertSolverResult(candidateResult);

        const candidateWitnesses = candidateResult.Call?.[0]?.Witnesses || [];
        if (candidateWitnesses.length === 0) {
            return candidateResult;
        }

        const candidateFacts = candidateWitnesses.map((witness, index) => {
            const modelId = index + 1;
            const members = (witness.Value || [])
                .map((predicate) => predicate.match(/^in\(([^)]+)\)$/))
                .filter(Boolean)
                .map((match) => `member(${modelId},${match[1]}).`);
            return [`candidate(${modelId}).`, ...members].join('\n');
        }).join('\n');

        onLog('Filtering subset-maximal complete candidates…', 'info');
        const subsetProgram = `
${candidateFacts}
${wabaModules.semantics.subset_maximal_filter}
`;
        const subsetResult = await this.runSolver(subsetProgram, 0, ['--project'], config.timeout);
        this.assertSolverResult(subsetResult);
        const keepWitness = subsetResult.Call?.[0]?.Witnesses?.[0]?.Value || [];
        const keepIds = new Set(
            keepWitness
                .map((predicate) => predicate.match(/^keep\((\d+)\)$/))
                .filter(Boolean)
                .map((match) => Number.parseInt(match[1], 10))
        );

        let preferredWitnesses = candidateWitnesses.filter((_, index) => keepIds.has(index + 1));

        if (shouldApplyNumericPostFilter(config)) {
            onLog('Applying numeric objective after exact preferred filtering…', 'info');
            const ranked = preferredWitnesses.map((witness) => {
                const aggregate = this.getWitnessAggregateValue(witness, config.monoid);
                return {
                    witness: {
                        ...witness,
                        Optimization: formatSyntheticOptimization(aggregate)
                    },
                    tuple: getObjectiveTuple(config, aggregate)
                };
            });
            const bestTuple = ranked.reduce((best, entry) => {
                if (!best) {
                    return entry.tuple;
                }
                return compareTuples(entry.tuple, best) < 0 ? entry.tuple : best;
            }, null);
            preferredWitnesses = ranked
                .filter((entry) => compareTuples(entry.tuple, bestTuple) === 0)
                .map((entry) => entry.witness);
        }

        if (config.numModels > 0) {
            preferredWitnesses = preferredWitnesses.slice(0, config.numModels);
        }

        return {
            Result: preferredWitnesses.length > 0
                ? (config.optMode === 'optN' ? 'OPTIMUM FOUND' : 'SATISFIABLE')
                : 'UNSATISFIABLE',
            Call: [
                {
                    Witnesses: preferredWitnesses
                }
            ]
        };
    }

    getWitnessAggregateValue(witness, monoid) {
        const predicates = witness.Value || [];
        const discarded = predicates.filter((predicate) => predicate.startsWith('discarded_attack('));
        return computeAggregateFromDiscarded(discarded, monoid);
    }

    async runSolver(program, numModels, args, timeout) {
        return this.enqueueSolver(() => this.executeSolver(program, numModels, args, timeout));
    }

    async runRaw(program, numModels = 0, args = [], timeout = 60000) {
        return this.enqueueSolver(() => this.executeSolver(program, numModels, args, timeout));
    }

    assertSolverResult(result) {
        if (!result || typeof result !== 'object') {
            throw new Error('Clingo returned an invalid result.');
        }
        if (result.Result === 'ERROR' || result.Result === 'UNKNOWN') {
            throw new Error(`Clingo returned ${result.Result}.`);
        }
    }

    async runWithTimeout(promise, timeoutMs, timeoutMessage) {
        let timeoutHandle;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutHandle = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
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

    enqueueSolver(task) {
        const run = this.solverQueue.then(() => task());
        this.solverQueue = run.catch(() => undefined);
        return run;
    }

    async executeSolver(program, numModels, args, timeout) {
        return this.runWithTimeout(
            clingo.run(program, numModels || 0, args),
            timeout || 60000,
            'Clingo execution timed out. Try a smaller framework or a less permissive search mode.'
        );
    }

    normalizeConfig(config) {
        return normalizeConfig(config);
    }

    validateConfig(config) {
        return validateConfig(config);
    }

    resolveSemiringModuleKey(semiringFamily, polarity) {
        return resolveSemiringModuleKey(semiringFamily, polarity);
    }

    getAliasLabel(semiringFamily, polarity) {
        return getAliasLabel(semiringFamily, polarity);
    }

    getCoreModule() {
        return getCoreModule();
    }

    getSemiringModule(config) {
        return getSemiringModule(config);
    }

    getDefaultPolicyModule(defaultPolicy) {
        return getDefaultPolicyModule(defaultPolicy);
    }

    getMonoidModule(monoid) {
        return getMonoidModule(monoid);
    }

    getOptimizeModule(optimization) {
        return getOptimizeModule(optimization);
    }

    getConstraintModule(budgetMode) {
        return getConstraintModule(budgetMode);
    }

    getFilterModule(filterType) {
        return getFilterModule(filterType);
    }

    getSemanticsModule(semantics) {
        return getSemanticsModule(semantics);
    }
}
