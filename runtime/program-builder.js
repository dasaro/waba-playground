import { wabaModules } from '../waba-modules.js?v=20260729-2';
import { resolveBudgetProfile, resolveSolverOptMode, shouldLoadObjective, isBudgetedDefence } from './config-service.js?v=20260729-2';

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
    if (semantics === 'preferred' || semantics === 'grounded') {
        return wabaModules.semantics.complete;
    }
    // wABA budgeted-defence (Dunne Def 6): map to the self-contained-budget modules.
    if (semantics === 'budgeted-admissible' || semantics === 'budgeted-preferred') {
        return wabaModules.semantics.admissible_dunne;
    }
    if (semantics === 'budgeted-complete') {
        return wabaModules.semantics.complete_dunne;
    }
    return wabaModules.semantics[semantics] || wabaModules.semantics.stable;
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
    // Ground the CONSTANT beta, exactly as bin/waba's `-c beta=N` does. core/base.lp
    // states `budget(beta).` and the curated frameworks end with `budget(beta).`, so
    // emitting a `budget(N).` FACT instead would leave `beta` symbolic — and a symbolic
    // constant outranks every integer in clingo's term order, which makes constraint/lb.lp
    // (`:- budget_value(C), C < B, budget(B), some_discard.`) reject EVERY discard and
    // silently collapse lower-bound mode to no-discard. Skip our declaration when the
    // framework already fixes beta: clingo rejects a redefined constant outright.
    const frameworkFixesBeta = /^[^%\n]*#const\s+beta\s*=/m.test(framework);
    const parts = [
        '%% Framework',
        framework.trim(),
        '',
        '%% Budget',
        frameworkFixesBeta ? '%% (beta fixed by the framework)' : `#const beta = ${config.beta}.`,
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
    if (effectiveOptMode === 'ignore') {
        // Budgeted-defence realises one extension via many discard sets, so project
        // onto the shown atoms to enumerate each beta-admissible set once.
        return isBudgetedDefence(config.semantics)
            ? ['--opt-mode=ignore', '--project']
            : ['--opt-mode=ignore'];
    }
    return [`--opt-mode=${effectiveOptMode}`, '--quiet=1', '--project'];
}
