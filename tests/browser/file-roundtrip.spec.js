import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Where the captured downloads are kept so they can be validated with the real clingo
// afterwards. A browser test cannot run clingo itself.
const DUMP = process.env.ROUNDTRIP_DUMP
    || '/private/tmp/claude-501/-Users-fdasaro-Desktop-GitHub-WABA/0e289e06-4548-4b51-89b5-0fdcb33dc8ed/scratchpad/roundtrip';

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
        await page.waitForTimeout(1200);
        const before = await solve(page);
        expect(before.length, `${example} produced no extensions to compare`).toBeGreaterThan(0);

        const lp = await captureDownload(page, '#download-lp-btn', `${example}.lp`);
        expect(lp.suggested).toMatch(/\.lp$/);
        expect(lp.content.length).toBeGreaterThan(20);

        // Feed the exported file straight back in
        await page.setInputFiles('#file-upload-input', {
            name: `${example}.lp`, mimeType: 'text/plain', buffer: Buffer.from(lp.content)
        });
        await page.waitForTimeout(1200);
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
        await page.waitForTimeout(1200);
        const before = await solve(page);
        expect(before.length, `${example} produced no extensions to compare`).toBeGreaterThan(0);

        const waba = await captureDownload(page, '#download-waba-btn', `${example}.waba`);
        expect(waba.suggested).toMatch(/\.waba$/);
        expect(waba.content.length).toBeGreaterThan(20);

        await page.setInputFiles('#file-upload-input', {
            name: `${example}.waba`, mimeType: 'text/plain', buffer: Buffer.from(waba.content)
        });
        await page.waitForTimeout(1200);
        const after = await solve(page);

        expect(after, `${example}: .waba round-trip changed the result`).toEqual(before);
        expect(errors).toEqual([]);
    });
}

test('both export formats preserve the description', async ({ page }) => {
    test.setTimeout(180000);
    await waitForReady(page);
    await page.selectOption('#example-select', 'conflict_cycle');
    await page.waitForTimeout(1200);

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
        await page.waitForTimeout(1400);
        await expect(page.locator('#simple-description-preview'),
            `${name} lost the description on import`).toContainText(MARKER);
    }
});

// The playground's own exports are one shape; the repository's curated frameworks are another
// (compact `head(r1,x). body(r1,y).` runs, `#const beta`, `budget(beta)`, block comments). A
// user loading their own .lp hits that second shape, so it has to be exercised too.
const CANONICAL = '/Users/fdasaro/Desktop/GitHub-WABA/WABA/examples';
const CANONICAL_FILES = fs.existsSync(CANONICAL)
    ? fs.readdirSync(CANONICAL, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .flatMap((d) => fs.readdirSync(path.join(CANONICAL, d.name))
            .filter((f) => f.endsWith('.lp'))
            .map((f) => path.join(CANONICAL, d.name, f)))
    : [];

for (const file of CANONICAL_FILES) {
    test(`loads the canonical framework ${path.basename(file)}`, async ({ page }) => {
        test.setTimeout(120000);
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await waitForReady(page);

        await page.setInputFiles('#file-upload-input', {
            name: path.basename(file), mimeType: 'text/plain', buffer: fs.readFileSync(file)
        });
        await page.waitForTimeout(1400);
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
    await page.waitForTimeout(1200);
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
