import { wabaModules } from '../waba-modules.js?v=20260831-1';
import { resolveBudgetProfile, resolveSolverOptMode, shouldLoadObjective } from './config-service.js?v=20260831-1';

export function getCoreModule() {
    return wabaModules.core.base;
}

export function getSemiringModule(config) {
    return wabaModules.semiring[config.semiringKey] || wabaModules.semiring.godel;
}

export function getDefaultPolicyModule(defaultPolicy) {
    return wabaModules.defaults[defaultPolicy] || wabaModules.defaults.neutral;
}

export function getMonoidModule(monoid) {
    return wabaModules.monoid[monoid] || wabaModules.monoid.sum;
}

export function getOptimizeModule(optimization) {
    return wabaModules.optimize[optimization] || wabaModules.optimize.minimize;
}

export function getConstraintModule(budgetMode) {
    return wabaModules.constraint[budgetMode] || wabaModules.constraint.no_discard;
}

export function getFilterModule(filterType = 'standard') {
    return wabaModules.filter[filterType] || wabaModules.filter.standard;
}

export function getSemanticsModule(semantics) {
    // A derived semantics has no module of its own: it is computed by
    // post-filtering the candidates of another one. metadata.derivedSemantics carries that
    // mapping straight from the sync policy, so it cannot drift from bin/waba.
    const derived = wabaModules.metadata.derivedSemantics || {};
    const moduleKey = derived[semantics] || semantics;
    return wabaModules.semantics[moduleKey] || wabaModules.semantics.stable;
}

export function getSemanticsAuxiliary(semantics) {
    const moduleKey = wabaModules.metadata.semanticAuxiliaries?.[semantics];
    return moduleKey ? (wabaModules.semantics[moduleKey] || '') : '';
}

/**
 * @param {string} framework
 * @param {import('../core/types.js').EffectiveConfig} config
 * @param {{ semantics?: string, includeObjective?: boolean, auxiliaryFor?: string }} [options]
 */
export function buildProgram(framework, config, options = {}) {
    const semanticsKey = options.semantics || config.semantics;
    const includeObjective = options.includeObjective ?? shouldLoadObjective(config);
    const budgetProfile = resolveBudgetProfile(config);
    // beta is supplied as a SOLVER CONSTANT (-c beta=N) in buildSolverArgs, exactly as
    // bin/waba does -- NOT as a `#const beta = N.` in the program text.
    //
    // Emitting it into the text could not override a framework that declares its own
    // `#const beta = 0.` (clingo rejects a redefined constant), so the playground silently
    // yielded to the framework while the CLI's -c overrode it. Under a lower-bound reading
    // that could silently turn beta=101 into beta=0 and admit the wrong discard sets.
    // -c wins over #const, so this makes the caller's beta authoritative in both surfaces.
    const parts = [
        '%% Framework',
        framework.trim(),
        '',
        `%% Budget: beta = ${config.beta} (passed as -c beta, which overrides any framework #const)`,
        '',
        '%% Core',
        getCoreModule(),
        '',
        '%% Ordered semiring',
        getSemiringModule(config),
        '',
        '%% Default policy',
        getDefaultPolicyModule(config.defaultPolicy)
    ];

    if (budgetProfile === 'bounded') {
        parts.push('', '%% Monoid', getMonoidModule(config.monoid));
        parts.push('', '%% Budget constraint', getConstraintModule(config.budgetMode));
        if (includeObjective) {
            parts.push('', '%% Objective', getOptimizeModule(config.optimization));
        }
        parts.push('', '%% Budget threshold export', '#show budget_value/1.');
    } else if (budgetProfile === 'no_discard') {
        parts.push('', '%% Plain / no-discard profile', getConstraintModule('no_discard'));
    }

    parts.push('', '%% Output filter', getFilterModule(config.filterType));
    parts.push('', '%% Semantics', getSemanticsModule(semanticsKey));
    const auxiliary = getSemanticsAuxiliary(options.auxiliaryFor || '');
    if (auxiliary) {
        parts.push('', '%% Internal semantics projection', auxiliary);
    }

    return `${parts.join('\n')}\n`;
}

export function buildSolverArgs(config) {
    const effectiveOptMode = resolveSolverOptMode(config);
    const constants = ['-c', `beta=${config.beta}`];
    // semiring/lukasiewicz.lp declares `#const k = 1000.`; -c overrides it, exactly as
    // bin/waba's --luk-k does. Left off for every other algebra, which has no k.
    if (config.semiringKey === 'lukasiewicz' && Number.isFinite(config.lukK)) {
        constants.push('-c', `k=${config.lukK}`);
    }
    if (effectiveOptMode === 'ignore') {
        // Multiple affordable discard witnesses may realise the same extension under every
        // semantics. ClingoManager intentionally retains those witnesses here, then deduplicates
        // by in/1 after selecting a deterministic representative receipt. Projecting inside
        // clingo would existentially forget D before preferred can maximise within each reduct.
        return [...constants, '--opt-mode=ignore'];
    }
    // Retain the discard witness even though semantics modules declare #project in/out. The
    // browser performs extension-level deduplication after solving and keeps one receipt; using
    // --project here would erase every discarded_attack/3 atom from the returned witness.
    return [...constants, `--opt-mode=${effectiveOptMode}`, '--quiet=1'];
}
