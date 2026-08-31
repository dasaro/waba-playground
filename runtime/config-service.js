import { wabaModules } from '../waba-modules.js?v=20260831-1';
export { validateFrameworkSource } from './framework-source-validator.js?v=20260831-1';

const SUPPORTED_SEMANTICS = new Set(wabaModules.metadata.supportedSemantics);
const SUPPORTED_BOUNDED_PAIRS = new Set(
    wabaModules.metadata.supportedBudgetPairs.map(({ monoid, budgetMode }) => `${monoid}:${budgetMode}`)
);
const SUPPORTED_BUDGET_MODES = new Set(wabaModules.metadata.budgetModes);
const SUPPORTED_OPT_MODES = new Set(['ignore', 'optN']);
const OBJECTIVE_MAP = {
    'sum-min': { monoid: 'sum', optimization: 'minimize' },
    'sum-max': { monoid: 'sum', optimization: 'maximize' },
    'max-min': { monoid: 'max', optimization: 'minimize' },
    'max-max': { monoid: 'max', optimization: 'maximize' },
    'min-min': { monoid: 'min', optimization: 'minimize' },
    'min-max': { monoid: 'min', optimization: 'maximize' }
};
const DEFAULT_OBJECTIVE = 'sum-min';
// Polarity per semiring module key, DERIVED from the bundle.
//
// This used to be a hand-written table, re-typed from the .lp files -- along with a
// RECOMMENDED_BUDGET table, an `isLukasiewicz` special case and a prose table elsewhere. Every
// bound direction in the app follows from the polarity, so a mistyped entry produced a control
// that looked right and computed the wrong thing, and adding an algebra to WABA/ meant editing
// four JS files plus an <option> list. The generator now reads `oplus(max|min).` straight out
// of each module, so there is exactly one source.
export const SEMIRING_INFO = wabaModules.metadata.semiringInfo || {};
const SEMIRING_POLARITY = Object.fromEntries(
    Object.entries(SEMIRING_INFO).map(([key, info]) => [key, info.polarity])
);

/** The algebras a user may pick: every module that is not an alias for another. */
export function selectableSemirings() {
    return Object.entries(SEMIRING_INFO)
        .filter(([, info]) => !info.aliasOf)
        .map(([key, info]) => ({ key, ...info }));
}

/** The tunable constants an algebra declares (`#const k = 1000.` -> one control, and -c k). */
export function semiringConstants(semiringKey) {
    return SEMIRING_INFO[semiringKey]?.constants || [];
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
    // Both legacy family names are also concrete modules. Their module polarity is therefore
    // the canonical default, matching bin/waba (godel -> higher, tropical -> lower).
    const familyPolarity = config.polarity
        || (explicitFamily ? SEMIRING_POLARITY[explicitFamily] : null)
        || 'higher';
    const semiringKey = explicitFamily
        ? resolveSemiringModuleKey(explicitFamily, familyPolarity)
        : (config.semiring || 'godel');
    const polarity = explicitFamily
        ? familyPolarity
        : (SEMIRING_POLARITY[semiringKey] || 'higher');
    const semiringFamily = explicitFamily || SEMIRING_FAMILY_OF[semiringKey] || semiringKey;
    const abaRecovery = Boolean(config.abaRecovery);
    // 'legacy' was retired from the surface: it contributes a single constant (delta) that is
    // identical to 'neutral' for godel/arctic/lukasiewicz/bottleneck_cost and identical to
    // 'aba' for tropical, so every (algebra, legacy) pair is reachable without it. Saved
    // configs naming it are mapped rather than rejected.
    const requestedPolicy = config.defaultPolicy === 'legacy'
        ? (config.semiring === 'tropical' || config.semiringKey === 'tropical' ? 'aba' : 'neutral')
        : config.defaultPolicy;
    const defaultPolicy = abaRecovery ? 'neutral' : (requestedPolicy || 'neutral');
    const objective = config.objective || DEFAULT_OBJECTIVE;
    const objectiveParts = deriveObjectiveParts(objective);
    const monoid = config.monoid || objectiveParts.monoid;
    const optimization = config.optimization || config.optimize || objectiveParts.optimization;
    const budgetMode = config.budgetMode || config.constraint || 'none';
    const budgetIntent = budgetMode === 'none' ? 'no_discard' : 'bounded';
    const semantics = config.semantics || 'stable';
    const optMode = config.optMode || 'ignore';
    const filterType = config.filterType || 'projection';
    const betaInput = config.beta ?? config.budget ?? 0;
    const parsedBeta = typeof betaInput === 'number' ? betaInput : Number(betaInput);
    const requestedBeta = Number.isFinite(parsedBeta) ? parsedBeta : 0;
    // ABA recovery is structural for every semantics: constraint/no_discard.lp forbids the
    // one common discard set D before ordinary sigma semantics is checked. beta is therefore
    // irrelevant in recovery mode; normalise it to zero for a stable, truthful run summary.
    const beta = abaRecovery ? 0 : requestedBeta;
    const numModels = Number.isFinite(config.numModels) ? config.numModels : parseInt(config.numModels || '0', 10) || 0;
    const timeout = Number.isFinite(config.timeout) ? config.timeout : 60000;
    const lukDefault = semiringConstants('lukasiewicz')
        .find(({ name }) => name === 'k')?.default ?? 1000;
    const parsedLukK = typeof config.lukK === 'number' ? config.lukK : Number(config.lukK);
    const lukK = Number.isFinite(parsedLukK) ? parsedLukK : lukDefault;
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

    if (!SUPPORTED_BUDGET_MODES.has(config.budgetMode)) {
        return `Unknown budget mode "${config.budgetMode}".`;
    }

    if (!SUPPORTED_OPT_MODES.has(config.optMode)) {
        return `Unknown solver result mode "${config.optMode}".`;
    }

    if (!Number.isInteger(config.beta)) {
        return `Budget beta must be an integer, got "${config.beta}".`;
    }

    if (config.semiringKey === 'lukasiewicz'
        && (!Number.isInteger(config.lukK) || config.lukK <= 0)) {
        return `Łukasiewicz bound k must be a positive integer, got "${config.lukK}".`;
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
    // Every supported semantics uses the same external discard, monoid and bound modules.
    // The only no-discard cases are an explicit plain-ABA reading and ABA recovery.
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
