import { wabaModules } from '../waba-modules.js?v=20260315-1';

const REQUIRED_SECTIONS = ['core', 'semiring', 'defaults', 'monoid', 'optimize', 'constraint', 'filter', 'semantics', 'examples', 'metadata'];
const REQUIRED_METADATA_KEYS = [
    'generatedFrom',
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

    if (!Array.isArray(modules.metadata.supportedSemantics) || modules.metadata.supportedSemantics.length === 0) {
        throw new Error('wabaModules.metadata.supportedSemantics must be a non-empty array.');
    }

    if (!Array.isArray(modules.metadata.supportedBudgetPairs)) {
        throw new Error('wabaModules.metadata.supportedBudgetPairs must be an array.');
    }

    return true;
}
