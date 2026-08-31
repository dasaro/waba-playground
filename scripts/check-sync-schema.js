#!/usr/bin/env node
/**
 * Gate check for waba-modules.js.
 *
 *  1. SHAPE      — every expected section/metadata key is present.
 *  2. FRESHNESS  — the bundled .lp text still matches the WABA sources it was generated
 *     from. Shape validation alone cannot see staleness: a bundle carrying a superseded
 *     copy of a semiring has a perfectly valid shape while silently giving the playground
 *     different mathematics from the CLI.
 *
 * Freshness is checked only when the source tree is actually available (it lives outside
 * this repo), otherwise it is reported as skipped rather than failing the gate.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { validateWabaModulesShape } from '../runtime/module-schema.js';
import { wabaModules } from '../waba-modules.js';
import { resolveWabaRoot } from './waba-root.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Resolved by CONTENT -- see scripts/waba-root.js for why position is not enough.
const { root: FOUND_ROOT, explicit: ROOT_EXPLICIT } = resolveWabaRoot(ROOT);
const WABA_ROOT = FOUND_ROOT || process.env.WABA_ROOT || path.join(ROOT, '..', 'WABA');

validateWabaModulesShape();
console.log('waba-modules schema check passed.');

const SECTION_DIRS = {
    core: 'core',
    semiring: 'semiring',
    defaults: 'defaults',
    monoid: 'monoid',
    optimize: 'optimize',
    constraint: 'constraint',
    semantics: 'semantics',
    filter: 'filter'
};
const SINGLE_FILES = {
    'validate.framework': 'validate.lp'
};

function resolveIncludes(content, basedir) {
    return content.replace(/#include\s+"([^"]+)"\.?/g, (match, rel) => {
        const target = path.resolve(basedir, rel);
        if (!fs.existsSync(target)) {
            return match;
        }
        return resolveIncludes(fs.readFileSync(target, 'utf8'), path.dirname(target));
    });
}

// Strict whenever a real source tree was located: at that point "cannot check" means the
// bundle and the tree disagree about which modules exist, which is exactly the staleness this
// gate is for. Keying strictness on `process.env.WABA_ROOT` instead left it off in the one
// invocation that matters, since nothing in package.json sets it.
// A genuine fresh clone with no core tree beside it still skips; WABA_STRICT_SYNC=1 forces
// even that to fail.
const strict = Boolean(FOUND_ROOT) || ROOT_EXPLICIT || process.env.WABA_STRICT_SYNC === '1';

function cannotCheck(reason) {
    if (strict) {
        console.error(`waba-modules freshness check FAILED: ${reason}`);
        console.error(ROOT_EXPLICIT
            ? 'WABA_ROOT was set explicitly, so it is authoritative: point it at the WABA '
                + 'checkout that owns this bundle (the one carrying bin/sync-playground.mjs), '
                + 'or unset it to let the check locate that tree itself.'
            : 'A WABA checkout was located, so the bundle must match it. Re-run `npm run sync`.');
        process.exit(1);
    }
    console.log(`waba-modules freshness check SKIPPED: ${reason}`);
    process.exit(0);
}

if (!fs.existsSync(path.join(WABA_ROOT, 'core', 'base.lp'))) {
    cannotCheck(`no WABA sources at ${WABA_ROOT}`);
}

const stale = [];
const missing = [];
for (const [section, dir] of Object.entries(SECTION_DIRS)) {
    const bundled = wabaModules[section] || {};
    for (const [key, text] of Object.entries(bundled)) {
        const file = path.join(WABA_ROOT, dir, `${key}.lp`);
        if (!fs.existsSync(file)) {
            missing.push(`${section}.${key} (no ${path.relative(WABA_ROOT, file)})`);
            continue;
        }
        const expected = resolveIncludes(fs.readFileSync(file, 'utf8'), path.join(WABA_ROOT, dir));
        if (expected.trim() !== String(text).trim()) {
            stale.push(`${section}.${key}`);
        }
    }
}

for (const [qualifiedKey, relativeFile] of Object.entries(SINGLE_FILES)) {
    const [section, key] = qualifiedKey.split('.');
    const file = path.join(WABA_ROOT, relativeFile);
    if (!fs.existsSync(file)) {
        missing.push(`${qualifiedKey} (no ${relativeFile})`);
        continue;
    }
    const expected = resolveIncludes(fs.readFileSync(file, 'utf8'), path.dirname(file));
    const bundled = wabaModules[section]?.[key];
    if (typeof bundled !== 'string' || expected.trim() !== bundled.trim()) {
        stale.push(qualifiedKey);
    }
}

// Examples are generated recursively and keyed by basename. Check both their content and the
// key set: otherwise editing, adding, or removing a shipped framework could leave the UI on a
// different public surface while every logic module still passed freshness.
const sourceExamples = {};
const examplesRoot = path.join(WABA_ROOT, 'examples');
const walkExamples = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walkExamples(full);
        else if (entry.name.endsWith('.lp')) {
            const key = path.basename(entry.name, '.lp');
            sourceExamples[key] = resolveIncludes(fs.readFileSync(full, 'utf8'), path.dirname(full));
        }
    }
};
if (fs.existsSync(examplesRoot)) walkExamples(examplesRoot);
const bundledExamples = wabaModules.examples || {};
for (const [key, expected] of Object.entries(sourceExamples)) {
    if (!(key in bundledExamples) || expected.trim() !== String(bundledExamples[key]).trim()) {
        stale.push(`examples.${key}`);
    }
}
for (const key of Object.keys(bundledExamples)) {
    if (!(key in sourceExamples)) missing.push(`examples.${key} (no matching source example)`);
}

// A tree that is missing modules the bundle contains is not the tree the bundle was
// generated from (the default WABA_ROOT is a sibling path that may hold an older or
// unrelated checkout). Treat that as "cannot check", not as a failure - only a tree that
// supplies every bundled module can witness genuine staleness.
if (missing.length > 0) {
    cannotCheck(`${WABA_ROOT} is not the source tree `
        + `(${missing.length} bundled module(s) absent there, e.g. ${missing[0]})`);
}

if (stale.length > 0) {
    console.error(`\nwaba-modules is STALE - these differ from ${WABA_ROOT}:`);
    stale.forEach((entry) => console.error(`  - ${entry}`));
    console.error(`\nRegenerate with:  WABA_ROOT=${WABA_ROOT} node scripts/sync-modules.js\n`);
    process.exit(1);
}

console.log(`waba-modules freshness check passed (matches ${WABA_ROOT}).`);
