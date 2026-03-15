import { test, expect } from '@playwright/test';

async function waitForClingoReady(page) {
    await page.goto('/');
    await expect(page.locator('#intro-status')).toContainText(/Clingo WASM loaded successfully|Loading Clingo WASM/);
    await page.waitForFunction(() => {
        const status = document.getElementById('intro-status');
        return status && /loaded successfully/i.test(status.textContent || '');
    }, null, { timeout: 60000 });
}

test('collapsible panels toggle cleanly', async ({ page }) => {
    await waitForClingoReady(page);
    await expect(page.locator('#semiring-select option')).toHaveText(['Gödel', 'Łukasiewicz']);
    await expect(page.locator('#default-policy-select option')).toHaveText(['Legacy', 'ABA', 'Neutral']);
    await expect(page.locator('#show-select option')).toHaveText(['Projection', 'Standard']);
    await expect(page.locator('#analysis-export-png-proxy')).toBeVisible();
    await expect(page.locator('[data-panel="analysis"]')).toContainText('Decision Analysis');

    for (const panelId of ['config', 'output', 'analysis']) {
        const panel = page.locator(`.panel[data-panel="${panelId}"]`);
        const toggle = panel.locator('.panel-toggle');
        await toggle.click();
        await expect(panel).toHaveAttribute('data-collapsed', 'true');
        await toggle.click();
        await expect(panel).toHaveAttribute('data-collapsed', 'false');
    }
});

test('curated stable and grounded runs complete without startup errors', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await waitForClingoReady(page);

    await page.selectOption('#example-select', 'simple_attack');
    await page.selectOption('#show-select', 'projection');
    await page.click('#run-btn');
    await expect(page.locator('.answer-header').first()).toBeVisible({ timeout: 60000 });

    await page.selectOption('#semantics-select', 'grounded');
    await page.click('#run-btn');
    await expect(page.locator('.answer-header').first()).toBeVisible({ timeout: 60000 });

    expect(pageErrors).toEqual([]);
});

test('exact preferred flow renders and graph modes switch without regressions', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await waitForClingoReady(page);

    await page.selectOption('#example-select', 'aspforaba_journal_example');
    await page.selectOption('#show-select', 'projection');
    await page.click('#run-btn');
    await expect(page.locator('.answer-header')).toHaveCount(1, { timeout: 60000 });

    await page.locator('.mode-option', { hasText: 'Assumption-Direct' }).click();
    await page.locator('.mode-option', { hasText: 'Assumption-Branching' }).click();
    await page.locator('.mode-option', { hasText: 'Standard' }).click();

    expect(pageErrors).toEqual([]);
});

test('analysis panel renders decision metrics and version check passes', async ({ page }) => {
    await waitForClingoReady(page);

    await page.selectOption('#example-select', 'simple_attack');
    await page.selectOption('#show-select', 'projection');
    await page.click('#run-btn');
    await expect(page.locator('#metrics-toggle-btn')).toBeVisible({ timeout: 60000 });
    await page.click('#metrics-toggle-btn');
    await expect(page.locator('#metrics-display')).toBeVisible();

    await page.goto('/version-check.html');
    await expect(page.locator('#status')).toContainText('Modules loaded successfully', { timeout: 60000 });
    await expect(page.locator('#status')).toContainText('GraphManager.initFullscreen() exists');
});

test('budgeted stable surface and subset-closure admissible smoke both run on the supported browser contract', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await waitForClingoReady(page);

    await page.selectOption('#example-select', 'strong_inference_bounded_lies');
    await page.selectOption('#semantics-select', 'stable');
    await page.selectOption('#constraint-select', 'ub');
    await page.selectOption('#monoid-select', 'count');
    await page.selectOption('#optimize-select', 'minimize');
    await page.fill('#budget-input', '2');
    await page.selectOption('#opt-mode-select', 'optN');
    await page.selectOption('#show-select', 'projection');
    await page.click('#run-btn');
    await expect(page.locator('.answer-header').first()).toBeVisible({ timeout: 60000 });

    await page.selectOption('#example-select', 'subset_closure_counterattack');
    await page.selectOption('#semantics-select', 'admissible');
    await page.selectOption('#constraint-select', 'none');
    await page.selectOption('#opt-mode-select', 'ignore');
    await page.click('#run-btn');
    const renderedAnswers = await page.locator('.textual-result-content').allTextContents();
    expect(renderedAnswers.some((text) => text.includes('in(a).') && text.includes('in(e).'))).toBeTruthy();

    expect(pageErrors).toEqual([]);
});
