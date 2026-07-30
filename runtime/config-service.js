import { wabaModules } from '../waba-modules.js?v=20260730-1';

const SUPPORTED_SEMANTICS = new Set(wabaModules.metadata.supportedSemantics);
const SUPPORTED_BOUNDED_PAIRS = new Set(
    wabaModules.metadata.supportedBudgetPairs.map(({ monoid, budgetMode }) => `${monoid}:${budgetMode}`)
);
const OBJECTIVE_MAP = {
    'sum-min': { monoid: 'sum', optimization: 'minimize' },
    'sum-max': { monoid: 'sum', optimization: 'maximize' },
    'max-min': { monoid: 'max', optimization: 'minimize' },
    'max-max': { monoid: 'max', optimization: 'maximize' },
    'min-min': { monoid: 'min', optimization: 'minimize' },
    'min-max': { monoid: 'min', optimization: 'maximize' }
};
const DEFAULT_OBJECTIVE = 'sum-min';
// Polarity per bundle semiring module key (also the semiring allow-list in validateConfig).
const SEMIRING_POLARITY = {
    godel: 'higher',
    godel_low: 'lower',
    tropical: 'lower',
    tropical_high: 'higher',
    arctic: 'higher',
    bottleneck_cost: 'lower',
    // Łukasiewicz is a standalone family (bounded-sum ⊗, ⊕=max) with no polarity
    // variants — it resolves directly to itself. Listed here so validateConfig
    // accepts it as a supported semiring.
    lukasiewicz: 'higher'
};

// wABA budgeted DEFENCE (Dunne et al. AIJ 2011 Def 6, lifted to structured ABA). These take
// beta directly -- their own SUM inconsistency budget lives inside the module -- and compose
// with no_discard, so they take no monoid/bound pairing. Mirrors bin/waba's set of the same
// name. Any semantics that is not directly budgeted (cf/stable) is one of these.
const DIRECTLY_BUDGETED_SEMANTICS = new Set(['cf', 'stable']);
export function isBudgetedDefence(semantics) {
    return SUPPORTED_SEMANTICS.has(semantics) && !DIRECTLY_BUDGETED_SEMANTICS.has(semantics);
}

// Reverse of metadata.canonicalSemiring: module key -> the family it is the variant of.
const SEMIRING_FAMILY_OF = Object.fromEntries(
    Object.entries(wabaModules.metadata.canonicalSemiring).flatMap(
        ([family, byPolarity]) => Object.values(byPolarity).map((key) => [key, family])
    )
);

export function resolveSemiringModuleKey(semiringFamily, polarity) {
    // A canonical family (godel/tropical) MUST be resolved by polarity FIRST: both
    // family names are themselves valid module keys, so short-circuiting on
    // wabaModules.semiring[semiringFamily] would ignore polarity entirely
    // (godel+lower would wrongly stay godel instead of bottleneck_cost, and
    // tropical+higher would stay tropical instead of arctic).
    const familyEntry = wabaModules.metadata.canonicalSemiring[semiringFamily];
    if (familyEntry) {
        const moduleKey = familyEntry[polarity];
        if (!moduleKey || !wabaModules.semiring[moduleKey]) {
            throw new Error(`No semiring module for ${semiringFamily} with ${polarity} polarity.`);
        }
        return moduleKey;
    }
    // Otherwise the family is already a concrete module key (e.g. a direct 'arctic').
    if (wabaModules.semiring[semiringFamily]) {
        return semiringFamily;
    }
    throw new Error(`Unknown semiring family "${semiringFamily}".`);
}

export function getAliasLabel(semiringFamily, polarity) {
    const aliases = Object.entries(wabaModules.metadata.aliases);
    const match = aliases.find(([, value]) => value.family === semiringFamily && value.polarity === polarity);
    return match ? match[0] : null;
}

export function deriveObjectiveParts(objective = DEFAULT_OBJECTIVE) {
    return OBJECTIVE_MAP[objective] || OBJECTIVE_MAP[DEFAULT_OBJECTIVE];
}

/**
 * @param {Partial<import('../core/types.js').RunConfig>} config
 * @returns {import('../core/types.js').EffectiveConfig}
 */
export function normalizeConfig(config = {}) {
    // The control surface names the algebra directly. A direct module key must never be
    // re-resolved through canonicalSemiring: 'tropical' is BOTH a family name and a module
    // key, so resolving it as a family with the default 'higher' polarity would silently
    // hand back arctic. Only an explicit semiringFamily takes the resolution path (kept so
    // saved/legacy configs still load).
    const explicitFamily = config.semiringFamily || null;
    const semiringKey = explicitFamily
        ? resolveSemiringModuleKey(explicitFamily, config.polarity || 'higher')
        : (config.semiring || 'godel');
    const polarity = explicitFamily
        ? (config.polarity || 'higher')
        : (SEMIRING_POLARITY[semiringKey] || 'higher');
    const semiringFamily = explicitFamily || SEMIRING_FAMILY_OF[semiringKey] || semiringKey;
    const abaRecovery = Boolean(config.abaRecovery);
    const defaultPolicy = abaRecovery ? 'neutral' : (config.defaultPolicy || 'legacy');
    const objective = config.objective || DEFAULT_OBJECTIVE;
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
    const lukK = Number.isFinite(config.lukK) ? config.lukK : parseInt(config.lukK || '10', 10) || 10;
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
        timeout,
        lukK
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
        return `Unsupported supported-surface pairing: ${config.monoid} + ${config.budgetMode}. Use sum/max + ub or min + lb.`;
    }

    return null;
}

/**
 * @param {import('../core/types.js').EffectiveConfig} config
 * @returns {'bounded'|'unbounded'|'no_discard'}
 */
export function resolveBudgetProfile(config) {
    // Budgeted-defence uses its OWN sum budget inside the module (no monoid/constraint),
    // so it rides the no-discard profile (base discards pinned off) with beta passed through.
    if (isBudgetedDefence(config.semantics)) {
        return 'no_discard';
    }
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
