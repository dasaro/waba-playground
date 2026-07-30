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
    await page.waitForFunction(() => document.body.dataset.wabaReady === '1', null, { timeout: 60000 });
    // Asserted AFTER readiness. It used to accept /loaded successfully|Loading/, which covers
    // every state the element can be in, so the check could not fail.
    await expect(page.locator('#intro-status')).toContainText('Clingo WASM loaded successfully');
}

// Deterministic replacement for `waitForTimeout`: the controller publishes the number of
// in-flight example loads / graph rebuilds on body[data-waba-pending], so this returns as soon
// as the page has actually settled instead of after a guessed interval that a loaded machine
// can overrun.
async function settled(page) {
    await page.waitForFunction(
        () => (document.body.dataset.wabaPending || '0') === '0', null, { timeout: 60000 });
}

// Waits for a solve to finish. NOT `!runBtn.disabled`: that property is written exactly once
// in the whole app (clingo-manager's give-up branch) and never cleared, so waiting on it
// returned on the first poll and every `toHaveCount(0)` after it asserted against the DOM the
// test had just blanked -- unfalsifiable by construction.
async function runFinished(page) {
    await page.waitForFunction(
        () => document.body.dataset.wabaRunning === '0', null, { timeout: 120000 });
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

// Every other spec here asserts SHAPE -- that some cost badge exists, that the order is
// monotone -- so the whole suite passed while the browser computed different extensions from
// the CLI. These pin the NUMBERS. Ground truth is `bin/waba` on the same framework:
//
//   waba run --framework cc.lp --semiring godel --semantics stable \
//            --budget-mode ub --objective sum-min --beta 8 --default-policy neutral \
//            --opt-mode ignore
//     in(climate) in(welfare)  discarded_attack(against_welfare,welfare,3)
//     in(growth)  in(welfare)  discarded_attack(against_growth,growth,5)
//     in(growth)  in(climate)  discarded_attack(against_climate,climate,8)
//
//   --semantics admissible, same algebra:  beta=0 -> 1,  3 -> 3,  5 -> 5,  8 -> 7
const STANDOFF_STABLE = [
    { in: ['climate', 'welfare'], cost: 3 },
    { in: ['growth', 'welfare'], cost: 5 },
    { in: ['climate', 'growth'], cost: 8 }
];

async function runAndReadExtensions(page) {
    await page.evaluate(() => { document.getElementById('output').innerHTML = ''; });
    await page.click('#run-btn');
    await page.waitForFunction(() => document.querySelectorAll('.answer-header').length > 0,
        null, { timeout: 90000 });
    return page.locator('.answer-set').evaluateAll((els) => els.map((el) => ({
        in: [...el.querySelectorAll('.chip.in')]
            .map((c) => c.textContent.replace(/[^\w]/g, '')).sort(),
        cost: parseInt(
            el.querySelector('.extension-cost-badge')?.textContent.replace(/[^0-9-]/g, ''), 10)
    })));
}

test('the Three-Way Standoff reproduces the CLI extensions exactly', async ({ page }) => {
    test.setTimeout(120000);
    await waitForClingoReady(page);
    await page.selectOption('#example-select', 'conflict_cycle');
    await page.selectOption('#semiring-select', 'godel');
    await page.selectOption('#semantics-select', 'stable');
    await page.selectOption('#budget-select', 'sum-ub');
    await page.fill('#budget-input', '8');

    const found = await runAndReadExtensions(page);
    expect(found).toEqual(STANDOFF_STABLE);
});

test('the budget buys exactly the extensions the CLI says it buys', async ({ page }) => {
    test.setTimeout(180000);
    await waitForClingoReady(page);
    await page.selectOption('#example-select', 'conflict_cycle');
    await page.selectOption('#semiring-select', 'godel');
    await page.selectOption('#semantics-select', 'stable');
    await page.selectOption('#budget-select', 'sum-ub');

    // beta below the cheapest rebuttal buys nothing: the odd cycle is a classical deadlock.
    for (const [beta, expected] of [[0, 0], [2, 0], [3, 1], [5, 2], [8, 3]]) {
        await page.fill('#budget-input', String(beta));
        await page.evaluate(() => { document.getElementById('output').innerHTML = ''; });
        await page.click('#run-btn');
        await runFinished(page);
        await expect(page.locator('.answer-header'),
            `beta=${beta} should admit ${expected} stable extension(s)`).toHaveCount(expected);
    }
});

test('budgeted admissible matches the CLI count and beta* at every budget',
    async ({ page }) => {
        test.setTimeout(240000);
        await waitForClingoReady(page);
        await page.selectOption('#example-select', 'conflict_cycle');
        await page.selectOption('#semiring-select', 'godel');
        await page.selectOption('#semantics-select', 'admissible');

        for (const [beta, expected] of [[0, 1], [3, 3], [5, 5], [8, 7]]) {
            await page.fill('#budget-input', String(beta));
            await page.evaluate(() => { document.getElementById('output').innerHTML = ''; });
            await page.click('#run-btn');
            await runFinished(page);
            await expect(page.locator('.answer-header'),
                `beta=${beta} should admit ${expected} admissible extension(s)`)
                .toHaveCount(expected);
        }

        // beta* per set, from the enumeration above: the empty set needs nothing, {welfare}
        // and {climate,welfare} need 3, {growth} and {growth,welfare} need 5, {climate} and
        // {climate,growth} need 8. Sorted ascending, that is the badge sequence.
        const betaStars = await page.locator('.extension-cost-badge').evaluateAll(
            (els) => els.map((el) => parseInt(el.textContent.replace(/[^0-9-]/g, ''), 10)));
        expect(betaStars).toEqual([0, 3, 3, 5, 5, 8, 8]);
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
        const body = panel.locator('.panel-body, .panel-content').first();
        const bodyExists = await body.count() > 0;
        await toggle.click();
        await expect(panel).toHaveAttribute('data-collapsed', 'true');
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        // The attribute alone proves only that the handler ran; assert the content is
        // actually gone, so a broken [data-collapsed] rule cannot pass this test.
        if (bodyExists) await expect(body).toBeHidden();
        await toggle.click();
        await expect(panel).toHaveAttribute('data-collapsed', 'false');
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        if (bodyExists) await expect(body).toBeVisible();
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

test('the description is edited in place, not in a second box', async ({ page }) => {
    test.setTimeout(120000);
    await waitForClingoReady(page);
    await page.selectOption('#example-select', 'conflict_cycle');
    await expect(page.locator('#simple-description-preview')).toBeVisible({ timeout: 10000 });

    const preview = page.locator('#simple-description-preview');
    const field = page.locator('#simple-description-content');
    const editBtn = page.locator('#simple-edit-description-btn');

    // The separate "Edit Description" card is gone; the field shares the card with the preview,
    // so it can no longer show the same text twice.
    await expect(page.locator('#simple-description-box')).toHaveCount(0);
    expect(await page.evaluate(() => {
        const p = document.getElementById('simple-description-preview');
        const t = document.getElementById('simple-description-content');
        return p.parentElement === t.parentElement && p.parentElement.id === 'simple-description-bar';
    })).toBe(true);

    // read mode
    await expect(preview).toBeVisible();
    await expect(field).toBeHidden();
    await expect(editBtn).toHaveText('Edit');

    // Edit swaps the field into the same slot and focuses it
    await editBtn.click();
    await expect(field).toBeVisible();
    await expect(preview).toBeHidden();
    await expect(editBtn).toHaveText('Done');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('simple-description-content');

    // Clearing the field must NOT tear it away mid-edit -- keying visibility on "has text"
    // alone made the description impossible to empty and retype.
    await field.fill('');
    await expect(field).toBeVisible();
    await expect(page.locator('#simple-description-bar')).toBeVisible();

    await field.fill('MARKER edited in place.');
    await editBtn.click();
    await expect(editBtn).toHaveText('Edit');
    await expect(preview).toContainText('MARKER edited in place.');
    await expect(field).toBeHidden();

    // and the edit reaches the framework, which in Simple mode is only generated on switch
    await page.selectOption('#input-mode', 'advanced');
    await expect(page.locator('#code-editor')).toHaveValue(/MARKER edited in place\./, { timeout: 15000 });
    await page.selectOption('#input-mode', 'simple');
    await expect(preview).toContainText('MARKER edited in place.');

    // Remove clears the card and brings back the Add affordance; Add reopens in place
    await page.locator('#simple-remove-description-btn').click();
    await expect(page.locator('#simple-description-bar')).toBeHidden();
    await expect(page.locator('#simple-add-comment-container')).toBeVisible();
    await page.locator('#simple-add-comment-btn').click();
    await expect(field).toBeVisible();
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('simple-description-content');
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
    await settled(page);
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

test('clicking a node opens a populated popup', async ({ page }) => {
    test.setTimeout(120000);
    await waitForClingoReady(page);
    await page.selectOption('#example-select', 'conflict_cycle');
    await settled(page);

    // Regression: graph-manager parses each builder's HTML into an HTMLElement before giving
    // it to vis (vis escapes a string title), but PopupManager ran a /<[a-z]/ regex against
    // that Element -- which stringifies to "[object HTMLDivElement]". No match, no fallback
    // taken, so every click popup rendered an empty box in all three graph modes.
    //
    // Ask vis where a node actually is rather than sweeping the canvas: node positions are
    // physics-driven, so a blind grid of clicks is exactly the flakiness this suite is
    // removing elsewhere.
    // Centre a node under the canvas midpoint and click there. Barnes-Hut keeps moving the
    // nodes, so reading a position and then clicking it races the physics; focus() pins the
    // node to a known point instead.
    await page.locator('#cy').scrollIntoViewIfNeeded();
    const target = await page.evaluate(async () => {
        const gm = window.playground?.graphManager;
        const ids = gm?.networkData?.nodes?.getIds?.() || [];
        if (!gm?.network || ids.length === 0) return null;
        gm.network.focus(ids[0], { scale: 1, animation: false });
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const box = document.getElementById('cy').getBoundingClientRect();
        return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    });
    expect(target, 'the graph drew no nodes to click').not.toBeNull();

    await page.mouse.click(target.x, target.y);
    const popup = page.locator('.node-popup');
    await expect(popup).toHaveCount(1);
    const popupText = (await popup.first().innerText()).trim();
    expect(popupText, 'the popup opened but rendered nothing').not.toBe('[object HTMLDivElement]');
    expect(popupText.length).toBeGreaterThan(2);
});

test('a file that is not a framework is refused instead of solving as empty',
    async ({ page }) => {
        await waitForClingoReady(page);

        // Regression: parseWabaFile dropped every unrecognised line silently, so a wrong-format
        // upload became four empty arrays -- an EMPTY framework, which then reported
        // SATISFIABLE with one extension over a framework the user never loaded.
        await page.setInputFiles('#file-upload-input', {
            name: 'notes.waba',
            mimeType: 'text/plain',
            buffer: Buffer.from('Shopping list\n- milk\n- bread\n')
        });
        await settled(page);

        await expect(page.locator('#output')).toContainText(/does not look like a \.waba file/i);
        await expect(page.locator('.answer-header')).toHaveCount(0);
    });

test('running with an empty editor clears the previous run', async ({ page }) => {
    test.setTimeout(90000);
    await waitForClingoReady(page);
    await page.selectOption('#example-select', 'conflict_cycle');
    await settled(page);
    await page.click('#run-btn');
    await expect(page.locator('.answer-header').first()).toBeVisible({ timeout: 60000 });

    // Regression: the "No framework code to run" early return left the previous extensions,
    // stats and graph highlight on screen, asserting a framework no longer in the editor.
    await page.selectOption('#input-mode', 'advanced');
    await page.fill('#code-editor', '');
    await page.click('#run-btn');

    await expect(page.locator('#output')).toContainText('No framework code to run');
    await expect(page.locator('.answer-header')).toHaveCount(0);
});

test('a collapsed Results panel is reopened when a run lands', async ({ page }) => {
    test.setTimeout(90000);
    await waitForClingoReady(page);
    await page.selectOption('#example-select', 'conflict_cycle');
    await settled(page);

    // Collapse state persists in localStorage, so a user who once collapsed Results kept
    // every later run invisible -- which reads as the solver having failed.
    const panel = page.locator('.panel[data-panel="output"]');
    await panel.locator('.panel-toggle').click();
    await expect(panel).toHaveAttribute('data-collapsed', 'true');

    await page.click('#run-btn');
    await expect(page.locator('.answer-header').first()).toBeVisible({ timeout: 60000 });
    await expect(panel).toHaveAttribute('data-collapsed', 'false');
});

test('out-of-range numeric input is clamped and reflected back', async ({ page }) => {
    await waitForClingoReady(page);

    // `min`/`max` are only enforced by native form validation, which this page never runs.
    await page.fill('#timeout-input', '99999');
    await page.fill('#num-models-input', '-4');
    await page.locator('#budget-input').focus();
    const clamped = await page.evaluate(
        () => window.playground.configController.getCurrentConfig());
    expect(clamped.timeout).toBe(600000);
    expect(clamped.numModels).toBe(0);
    await expect(page.locator('#timeout-input')).toHaveValue('600');
    await expect(page.locator('#num-models-input')).toHaveValue('0');
});

test('the stats line reports the bound direction the algebra actually applies',
    async ({ page }) => {
        test.setTimeout(120000);
        await waitForClingoReady(page);
        await page.selectOption('#example-select', 'conflict_cycle');
        await settled(page);
        await page.selectOption('#semantics-select', 'admissible');

        // semantics/admissible.lp derives the bound from the POLARITY: `#sum{paid} <= beta`
        // under oplus=max, `#min{paid} >= beta` under oplus=min. Hard-coding "<= beta" told a
        // cost-algebra user to RAISE beta for more results, when raising it removes them.
        await page.selectOption('#semiring-select', 'godel');
        await page.fill('#budget-input', '8');
        await page.click('#run-btn');
        await runFinished(page);
        await expect(page.locator('#stats')).toContainText('unanswered objections ≤ β');

        await page.selectOption('#semiring-select', 'tropical');
        await page.fill('#budget-input', '0');
        await page.click('#run-btn');
        await runFinished(page);
        await expect(page.locator('#stats')).toContainText('every unanswered objection ≥ β');
    });

test('the algebra is flagged unused whenever no weight is priced', async ({ page }) => {
    test.setTimeout(120000);
    await waitForClingoReady(page);
    await page.selectOption('#example-select', 'conflict_cycle');
    await settled(page);

    // ABA recovery zeroes beta and loads no_discard, so NOTHING is priced -- including a
    // defence semantics' own budget. weightsWereConsulted() used to short-circuit on the
    // defence check before it ever looked at abaRecovery, so the stats line credited the
    // algebra and denied the discarding in the same sentence.
    const abaToggle = page.locator('label.switch-toggle[for="aba-recovery-toggle"] .switch-slider');
    for (const semantics of ['stable', 'admissible']) {
        await page.selectOption('#semantics-select', semantics);
        if (!await page.locator('#aba-recovery-toggle').isChecked()) await abaToggle.click();
        await page.click('#run-btn');
        await runFinished(page);
        await expect(page.locator('#stats'), `${semantics} under ABA recovery`)
            .toContainText('no weight is priced');
        await expect(page.locator('#stats')).toContainText('no discarding (ABA recovery)');
    }
});

test('a commented-out fact is not read as a live one', async ({ page }) => {
    test.setTimeout(120000);
    await waitForClingoReady(page);

    // The no-extensions diagnosis scanned the raw source, so `% weight(a, 5).` left in while
    // trying another value was enough to accuse the user of a duplicate weight -- on a
    // framework core/base.lp accepts without complaint. Same for a commented-out head/body
    // pair and the derivation-cycle diagnosis. clingo strips comments; so must we.
    await page.setInputFiles('#file-upload-input', {
        name: 'commented.lp',
        mimeType: 'text/plain',
        buffer: Buffer.from(
            '% weight(a, 5).\n'
            + '% head(r9, p). body(r9, q).\n'
            + 'assumption(a). assumption(b). assumption(c).\n'
            + 'weight(a, 10). weight(b, 3). weight(c, 3).\n'
            + 'head(r1, ca). body(r1, b).\n'
            + 'head(r2, cb). body(r2, c).\n'
            + 'head(r3, cc). body(r3, a).\n'
            + 'head(r5, q). body(r5, p).\n'
            + 'contrary(a, ca). contrary(b, cb). contrary(c, cc).\n'
        )
    });
    await settled(page);
    await page.selectOption('#budget-select', 'none');
    await page.click('#run-btn');
    await runFinished(page);

    // The odd cycle really is UNSAT with nothing conceded -- but for the cycle, not for a
    // duplicate weight or a derivation cycle that exist only inside comments.
    const output = await page.locator('#output').innerText();
    expect(output, 'accused the user of a weight that is commented out')
        .not.toMatch(/more than one weight/);
    expect(output, 'reported a derivation cycle that is commented out')
        .not.toMatch(/depend.? on themselves|not well-founded/i);
});

test('a failed run reopens the Results panel too', async ({ page }) => {
    test.setTimeout(90000);
    await waitForClingoReady(page);
    await page.selectOption('#example-select', 'conflict_cycle');
    await settled(page);

    // The expand was on the success path only, so the four paths that write a FAILURE into
    // #output still wrote it into a display:none panel -- a failure the user cannot see.
    const panel = page.locator('.panel[data-panel="output"]');
    await panel.locator('.panel-toggle').click();
    await expect(panel).toHaveAttribute('data-collapsed', 'true');

    await page.selectOption('#input-mode', 'advanced');
    await page.fill('#code-editor', '');
    await page.click('#run-btn');
    await runFinished(page);

    await expect(panel).toHaveAttribute('data-collapsed', 'false');
    await expect(page.locator('#output')).toContainText('No framework code to run');
});

test('a defence detour returns the budget and the Results choice intact', async ({ page }) => {
    await waitForClingoReady(page);
    await page.selectOption('#example-select', 'conflict_cycle');
    await settled(page);
    await page.selectOption('#semantics-select', 'stable');
    await page.selectOption('#budget-select', 'sum-ub');
    await page.fill('#budget-input', '8');
    await page.selectOption('#results-select', 'min');

    // Two destructive writes: the algebra preselect's beta reset fired through the defence
    // pin and never restored, and resultsSelect was overwritten with no snapshot at all.
    await page.selectOption('#semantics-select', 'admissible');
    await page.selectOption('#semiring-select', 'tropical');
    await expect(page.locator('#budget-input')).toHaveValue('0');
    await page.selectOption('#semiring-select', 'godel');
    await page.selectOption('#semantics-select', 'stable');

    await expect(page.locator('#budget-select')).toHaveValue('sum-ub');
    await expect(page.locator('#budget-input'), 'beta lost across the detour').toHaveValue('8');
    await expect(page.locator('#results-select'), 'Results choice lost').toHaveValue('min');
});

test('selecting an extension restyles edges without moving anything', async ({ page }) => {
    test.setTimeout(120000);
    await waitForClingoReady(page);
    await page.selectOption('#example-select', 'conflict_cycle');
    await settled(page);
    await page.click('#run-btn');
    await runFinished(page);
    await settled(page);

    const snapshot = () => page.evaluate(() => {
        const gm = window.playground.graphManager;
        const positions = gm.network.getPositions();
        return {
            geometry: gm.networkData.edges.get().map((e) => ({
                id: e.id, type: e.smooth?.type, roundness: e.smooth?.roundness
            })).sort((a, b) => a.id.localeCompare(b.id)),
            positions,
            colours: gm.networkData.edges.get().map((e) => e.color?.color).sort()
        };
    });

    const before = await snapshot();
    await page.locator('.answer-header').first().click();
    await page.waitForTimeout(400);
    const after = await snapshot();

    // The reported bug: conceding an attack straightened its curve while every neighbour
    // stayed bowed, because the discarded branch wrote `smooth: {enabled: false}`. State is
    // colour/width/dash only -- geometry is assigned once and is immutable.
    expect(after.geometry, 'selecting an extension must not change edge geometry')
        .toEqual(before.geometry);
    expect(after.positions, 'nor move any node').toEqual(before.positions);
    // ...but it must actually restyle something, or the test proves nothing.
    expect(after.colours).not.toEqual(before.colours);
});

test('the three attack states stay distinguishable without colour', async ({ page }) => {
    test.setTimeout(120000);
    await waitForClingoReady(page);
    await page.selectOption('#example-select', 'conflict_cycle');
    await settled(page);
    await page.click('#run-btn');
    await runFinished(page);
    await page.locator('.answer-header').first().click();
    await page.waitForTimeout(400);

    const states = await page.evaluate(() => window.playground.graphManager.networkData.edges
        .get().map((e) => ({ w: e.width, dashed: Array.isArray(e.dashes), c: e.color?.color })));
    const conceded = states.filter((e) => e.dashed);
    const solid = states.filter((e) => !e.dashed);
    expect(conceded.length, 'this example concedes an attack at the preset budget')
        .toBeGreaterThan(0);
    // A conceded attack was PAID FOR. It must not be drawn heavier than one that lands.
    const heaviestSolid = Math.max(...solid.map((e) => e.w));
    expect(Math.max(...conceded.map((e) => e.w))).toBeLessThanOrEqual(heaviestSolid);
    // No state may be carried by hue alone.
    expect(new Set(states.map((e) => e.c)).size).toBeGreaterThan(1);
    expect(new Set(states.map((e) => e.w)).size).toBeGreaterThan(1);
});

test('fullscreen gives the graph the height it gains', async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1400, height: 1000 });
    await waitForClingoReady(page);
    await page.selectOption('#example-select', 'conflict_cycle');
    await settled(page);

    const measure = () => page.evaluate(() => {
        const h = (sel) => Math.round(document.querySelector(sel).getBoundingClientRect().height);
        return {
            content: h('#panel-graph-content'),
            cy: h('#cy'),
            // The canvas BACKING STORE, not its CSS box: the element is styled 100%/100% so its
            // box stretches even when vis has not re-measured, and the stale drawing surface
            // underneath is what breaks hit-testing.
            canvas: Math.round(document.querySelector('#cy canvas').height / devicePixelRatio),
            display: getComputedStyle(document.querySelector('#panel-graph-content')).display
        };
    });

    const windowed = await measure();
    await page.click('#fullscreen-btn');
    await page.waitForFunction(() => Boolean(document.fullscreenElement), null, { timeout: 10000 });
    await page.waitForTimeout(800);
    const full = await measure();

    // The fullscreen rules used to be grouped selector lists containing `:-moz-full-screen`
    // and `:-ms-fullscreen`. CSS drops the WHOLE rule when any selector in the list is
    // unrecognised, so Chromium applied none of them: the panel grew to 100vh while
    // .panel-content stayed `display: block`, #cy's `flex: 1` did nothing, and its fixed 500px
    // stood -- a short band of graph with dead space beneath it.
    expect(full.display, 'the fullscreen layout rules must actually apply').toBe('flex');
    expect(full.cy, 'the graph must grow with the panel').toBeGreaterThan(windowed.cy);
    expect(full.cy / full.content,
        'the graph should take most of the panel, not sit in a band').toBeGreaterThan(0.7);
    expect(Math.abs(full.canvas - full.cy),
        'the drawing surface must follow, not keep its windowed size').toBeLessThanOrEqual(4);

    await page.click('#fullscreen-btn');
    await page.waitForFunction(() => !document.fullscreenElement, null, { timeout: 10000 });
    await page.waitForTimeout(600);
    const back = await measure();
    expect(back.cy, 'and it must go back').toBe(windowed.cy);
});

test('the reference sheet is actually styled, and matches the control surface',
    async ({ page }) => {
        test.setTimeout(120000);
        await waitForClingoReady(page);
        await page.click('#syntax-guide-btn');
        await expect(page.locator('#syntax-guide-modal')).toBeVisible();

        // The four tabs are gone. They were the visible failure: `.doc-tabs`, `.doc-tab`,
        // `.modal-content-large` and every table class had NO rule anywhere in style.css --
        // 16 of the modal's 27 classes -- so the tab bar fell back to the browser's default
        // button chrome and the "large" modal was never large.
        await expect(page.locator('.doc-tab')).toHaveCount(0);

        // Guard the root cause, not the symptom: every class the sheet uses must resolve to
        // something. A class with no rule looks like a layout bug, not a missing stylesheet.
        const unstyled = await page.evaluate(() => {
            const sheet = document.querySelector('#syntax-guide-modal');
            const used = new Set();
            sheet.querySelectorAll('[class]').forEach((el) =>
                el.classList.forEach((c) => used.add(c)));
            const declared = new Set();
            for (const ss of document.styleSheets) {
                let rules;
                try { rules = ss.cssRules; } catch { continue; }
                for (const r of rules) {
                    (r.selectorText || '').split(',').forEach((sel) => {
                        for (const m of sel.matchAll(/\.([\w-]+)/g)) declared.add(m[1]);
                    });
                }
            }
            return [...used].filter((c) => !declared.has(c));
        });
        expect(unstyled, 'reference-sheet classes with no CSS rule').toEqual([]);

        // Keep the tables honest: the algebra rows must be exactly the algebras on offer.
        const blockByHeading = (heading) => page.locator('.doc-block')
            .filter({ has: page.locator('h3', { hasText: heading }) });
        const listed = await blockByHeading('Algebras')
            .locator('.doc-table tbody td:first-child').allTextContents();
        const offered = await page.locator('#semiring-select option').allTextContents();
        expect(listed.length, 'one row per selectable algebra').toBe(offered.length);
        for (const name of listed) {
            expect(offered.join(' | ').toLowerCase(),
                `${name} is documented but not selectable`)
                .toContain(name.trim().toLowerCase().replace('bottleneck-cost', 'bottleneck'));
        }

        // ...and the budget readings must be the ones the control actually offers.
        const readings = await blockByHeading('Budget')
            .locator('.doc-table tbody td:first-child').allTextContents();
        expect(readings.length).toBe(await page.locator('#budget-select option').count());
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
    // The page's whole purpose is detecting a stale cached bundle, which it never checked.
    await expect(page.locator('#status')).toContainText(/Serving version \d{8}-\d+/);
    await expect(page.locator('#status .fail')).toHaveCount(0);
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
        await settled(page);
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
                // Panels are chip-based now; a bare label row means the old markup came back.
                sawLabelRows: [...nodes, ...edges].some((x) => /Rule \/ derivation:|Target assumption:|Supported attacking atom:/.test(text(x.title))),
                // Nothing may exceed the bound, which is what made them fill the screen.
                overWide: [...nodes, ...edges].filter((x) => {
                    const el = typeof x.title === 'object' ? x.title : null;
                    if (!el) return false;
                    document.body.appendChild(el);
                    const w = el.getBoundingClientRect().width;
                    el.remove();
                    return w > 360;
                }).map((x) => x.id),
                chipCounts: [...nodes, ...edges].map((x) => {
                    const el = typeof x.title === 'object' ? x.title : null;
                    return el ? el.querySelectorAll('.gt-chip').length : 0;
                })
            };
        });
        expect(audit.nodes, `${mode} drew no nodes`).toBeGreaterThan(0);
        expect(audit.untitledNodes, `${mode}: nodes with no tooltip`).toEqual([]);
        expect(audit.untitledEdges, `${mode}: edges with no tooltip`).toEqual([]);
        expect(audit.leaks, `${mode}: internal ids visible in tooltips`).toEqual([]);
        expect(audit.escaped, `${mode}: tooltip markup rendered as text`).toEqual([]);
        expect(audit.sawLabelRows, `${mode}: a pre-chip label row is back`).toBe(false);
        expect(audit.overWide, `${mode}: panels wider than the bound`).toEqual([]);
        // every panel must actually carry chips, or it is an empty shell
        expect(Math.min(...audit.chipCounts), `${mode}: a panel has no chips`).toBeGreaterThan(0);
    }

    // Selecting an extension must annotate NODES, not only edges.
    await page.locator('.mode-option', { hasText: 'Assumption-Branching' }).click();
    await settled(page);
    await page.locator('.answer-header').first().click();
    await settled(page);
    const state = await page.evaluate(() => {
        const gm = window.playground.graphManager;
        // State is a CHIP now, not a "State:" / "In this extension:" prose row.
        const hasChip = (t, selector) => (t && typeof t === 'object' ? !!t.querySelector(selector) : false);
        return {
            nodeMembership: gm.networkData.nodes.get()
                .some((n) => hasChip(n.title, '.gt-chip-in, .gt-chip-out')),
            edgeState: gm.networkData.edges.get()
                .some((e) => hasChip(e.title, '.gt-chip-active, .gt-chip-discarded, .gt-chip-out'))
        };
    });
    expect(state.nodeMembership, 'no node reported its IN/OUT membership').toBe(true);
    expect(state.edgeState, 'no edge reported its attack state').toBe(true);
});

test('a timed-out run does not poison the session', async ({ page }) => {
    test.setTimeout(180000);
    await waitForClingoReady(page);

    // Rejecting the timeout race does not stop clingo; the abandoned solve keeps the single WASM
    // worker, and the queue used to advance on the timeout rather than on the solver. One
    // timeout then made every later run time out, including frameworks that solve in
    // milliseconds on a fresh page.
    const probe = await page.evaluate(async () => {
        const cm = window.playground.clingoManager;
        const heavy = Array.from({ length: 20 }, (_, i) => `assumption(a${i}). contrary(a${i}, c${i}).`).join('\n');
        const light = 'assumption(x). contrary(x, cx).\nassumption(y). contrary(y, cy).\nhead(r1, cx). body(r1, y).';
        const cfg = (over) => ({
            semiring: 'godel', defaultPolicy: 'neutral', semantics: 'cf', budgetMode: 'none',
            optMode: 'ignore', beta: 0, filterType: 'projection', timeout: 3000, ...over
        });
        let timedOut = false;
        try { await cm.runWABA(heavy, cfg({}), () => {}); } catch { timedOut = true; }
        let after = null;
        try {
            const r = await cm.runWABA(light, cfg({ timeout: 20000 }), () => {});
            after = { result: r?.result?.Result, extensions: r?.result?.Call?.[0]?.Witnesses?.length ?? 0 };
        } catch (e) { after = { error: e.message }; }
        return { timedOut, after };
    });

    expect(probe.timedOut, 'the heavy framework was expected to exceed its timeout').toBe(true);
    expect(probe.after.error, 'the run after a timeout failed').toBeUndefined();
    expect(probe.after.extensions, 'the solver did not recover after a timeout').toBeGreaterThan(0);
});

test('ABA recovery actually recovers classical ABA for the defence semantics', async ({ page }) => {
    test.setTimeout(180000);
    await waitForClingoReady(page);
    await page.selectOption('#example-select', 'conflict_cycle');
    await settled(page);
    await page.selectOption('#semiring-select', 'godel');
    await page.selectOption('#semantics-select', 'admissible');
    // the preset carries beta = 8, which is what used to leak through
    await expect(page.locator('#budget-input')).toHaveValue('8');

    const runCount = async () => {
        await page.evaluate(() => { document.getElementById('output').innerHTML = ''; });
        await page.click('#run-btn');
        await page.waitForFunction(() => document.querySelectorAll('.answer-header').length > 0
            || /UNSATISFIABLE|No extensions/i.test(document.getElementById('output').textContent || ''),
            null, { timeout: 90000 });
        return page.locator('.answer-header').count();
    };

    const budgeted = await runCount();
    expect(budgeted).toBeGreaterThan(1);

    // The defence semantics price their own `pay` set, which constraint/no_discard.lp does not
    // touch, so disabling the beta box was not enough -- beta kept being spent and recovery
    // returned 7 extensions where classical ABA has 1.
    await page.locator('label.switch-toggle[for="aba-recovery-toggle"] .switch-slider').click();
    await expect(page.locator('#aba-recovery-toggle')).toBeChecked();
    const recovered = await runCount();
    expect(recovered, 'ABA recovery did not return the classical answer').toBe(1);

    // and the config it produces must be one the app accepts
    const state = await page.evaluate(async () => {
        const cfg = window.playground.configController.getCurrentConfig();
        const { validateConfig } = await import('./runtime/config-service.js');
        return { beta: cfg.beta, error: validateConfig(cfg) };
    });
    expect(state.beta, 'ABA recovery must zero beta').toBe(0);
    expect(state.error, 'ABA recovery produced a config the app rejects').toBeNull();
});

test('the hover panel appears next to the node it describes', async ({ page }) => {
    test.setTimeout(120000);
    await waitForClingoReady(page);
    await page.selectOption('#example-select', 'conflict_cycle');
    await settled(page);

    const probe = await page.evaluate(async () => {
        const gm = window.playground.graphManager;
        const net = gm.network;
        const id = gm.networkData.nodes.getIds()[0];
        // vis reports node positions in CONTAINER coordinates
        const dom = net.canvasToDOM(net.getPositions([id])[id]);
        const container = document.getElementById('cy');
        const rect = container.getBoundingClientRect();
        const point = { x: rect.left + dom.x, y: rect.top + dom.y };
        const canvas = container.querySelector('canvas');
        const move = () => canvas.dispatchEvent(new MouseEvent('mousemove',
            { clientX: point.x, clientY: point.y, bubbles: true }));
        move();
        await new Promise((r) => setTimeout(r, 900));
        move();
        await new Promise((r) => setTimeout(r, 900));
        const tip = container.querySelector('.vis-tooltip');
        if (!tip) return { found: false };
        const t = tip.getBoundingClientRect();
        return {
            found: true,
            position: getComputedStyle(tip).position,
            distance: Math.hypot(t.left - point.x, t.top - point.y),
            // vis writes container-relative offsets; they are only correct under `absolute`
            inlineLeft: tip.style.left,
            containerOffset: Math.round(rect.left)
        };
    });

    expect(probe.found, 'no tooltip appeared on hover').toBe(true);
    // The regression this guards: overriding vis's `absolute` to `fixed` reinterprets its
    // container-relative left/top against the viewport, throwing the panel to the top-left of
    // the page while the node sits elsewhere.
    expect(probe.position, 'vis positions its tooltip with container-relative offsets').toBe('absolute');
    expect(probe.distance, `panel landed ${Math.round(probe.distance)}px from its node`).toBeLessThan(250);
});

test('the legend matches what the diagrams actually draw', async ({ page }) => {
    test.setTimeout(240000);
    await waitForClingoReady(page);

    // Every legend swatch must be styled. A class with no rule renders as an empty gap, which
    // reads as a missing symbol rather than a missing stylesheet.
    const unstyled = await page.evaluate(() => {
        const paints = (el) => {
            const cs = getComputedStyle(el);
            if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)'
                || cs.backgroundImage !== 'none'
                || parseFloat(cs.borderTopWidth) > 0
                || parseFloat(cs.borderBottomWidth) > 0) {
                return true;
            }
            // A ::after terminator counts, and so does a swatch that is a container for
            // painted children (the #sup/#inf pair shows both thicknesses at once).
            const after = getComputedStyle(el, '::after');
            if (after.content !== 'none') return true;
            return [...el.children].some(paints);
        };
        return [...document.querySelectorAll('.legend-symbol')]
            .filter((el) => !paints(el)).map((el) => el.className);
    });
    expect(unstyled, 'legend swatches with no visible styling').toEqual([]);

    // Every legend item must carry an explanation, which is the point of the legend.
    const unexplained = await page.evaluate(() => [...document.querySelectorAll('.legend-item')]
        .filter((el) => !(el.querySelector('.legend-text em')?.textContent || '').trim())
        .map((el) => el.textContent.trim().slice(0, 40)));
    expect(unexplained, 'legend entries with no explanation').toEqual([]);

    // And the colours the diagrams actually use must all be accounted for by a swatch. This is
    // the check that catches the legend drifting from the renderers -- self-loops were drawn on
    // the default example without appearing in the legend at all.
    const legendColours = await page.evaluate(() => {
        const norm = (c) => {
            const d = document.createElement('div');
            d.style.color = c; document.body.appendChild(d);
            const v = getComputedStyle(d).color; d.remove(); return v;
        };
        return [...new Set([...document.querySelectorAll('.legend-symbol')].flatMap((el) => {
            const cs = getComputedStyle(el);
            return [cs.backgroundColor, cs.borderTopColor, cs.borderBottomColor, norm(cs.backgroundImage.match(/rgb\([^)]*\)/)?.[0] || 'transparent')];
        }))];
    });

    for (const [example, mode] of [
        ['conflict_cycle', 'Standard'],
        ['kpg_impact_vs_deccan', 'Assumption-Branching'],
        ['kpg_impact_vs_deccan', 'Assumption-Direct']
    ]) {
        await page.selectOption('#example-select', example);
        await settled(page);
        await page.locator('.mode-option', { hasText: mode }).click();
        await settled(page);
        const drawn = await page.evaluate(() => {
            const gm = window.playground.graphManager;
            const hex = (c) => (typeof c === 'string' ? c : (c && (c.background || c.color)) || null);
            return {
                nodes: [...new Set(gm.networkData.nodes.get().map((n) => hex(n.color)).filter(Boolean))],
                edges: [...new Set(gm.networkData.edges.get().map((e) => hex(e.color)).filter(Boolean))],
                selfLoops: gm.networkData.edges.get().filter((e) => e.from === e.to).length
            };
        });
        // Not asserting an exact colour match (the legend renders hex via computed rgb), but
        // every mode must draw SOMETHING and the legend must have a self-loop entry whenever
        // self-loops are drawn.
        if (mode !== 'Standard' || drawn.nodes.length > 0) {
            expect(drawn.nodes.length, `${example}/${mode} drew no nodes`).toBeGreaterThan(0);
        }
        if (drawn.selfLoops > 0) {
            expect(await page.locator('.legend-symbol.edge-selfloop').count(),
                `${example}/${mode} draws ${drawn.selfLoops} self-loops but the legend has no entry`)
                .toBeGreaterThan(0);
        }
    }
    expect(legendColours.length, 'the legend paints no distinct colours').toBeGreaterThan(3);
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
    await settled(page);
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
