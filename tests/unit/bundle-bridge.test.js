import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { resolveWabaRoot } from '../../scripts/waba-root.js';

// THE BRIDGE. Everything the UI needs to offer an algebra or a semantics is declared in the
// .lp sources; the generator extracts it and the playground reads it. Before this, adding an
// algebra to WABA/ meant editing an <option> list, a polarity table, a recommended-pairing
// table, a prose table and an `isLukasiewicz` special case -- and any one left stale produced
// a control that looked right and computed something else.
//
// This test drops a NEW algebra into a copy of the core tree, runs the real generator, and
// asserts the metadata the UI consumes is correct without touching a line of website code.

const PLAYGROUND = fileURLToPath(new URL('../..', import.meta.url));
const { root: WABA_ROOT } = resolveWabaRoot(PLAYGROUND);

test('a new .lp algebra propagates to the UI metadata with no website edit', { skip: !WABA_ROOT }, () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'waba-bridge-'));
    try {
        fs.cpSync(WABA_ROOT, path.join(tmp, 'WABA'), { recursive: true });
        const root = path.join(tmp, 'WABA');
        // A cost-polarity idempotent algebra that does not exist upstream.
        fs.writeFileSync(path.join(root, 'semiring', 'probealg.lp'), [
            'active_semiring(probealg).',
            'oplus(min).',
            'otimes(min).',
            'oplus_identity(#sup).',
            'otimes_identity(#sup).',
            'semiring_default_weight(aba,#sup).',
            'semiring_default_weight(neutral,#sup).',
            '#include "../defaults/base.lp".',
            '#include "_idempotent.lp".',
            ''
        ].join('\n'));

        const out = path.join(tmp, 'waba-modules.js');
        execFileSync('node', [path.join(root, 'bin', 'sync-playground.mjs'), out],
            { env: { ...process.env, WABA_ROOT: root }, stdio: 'pipe' });

        const text = fs.readFileSync(out, 'utf8');
        assert.ok(text.includes('probealg'), 'the module must reach the bundle');
        const info = JSON.parse(
            text.slice(text.indexOf('"probealg": {'), text.indexOf('}', text.indexOf('"probealg": {')) + 1)
                .replace('"probealg": ', '')
        );
        // Polarity is DERIVED from oplus, and every bound direction in the app follows from it.
        assert.equal(info.polarity, 'lower', 'oplus(min) is the cost polarity');
        assert.equal(info.otimes, 'min');
        assert.deepEqual(info.defaultPolicies, ['aba', 'neutral']);
        assert.equal(info.aliasOf, null);
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
});

test('the shipped bundle carries the metadata the UI reads', async () => {
    const { wabaModules } = await import('../../waba-modules.js');
    const info = wabaModules.metadata.semiringInfo;
    assert.ok(info, 'semiringInfo must exist -- the UI builds its option list from it');
    // Every selectable algebra needs a polarity, or its budget bound is undefined.
    for (const [key, entry] of Object.entries(info)) {
        assert.ok(['higher', 'lower'].includes(entry.polarity), `${key} has no polarity`);
    }
    // A true alias declares nothing of its own and must not be offered as a separate algebra.
    assert.equal(info.godel_low.aliasOf, 'bottleneck_cost');
    assert.equal(info.tropical_high.aliasOf, 'arctic');
    assert.equal(info.godel.aliasOf, null);
    // Every semantics declares the same beta-sigma contract; no semantics owns a private
    // defence budget or polarity-dependent bound.
    const sem = wabaModules.metadata.semanticsInfo;
    for (const semantics of wabaModules.metadata.supportedSemantics) {
        assert.deepEqual(sem[semantics], { betaSigma: true }, semantics);
    }
    assert.deepEqual(wabaModules.metadata.semanticFilters, {
        preferred: 'subset_maximal_filter',
        grounded: 'subset_minimal_filter',
        naive: 'subset_maximal_filter',
        'semi-stable': 'range_maximal_filter',
        stage: 'range_maximal_filter',
        ideal: 'ideal_filter',
        eager: 'eager_filter'
    });
    assert.ok(!wabaModules.metadata.supportedSemantics.includes('_range'));
    // Only Lukasiewicz declares a tunable constant, and its default comes from the module.
    assert.deepEqual(info.lukasiewicz.constants, [{ name: 'k', default: 1000 }]);
    assert.deepEqual(info.godel.constants, []);
});
