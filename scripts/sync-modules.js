#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PLAYGROUND_ROOT = path.join(__dirname, '..');
const WABA_ROOT = path.join(PLAYGROUND_ROOT, '..', 'WABA');
const OUTPUT_FILE = path.join(PLAYGROUND_ROOT, 'waba-modules.js');

const MANIFEST = {
    core: {
        base: 'core/base.lp'
    },
    semiring: {
        godel: 'semiring/godel.lp',
        lukasiewicz: 'semiring/lukasiewicz.lp',
        lukasiewicz_low: 'semiring/lukasiewicz_low.lp'
    },
    defaults: {
        legacy: 'defaults/legacy.lp',
        aba: 'defaults/aba.lp',
        neutral: 'defaults/neutral.lp'
    },
    monoid: {
        sum: 'monoid/sum.lp',
        max: 'monoid/max.lp',
        min: 'monoid/min.lp',
        count: 'monoid/count.lp'
    },
    optimize: {
        minimize: 'optimize/minimize.lp',
        maximize: 'optimize/maximize.lp'
    },
    constraint: {
        ub: 'constraint/ub.lp',
        lb: 'constraint/lb.lp',
        no_discard: 'constraint/no_discard.lp'
    },
    filter: {
        standard: 'filter/standard.lp',
        projection: 'filter/projection.lp'
    },
    semantics: {
        cf: 'semantics/cf.lp',
        stable: 'semantics/stable.lp',
        admissible: 'semantics/admissible.lp',
        complete: 'semantics/complete.lp',
        subset_maximal_filter: 'semantics/subset_maximal_filter.lp',
        subset_minimal_filter: 'semantics/subset_minimal_filter.lp'
    },
    examples: {
        simple_attack: 'examples/aspartix_test/simple_attack.lp',
        aspforaba_journal_example: 'examples/reference/aspforaba_journal_example.lp',
        strong_inference_bounded_lies: 'examples/reference/strong_inference_bounded_lies.lp',
        expanding_universe_argumentation: 'examples/reference/expanding_universe_argumentation.lp',
        sem_subset_closure_counterattack: 'tests/regression/cases/sem_subset_closure_counterattack.lp'
    },
    metadata: {
        generatedFrom: 'ABA-variants/WABA',
        semiringFamilies: ['godel', 'lukasiewicz'],
        polarities: ['higher', 'lower'],
        supportedSemiringKeys: ['godel', 'lukasiewicz', 'lukasiewicz_low'],
        defaults: ['legacy', 'aba', 'neutral'],
        monoids: ['sum', 'max', 'count', 'min'],
        optimizations: ['minimize', 'maximize'],
        objectives: ['sum-min', 'sum-max', 'max-min', 'max-max', 'count-min', 'count-max', 'min-min', 'min-max'],
        budgetModes: ['none', 'ub', 'lb'],
        supportedSemantics: ['cf', 'stable', 'admissible', 'complete', 'grounded', 'preferred'],
        postFilteredSemantics: ['grounded', 'preferred'],
        canonicalSemiring: {
            godel: { higher: 'godel' },
            lukasiewicz: { higher: 'lukasiewicz', lower: 'lukasiewicz_low' }
        },
        aliases: {},
        supportedBudgetPairs: [
            { monoid: 'sum', budgetMode: 'ub' },
            { monoid: 'max', budgetMode: 'ub' },
            { monoid: 'count', budgetMode: 'ub' },
            { monoid: 'min', budgetMode: 'lb' }
        ]
    }
};

function escapeTemplateLiteral(content) {
    return content.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

function resolveIncludes(content, basedir, visited = new Set()) {
    const includePattern = /#include\s+"([^"]+)"\.?/g;
    return content.replace(includePattern, (match, relativePath) => {
        const includePath = path.resolve(basedir, relativePath);
        if (visited.has(includePath)) {
            throw new Error(`Circular include detected at ${includePath}`);
        }
        if (!fs.existsSync(includePath)) {
            throw new Error(`Missing include ${relativePath} referenced from ${basedir}`);
        }
        visited.add(includePath);
        const includedContent = fs.readFileSync(includePath, 'utf8');
        return resolveIncludes(includedContent, path.dirname(includePath), visited);
    });
}

function readModule(relativePath) {
    const absolutePath = path.join(WABA_ROOT, relativePath);
    if (!fs.existsSync(absolutePath)) {
        throw new Error(`Required module not found: ${relativePath}`);
    }
    const raw = fs.readFileSync(absolutePath, 'utf8');
    return resolveIncludes(raw, path.dirname(absolutePath), new Set([absolutePath]));
}

function loadSection(sectionName, entries) {
    const result = {};
    for (const [key, relativePath] of Object.entries(entries)) {
        result[key] = readModule(relativePath);
    }
    return result;
}

function serializeSection(sectionObject, indent = '    ') {
    return Object.entries(sectionObject)
        .map(([key, value]) => `${indent}${JSON.stringify(key)}: \`${escapeTemplateLiteral(value)}\``)
        .join(',\n');
}

function serializeMetadata(metadata) {
    return JSON.stringify(metadata, null, 4)
        .split('\n')
        .map((line, index) => (index === 0 ? line : `    ${line}`))
        .join('\n');
}

console.log('Syncing mature WABA modules into waba-modules.js');

const core = loadSection('core', MANIFEST.core);
const semiring = loadSection('semiring', MANIFEST.semiring);
const defaults = loadSection('defaults', MANIFEST.defaults);
const monoid = loadSection('monoid', MANIFEST.monoid);
const optimize = loadSection('optimize', MANIFEST.optimize);
const constraint = loadSection('constraint', MANIFEST.constraint);
const filter = loadSection('filter', MANIFEST.filter);
const semantics = loadSection('semantics', MANIFEST.semantics);
const examples = loadSection('examples', MANIFEST.examples);

const output = `// AUTO-GENERATED by scripts/sync-modules.js
// DO NOT EDIT MANUALLY
// Last updated: ${new Date().toISOString()}

export const wabaModules = {
    core: {
${serializeSection(core, '        ')}
    },
    semiring: {
${serializeSection(semiring, '        ')}
    },
    defaults: {
${serializeSection(defaults, '        ')}
    },
    monoid: {
${serializeSection(monoid, '        ')}
    },
    optimize: {
${serializeSection(optimize, '        ')}
    },
    constraint: {
${serializeSection(constraint, '        ')}
    },
    filter: {
${serializeSection(filter, '        ')}
    },
    semantics: {
${serializeSection(semantics, '        ')}
    },
    examples: {
${serializeSection(examples, '        ')}
    },
    metadata: ${serializeMetadata(MANIFEST.metadata)}
};
`;

fs.writeFileSync(OUTPUT_FILE, output, 'utf8');

console.log(`Generated ${OUTPUT_FILE}`);
