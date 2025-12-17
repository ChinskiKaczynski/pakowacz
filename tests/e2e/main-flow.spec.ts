import { test, expect } from '@playwright/test';

test.describe('Pallet Optimizer', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('should display form and calculate recommendation', async ({ page }) => {
        // Fill in dimensions
        await page.fill('#lengthCm', '80');
        await page.fill('#widthCm', '60');
        await page.fill('#heightCm', '100');
        await page.fill('#weightKg', '50');

        // Submit form
        await page.click('button[type="submit"]');

        // Check for recommendation
        await expect(page.locator('text=Rekomendacja')).toBeVisible();
        await expect(page.locator('text=PLN')).toBeVisible();
    });



    test('should show warning when no pallet fits', async ({ page }) => {
        // Fill in oversized dimensions
        await page.fill('#lengthCm', '300');
        await page.fill('#widthCm', '200');
        await page.fill('#heightCm', '100');
        await page.fill('#weightKg', '50');

        // Submit form
        await page.click('button[type="submit"]');

        // Should show no match warning
        await expect(page.locator('text=Brak dopasowania')).toBeVisible();
        await expect(page.locator('text=Żaden nośnik nie spełnia wymagań')).toBeVisible();
    });

    test('should reset form and results', async ({ page }) => {
        // Fill in dimensions
        await page.fill('#lengthCm', '80');
        await page.fill('#widthCm', '60');
        await page.fill('#heightCm', '100');
        await page.fill('#weightKg', '50');

        // Submit form
        await page.click('button[type="submit"]');

        // Verify result is shown
        await expect(page.locator('text=Rekomendacja')).toBeVisible();

        // Click reset
        await page.click('button:has-text("Reset")');

        // Result should be hidden
        await expect(page.locator('text=Rekomendacja')).not.toBeVisible();
    });

    test('should display alternatives section', async ({ page }) => {
        // Fill in dimensions that fit multiple pallets
        await page.fill('#lengthCm', '100');
        await page.fill('#widthCm', '80');
        await page.fill('#heightCm', '150');
        await page.fill('#weightKg', '80');

        // Submit form
        await page.click('button[type="submit"]');

        // Should show alternatives
        await expect(page.locator('text=Alternatywy')).toBeVisible();
    });

    test('should copy result to clipboard', async ({ page, context }) => {
        // Grant clipboard permissions
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);

        // Fill in dimensions
        await page.fill('#lengthCm', '80');
        await page.fill('#widthCm', '60');
        await page.fill('#heightCm', '100');
        await page.fill('#weightKg', '50');

        // Submit form
        await page.click('button[type="submit"]');

        // Click copy button
        await page.click('button:has-text("Kopiuj wynik")');

        // Should show copied confirmation
        await expect(page.locator('text=Skopiowano!')).toBeVisible();
    });
});
