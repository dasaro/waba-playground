#!/usr/bin/env node

// Auto-discovering sync: bundle the CANONICAL WABA modules into waba-modules.js.
//
// Scans the WABA tree (semiring/, monoid/, semantics/, examples/, ...) instead of
// a hardcoded manifest, so adding/removing a module propagates automatically and
// the bundle can no longer silently drift from the source of truth.
//
// Source of truth: ../WABA  (override with WABA_ROOT=/path/to/WABA).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PLAYGROUND_ROOT = path.join(__dirname, '..');
const WABA_ROOT = process.env.WABA_ROOT || path.join(PLAYGROUND_ROOT, '..', 'WABA');
const OUTPUT_FILE = path.join(PLAYGROUND_ROOT, 'waba-modules.js');

const SINGLE = { core: { base: 'core/base.lp' } };
const DIRS = {
    semiring: 'semiring',
    defaults: 'defaults',
    monoid: 'monoid',
    optimize: 'optimize',
    constraint: 'constraint',
    filter: 'filter',
    semantics: 'semantics'
};

// Structural policy mirroring WABA/bin/waba (the supported CLI surface).
// Only the *shape* lives here; the module SET is discovered from disk.
const POLICY = {
    semiringFamilies: ['godel', 'tropical'],
    polarities: ['higher', 'lower'],
    canonicalSemiring: {
        godel: { higher: 'godel', lower: 'bottleneck_cost' },
        tropical: { higher: 'arctic', lower: 'tropical' }
    },
    aliases: {
        godel_low: { family: 'godel', polarity: 'lower' },
        tropical_high: { family: 'tropical', polarity: 'higher' }
    },
    supportedSemantics: ['cf', 'stable', 'admissible', 'complete', 'grounded', 'preferred'],
    postFilteredSemantics: ['grounded', 'preferred'],
    budgetSide: { sum: 'ub', max: 'ub', min: 'lb' }
};

function escapeTemplateLiteral(content) {
    return content.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

function resolveIncludes(content, basedir, visited = new Set()) {
    const includePattern = /#include\s+"([^"]+)"\.?/g;
    return content.replace(includePattern, (match, relativePath) => {
        const includePath = path.resolve(basedir, relativePath);
        if (visited.has(includePath)) throw new Error(`Circular include at ${includePath}`);
        if (!fs.existsSync(includePath)) throw new Error(`Missing include ${relativePath} from ${basedir}`);
        visited.add(includePath);
        return resolveIncludes(fs.readFileSync(includePath, 'utf8'), path.dirname(includePath), visited);
    });
}

function readModule(relativePath) {
    const abs = path.join(WABA_ROOT, relativePath);
    if (!fs.existsSync(abs)) throw new Error(`Required module not found: ${relativePath} (WABA_ROOT=${WABA_ROOT})`);
    return resolveIncludes(fs.readFileSync(abs, 'utf8'), path.dirname(abs), new Set([abs]));
}

function discoverDir(relDir) {
    const absDir = path.join(WABA_ROOT, relDir);
    if (!fs.existsSync(absDir)) throw new Error(`Required directory not found: ${relDir} (WABA_ROOT=${WABA_ROOT})`);
    const result = {};
    for (const file of fs.readdirSync(absDir).sort()) {
        if (!file.endsWith('.lp')) continue;
        // Skip `_`-prefixed include fragments (e.g. semiring/_phase.lp,
        // _idempotent.lp, _additive.lp): they are inlined into the real modules
        // via resolveIncludes, not standalone selectable modules.
        if (file.startsWith('_')) continue;
        result[path.basename(file, '.lp')] = readModule(path.join(relDir, file));
    }
    return result;
}

function loadSingle(entries) {
    const result = {};
    for (const [key, rel] of Object.entries(entries)) result[key] = readModule(rel);
    return result;
}

function discoverExamples() {
    const root = path.join(WABA_ROOT, 'examples');
    const result = {};
    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })
            .sort((a, b) => a.name.localeCompare(b.name))) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (entry.name.endsWith('.lp')) {
                result[path.basename(entry.name, '.lp')] =
                    resolveIncludes(fs.readFileSync(full, 'utf8'), path.dirname(full), new Set([full]));
            }
        }
    };
    if (fs.existsSync(root)) walk(root);
    return result;
}

function serializeSection(sectionObject, indent = '        ') {
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

console.log(`Syncing WABA modules from ${WABA_ROOT}`);

const core = loadSingle(SINGLE.core);
const sections = {};
for (const [name, rel] of Object.entries(DIRS)) sections[name] = discoverDir(rel);
const examples = discoverExamples();

const monoids = Object.keys(sections.monoid);
const optimizations = Object.keys(sections.optimize).filter((k) => k === 'minimize' || k === 'maximize');
const objectives = [];
for (const m of monoids) for (const dir of ['min', 'max']) objectives.push(`${m}-${dir}`);
const supportedBudgetPairs = monoids
    .filter((m) => POLICY.budgetSide[m])
    .map((m) => ({ monoid: m, budgetMode: POLICY.budgetSide[m] }));

const metadata = {
    generatedFrom: 'ABA-variants/WABA',
    semiringFamilies: POLICY.semiringFamilies,
    polarities: POLICY.polarities,
    supportedSemiringKeys: Object.keys(sections.semiring),
    defaults: Object.keys(sections.defaults),
    monoids,
    optimizations,
    objectives,
    budgetModes: ['none', 'ub', 'lb'],
    supportedSemantics: POLICY.supportedSemantics,
    postFilteredSemantics: POLICY.postFilteredSemantics,
    canonicalSemiring: POLICY.canonicalSemiring,
    aliases: POLICY.aliases,
    supportedBudgetPairs
};

const output = `// AUTO-GENERATED by scripts/sync-modules.js (auto-discovering)
// DO NOT EDIT MANUALLY
// Source of truth: ${metadata.generatedFrom}

export const wabaModules = {
    core: {
${serializeSection(core)}
    },
    semiring: {
${serializeSection(sections.semiring)}
    },
    defaults: {
${serializeSection(sections.defaults)}
    },
    monoid: {
${serializeSection(sections.monoid)}
    },
    optimize: {
${serializeSection(sections.optimize)}
    },
    constraint: {
${serializeSection(sections.constraint)}
    },
    filter: {
${serializeSection(sections.filter)}
    },
    semantics: {
${serializeSection(sections.semantics)}
    },
    examples: {
${serializeSection(examples)}
    },
    metadata: ${serializeMetadata(metadata)}
};
`;

fs.writeFileSync(OUTPUT_FILE, output, 'utf8');
console.log(`Generated ${OUTPUT_FILE}`);
console.log(`  semirings: ${metadata.supportedSemiringKeys.join(', ')}`);
console.log(`  monoids:   ${metadata.monoids.join(', ')}`);
console.log(`  objectives:${metadata.objectives.join(', ')}`);
console.log(`  examples:  ${Object.keys(examples).length}`);
