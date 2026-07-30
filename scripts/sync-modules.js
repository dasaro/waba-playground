#!/usr/bin/env node
/**
 * Regenerate waba-modules.js from the canonical WABA tree.
 *
 * This is a DELEGATOR, not a second generator. The bundling policy (which modules are
 * discovered, which semantics are derived by post-filtering, which semiring keys are
 * selectable) lives in exactly one place -- `bin/sync-playground.mjs` inside the WABA
 * source tree -- so the playground can no longer drift from the CLI because two forked
 * copies of the same script disagreed about the module set.
 *
 * Source of truth: ../WABA  (override with WABA_ROOT=/path/to/WABA).
 *
 * A tree without `bin/sync-playground.mjs` predates the modular core and cannot describe
 * the current surface, so we refuse it rather than silently emitting a stale bundle.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const PLAYGROUND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WABA_ROOT = process.env.WABA_ROOT || path.join(PLAYGROUND_ROOT, '..', 'WABA');
const OUTPUT_FILE = path.join(PLAYGROUND_ROOT, 'waba-modules.js');
const GENERATOR = path.join(WABA_ROOT, 'bin', 'sync-playground.mjs');

if (!fs.existsSync(GENERATOR)) {
    console.error(`Cannot sync: no generator at ${GENERATOR}`);
    console.error(`WABA_ROOT=${WABA_ROOT} is not a current WABA checkout.`);
    console.error('Point WABA_ROOT at the WABA tree that owns bin/sync-playground.mjs, e.g.');
    console.error('  WABA_ROOT=/path/to/GitHub-WABA/WABA npm run sync');
    process.exit(1);
}

console.log(`Syncing WABA modules from ${WABA_ROOT}`);
const result = spawnSync(process.execPath, [GENERATOR, OUTPUT_FILE], {
    stdio: 'inherit',
    env: { ...process.env, WABA_ROOT }
});
process.exit(result.status ?? 1);
