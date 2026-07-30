/**
 * ClingoManager - Handles Clingo WASM integration and mature WABA program execution.
 */
import { wabaModules } from '../waba-modules.js?v=20260730-6';
import {
    normalizeConfig,
    resolveSemiringModuleKey,
    getAliasLabel,
    isBudgetedDefence,
    shouldApplyNumericPostFilter,
    validateConfig
} from '../runtime/config-service.js?v=20260730-6';
import { buildProgram, buildSolverArgs, getConstraintModule, getCoreModule, getDefaultPolicyModule, getFilterModule, getMonoidModule, getOptimizeModule, getSemanticsModule, getSemiringModule } from '../runtime/program-builder.js?v=20260730-6';
import { compareTuples, computeAggregateFromDiscarded, formatSyntheticOptimization, getObjectiveTuple } from '../runtime/objective-utils.js?v=20260730-6';
import { ParserUtils } from './parser-utils.js?v=20260730-6';

// Which semantics need the enumerate-then-subset-filter two-pass, and what they filter over.
// Both come from the bundle so they track the .lp module set automatically.
const DERIVED_SEMANTICS = wabaModules.metadata.derivedSemantics || {};
const POST_FILTERED = new Set(wabaModules.metadata.postFilteredSemantics || []);

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
            const result = POST_FILTERED.has(normalized.semantics)
                ? await this.runExactSubsetSemantics(framework, normalized, onLog)
                : await this.runDirect(framework, normalized);
            const defenceCosts = await this.computeDefenceCosts(framework, normalized, result, onLog);
            const elapsed = ((performance.now() - startTime) / 1000).toFixed(3);
            return { result, elapsed, effectiveConfig: normalized, defenceCosts };
        } catch (error) {
            console.error('Error running WABA:', error);
            throw error;
        }
    }

    /**
     * Per-extension cost for the DEFENCE semantics (admissible / complete / preferred).
     *
     * Those semantics price a shared `pay` set internally and emit no discarded_attack/3, so
     * the answer set carries in/1 and out/1 and nothing else -- which is why no cost was ever
     * shown for them. `#show pay/2` is NOT the fix: it multiplies the model count, because
     * different payment choices realising the SAME extension become distinct projected models
     * (measured 3 -> 5 -> 7 -> 11 as beta rises), breaking enumerate-each-extension-once.
     *
     * Instead: one extra solve per returned extension, with in/out PINNED and the paid
     * aggregate minimised. The optimum is the least objection-weight this extension has to
     * wave away -- 0 exactly when it is classically admissible. Under a strength algebra that
     * is also the smallest beta admitting it.
     *
     * Returns a Map from a canonical extension key to the number, or null when not applicable.
     */
    async computeDefenceCosts(framework, config, result, onLog = () => {}) {
        if (!isBudgetedDefence(config.semantics)) {
            return null;
        }
        const witnesses = result?.Call?.[0]?.Witnesses || [];
        if (witnesses.length === 0) {
            return null;
        }

        const assumptions = ParserUtils.parseAssumptions(framework);
        if (assumptions.length === 0) {
            return null;
        }

        // The probe must not be blocked by the module's own bound while we search for the
        // minimum. A strength bound is `sum <= beta` and additionally forbids ANY payment at
        // beta = 0, so the probe needs a large beta; a cost bound is `min >= beta`, which is
        // vacuous at 0. Either way the #minimize, not beta, decides the answer.
        const probeBeta = config.polarity === 'lower' ? 0 : 1000000;
        const costs = new Map();

        for (const witness of witnesses) {
            const inSet = new Set((witness.Value || [])
                .map((predicate) => predicate.match(/^in\((.+)\)$/))
                .filter(Boolean)
                .map((match) => match[1]));
            const key = [...inSet].sort().join(',');
            if (costs.has(key)) {
                continue;
            }

            const pins = assumptions
                .map((a) => (inSet.has(a) ? `:- not in(${a}).` : `:- in(${a}).`))
                .join('\n');
            const program = `${buildProgram(framework, { ...config, beta: probeBeta })}
%% Pin this extension and minimise what it must concede
${pins}
#minimize { W,X,Y : pay(X,Y), arg_weight(X,W) }.
`;
            try {
                const probe = await this.runSolver(
                    program, 1, ['-c', `beta=${probeBeta}`, '--opt-mode=opt', '--quiet=1'], config.timeout
                );
                const probeWitnesses = probe?.Call?.[0]?.Witnesses || [];
                const last = probeWitnesses[probeWitnesses.length - 1];
                const value = Array.isArray(last?.Costs) ? last.Costs[last.Costs.length - 1] : null;
                // An extension needing no concession yields no `pay` atom, so clingo reports no
                // objective at all rather than 0. That IS zero, not "unknown".
                costs.set(key, typeof value === 'number' ? value : 0);
            } catch (error) {
                onLog(`Could not price extension {${key}}: ${error.message}`, 'warning');
            }
        }
        return costs;
    }

    async runDirect(framework, config) {
        const program = buildProgram(framework, config);
        const args = buildSolverArgs(config);
        const result = await this.runSolver(program, config.numModels, args, config.timeout);
        this.assertSolverResult(result);
        return result;
    }

    async runExactSubsetSemantics(framework, config, onLog) {
        // preferred = the subset-MAXIMAL beta-admissible sets, matching bin/waba's
        // POST_FILTER_SEMANTICS/SUBSET_FILTER pair. The candidate semantics comes from the
        // bundle's derivedSemantics map rather than a local guess, so the two-pass shape
        // cannot disagree with the CLI about what is being maximised over.
        const filterKind = 'subset_maximal_filter';
        const candidateSemantics = DERIVED_SEMANTICS[config.semantics] || 'admissible';
        const targetLabel = config.semantics;
        onLog(`Enumerating ${candidateSemantics} candidates for exact ${targetLabel} semantics…`, 'info');

        const candidateConfig = {
            ...config,
            semantics: candidateSemantics,
            optMode: 'ignore'
        };
        const candidateProgram = buildProgram(framework, candidateConfig, {
            includeObjective: false
        });
        const candidateResult = await this.runSolver(candidateProgram, 0, buildSolverArgs(candidateConfig), config.timeout);
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

        onLog(`Filtering subset-maximal ${candidateSemantics} candidates…`, 'info');
        const subsetProgram = `
${candidateFacts}
${wabaModules.semantics[filterKind]}
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

        let filteredWitnesses = candidateWitnesses.filter((_, index) => keepIds.has(index + 1));

        if (shouldApplyNumericPostFilter(config)) {
            onLog(`Applying numeric objective after exact ${targetLabel} filtering…`, 'info');
            const ranked = filteredWitnesses.map((witness) => {
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
            filteredWitnesses = ranked
                .filter((entry) => compareTuples(entry.tuple, bestTuple) === 0)
                .map((entry) => entry.witness);
        }

        if (config.numModels > 0) {
            filteredWitnesses = filteredWitnesses.slice(0, config.numModels);
        }

        return {
            Result: filteredWitnesses.length > 0
                ? (config.optMode === 'optN' ? 'OPTIMUM FOUND' : 'SATISFIABLE')
                : 'UNSATISFIABLE',
            Call: [
                {
                    Witnesses: filteredWitnesses
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
            const detail = Array.isArray(result.Error)
                ? result.Error.join('; ')
                : (typeof result.Error === 'string' ? result.Error : '');
            throw new Error(`Clingo returned ${result.Result}${detail ? `: ${detail}` : ''}.`);
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
