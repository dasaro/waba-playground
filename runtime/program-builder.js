import { wabaModules } from '../waba-modules.js?v=20260312-10';
import { resolveBudgetProfile, resolveSolverOptMode, shouldLoadObjective } from './config-service.js?v=20260312-10';

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
    if (semantics === 'preferred') {
        return wabaModules.semantics.complete;
    }
    return wabaModules.semantics[semantics] || wabaModules.semantics.stable;
}

export function getBudgetValueHelperModule() {
    return `budget_value(C) :- active_monoid(sum), C = #sum{ W,X,Y : discarded_attack(X,Y,W) }.
budget_value(C) :- active_monoid(max), C = #max{ W : discarded_attack(_,_,W) }.
budget_value(C) :- active_monoid(min), C = #min{ W : discarded_attack(_,_,W) }.
budget_value(C) :- active_monoid(count), C = #count{ X,Y : discarded_attack(X,Y,_) }.
#show budget_value/1.`;
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
    const parts = [
        '%% Framework',
        framework.trim(),
        '',
        '%% Budget',
        `budget(${config.beta}).`,
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
    } else if (budgetProfile === 'unbounded') {
        parts.push('', '%% Monoid', getMonoidModule(config.monoid));
        if (includeObjective) {
            parts.push('', '%% Objective', getOptimizeModule(config.optimization));
        }
        parts.push('', '%% Unbounded aggregate export', getBudgetValueHelperModule());
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
        return ['--opt-mode=ignore'];
    }
    return [`--opt-mode=${effectiveOptMode}`, '--quiet=1', '--project'];
}
