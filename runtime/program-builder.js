import { wabaModules } from '../waba-modules.js?v=20260730-8';
import { resolveBudgetProfile, resolveSolverOptMode, shouldLoadObjective, isBudgetedDefence } from './config-service.js?v=20260730-8';

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
    // A derived semantics (preferred) has no module of its own: it is computed by
    // post-filtering the candidates of another one. metadata.derivedSemantics carries that
    // mapping straight from the sync policy, so it cannot drift from bin/waba.
    const derived = wabaModules.metadata.derivedSemantics || {};
    const moduleKey = derived[semantics] || semantics;
    return wabaModules.semantics[moduleKey] || wabaModules.semantics.stable;
}

/**
 * @param {string} framework
 * @param {import('../core/types.js').EffectiveConfig} config
 * @param {{ semantics?: string, includeObjective?: boolean }} [options]
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
    // yielded to the framework while the CLI's -c overrode it. Under a cost algebra that
    // turned beta=101 into beta=0, the lower-bound defence guard went vacuous, and the
    // playground returned every candidate set where the CLI returned the 7 correct ones.
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
        // Budgeted-defence realises one extension via many discard sets, so project
        // onto the shown atoms to enumerate each beta-admissible set once.
        return isBudgetedDefence(config.semantics)
            ? [...constants, '--opt-mode=ignore', '--project']
            : [...constants, '--opt-mode=ignore'];
    }
    return [...constants, `--opt-mode=${effectiveOptMode}`, '--quiet=1', '--project'];
}
