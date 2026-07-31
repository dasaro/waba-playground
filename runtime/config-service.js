import { wabaModules } from '../waba-modules.js?v=20260731-3';

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

// wABA budgeted DEFENCE (Dunne et al. AIJ 2011 Def 6, lifted to structured ABA). Detected in
// the generator by whether the module prices a `pay` set -- that is exactly what makes it carry
// its own budget, take beta directly and reject a monoid/bound pairing. It was a literal
// ['admissible','complete','preferred'] in four places.
const SEMANTICS_INFO = wabaModules.metadata.semanticsInfo || {};
export function isBudgetedDefence(semantics) {
    return Boolean(SEMANTICS_INFO[semantics]?.defence);
}

/** True when this semantics' bound direction follows the algebra's polarity. */
export function hasPolarityDependentBound(semantics) {
    return Boolean(SEMANTICS_INFO[semantics]?.polarityDependentBound);
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
    const requestedBeta = Number.isFinite(config.beta)
        ? config.beta
        : parseInt(config.beta || config.budget || '0', 10) || 0;
    // ABA recovery means NOTHING may be conceded. constraint/no_discard.lp pins the base
    // discard set, but the defence semantics price their own `pay` set, which it does not touch
    // -- so a left-over beta was still being spent and recovery returned 7 extensions instead of
    // 1 on the default example. Zeroed here, at the one point every config passes through, so a
    // preset or a restored config cannot bypass it either. bin/waba refuses the combination
    // outright (`--aba-recovery cannot be combined with ... --beta`).
    // ABA recovery means NOTHING may be conceded -- but WHICH beta achieves that depends on
    // the polarity, and zero is only right for half the algebras.
    //
    // semantics/admissible.lp derives its bound from the polarity: `oplus(max)` forbids any pay
    // at beta = 0, whereas `oplus(min)` imposes `#min{paid} >= beta`, for which beta = 0 is
    // VACUOUS and recovery arrives at a beta above every attack weight (CLAUDE.md: "the
    // recovery budget is not universally 0"). So on Tropical or Bottleneck-cost with a defence
    // semantics, recovery was pinning the most PERMISSIVE end and returning budget-relaxed sets
    // while claiming to recover classical ABA -- with the beta field disabled, so the user
    // could not correct it.
    //
    // The conflict-based path is unaffected: it loads constraint/no_discard.lp, which forbids
    // every discard outright and ignores beta entirely.
    const needsHighBeta = abaRecovery
        && isBudgetedDefence(config.semantics)
        && polarity === 'lower';
    // Above any weight a framework realistically declares; core/base.lp requires integers, and
    // clingo's integer range comfortably exceeds this.
    const RECOVERY_CEILING = 1073741824;
    const beta = abaRecovery ? (needsHighBeta ? RECOVERY_CEILING : 0) : requestedBeta;
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
