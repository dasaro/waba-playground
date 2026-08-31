import { wabaModules } from '../waba-modules.js?v=20260831-1';

const REQUIRED_SECTIONS = ['core', 'validate', 'semiring', 'defaults', 'monoid', 'optimize', 'constraint', 'filter', 'semantics', 'examples', 'metadata'];
const REQUIRED_METADATA_KEYS = [
    'generatedFrom',
    'inputPolicy',
    'semiringFamilies',
    'polarities',
    'supportedSemiringKeys',
    'defaults',
    'monoids',
    'optimizations',
    'objectives',
    'budgetModes',
    'supportedSemantics',
    'postFilteredSemantics',
    'derivedSemantics',
    'semanticFilters',
    'semanticAuxiliaries',
    'semanticsInfo',
    'canonicalSemiring',
    'aliases',
    'supportedBudgetPairs'
];

export function validateWabaModulesShape(modules = wabaModules) {
    for (const key of REQUIRED_SECTIONS) {
        if (!modules[key]) {
            throw new Error(`wabaModules is missing required section "${key}".`);
        }
    }

    for (const key of REQUIRED_METADATA_KEYS) {
        if (!(key in modules.metadata)) {
            throw new Error(`wabaModules.metadata is missing required key "${key}".`);
        }
    }

    if (typeof modules.validate.framework !== 'string' || modules.validate.framework.length === 0) {
        throw new Error('wabaModules.validate.framework must contain the pre-flight program.');
    }

    if (Object.keys(modules.examples).length === 0) {
        throw new Error('wabaModules.examples must contain the generated example surface.');
    }

    if (!Array.isArray(modules.metadata.supportedSemantics) || modules.metadata.supportedSemantics.length === 0) {
        throw new Error('wabaModules.metadata.supportedSemantics must be a non-empty array.');
    }

    if (!Array.isArray(modules.metadata.supportedBudgetPairs)) {
        throw new Error('wabaModules.metadata.supportedBudgetPairs must be an array.');
    }

    const inputPolicy = modules.metadata.inputPolicy;
    const expectedFrameworkPredicates = { assumption: 1, contrary: 2, head: 2, body: 2, weight: 2 };
    if (JSON.stringify(inputPolicy?.frameworkPredicates) !== JSON.stringify(expectedFrameworkPredicates)
        || !Array.isArray(inputPolicy?.reservedPredicates)
        || !Array.isArray(inputPolicy?.reservedConstants)
        || !inputPolicy?.authoritativeConstants?.includes('beta')
        || !inputPolicy?.authoritativeConstants?.includes('k')
        || !inputPolicy?.allowedDirectives?.includes('const')
        || !inputPolicy?.allowedDirectives?.includes('include')) {
        throw new Error('wabaModules.metadata.inputPolicy must define the five input signatures and reserved predicates.');
    }

    for (const semantics of modules.metadata.supportedSemantics) {
        if (modules.metadata.semanticsInfo?.[semantics]?.betaSigma !== true) {
            throw new Error(`wabaModules.metadata.semanticsInfo.${semantics} must declare betaSigma=true.`);
        }
    }

    for (const semantics of modules.metadata.postFilteredSemantics) {
        const candidate = modules.metadata.derivedSemantics?.[semantics];
        const filter = modules.metadata.semanticFilters?.[semantics];
        if (!candidate || typeof modules.semantics[candidate] !== 'string') {
            throw new Error(`Post-filtered semantics "${semantics}" has no bundled candidate module.`);
        }
        if (!filter || typeof modules.semantics[filter] !== 'string') {
            throw new Error(`Post-filtered semantics "${semantics}" has no bundled exact filter.`);
        }
        const auxiliary = modules.metadata.semanticAuxiliaries?.[semantics];
        if (auxiliary && typeof modules.semantics[auxiliary] !== 'string') {
            throw new Error(`Post-filtered semantics "${semantics}" has no bundled auxiliary module.`);
        }
    }

    return true;
}
