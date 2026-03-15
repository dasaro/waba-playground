import { wabaModules } from '../waba-modules.js?v=20260315-1';

const SUPPORTED_SEMANTICS = new Set(wabaModules.metadata.supportedSemantics);
const SUPPORTED_BOUNDED_PAIRS = new Set(
    wabaModules.metadata.supportedBudgetPairs.map(({ monoid, budgetMode }) => `${monoid}:${budgetMode}`)
);
const OBJECTIVE_MAP = {
    'sum-min': { monoid: 'sum', optimization: 'minimize' },
    'sum-max': { monoid: 'sum', optimization: 'maximize' },
    'max-min': { monoid: 'max', optimization: 'minimize' },
    'max-max': { monoid: 'max', optimization: 'maximize' },
    'count-min': { monoid: 'count', optimization: 'minimize' },
    'count-max': { monoid: 'count', optimization: 'maximize' },
    'min-min': { monoid: 'min', optimization: 'minimize' },
    'min-max': { monoid: 'min', optimization: 'maximize' }
};
const SEMIRING_POLARITY = {
    godel: 'higher',
    lukasiewicz: 'higher',
    lukasiewicz_low: 'lower'
};

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

export function deriveObjectiveParts(objective = 'count-min') {
    return OBJECTIVE_MAP[objective] || OBJECTIVE_MAP['count-min'];
}

/**
 * @param {Partial<import('../core/types.js').RunConfig>} config
 * @returns {import('../core/types.js').EffectiveConfig}
 */
export function normalizeConfig(config = {}) {
    const semiringFamily = config.semiringFamily || config.semiring || 'godel';
    const requestedPolarity = config.polarity || 'higher';
    const polarity = semiringFamily === 'godel' ? 'higher' : requestedPolarity;
    const abaRecovery = Boolean(config.abaRecovery);
    const defaultPolicy = abaRecovery ? 'neutral' : (config.defaultPolicy || 'legacy');
    const objective = config.objective || 'count-min';
    const objectiveParts = deriveObjectiveParts(objective);
    const monoid = config.monoid || objectiveParts.monoid;
    const optimization = config.optimization || config.optimize || objectiveParts.optimization;
    const budgetMode = config.budgetMode || config.constraint || 'none';
    const budgetIntent = budgetMode === 'none' ? 'no_discard' : 'bounded';
    const semantics = config.semantics || 'stable';
    const optMode = config.optMode || 'ignore';
    const filterType = config.filterType || 'projection';
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
        abaRecovery,
        defaultPolicy,
        objective,
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

    if (config.semiringKey && !SEMIRING_POLARITY[config.semiringKey]) {
        return `Unsupported semiring "${config.semiringKey}" in the supported playground surface.`;
    }

    if (!wabaModules.defaults[config.defaultPolicy]) {
        return `Unknown default policy "${config.defaultPolicy}".`;
    }

    if (config.objective && !OBJECTIVE_MAP[config.objective]) {
        return `Unknown objective "${config.objective}".`;
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

    if (config.abaRecovery && config.budgetMode !== 'none') {
        return 'ABA recovery cannot be combined with a bounded budget mode.';
    }

    if ((config.budgetMode === 'ub' || config.budgetMode === 'lb')
        && !SUPPORTED_BOUNDED_PAIRS.has(`${config.monoid}:${config.budgetMode}`)) {
        return `Unsupported supported-surface pairing: ${config.monoid} + ${config.budgetMode}. Use sum/max/count + ub or min + lb.`;
    }

    return null;
}

/**
 * @param {import('../core/types.js').EffectiveConfig} config
 * @returns {'bounded'|'unbounded'|'no_discard'}
 */
export function resolveBudgetProfile(config) {
    return config.budgetMode === 'none' || config.abaRecovery ? 'no_discard' : 'bounded';
}

export function shouldLoadObjective(config) {
    return resolveBudgetProfile(config) === 'bounded';
}

export function shouldApplyNumericPostFilter(config) {
    return config.optMode === 'optN' && resolveBudgetProfile(config) === 'bounded';
}

export function resolveSolverOptMode(config) {
    if (resolveBudgetProfile(config) === 'no_discard') {
        return 'ignore';
    }
    return config.optMode;
}

export function getSupportedMetadata() {
    return wabaModules.metadata;
}
