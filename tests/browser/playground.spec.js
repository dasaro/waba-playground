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
    await expect(page.locator('#semiring-select option')).toHaveText(['Gödel', 'Tropical', 'Łukasiewicz']);
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

    await page.selectOption('#example-select', 'conflict_cycle');
    await page.selectOption('#show-select', 'projection');
    await page.click('#run-btn');
    await expect(page.locator('.answer-header').first()).toBeVisible({ timeout: 60000 });

    // Attack provenance: conflict_cycle has no fact-based attacks, so every attack
    // line must name its supporting assumption (e.g. "climate ⊬ against_welfare …"),
    // never the ⊤ fallback — even in projection mode, which omits head/body from the
    // witness (regression guard for the framework-source provenance fallback).
    const attackTexts = await page.locator('.attack-item').allTextContents();
    expect(attackTexts.length).toBeGreaterThan(0);
    for (const text of attackTexts) {
        expect(text.trim().startsWith('⊤')).toBe(false);
    }

    await page.selectOption('#semantics-select', 'grounded');
    await page.click('#run-btn');
    await expect(page.locator('.answer-header').first()).toBeVisible({ timeout: 60000 });

    expect(pageErrors).toEqual([]);
});

test('exact preferred flow renders and graph modes switch without regressions', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await waitForClingoReady(page);

    await page.selectOption('#example-select', 'conflict_cycle');
    await page.selectOption('#semantics-select', 'preferred');
    // preferred is a defence semantics -> the budget is forced to none and the
    // constraint control is disabled (defence runs on the no-discard surface).
    await expect(page.locator('#constraint-select')).toBeDisabled();
    await expect(page.locator('#constraint-select')).toHaveValue('none');
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

    await page.selectOption('#example-select', 'conflict_cycle');
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

    await page.selectOption('#example-select', 'arctic_grounds');
    await page.selectOption('#semantics-select', 'stable');
    await page.selectOption('#constraint-select', 'ub');
    await page.selectOption('#monoid-select', 'sum');
    await page.selectOption('#optimize-select', 'minimize');
    await page.fill('#budget-input', '20');
    await page.selectOption('#opt-mode-select', 'optN');
    await page.selectOption('#show-select', 'projection');
    await page.click('#run-btn');
    await expect(page.locator('.answer-header').first()).toBeVisible({ timeout: 60000 });

    await page.selectOption('#example-select', 'conflict_cycle');
    await page.selectOption('#semantics-select', 'admissible');
    // admissible (defence) forces the no-discard surface: the budget + opt-mode
    // controls are disabled (nothing to discard/optimise).
    await expect(page.locator('#constraint-select')).toBeDisabled();
    await expect(page.locator('#opt-mode-select')).toBeDisabled();
    await page.click('#run-btn');
    await expect(page.locator('.answer-header').first()).toBeVisible({ timeout: 60000 });

    expect(pageErrors).toEqual([]);
});
