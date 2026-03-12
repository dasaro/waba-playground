/**
 * ClingoManager - Handles Clingo WASM integration and mature WABA program assembly.
 */
import { wabaModules } from '../waba-modules.js?v=20260312-1';

const SUPPORTED_SEMANTICS = new Set(wabaModules.metadata.supportedSemantics);
const SUPPORTED_BOUNDED_PAIRS = new Set(
    wabaModules.metadata.supportedBudgetPairs.map(({ monoid, budgetMode }) => `${monoid}:${budgetMode}`)
);

const POS_INF = '#sup';
const NEG_INF = '#inf';

export class ClingoManager {
    constructor(runBtn) {
        this.runBtn = runBtn;
        this.clingoReady = false;
    }

    async initClingo() {
        const maxAttempts = 20;
        let attempts = 0;

        while (attempts < maxAttempts) {
            if (typeof clingo !== 'undefined') {
                try {
                    if (typeof clingo.run === 'function') {
                        this.clingoReady = true;
                        const introStatus = document.getElementById('intro-status');
                        if (introStatus) {
                            introStatus.textContent = 'Clingo WASM loaded successfully';
                            introStatus.style.color = 'var(--success-color)';
                        }
                        return true;
                    }
                } catch (error) {
                    // Continue waiting.
                }
            }

            await new Promise((resolve) => setTimeout(resolve, 500));
            attempts += 1;
        }

        const introStatus = document.getElementById('intro-status');
        if (introStatus) {
            introStatus.textContent = 'Failed to load Clingo. Refresh the page and try again.';
            introStatus.style.color = 'var(--error-color)';
        }
        if (this.runBtn) {
            this.runBtn.disabled = true;
        }
        return false;
    }

    async runWABA(framework, config, onLog) {
        if (!this.clingoReady) {
            onLog('Clingo is still loading.', 'warning');
            return null;
        }

        const normalized = this.normalizeConfig(config);
        const validationError = this.validateConfig(normalized);
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

    normalizeConfig(config) {
        const semiringFamily = config.semiringFamily || config.semiring || 'godel';
        const polarity = config.polarity || 'higher';
        const defaultPolicy = config.defaultPolicy || 'legacy';
        const monoid = config.monoid || 'sum';
        const optimization = config.optimization || config.optimize || 'minimize';
        const budgetMode = config.budgetMode || config.constraint || 'none';
        const budgetIntent = config.budgetIntent || (budgetMode === 'none' ? 'no_discard' : 'bounded');
        const semantics = config.semantics || 'stable';
        const optMode = config.optMode || 'ignore';
        const filterType = config.filterType || 'standard';
        const beta = Number.isFinite(config.beta) ? config.beta : parseInt(config.beta || config.budget || '0', 10) || 0;
        const numModels = Number.isFinite(config.numModels) ? config.numModels : parseInt(config.numModels || '0', 10) || 0;
        const timeout = Number.isFinite(config.timeout) ? config.timeout : 60000;
        const semiringKey = this.resolveSemiringModuleKey(semiringFamily, polarity);
        const aliasLabel = this.getAliasLabel(semiringFamily, polarity);

        return {
            ...config,
            semiringFamily,
            polarity,
            semiringKey,
            aliasLabel,
            defaultPolicy,
            monoid,
            optimization,
            budgetMode,
            budgetIntent,
            semantics,
            optMode,
            filterType,
            beta,
            numModels,
            timeout
        };
    }

    validateConfig(config) {
        if (!SUPPORTED_SEMANTICS.has(config.semantics)) {
            return `Unsupported semantics "${config.semantics}" in the supported playground surface.`;
        }

        if (!wabaModules.defaults[config.defaultPolicy]) {
            return `Unknown default policy "${config.defaultPolicy}".`;
        }

        if (!wabaModules.monoid[config.monoid]) {
            return `Unknown monoid "${config.monoid}".`;
        }

        if (!wabaModules.optimize[config.optimization]) {
            return `Unknown optimization direction "${config.optimization}".`;
        }

        if (!wabaModules.filter[config.filterType]) {
            return `Unknown output filter "${config.filterType}".`;
        }

        if (config.budgetMode === 'ub' || config.budgetMode === 'lb') {
            if (!SUPPORTED_BOUNDED_PAIRS.has(`${config.monoid}:${config.budgetMode}`)) {
                return `Unsupported supported-surface pairing: ${config.monoid} + ${config.budgetMode}. Use sum/max/count + ub or min + lb.`;
            }
        }

        if (config.budgetMode === 'none' && config.budgetIntent !== 'no_discard' && config.budgetIntent !== 'explore') {
            return `Unknown budget-none behavior "${config.budgetIntent}".`;
        }

        return null;
    }

    async runDirect(framework, config) {
        const program = this.buildProgram(framework, config);
        const args = this.buildSolverArgs(config);
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
        const candidateProgram = this.buildProgram(framework, candidateConfig, {
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

        if (this.shouldApplyNumericPostFilter(config)) {
            onLog('Applying numeric objective after exact preferred filtering…', 'info');
            const ranked = preferredWitnesses.map((witness) => {
                const aggregate = this.getWitnessAggregateValue(witness, config.monoid);
                return {
                    witness: {
                        ...witness,
                        Optimization: this.formatSyntheticOptimization(aggregate)
                    },
                    tuple: this.getObjectiveTuple(config, aggregate)
                };
            });
            const bestTuple = ranked.reduce((best, entry) => {
                if (!best) {
                    return entry.tuple;
                }
                return this.compareTuples(entry.tuple, best) < 0 ? entry.tuple : best;
            }, null);
            preferredWitnesses = ranked
                .filter((entry) => this.compareTuples(entry.tuple, bestTuple) === 0)
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

    buildProgram(framework, config, options = {}) {
        const semanticsKey = options.semantics || config.semantics;
        const includeObjective = options.includeObjective ?? this.shouldLoadObjective(config);
        const budgetProfile = this.resolveBudgetProfile(config);
        const monoidLoaded = budgetProfile !== 'no_discard';
        const parts = [
            '%% Framework',
            framework.trim(),
            '',
            '%% Budget',
            `budget(${config.beta}).`,
            '',
            '%% Core',
            this.getCoreModule(),
            '',
            '%% Ordered semiring',
            this.getSemiringModule(config),
            '',
            '%% Default policy',
            this.getDefaultPolicyModule(config.defaultPolicy)
        ];

        if (budgetProfile === 'bounded') {
            parts.push('', '%% Monoid', this.getMonoidModule(config.monoid));
            parts.push('', '%% Budget constraint', this.getConstraintModule(config.budgetMode));
            if (includeObjective) {
                parts.push('', '%% Objective', this.getOptimizeModule(config.optimization));
            }
            parts.push('', '%% Budget threshold export', '#show budget_value/1.');
        } else if (budgetProfile === 'unbounded') {
            parts.push('', '%% Monoid', this.getMonoidModule(config.monoid));
            if (includeObjective) {
                parts.push('', '%% Objective', this.getOptimizeModule(config.optimization));
            }
            parts.push('', '%% Unbounded aggregate export', this.getBudgetValueHelperModule());
        } else if (budgetProfile === 'no_discard') {
            parts.push('', '%% Plain / no-discard profile', this.getConstraintModule('no_discard'));
        }

        parts.push('', '%% Output filter', this.getFilterModule(config.filterType));
        parts.push('', '%% Semantics', this.getSemanticsModule(semanticsKey));

        return `${parts.join('\n')}\n`;
    }

    buildSolverArgs(config) {
        const effectiveOptMode = this.resolveSolverOptMode(config);
        if (effectiveOptMode === 'ignore') {
            return ['--opt-mode=ignore'];
        }
        return [`--opt-mode=${effectiveOptMode}`, '--quiet=1', '--project'];
    }

    resolveSolverOptMode(config) {
        if (config.semantics === 'grounded') {
            return 'optN';
        }
        if (!this.shouldLoadObjective(config) && config.semantics !== 'grounded') {
            return 'ignore';
        }
        return config.optMode;
    }

    shouldLoadObjective(config) {
        if (config.semantics === 'preferred') {
            return false;
        }
        return config.optMode === 'optN' && this.resolveBudgetProfile(config) !== 'no_discard';
    }

    shouldApplyNumericPostFilter(config) {
        return config.optMode === 'optN' && this.resolveBudgetProfile(config) !== 'no_discard';
    }

    resolveBudgetProfile(config) {
        if (config.budgetMode === 'none') {
            return config.budgetIntent === 'explore' ? 'unbounded' : 'no_discard';
        }
        return 'bounded';
    }

    resolveSemiringModuleKey(semiringFamily, polarity) {
        if (wabaModules.semiring[semiringFamily]) {
            return semiringFamily;
        }
        const familyEntry = wabaModules.metadata.canonicalSemiring[semiringFamily];
        if (!familyEntry) {
            throw new Error(`Unknown semiring family "${semiringFamily}".`);
        }
        const moduleKey = familyEntry[polarity];
        if (!moduleKey || !wabaModules.semiring[moduleKey]) {
            throw new Error(`No semiring module for ${semiringFamily} with ${polarity} polarity.`);
        }
        return moduleKey;
    }

    getAliasLabel(semiringFamily, polarity) {
        const aliases = Object.entries(wabaModules.metadata.aliases);
        const match = aliases.find(([, value]) => value.family === semiringFamily && value.polarity === polarity);
        return match ? match[0] : null;
    }

    getCoreModule() {
        return wabaModules.core.base;
    }

    getSemiringModule(semiringConfig) {
        if (typeof semiringConfig === 'string' && wabaModules.semiring[semiringConfig]) {
            return wabaModules.semiring[semiringConfig];
        }
        const moduleKey = typeof semiringConfig === 'string'
            ? this.resolveSemiringModuleKey(semiringConfig, document.getElementById('polarity-select')?.value || 'higher')
            : semiringConfig.semiringKey;
        return wabaModules.semiring[moduleKey] || wabaModules.semiring.godel;
    }

    getDefaultPolicyModule(defaultPolicy) {
        return wabaModules.defaults[defaultPolicy] || wabaModules.defaults.legacy;
    }

    getMonoidModule(monoid) {
        return wabaModules.monoid[monoid] || wabaModules.monoid.sum;
    }

    getOptimizeModule(optimization) {
        return wabaModules.optimize[optimization] || wabaModules.optimize.minimize;
    }

    getConstraintModule(budgetMode) {
        return wabaModules.constraint[budgetMode] || wabaModules.constraint.no_discard;
    }

    getFilterModule(filterType = 'standard') {
        return wabaModules.filter[filterType] || wabaModules.filter.standard;
    }

    getSemanticsModule(semantics) {
        if (semantics === 'preferred') {
            return wabaModules.semantics.complete;
        }
        return wabaModules.semantics[semantics] || wabaModules.semantics.stable;
    }

    getBudgetValueHelperModule() {
        return `budget_value(C) :- active_monoid(sum), C = #sum{ W,X,Y : discarded_attack(X,Y,W) }.
budget_value(C) :- active_monoid(max), C = #max{ W : discarded_attack(_,_,W) }.
budget_value(C) :- active_monoid(min), C = #min{ W : discarded_attack(_,_,W) }.
budget_value(C) :- active_monoid(count), C = #count{ X,Y : discarded_attack(X,Y,_) }.
#show budget_value/1.`;
    }

    getWitnessAggregateValue(witness, monoid) {
        const predicates = witness.Value || [];
        const weights = predicates
            .map((predicate) => predicate.match(/^discarded_attack\([^,]+,\s*[^,]+,\s*([^)]+)\)$/))
            .filter(Boolean)
            .map((match) => match[1]);

        if (monoid === 'count') {
            return weights.length;
        }

        const numericWeights = weights.map((value) => {
            if (value === POS_INF) {
                return POS_INF;
            }
            if (value === NEG_INF) {
                return NEG_INF;
            }
            return Number.parseFloat(value);
        });

        if (monoid === 'sum') {
            return numericWeights.reduce((total, value) => {
                if (value === POS_INF) {
                    return POS_INF;
                }
                if (value === NEG_INF) {
                    return NEG_INF;
                }
                if (total === POS_INF || total === NEG_INF) {
                    return total;
                }
                return total + value;
            }, 0);
        }

        if (monoid === 'max') {
            if (numericWeights.length === 0) {
                return NEG_INF;
            }
            return numericWeights.reduce((current, value) => this.maxWithSentinels(current, value), NEG_INF);
        }

        if (monoid === 'min') {
            if (numericWeights.length === 0) {
                return POS_INF;
            }
            return numericWeights.reduce((current, value) => this.minWithSentinels(current, value), POS_INF);
        }

        return 0;
    }

    maxWithSentinels(left, right) {
        if (left === POS_INF || right === POS_INF) {
            return POS_INF;
        }
        if (left === NEG_INF) {
            return right;
        }
        if (right === NEG_INF) {
            return left;
        }
        return Math.max(left, right);
    }

    minWithSentinels(left, right) {
        if (left === NEG_INF || right === NEG_INF) {
            return NEG_INF;
        }
        if (left === POS_INF) {
            return right;
        }
        if (right === POS_INF) {
            return left;
        }
        return Math.min(left, right);
    }

    getObjectiveTuple(config, aggregateValue) {
        const { monoid, optimization } = config;

        if (monoid === 'sum' || monoid === 'count') {
            return [0, 0, optimization === 'minimize' ? aggregateValue : -aggregateValue];
        }

        if (monoid === 'max' && optimization === 'minimize') {
            if (aggregateValue === POS_INF) {
                return [1, 0, 0];
            }
            if (aggregateValue === NEG_INF) {
                return [0, 0, 0];
            }
            return [0, 0, aggregateValue];
        }

        if (monoid === 'max' && optimization === 'maximize') {
            if (aggregateValue === NEG_INF) {
                return [1, -1, 0];
            }
            if (aggregateValue === POS_INF) {
                return [0, 0, 0];
            }
            return [0, -1, -aggregateValue];
        }

        if (monoid === 'min' && optimization === 'minimize') {
            if (aggregateValue === NEG_INF) {
                return [1, 0, 0];
            }
            if (aggregateValue === POS_INF) {
                return [0, 0, 0];
            }
            return [0, 0, aggregateValue];
        }

        if (monoid === 'min' && optimization === 'maximize') {
            if (aggregateValue === NEG_INF) {
                return [1, 0, 0];
            }
            if (aggregateValue === POS_INF) {
                return [0, -1, 0];
            }
            return [0, -1, -aggregateValue];
        }

        return [0, 0, 0];
    }

    compareTuples(left, right) {
        for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
            const leftValue = left[index] ?? 0;
            const rightValue = right[index] ?? 0;
            if (leftValue < rightValue) {
                return -1;
            }
            if (leftValue > rightValue) {
                return 1;
            }
        }
        return 0;
    }

    formatSyntheticOptimization(aggregateValue) {
        if (aggregateValue === POS_INF) {
            return POS_INF;
        }
        if (aggregateValue === NEG_INF) {
            return NEG_INF;
        }
        return aggregateValue;
    }

    async runSolver(program, numModels, args, timeout) {
        return this.runWithTimeout(
            clingo.run(program, numModels || 0, args),
            timeout || 60000,
            'Clingo execution timed out. Try a smaller framework or a less permissive search mode.'
        );
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
}
