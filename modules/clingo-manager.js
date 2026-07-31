/**
 * ClingoManager - Handles Clingo WASM integration and mature WABA program execution.
 */
import { wabaModules } from '../waba-modules.js?v=20260731-8';
import {
    normalizeConfig,
    resolveSemiringModuleKey,
    getAliasLabel,
    isBudgetedDefence,
    shouldApplyNumericPostFilter,
    validateConfig
} from '../runtime/config-service.js?v=20260731-8';
import { buildProgram, buildSolverArgs, getConstraintModule, getCoreModule, getDefaultPolicyModule, getFilterModule, getMonoidModule, getOptimizeModule, getSemanticsModule, getSemiringModule } from '../runtime/program-builder.js?v=20260731-8';
import { compareTuples, computeAggregateFromDiscarded, formatSyntheticOptimization, getObjectiveTuple } from '../runtime/objective-utils.js?v=20260731-8';
import { matchPredicate, splitTopLevelArgs } from '../runtime/answer-set-parser.js?v=20260731-8';
import { ParserUtils } from './parser-utils.js?v=20260731-8';

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

        // The framework's own preconditions, checked by RUNNING WABA/validate.lp through
        // clingo-wasm. The first version scanned the text with regexes and was wrong both ways:
        // it missed pooled facts (the compact form CLAUDE.md tells authors to prefer), facts
        // split across lines, rule-derived weights and block comments, and it REJECTED legal
        // frameworks whose atoms are function terms. Letting clingo parse it is exact, and it is
        // the same file bin/waba uses, so the two boundaries cannot drift.
        const precondition = await this.checkPreconditions(framework, normalized, onLog);
        if (precondition) {
            throw new Error(precondition);
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

        // The two polarities ask DIFFERENT questions of the module:
        //
        //   strength (oplus = max): it bounds `#sum{paid} <= beta`, so S holds for every
        //       beta >= the least total it can concede. beta* = that minimum.
        //   cost (oplus = min): it bounds `#min{paid} >= beta`, so a BIGGER beta is more
        //       restrictive and S holds for every beta <= the largest floor it can achieve.
        //       beta* = that maximum.
        //
        // The strength side is a plain #minimize and is verified exact. The cost side is not: a
        // #maximize over the computed #min got the answer wrong three different ways (it ignores
        // that a pay-free model dominates, and it does not reliably find the best floor). Rather
        // than keep guessing at an encoding, the cost side BINARY-SEARCHES the real module -- it
        // asks the actual semantics whether S survives at a given beta, so it cannot disagree
        // with it by construction.
        const isCost = config.polarity === 'lower';
        const costs = new Map();

        // Search ceiling, measured rather than guessed.
        //
        // It used to be the sum of the DECLARED weight/2 literals, on the reasoning that no
        // threshold can exceed the total declared weight. That is false in two ways: with
        // otimes = + a leaf feeding two branches contributes to arg_weight twice, so a single
        // arg_weight can exceed the declared total; and a delta-weighted assumption contributes
        // nothing to the sum but a real arg_weight to the bound. When the ceiling fell short,
        // the strength probe was UNSAT and the code below turned that into beta* = 0 -- the
        // value meaning "needs no budget at all" -- and the cost probe concluded "survives at
        // every beta". Both are the most flattering possible answer, and both sorted those
        // extensions to the top.
        //
        // So ask the module for the actual arg_weights. The bound is over `pay`, so the largest
        // total is (max arg_weight) x (number of payable attacks) and the largest floor is
        // (max arg_weight); take the former, which covers both.
        let ceiling = 1000;
        try {
            const weightProbe = await this.runSolver(
                `${buildProgram(framework, { ...config, beta: 0 })}\n#show arg_weight/2.\n`,
                1, buildSolverArgs({ ...config, beta: 0, optMode: 'ignore' }), config.timeout
            );
            const shown = weightProbe?.Call?.[0]?.Witnesses?.[0]?.Value || [];
            const argWeights = shown
                .map((atom) => matchPredicate(atom, 'arg_weight'))
                .filter((args) => args !== null)
                .map((args) => Number(splitTopLevelArgs(args)[1]))
                .filter((n) => Number.isFinite(n));
            if (argWeights.length > 0) {
                const maxArg = Math.max(...argWeights.map(Math.abs));
                ceiling = maxArg * argWeights.length + 1;
            }
        } catch {
            // Fall through to the default; the guards below still refuse to invent a number.
        }

        // One solve per extension for strength, ~log2(ceiling) for cost. Uncapped this was 2^n
        // probes on a wide framework, which froze the page behind a modal overlay.
        const PRICING_CAP = 24;
        let priced = 0;

        const holdsAt = async (pins, beta) => {
            const program = `${buildProgram(framework, { ...config, beta })}
%% Pin this extension and ask the module whether it survives at this beta
${pins}
`;
            const probe = await this.runSolver(
                program, 1,
                buildSolverArgs({ ...config, beta, optMode: 'ignore' }), config.timeout
            );
            return probe?.Result === 'SATISFIABLE';
        };

        for (const witness of witnesses) {
            const inSet = new Set((witness.Value || [])
                .map((predicate) => matchPredicate(predicate, 'in'))
                .filter((arg) => arg !== null));
            const key = [...inSet].sort().join(',');
            if (costs.has(key)) {
                continue;
            }
            if (priced >= PRICING_CAP) {
                onLog(`Priced the first ${PRICING_CAP} extensions; the rest are shown without a β*.`, 'info');
                break;
            }
            priced += 1;

            const pins = assumptions
                .map((a) => (inSet.has(a) ? `:- not in(${a}).` : `:- in(${a}).`))
                .join('\n');

            try {
                if (!isCost) {
                    // Least beta admitting S: minimise what it must concede.
                    const program = `${buildProgram(framework, { ...config, beta: ceiling })}
%% Pin this extension and minimise what it must concede
${pins}
#minimize { W,X,Y : pay(X,Y), arg_weight(X,W) }.
`;
                    // buildSolverArgs, NOT a hand-rolled list: it is the only place `-c k` is
                    // added, so hand-rolling left every Lukasiewicz probe at the module's default
                    // k = 1000 regardless of the k control.
                    const probe = await this.runSolver(
                        program, 1,
                        [...buildSolverArgs({ ...config, beta: ceiling, optMode: 'ignore' })
                            .filter((a) => !a.startsWith('--opt-mode')), '--opt-mode=opt', '--quiet=1'],
                        config.timeout
                    );
                    const witnessesOut = probe?.Call?.[0]?.Witnesses || [];
                    const last = witnessesOut[witnessesOut.length - 1];
                    const raw = Array.isArray(last?.Costs) ? last.Costs[last.Costs.length - 1] : null;
                    // An UNSAT probe means the ceiling was still too low, NOT that the set is
                    // free. Leaving it unpriced shows no badge; claiming 0 asserted the set is
                    // classically admissible and ranked it first.
                    if (typeof raw === 'number') {
                        costs.set(key, raw);
                    }
                    continue;
                }

                // Cost: greatest beta at which S still holds. Monotone (a bigger beta is strictly
                // more restrictive), so binary search is exact.
                if (!(await holdsAt(pins, 0))) {
                    continue;                       // holds nowhere; nothing meaningful to show
                }
                if (await holdsAt(pins, ceiling)) {
                    // Only sound if the ceiling really is above every reachable arg_weight.
                    // Confirm at twice the ceiling before claiming the set survives any floor;
                    // if that fails the ceiling was short, so leave it unpriced rather than
                    // advertising "any β".
                    if (await holdsAt(pins, ceiling * 2)) {
                        costs.set(key, Infinity);
                    }
                    continue;
                }
                let lo = 0;                          // known to hold
                let hi = ceiling;                    // known not to hold
                while (hi - lo > 1) {
                    const mid = Math.floor((lo + hi) / 2);
                    if (await holdsAt(pins, mid)) {
                        lo = mid;
                    } else {
                        hi = mid;
                    }
                }
                costs.set(key, lo);
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
            // `[^)]+` stopped at the first `)`, so a function-term assumption such as
            // `in(flies(tweety))` matched nothing and NO member/2 facts were emitted. The
            // subset-maximal filter then saw candidates with empty membership, derived no
            // has_extra, dominated nothing, and kept every candidate -- so `preferred`
            // silently returned exactly the admissible sets.
            const members = (witness.Value || [])
                .map((predicate) => matchPredicate(predicate, 'in'))
                .filter((arg) => arg !== null)
                .map((atom) => `member(${modelId},${atom}).`);
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

    /**
     * Run the pre-flight validator. Returns an explanation, or null when the framework is a
     * well-formed wABA framework.
     */
    async checkPreconditions(framework, config, onLog = () => {}) {
        const EXPLAIN = {
            not_flat: 'wABA is defined for FLAT ABA: an assumption may not be a rule head',
            cyclic: 'wABA is defined for WELL-FOUNDED frameworks: rule dependencies must be '
                + "acyclic, or a derived atom's weight has no unique least fixpoint",
            multi_weight: 'weight/2 must be a partial FUNCTION: two weights for one atom split '
                + 'a single conflict into several independently discardable attacks',
            not_a_number: 'a non-integral weight is dropped by the monoid aggregates, so its '
                + 'attack would cost nothing and be discardable at any β',
            negative: 'weights must be nonnegative',
            off_grid: "outside Łukasiewicz's carrier [0, k], where the bounded sum is not "
                + 'associative'
        };
        // k applies whenever the algebra is Łukasiewicz, whether or not the user chose one --
        // the module carries `#const k = 1000`. Gating on the CONTROL rather than the algebra is
        // exactly the bug the CLI had.
        const args = ['--warn=none'];
        if (config.semiringKey === 'lukasiewicz') {
            args.push('-c', `k=${Number.isFinite(config.lukK) ? config.lukK : 1000}`);
        }
        const result = await this.runRaw(
            `${wabaModules.validate.framework}\n${framework}\n`, 1, args, 20000);
        // UNSATISFIABLE means the framework's OWN integrity constraints fired against
        // validate.lp, which defines none of the solver predicates they mention. No violation
        // atom is emitted, so treating it as a pass would skip validation entirely.
        if (result?.Result === 'UNSATISFIABLE') {
            return 'Could not validate this framework: it contains integrity constraints that '
                + 'refer to predicates the pre-flight check does not define (in/1, supported/1, '
                + '…). Move them out of the framework to run it here.';
        }
        const atoms = result?.Call?.[0]?.Witnesses?.[0]?.Value || [];
        const byKind = new Map();
        for (const atom of atoms) {
            const args2 = matchPredicate(atom, 'violation');
            if (args2 === null) continue;
            const [kind, offender] = splitTopLevelArgs(args2);
            if (!byKind.has(kind)) byKind.set(kind, new Set());
            byKind.get(kind).add(offender);
        }
        // Advisories are not rejections. leaf_reuse says a derivation reuses a leaf, which is
        // well formed but is exactly where the tree fold and the support-set reading part
        // company -- and where the probabilistic reading stops being exact.
        for (const atom of atoms) {
            const adv = matchPredicate(atom, 'advisory');
            if (adv === null) continue;
            const [kind, offender] = splitTopLevelArgs(adv);
            if (kind === 'leaf_reuse') {
                onLog(`\u2139\ufe0f ${offender}: a derivation reuses a leaf. Under an additive `
                    + 'algebra (Tropical, Arctic, Łukasiewicz) ⊗ folds each occurrence, so its '
                    + 'weight depends on the derivation tree rather than the support set — and '
                    + 'a probabilistic reading multiplies the reused fact twice. Gödel and '
                    + 'Bottleneck-cost are unaffected (⊗ is idempotent).', 'info');
            }
        }
        if (byKind.size === 0) return null;
        const parts = [...byKind.entries()].map(([kind, set]) => {
            const shown = [...set].sort().slice(0, 6).join(', ');
            const more = set.size > 6 ? ` (+${set.size - 6} more)` : '';
            return `${EXPLAIN[kind] || kind} — ${shown}${more}`;
        });
        return `This is not a well-formed wABA framework. ${parts.join('; ')}.`;
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

    /**
     * Restarts the WASM worker. Needed because a timed-out solve is NOT cancelled by rejecting
     * the race: clingo keeps chewing on the abandoned program and owns the single worker.
     */
    async restartSolver() {
        const wasmUrl = this.resolveWasmUrl();
        if (typeof clingo !== 'undefined' && typeof clingo.restart === 'function') {
            await clingo.restart(wasmUrl);
        } else if (typeof clingo !== 'undefined' && typeof clingo.init === 'function') {
            await clingo.init(wasmUrl);
        }
    }

    /**
     * Races a solve against the timeout, and on timeout ACTUALLY cancels it.
     *
     * Rejecting the race used to leave the solve running. Since the queue chained on this
     * wrapper rather than on the solve, the next task started while the abandoned one still had
     * the worker -- so one timeout made every later run time out too, including frameworks that
     * solve in 200ms on a fresh page. Measured: after a single timeout, inflight stayed at 1 and
     * the following run reached inflight 2 and never returned.
     */
    async runWithTimeout(promise, timeoutMs, timeoutMessage) {
        let timeoutHandle;
        let timedOut = false;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutHandle = setTimeout(() => {
                timedOut = true;
                reject(new Error(timeoutMessage));
            }, timeoutMs);
        });

        // The abandoned solve must never surface as an unhandled rejection.
        promise.catch(() => undefined);

        try {
            const result = await Promise.race([promise, timeoutPromise]);
            clearTimeout(timeoutHandle);
            return result;
        } catch (error) {
            clearTimeout(timeoutHandle);
            if (timedOut) {
                // Free the worker before returning control, so the queue hands the next task a
                // solver that is actually idle.
                try {
                    await this.restartSolver();
                } catch {
                    // Best effort: a failed restart is still better than leaving it wedged.
                }
            }
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
