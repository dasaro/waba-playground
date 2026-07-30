import { test, expect } from '@playwright/test';

const ALGEBRAS = ['godel', 'arctic', 'lukasiewicz', 'tropical', 'bottleneck_cost'];
const SEMANTICS = ['cf', 'stable', 'admissible', 'complete', 'preferred'];
// The controls retired when the surface was cut from 11 selects to 7. Their combinations are
// now unreachable by construction, so a spec that still drives them is testing nothing.
const RETIRED_CONTROLS = [
    '#polarity-select', '#monoid-select', '#optimize-select',
    '#constraint-select', '#opt-mode-select', '#show-select'
];

// Loads with the auto-run DISABLED, so each spec exercises the interaction it was written for
// rather than racing the page's own first solve. The auto-run itself is covered by its own spec.
// Waits on body[data-waba-ready] rather than #intro-status alone: the status text flips as soon
// as the WASM module loads, which is before init has populated the example, applied its preset
// and built the graph, so waiting on it resumes into a half-initialised page.
async function waitForClingoReady(page, { autorun = false } = {}) {
    await page.goto(autorun ? '/' : '/?autorun=0');
    await expect(page.locator('#intro-status')).toContainText(/Clingo WASM loaded successfully|Loading Clingo WASM/);
    await page.waitForFunction(() => document.body.dataset.wabaReady === '1', null, { timeout: 60000 });
}

test('a normal load solves the default example without any interaction', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    // No click anywhere in this test.
    await waitForClingoReady(page, { autorun: true });

    await expect(page.locator('.answer-header').first()).toBeVisible({ timeout: 60000 });
    await expect(page.locator('.extension-cost-badge').first()).toBeVisible();
    // The unprompted run must not throw a modal overlay over the page.
    await expect(page.locator('#loading-overlay')).toBeHidden();
    expect(pageErrors).toEqual([]);
});

test('?autorun=0 suppresses the initial run', async ({ page }) => {
    await waitForClingoReady(page);
    await expect(page.locator('.answer-header')).toHaveCount(0);
});

test('the control surface exposes exactly the supported options', async ({ page }) => {
    await waitForClingoReady(page);

    await expect(page.locator('#semiring-select option')).toHaveCount(5);
    await expect(page.locator('#semiring-select optgroup')).toHaveCount(2);
    await expect(page.locator('#semantics-select option')).toHaveCount(5);
    // Only the three canonical (monoid, bound) pairings, plus no-discard.
    await expect(page.locator('#budget-select option')).toHaveCount(4);
    await expect(page.locator('#results-select option')).toHaveCount(3);
    // 'legacy' was retired: it contributes a delta identical to 'neutral' for four algebras
    // and to 'aba' for tropical, so it added a third name for behaviour already reachable.
    await expect(page.locator('#default-policy-select option')).toHaveCount(2);
    await expect(page.locator('#default-policy-select')).toHaveValue('neutral');
    await expect(page.locator('#default-policy-select option[value="legacy"]')).toHaveCount(0);

    for (const selector of RETIRED_CONTROLS) {
        await expect(page.locator(selector)).toHaveCount(0);
    }

    // Every control's description is visible without hovering, and the '?' affordances that
    // used to stand in for them are gone.
    await expect(page.locator('.help-dot')).toHaveCount(0);
    const visibleNotes = await page.evaluate(() => {
        const all = [...document.querySelectorAll('#panel-config-content .config-note')];
        return all.map((note) => ({
            text: (note.textContent || '').trim().slice(0, 40),
            // a note is only expected on screen when its own control is
            containerShown: note.closest('.config-item')?.offsetParent !== null,
            shown: note.offsetParent !== null && getComputedStyle(note).visibility !== 'hidden'
        }));
    });
    expect(visibleNotes.length).toBeGreaterThan(4);
    const wronglyHidden = visibleNotes.filter((note) => note.containerShown && !note.shown);
    expect(wronglyHidden, 'a description is still hover-gated').toEqual([]);

    // k belongs to Lukasiewicz alone and must not clutter the surface otherwise.
    await expect(page.locator('#luk-k-container')).toBeHidden();
    await page.selectOption('#semiring-select', 'lukasiewicz');
    await expect(page.locator('#luk-k-container')).toBeVisible();
    await page.selectOption('#semiring-select', 'godel');
    await expect(page.locator('#luk-k-container')).toBeHidden();
});

test('choosing an algebra preselects the budget reading for its polarity', async ({ page }) => {
    await waitForClingoReady(page);

    // Strength algebras (oplus = max) bound the total conceded; cost algebras (oplus = min)
    // put a floor under each concession. These are the canonical pairings.
    for (const algebra of ['godel', 'arctic', 'lukasiewicz']) {
        await page.selectOption('#semiring-select', 'tropical');
        await page.selectOption('#semiring-select', algebra);
        await expect(page.locator('#budget-select')).toHaveValue('sum-ub');
    }
    for (const algebra of ['tropical', 'bottleneck_cost']) {
        await page.selectOption('#semiring-select', 'godel');
        await page.selectOption('#semiring-select', algebra);
        await expect(page.locator('#budget-select')).toHaveValue('min-lb');
        // The two bounds run in opposite directions, so beta moves to the permissive end
        // rather than carrying over a value tuned for an upper bound and returning nothing.
        await expect(page.locator('#budget-input')).toHaveValue('0');
    }
});

test('extensions are ordered best-first, in the direction the bound implies', async ({ page }) => {
    test.setTimeout(180000);
    await waitForClingoReady(page);
    await page.selectOption('#example-select', 'conflict_cycle');

    const costsInOrder = async () => {
        await page.evaluate(() => { document.getElementById('output').innerHTML = ''; });
        await page.click('#run-btn');
        await page.waitForFunction(() => document.querySelectorAll('.answer-header').length > 0,
            null, { timeout: 90000 });
        return page.locator('.extension-cost-badge').evaluateAll(
            (els) => els.map((el) => parseInt(el.textContent.replace(/[^0-9-]/g, ''), 10))
        );
    };

    // Upper bound: the aggregate is a price, so cheapest first.
    await page.selectOption('#semiring-select', 'godel');
    await page.fill('#budget-input', '30');
    const ub = await costsInOrder();
    expect(ub.length).toBeGreaterThan(1);
    expect(ub, 'sum <= beta should ascend').toEqual([...ub].sort((a, b) => a - b));

    // Lower bound: the aggregate is a quality FLOOR, so the largest least-concession is the
    // best extension and the order must invert.
    await page.selectOption('#semiring-select', 'bottleneck_cost');
    await expect(page.locator('#budget-select')).toHaveValue('min-lb');
    const lb = await costsInOrder();
    expect(lb.length).toBeGreaterThan(1);
    expect(lb, 'min >= beta should descend').toEqual([...lb].sort((a, b) => b - a));

    // Defence semantics have no monoid aggregate; they rank by the probed beta*, ascending.
    await page.selectOption('#semiring-select', 'godel');
    await page.selectOption('#semantics-select', 'admissible');
    await page.fill('#budget-input', '30');
    const def = await costsInOrder();
    expect(def.length).toBeGreaterThan(1);
    expect(def, 'beta* should ascend').toEqual([...def].sort((a, b) => a - b));
});

test('the Standard set-graph refuses frameworks with too many candidate sets', async ({ page }) => {
    await waitForClingoReady(page);

    // n = 6 -> 64 sets, over the limit of 32.
    await page.selectOption('#example-select', 'out_of_africa');
    await page.locator('.mode-option', { hasText: 'Standard' }).click();
    await expect(page.locator('#graph-empty-message')).toContainText(/candidate sets/i, { timeout: 30000 });
    await expect(page.locator('#graph-empty-message')).toContainText(/Assumption-Direct|Assumption-Branching/);

    // n = 3 -> 8 sets, well under it, so it still draws.
    await page.selectOption('#example-select', 'conflict_cycle');
    await page.locator('.mode-option', { hasText: 'Standard' }).click();
    await expect(page.locator('#graph-empty-state')).toBeHidden({ timeout: 30000 });
});

test('every semantics reports a per-extension cost', async ({ page }) => {
    test.setTimeout(180000);
    await waitForClingoReady(page);
    await page.selectOption('#example-select', 'conflict_cycle');

    // The complaint this covers: only Stable ever showed a cost. cf shows the monoid aggregate;
    // the three defence semantics show the minimum they must concede, probed per extension.
    for (const semantics of ['cf', 'stable', 'admissible', 'complete', 'preferred']) {
        await page.selectOption('#semantics-select', semantics);
        await page.fill('#budget-input', '30');
        await page.evaluate(() => { document.getElementById('output').innerHTML = ''; });
        await page.click('#run-btn');
        // NOT "output is non-empty": the solver's progress messages are logged into #output,
        // so that fires before any extension exists and `preferred`, which needs a second
        // pass, lost the race.
        await page.waitForFunction(() => document.querySelectorAll('.answer-header').length > 0,
            null, { timeout: 90000 });
        const badges = await page.locator('.extension-cost-badge').count();
        expect(badges, `${semantics} exposed no cost`).toBeGreaterThan(0);
        // exactly one badge per extension, not the old Cost + beta* pair
        const headers = await page.locator('.answer-header').count();
        expect(badges, `${semantics} rendered ${badges} badges for ${headers} extensions`).toBe(headers);
    }
});

test('collapsible panels toggle cleanly', async ({ page }) => {
    await waitForClingoReady(page);
    // The Analysis & Export panel was removed: its Decision Analysis view was deprecated and
    // its PNG/PDF buttons were proxies that clicked the graph toolbar's real ones.
    await expect(page.locator('[data-panel="analysis"]')).toHaveCount(0);
    await expect(page.locator('#metrics-toggle-btn')).toHaveCount(0);
    // the graph toolbar still owns the real exports
    await expect(page.locator('#export-png-btn')).toBeVisible();
    await expect(page.locator('#export-pdf-btn')).toBeVisible();

    for (const panelId of ['config', 'output', 'graph']) {
        const panel = page.locator(`.panel[data-panel="${panelId}"]`);
        const toggle = panel.locator('.panel-toggle');
        await toggle.click();
        await expect(panel).toHaveAttribute('data-collapsed', 'true');
        await toggle.click();
        await expect(panel).toHaveAttribute('data-collapsed', 'false');
    }
});

test('a curated stable run names the assumption behind every attack', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await waitForClingoReady(page);
    await page.selectOption('#example-select', 'conflict_cycle');
    await page.click('#run-btn');
    await expect(page.locator('.answer-header').first()).toBeVisible({ timeout: 60000 });

    // conflict_cycle has no fact-based attacks, so every attack line must name its
    // supporting assumption, never the ⊤ fallback -- even under projection, whose witness
    // omits head/body (regression guard for the framework-source provenance fallback).
    const attackTexts = await page.locator('.attack-item').allTextContents();
    expect(attackTexts.length).toBeGreaterThan(0);
    for (const text of attackTexts) {
        expect(text.trim().startsWith('⊤')).toBe(false);
    }
    expect(pageErrors).toEqual([]);
});

test('curated example description renders in the description bar', async ({ page }) => {
    await waitForClingoReady(page);
    await page.selectOption('#example-select', 'conflict_cycle');
    await expect(page.locator('#simple-description-bar')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#simple-description-preview')).toContainText('weakest link');

    // It reads IN PLACE, above the assumptions/rules grid -- not in a hover panel. The trigger
    // chip and its absolutely-positioned tooltip are gone.
    const preview = page.locator('#simple-description-preview');
    await expect(preview).toBeVisible();
    await expect(page.locator('#simple-description-trigger')).toHaveCount(0);
    await expect(page.locator('.description-hover-panel')).toHaveCount(0);
    const layout = await page.evaluate(() => {
        const p = document.getElementById('simple-description-preview');
        const grid = document.querySelector('.simple-grid');
        return {
            position: getComputedStyle(p).position,
            aboveGrid: p.getBoundingClientRect().bottom <= grid.getBoundingClientRect().top + 2,
            bounded: p.getBoundingClientRect().height <= 200
        };
    });
    expect(layout.position, 'the description should sit in the flow, not float').toBe('static');
    expect(layout.aboveGrid, 'the description should render above the grid').toBe(true);
    // Curated descriptions reach ~1200 characters, so the box is capped and scrolls internally
    // rather than pushing the editor off screen.
    expect(layout.bounded, 'the description box should stay bounded').toBe(true);
    const editorValue = await page.locator('#code-editor').inputValue();
    expect(editorValue.startsWith('% //')).toBe(true);

    await page.selectOption('#example-select', 'detective_locked_house');
    await expect(page.locator('#simple-description-preview')).toContainText('locked house');
    // ~1200 characters: still visible, still bounded, and it scrolls in its own box.
    const long = await page.evaluate(() => {
        const p = document.getElementById('simple-description-preview');
        return { chars: p.textContent.trim().length, h: p.getBoundingClientRect().height, scrolls: p.scrollHeight > p.clientHeight };
    });
    expect(long.chars).toBeGreaterThan(800);
    expect(long.h).toBeLessThanOrEqual(200);
    expect(long.scrolls, 'a long description should scroll inside its own box').toBe(true);
});

test('every curated example applies its algebra to the control surface', async ({ page }) => {
    await waitForClingoReady(page);
    // Regression: the presets carried semiringFamily+polarity, which applyConfigToUI could
    // not read, so loading ANY example silently reset the algebra to Gödel.
    const expected = await page.evaluate(() => Object.fromEntries(
        Object.entries(window.WABAExamples)
            .filter(([, ex]) => ex.preset?.semiring)
            .map(([key, ex]) => [key, ex.preset.semiring])
    ));
    expect(Object.keys(expected).length).toBeGreaterThan(5);
    for (const [key, semiring] of Object.entries(expected)) {
        await page.selectOption('#example-select', key);
        await expect(page.locator('#semiring-select')).toHaveValue(semiring);
    }
});

test('uploading a framework adds a selectable option and loads the code', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await waitForClingoReady(page);

    // Regression: the uploaded option was inserted before select.options[1], which lives
    // inside an <optgroup> and is therefore not a direct child -> insertBefore threw.
    await page.setInputFiles('#file-upload-input', {
        name: 'probe.lp',
        mimeType: 'text/plain',
        buffer: Buffer.from('assumption(p). contrary(p, cp).\nassumption(q). contrary(q, cq).\nhead(r1, cp). body(r1, q).\n')
    });

    await expect(page.locator('#example-select option[value="__uploaded__"]')).toHaveCount(1);
    await expect(page.locator('#example-select')).toHaveValue('__uploaded__');
    expect(await page.locator('#code-editor').inputValue()).toContain('assumption(p)');
    expect(pageErrors).toEqual([]);
});

test('an uploaded framework cannot inject HTML into the results', async ({ page }) => {
    test.setTimeout(90000);
    await waitForClingoReady(page);

    // ASP permits quoted-string terms, so an atom name in an uploaded .lp can carry markup.
    // Regression: solver-derived text was interpolated into innerHTML unescaped.
    const payload = '<img src=x onerror=window.__XSS=1>';
    await page.setInputFiles('#file-upload-input', {
        name: 'hostile.lp',
        mimeType: 'text/plain',
        buffer: Buffer.from(
            `assumption("${payload}").\nassumption(b).\n`
            + `contrary("${payload}", cx).\ncontrary(b, cb).\n`
            + `weight("${payload}", 30). weight(b, 20).\n`
            + `head(r1, cx). body(r1, b).\nhead(r2, cb). body(r2, "${payload}").\n`
        )
    });
    await page.waitForTimeout(600);
    await page.selectOption('#budget-select', 'sum-ub');
    await page.fill('#budget-input', '100');
    await page.click('#run-btn');
    await page.waitForSelector('.answer-header', { timeout: 60000 });

    const probe = await page.evaluate(() => ({
        executed: window.__XSS === 1,
        liveNodes: document.querySelectorAll('img[src="x"]').length,
        shownAsText: document.body.innerText.includes('<img src=x onerror')
    }));
    expect(probe.executed).toBe(false);
    expect(probe.liveNodes).toBe(0);
    expect(probe.shownAsText).toBe(true);
});

test('a defence semantics owns its budget, so the reading control is inert', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await waitForClingoReady(page);
    await page.selectOption('#example-select', 'conflict_cycle');

    for (const semantics of ['admissible', 'complete', 'preferred']) {
        await page.selectOption('#semantics-select', semantics);
        // These carry their own SUM inconsistency budget and compose with no_discard, so
        // pairing them with a monoid/bound is meaningless rather than merely unusual.
        await expect(page.locator('#budget-select')).toBeDisabled();
        await expect(page.locator('#budget-select')).toHaveValue('none');
        // beta still applies -- it is the defence budget.
        await expect(page.locator('#budget-input')).toBeEnabled();
    }

    // preferred is post-filtered, so it must enumerate rather than optimise.
    await expect(page.locator('#results-select')).toBeDisabled();
    await expect(page.locator('#results-select')).toHaveValue('all');

    await page.click('#run-btn');
    await expect(page.locator('.answer-header').first()).toBeVisible({ timeout: 60000 });
    expect(pageErrors).toEqual([]);
});

test('a budgeted stable run honours the reading and the optimisation direction', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await waitForClingoReady(page);
    await page.selectOption('#example-select', 'arctic_grounds');
    await page.selectOption('#semantics-select', 'stable');
    await page.selectOption('#budget-select', 'sum-ub');
    await page.fill('#budget-input', '20');
    await page.selectOption('#results-select', 'min');
    await page.click('#run-btn');
    await expect(page.locator('.answer-header').first()).toBeVisible({ timeout: 60000 });

    // ABA recovery pins the transparent default and forbids discarding. The checkbox itself
    // is CSS-hidden behind the slider, so drive the visible control the user actually clicks.
    const abaToggle = page.locator('label.switch-toggle[for="aba-recovery-toggle"] .switch-slider');
    await abaToggle.click();
    await expect(page.locator('#aba-recovery-toggle')).toBeChecked();
    await expect(page.locator('#budget-select')).toBeDisabled();
    await expect(page.locator('#budget-select')).toHaveValue('none');
    await expect(page.locator('#default-policy-select')).toHaveValue('neutral');
    await expect(page.locator('#budget-input')).toBeDisabled();
    // Unchecking restores what the user had chosen, rather than leaving the pinned values.
    await abaToggle.click();
    await expect(page.locator('#aba-recovery-toggle')).not.toBeChecked();
    await expect(page.locator('#budget-select')).toHaveValue('sum-ub');

    expect(pageErrors).toEqual([]);
});

test('the extension download survives the removal of the analysis panel', async ({ page }) => {
    await waitForClingoReady(page);

    await page.selectOption('#example-select', 'conflict_cycle');
    await page.click('#run-btn');
    await expect(page.locator('.answer-header').first()).toBeVisible({ timeout: 60000 });

    // It used to be appended into the Analysis & Export panel; it now sits at the top of the
    // output pane, alongside the extensions it downloads.
    const download = page.locator('#download-all-extensions-btn');
    await expect(download).toBeVisible();
    expect(await download.evaluate((el) => el.closest('[data-panel]')?.getAttribute('data-panel'))).toBe('output');

    await page.goto('/version-check.html');
    await expect(page.locator('#status')).toContainText('Modules loaded successfully', { timeout: 60000 });
    await expect(page.locator('#status')).toContainText('GraphManager.initFullscreen() exists');
});

test('graph tooltips are populated and leak no internal ids, in every mode', async ({ page }) => {
    test.setTimeout(180000);
    await waitForClingoReady(page);

    // An example with derived claims, a multi-premise rule (so an ∧ junction) and attacks.
    await page.selectOption('#example-select', 'kpg_impact_vs_deccan');
    await page.click('#run-btn');
    await expect(page.locator('.answer-header').first()).toBeVisible({ timeout: 60000 });

    for (const mode of ['Assumption-Branching', 'Assumption-Direct']) {
        await page.locator('.mode-option', { hasText: mode }).click();
        await page.waitForTimeout(1500);
        const audit = await page.evaluate(() => {
            const gm = window.playground.graphManager;
            const text = (t) => (!t ? '' : (typeof t === 'string' ? t : (t.innerText || t.textContent || '')));
            const nodes = gm.networkData.nodes.get();
            const edges = gm.networkData.edges.get();
            return {
                nodes: nodes.length,
                untitledNodes: nodes.filter((n) => !n.title).map((n) => n.id),
                untitledEdges: edges.filter((e) => !e.title).map((e) => e.id),
                // Internal vis ids must never surface in prose. Compare against the actual
                // synthetic ids: this framework's own atoms are named `arg_iridium_anomaly`
                // etc., so a substring test on 'arg_' flags correct output as a leak.
                leaks: (() => {
                    const synthetic = nodes
                        .filter((n) => n.isDerived || n.isJunction)
                        .map((n) => n.id);
                    return [...nodes, ...edges]
                        .filter((x) => synthetic.some((id) => text(x.title).includes(id)))
                        .map((x) => x.id);
                })(),
                // a tooltip that renders its own markup as text is a bug
                escaped: [...nodes, ...edges].filter((x) => /&lt;div|&lt;strong/.test(text(x.title))).map((x) => x.id),
                sawDirectSupportFallback: edges.some((e) => /Rule \/ derivation:\s*direct support/.test(text(e.title)))
            };
        });
        expect(audit.nodes, `${mode} drew no nodes`).toBeGreaterThan(0);
        expect(audit.untitledNodes, `${mode}: nodes with no tooltip`).toEqual([]);
        expect(audit.untitledEdges, `${mode}: edges with no tooltip`).toEqual([]);
        expect(audit.leaks, `${mode}: internal ids visible in tooltips`).toEqual([]);
        expect(audit.escaped, `${mode}: tooltip markup rendered as text`).toEqual([]);
    }

    // Selecting an extension must annotate NODES, not only edges.
    await page.locator('.mode-option', { hasText: 'Assumption-Branching' }).click();
    await page.waitForTimeout(1200);
    await page.locator('.answer-header').first().click();
    await page.waitForTimeout(1200);
    const state = await page.evaluate(() => {
        const gm = window.playground.graphManager;
        const text = (t) => (!t ? '' : (typeof t === 'string' ? t : (t.innerText || t.textContent || '')));
        return {
            nodeMembership: gm.networkData.nodes.get().some((n) => /In this extension/i.test(text(n.title))),
            edgeState: gm.networkData.edges.get().some((e) => /State:/i.test(text(e.title)))
        };
    });
    expect(state.nodeMembership, 'no node reported its IN/OUT membership').toBe(true);
    expect(state.edgeState, 'no edge reported its attack state').toBe(true);
});

test('graph modes switch without regressions', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await waitForClingoReady(page);
    await page.selectOption('#example-select', 'conflict_cycle');
    await page.click('#run-btn');
    await expect(page.locator('.answer-header').first()).toBeVisible({ timeout: 60000 });

    await page.locator('.mode-option', { hasText: 'Assumption-Direct' }).click();
    await page.locator('.mode-option', { hasText: 'Assumption-Branching' }).click();
    await page.locator('.mode-option', { hasText: 'Standard' }).click();

    expect(pageErrors).toEqual([]);
});

test('STRESS: every algebra x every semantics solves with no page error', async ({ page }) => {
    test.setTimeout(600000);
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(`${error.message}`));

    await waitForClingoReady(page);
    await page.selectOption('#example-select', 'conflict_cycle');

    const failures = [];
    const results = [];
    for (const semiring of ALGEBRAS) {
        for (const semantics of SEMANTICS) {
            await page.selectOption('#semiring-select', semiring);
            await page.selectOption('#semantics-select', semantics);
            if (semiring === 'lukasiewicz') await page.fill('#luk-k-input', '20');
            // Give the conflict-based semantics a live budget; the defence ones take beta
            // through their own module and disable this control.
            const budgetDisabled = await page.locator('#budget-select').isDisabled();
            if (!budgetDisabled) await page.selectOption('#budget-select', 'sum-ub');
            await page.fill('#budget-input', '30');

            // Blank the output FIRST. Waiting on `.answer-header` alone is a false green:
            // the previous combination's header is still in the DOM, so the wait returns
            // immediately and every combination "passes" without being solved.
            await page.evaluate(() => { document.getElementById('output').innerHTML = ''; });
            await page.click('#run-btn');
            // Either extensions or an explicit UNSATISFIABLE is a PASS; a hang or a thrown
            // error is not. UNSAT is a legitimate mathematical answer here.
            const settled = await page.waitForFunction(() => {
                const out = document.getElementById('output');
                if (!out) return false;
                const text = out.textContent || '';
                if (!text.trim()) return false;
                return document.querySelector('.answer-header') !== null
                    || /UNSATISFIABLE|No extensions|Error/i.test(text);
            }, null, { timeout: 90000 }).catch(() => null);

            const text = await page.locator('#output').textContent();
            const headers = await page.locator('.answer-header').count();
            const unsat = /UNSATISFIABLE|No extensions/i.test(text || '');
            if (!settled) failures.push(`${semiring}/${semantics}: timed out`);
            else if (/Error/i.test(text || '')) failures.push(`${semiring}/${semantics}: ${text.slice(0, 160)}`);
            else if (headers === 0 && !unsat) failures.push(`${semiring}/${semantics}: no verdict`);
            results.push({ semiring, semantics, extensions: headers, unsat });
        }
    }

    console.table(results);
    expect(failures, failures.join('\n')).toEqual([]);
    expect(pageErrors).toEqual([]);
    // Every combination must have produced a verdict, not been skipped by a stale wait.
    expect(results.length).toBe(ALGEBRAS.length * SEMANTICS.length);
    // And the sweep must be discriminating: if every cell were identical the sweep would be
    // passing on a control surface that silently ignores the algebra.
    expect(new Set(results.map((r) => `${r.extensions}/${r.unsat}`)).size).toBeGreaterThan(1);
});

test("the UI's beta overrides a framework that pins its own #const beta", async ({ page }) => {
    test.setTimeout(120000);
    await waitForClingoReady(page);

    // Regression: buildProgram used to emit `#const beta = N.` into the program text and skip
    // it whenever the framework declared its own, because clingo rejects a redefined
    // constant. The CLI passes -c beta=N, which OVERRIDES a #const, so the two surfaces
    // disagreed: a framework pinning `#const beta = 0.` silently forced beta=0 in the
    // browser. Under a cost algebra that made the defence guard vacuous and returned every
    // candidate set. beta now travels as -c beta, so the caller's value wins in both.
    await page.setInputFiles('#file-upload-input', {
        name: 'pinned-beta.lp',
        mimeType: 'text/plain',
        buffer: Buffer.from(
            '#const beta = 0.\n'
            + 'assumption(a). assumption(b).\n'
            + 'contrary(a, ca). contrary(b, cb).\n'
            + 'weight(wa, 4). weight(wb, 6).\n'
            + 'head(r1, ca). body(r1, wa). head(r1b, wa).\n'
            + 'head(r2, cb). body(r2, wb). head(r2b, wb).\n'
        )
    });
    await page.waitForTimeout(600);
    await page.selectOption('#semiring-select', 'godel');
    await page.selectOption('#semantics-select', 'cf');
    await page.selectOption('#budget-select', 'sum-ub');

    async function countAt(beta) {
        await page.fill('#budget-input', String(beta));
        await page.evaluate(() => { document.getElementById('output').innerHTML = ''; });
        await page.click('#run-btn');
        await page.waitForFunction(() => {
            const out = document.getElementById('output');
            return out && (out.textContent || '').trim().length > 0;
        }, null, { timeout: 60000 });
        return page.locator('.answer-header').count();
    }

    // beta=0 forbids every discard; a budget above both weights permits them. If the
    // framework's `#const beta = 0.` still won, these two counts would be equal.
    const atZero = await countAt(0);
    const atTen = await countAt(10);
    expect(atTen).toBeGreaterThan(atZero);
});

test('STRESS: Lukasiewicz k is applied, so weights do not silently erode to zero', async ({ page }) => {
    test.setTimeout(180000);
    await waitForClingoReady(page);

    // The module declares `#const k = 1000.`; the erosion example's weights are 900, so a k
    // that is not plumbed through leaves every derivation at 0 and the example looks broken.
    await page.selectOption('#example-select', 'testimony_erosion');
    await expect(page.locator('#semiring-select')).toHaveValue('lukasiewicz');
    await expect(page.locator('#luk-k-container')).toBeVisible();
    await expect(page.locator('#luk-k-input')).toHaveValue('1000');

    await page.click('#run-btn');
    await expect(page.locator('.answer-header').first()).toBeVisible({ timeout: 90000 });
    const text = await page.locator('#output').textContent();
    // The eroded chain must retain SOME strength: an all-zero result is the failure mode.
    expect(text).toMatch(/[1-9]\d{2}/);
});
