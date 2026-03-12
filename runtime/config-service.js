import { wabaModules } from '../waba-modules.js?v=20260312-8';

const SUPPORTED_SEMANTICS = new Set(wabaModules.metadata.supportedSemantics);
const SUPPORTED_BOUNDED_PAIRS = new Set(
    wabaModules.metadata.supportedBudgetPairs.map(({ monoid, budgetMode }) => `${monoid}:${budgetMode}`)
);

export function resolveSemiringModuleKey(semiringFamily, polarity) {
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

export function getAliasLabel(semiringFamily, polarity) {
    const aliases = Object.entries(wabaModules.metadata.aliases);
    const match = aliases.find(([, value]) => value.family === semiringFamily && value.polarity === polarity);
    return match ? match[0] : null;
}

/**
 * @param {Partial<import('../core/types.js').RunConfig>} config
 * @returns {import('../core/types.js').EffectiveConfig}
 */
export function normalizeConfig(config = {}) {
    const semiringFamily = config.semiringFamily || config.semiring || 'godel';
    const polarity = config.polarity || 'higher';
    const defaultPolicy = 'neutral';
    const monoid = config.monoid || 'sum';
    const optimization = config.optimization || config.optimize || 'minimize';
    const budgetMode = config.budgetMode || config.constraint || 'none';
    const budgetIntent = config.budgetIntent || (budgetMode === 'none' ? 'explore' : 'bounded');
    const semantics = config.semantics || 'stable';
    const optMode = config.optMode || 'ignore';
    const filterType = config.filterType || 'standard';
    const beta = Number.isFinite(config.beta) ? config.beta : parseInt(config.beta || config.budget || '0', 10) || 0;
    const numModels = Number.isFinite(config.numModels) ? config.numModels : parseInt(config.numModels || '0', 10) || 0;
    const timeout = Number.isFinite(config.timeout) ? config.timeout : 60000;
    const semiringKey = resolveSemiringModuleKey(semiringFamily, polarity);
    const aliasLabel = getAliasLabel(semiringFamily, polarity);

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

/**
 * @param {import('../core/types.js').EffectiveConfig} config
 * @returns {string | null}
 */
export function validateConfig(config) {
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

    if ((config.budgetMode === 'ub' || config.budgetMode === 'lb')
        && !SUPPORTED_BOUNDED_PAIRS.has(`${config.monoid}:${config.budgetMode}`)) {
        return `Unsupported supported-surface pairing: ${config.monoid} + ${config.budgetMode}. Use sum/max/count + ub or min + lb.`;
    }

    if (config.budgetMode === 'none' && config.budgetIntent !== 'no_discard' && config.budgetIntent !== 'explore') {
        return `Unknown budget-none behavior "${config.budgetIntent}".`;
    }

    return null;
}

/**
 * @param {import('../core/types.js').EffectiveConfig} config
 * @returns {'bounded'|'unbounded'|'no_discard'}
 */
export function resolveBudgetProfile(config) {
    if (config.budgetMode === 'none') {
        return config.budgetIntent === 'explore' ? 'unbounded' : 'no_discard';
    }
    return 'bounded';
}

export function shouldLoadObjective(config) {
    if (config.semantics === 'preferred') {
        return false;
    }
    return config.optMode === 'optN' && resolveBudgetProfile(config) !== 'no_discard';
}

export function shouldApplyNumericPostFilter(config) {
    return config.optMode === 'optN' && resolveBudgetProfile(config) !== 'no_discard';
}

export function resolveSolverOptMode(config) {
    if (config.semantics === 'grounded') {
        return 'optN';
    }
    if (!shouldLoadObjective(config) && config.semantics !== 'grounded') {
        return 'ignore';
    }
    return config.optMode;
}

export function getSupportedMetadata() {
    return wabaModules.metadata;
}
