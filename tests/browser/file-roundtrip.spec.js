import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveWabaRoot } from '../../scripts/waba-root.js';

// Where the captured downloads are kept so they can be validated with the real clingo
// afterwards. A browser test cannot run clingo itself.
const DUMP = process.env.ROUNDTRIP_DUMP || path.join(os.tmpdir(), 'waba-roundtrip');

// Deterministic replacement for `waitForTimeout`: the controller publishes the number of
// in-flight example loads / graph rebuilds on body[data-waba-pending], so this returns as soon
// as the page has actually settled instead of after a guessed interval that a loaded machine
// can overrun.
async function settled(page) {
    await page.waitForFunction(
        () => (document.body.dataset.wabaPending || '0') === '0', null, { timeout: 60000 });
}

async function waitForReady(page) {
    await page.goto('/?autorun=0');
    await page.waitForFunction(() => document.body.dataset.wabaReady === '1', null, { timeout: 60000 });
}

async function solve(page) {
    await page.evaluate(() => { document.getElementById('output').innerHTML = ''; });
    await page.click('#run-btn');
    await page.waitForFunction(() => document.querySelectorAll('.answer-header').length > 0
        || /UNSATISFIABLE|No extensions/i.test(document.getElementById('output').textContent || ''),
        null, { timeout: 90000 });
    // Canonical fingerprint: the ACCEPTED assumptions plus the cost, per extension,
    // order-insensitive so a re-upload need not reproduce the display order.
    //
    // The accepted set renders as `.chip.in` (output-manager builds
    // `<span class="chip in">`). An earlier version of this helper guessed
    // `.assumption-item, .in-assumption`, which match nothing -- so every fingerprint was just
    // the cost badge and the comparison could not have detected a framework that round-tripped
    // to the same costs with different assumption sets. assertNonVacuous below makes that
    // failure mode impossible to ship again.
    const fingerprints = await page.evaluate(() => [...document.querySelectorAll('.answer-header')]
        .map((h) => {
            const body = h.parentElement;
            const ins = [...body.querySelectorAll('.chip.in')]
                .map((n) => n.textContent.replace(/[✓✗]/g, '').trim())
                .filter(Boolean);
            const badge = h.querySelector('.extension-cost-badge')?.textContent.trim() || '';
            return { ins: ins.sort().join(','), badge };
        }));

    // At least one extension must have named some accepted assumption, or the selector is wrong
    // again and every comparison below would be meaningless.
    const named = fingerprints.filter((f) => f.ins.length > 0).length;
    expect(named, 'no extension exposed its accepted assumptions: the .chip.in selector is stale')
        .toBeGreaterThan(0);

    return fingerprints.map((f) => `${f.ins}|${f.badge}`).sort();
}

async function captureDownload(page, selector, filename) {
    const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 30000 }),
        page.click(selector)
    ]);
    const target = path.join(DUMP, filename);
    await download.saveAs(target);
    return { suggested: download.suggestedFilename(), content: fs.readFileSync(target, 'utf8'), target };
}

const EXAMPLES = [
    'conflict_cycle', 'arctic_grounds', 'bottleneck_worstcase',
    'higgs_boson_discovery', 'testimony_erosion', 'kpg_impact_vs_deccan'
];

test.beforeAll(() => { fs.mkdirSync(DUMP, { recursive: true }); });

for (const example of EXAMPLES) {
    test(`round-trips ${example} through .lp`, async ({ page }) => {
        test.setTimeout(180000);
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await waitForReady(page);

        await page.selectOption('#example-select', example);
        await settled(page);
        const before = await solve(page);
        expect(before.length, `${example} produced no extensions to compare`).toBeGreaterThan(0);

        const lp = await captureDownload(page, '#download-lp-btn', `${example}.lp`);
        expect(lp.suggested).toMatch(/\.lp$/);
        expect(lp.content.length).toBeGreaterThan(20);

        // Feed the exported file straight back in
        await page.setInputFiles('#file-upload-input', {
            name: `${example}.lp`, mimeType: 'text/plain', buffer: Buffer.from(lp.content)
        });
        await settled(page);
        await expect(page.locator('#example-select')).toHaveValue('__uploaded__');
        const after = await solve(page);

        expect(after, `${example}: .lp round-trip changed the result`).toEqual(before);
        expect(errors).toEqual([]);
    });

    test(`round-trips ${example} through .waba`, async ({ page }) => {
        test.setTimeout(180000);
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await waitForReady(page);

        await page.selectOption('#example-select', example);
        await settled(page);
        const before = await solve(page);
        expect(before.length, `${example} produced no extensions to compare`).toBeGreaterThan(0);

        const waba = await captureDownload(page, '#download-waba-btn', `${example}.waba`);
        expect(waba.suggested).toMatch(/\.waba$/);
        expect(waba.content.length).toBeGreaterThan(20);

        await page.setInputFiles('#file-upload-input', {
            name: `${example}.waba`, mimeType: 'text/plain', buffer: Buffer.from(waba.content)
        });
        await settled(page);
        // The .lp twin has this guard and the .waba version did not. Without it an import that
        // THROWS leaves the original framework in the editor, solve() re-measures that same
        // framework, and `after` equals `before` by construction -- so all six .waba specs stay
        // green with export/import completely broken. parseWabaFile does throw on an
        // unrecognised file, and handleUploadedFile catches it, so this is reachable.
        await expect(page.locator('#example-select'),
            `${example}: the .waba import did not load — the comparison below would be vacuous`)
            .toHaveValue('__uploaded__');
        await expect(page.locator('#output')).not.toContainText('Error loading file');
        const after = await solve(page);

        expect(after, `${example}: .waba round-trip changed the result`).toEqual(before);
        expect(errors).toEqual([]);
    });
}

test('both export formats preserve the description', async ({ page }) => {
    test.setTimeout(180000);
    await waitForReady(page);
    await page.selectOption('#example-select', 'conflict_cycle');
    await settled(page);

    const MARKER = 'ROUNDTRIP DESCRIPTION MARKER 4711';
    await page.locator('#simple-edit-description-btn').click();
    await page.locator('#simple-description-content').fill(MARKER);
    await page.locator('#simple-edit-description-btn').click();
    await expect(page.locator('#simple-description-preview')).toContainText(MARKER);

    for (const [selector, name] of [['#download-lp-btn', 'desc.lp'], ['#download-waba-btn', 'desc.waba']]) {
        const file = await captureDownload(page, selector, name);
        // The exported file must actually contain it -- .waba dropped the description entirely,
        // and the extension-set comparison could never have caught that because a description
        // does not affect solving.
        expect(file.content, `${name} lost the description on export`).toContain(MARKER);

        await page.setInputFiles('#file-upload-input', {
            name, mimeType: 'text/plain', buffer: Buffer.from(file.content)
        });
        await settled(page);
        await expect(page.locator('#simple-description-preview'),
            `${name} lost the description on import`).toContainText(MARKER);
    }
});

// The playground's own exports are one shape; the repository's curated frameworks are another
// (compact `head(r1,x). body(r1,y).` runs, `#const beta`, `budget(beta)`, block comments). A
// user loading their own .lp hits that second shape, so it has to be exercised too.
// The tree that OWNS the bundle, resolved by CONTENT via the shared resolver.
//
// Resolving it "the same way sync-modules.js does" -- the sibling ../WABA -- looked right and
// was wrong: that sibling is a stale pre-modular checkout, so this suite silently stopped
// exercising the shipped reference frameworks (probabilistic.lp and the ASPforABA journal
// example vanished) and started exercising 25 deprecated ones instead. sync-modules.js gets
// away with that default because a wrong tree makes it exit 1; here a wrong tree just
// enumerates different files and stays green.
const { root: WABA_ROOT, candidates: CANDIDATE_ROOTS } = resolveWabaRoot(
    fileURLToPath(new URL('../..', import.meta.url))
);
const CANONICAL = WABA_ROOT ? path.join(WABA_ROOT, 'examples') : null;

const CANONICAL_FILES = CANONICAL && fs.existsSync(CANONICAL)
    ? fs.readdirSync(CANONICAL, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .flatMap((d) => fs.readdirSync(path.join(CANONICAL, d.name))
            .filter((f) => f.endsWith('.lp'))
            .map((f) => path.join(CANONICAL, d.name, f)))
    : [];

// An empty enumeration must be a failure, not silence: zero canonical tests looks exactly
// like zero canonical regressions.
test('the canonical framework suite found a source tree to run against', () => {
    expect(WABA_ROOT, `no WABA checkout with bin/sync-playground.mjs among ${CANDIDATE_ROOTS.join(', ')}`)
        .toBeTruthy();
    expect(CANONICAL_FILES.length, 'the canonical example set is empty').toBeGreaterThan(0);
});

for (const file of CANONICAL_FILES) {
    test(`loads the canonical framework ${path.basename(file)}`, async ({ page }) => {
        test.setTimeout(120000);
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await waitForReady(page);

        await page.setInputFiles('#file-upload-input', {
            name: path.basename(file), mimeType: 'text/plain', buffer: fs.readFileSync(file)
        });
        await settled(page);
        await expect(page.locator('#example-select')).toHaveValue('__uploaded__');
        // The editor must actually hold it, not silently swallow the upload.
        expect((await page.locator('#code-editor').inputValue()).length).toBeGreaterThan(30);

        await page.evaluate(() => { document.getElementById('output').innerHTML = ''; });
        await page.click('#run-btn');
        await page.waitForFunction(() => document.querySelectorAll('.answer-header').length > 0
            || /UNSATISFIABLE|No extensions|Error/i.test(document.getElementById('output').textContent || ''),
            null, { timeout: 90000 });
        const out = await page.locator('#output').textContent();
        // UNSAT is a legitimate mathematical answer; an error is not.
        expect(out, `${path.basename(file)} errored`).not.toMatch(/❌|Error:/);
        expect(errors).toEqual([]);
    });
}

test('Download All Extensions writes every displayed extension', async ({ page }) => {
    test.setTimeout(120000);
    await waitForReady(page);
    await page.selectOption('#example-select', 'conflict_cycle');
    await settled(page);
    const shown = await solve(page);
    expect(shown.length).toBeGreaterThan(0);

    const dump = await captureDownload(page, '#download-all-extensions-btn', 'extensions.txt');
    expect(dump.content.length).toBeGreaterThan(20);
    // The format is one numbered line per extension: `1: in(a). in(b). cost(3).`
    const lines = dump.content.trim().split('\n').filter((l) => /^\d+:/.test(l));
    expect(lines.length, 'one line per displayed extension').toBe(shown.length);
    for (const line of lines) {
        expect(line, 'each line should name its accepted assumptions').toMatch(/\bin\([^)]+\)/);
        expect(line, 'each line should carry its cost').toMatch(/\bcost\([^)]*\)/);
    }
});
