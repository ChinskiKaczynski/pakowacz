import { test, expect } from '@playwright/test';

test.describe('TOD 2026 KR Features', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    // E2E Test 1: Seasonal surcharge visible in breakdown
    test('should show seasonal surcharge in price breakdown when enabled', async ({ page }) => {
        // Fill in dimensions
        await page.fill('#lengthCm', '80');
        await page.fill('#widthCm', '60');
        await page.fill('#heightCm', '100');
        await page.fill('#weightKg', '50');

        // Ensure seasonal is enabled (default should be on)
        // Open TOD accordion if needed
        await page.click('text=Dopłaty % (TOD 2026 KR)');

        // Verify seasonal checkbox is checked
        const seasonalCheckbox = page.locator('#seasonalEnabled');
        await expect(seasonalCheckbox).toBeChecked();

        // Submit form
        await page.click('button[type="submit"]');

        // Check for seasonal in breakdown
        await expect(page.locator('text=Dodatek sezonowy')).toBeVisible();
        await expect(page.locator('text=6.5%')).toBeVisible();
    });

    // E2E Test 2: Redelivery with attempts increases price
    test('should increase price when redelivery with attempts=2 is enabled', async ({ page }) => {
        // Fill in dimensions
        await page.fill('#lengthCm', '80');
        await page.fill('#widthCm', '60');
        await page.fill('#heightCm', '100');
        await page.fill('#weightKg', '50');

        // First, submit without redelivery
        await page.click('button[type="submit"]');

        // Get initial price
        const initialPriceText = await page.locator('text=Brutto:').locator('..').locator('span').last().textContent();
        const initialPrice = parseFloat(initialPriceText?.replace(' PLN', '').replace(',', '.') || '0');

        // Reset
        await page.click('button:has-text("Reset")');

        // Fill in dimensions again
        await page.fill('#lengthCm', '80');
        await page.fill('#widthCm', '60');
        await page.fill('#heightCm', '100');
        await page.fill('#weightKg', '50');

        // Open TOD services accordion
        await page.click('text=Usługi dodatkowe TOD');

        // Enable redelivery
        await page.click('#redeliveryEnabled');

        // Set attempts to 2
        await page.fill('#redeliveryAttempts', '2');

        // Submit form
        await page.click('button[type="submit"]');

        // Get new price
        const newPriceText = await page.locator('text=Brutto:').locator('..').locator('span').last().textContent();
        const newPrice = parseFloat(newPriceText?.replace(' PLN', '').replace(',', '.') || '0');

        // Price should be higher with redelivery
        expect(newPrice).toBeGreaterThan(initialPrice);

        // Should show redelivery in breakdown
        await expect(page.locator('text=Ponowna dostawa')).toBeVisible();
        await expect(page.locator('text=(×2)')).toBeVisible();
    });

    // E2E Test 3: Carry-in surcharge when dimension sum > 400cm
    test('should show carry-in surcharge when dimension sum exceeds 400cm', async ({ page }) => {
        // Fill in large dimensions (sum > 400)
        await page.fill('#lengthCm', '150');
        await page.fill('#widthCm', '150');
        await page.fill('#heightCm', '120'); // Sum = 420 > 400
        await page.fill('#weightKg', '50');

        // Open TOD services accordion
        await page.click('text=Usługi dodatkowe TOD');

        // Enable carry-in
        await page.click('#carryInEnabled');

        // Submit form
        await page.click('button[type="submit"]');

        // Should show carry-in and surcharge
        await expect(page.locator('text=Wniesienie/Zniesienie')).toBeVisible();
        await expect(page.locator('text=Dopłata do wniesienia')).toBeVisible();
        // 60 PLN surcharge
        await expect(page.locator('text=+60.00 PLN')).toBeVisible();
    });

    // E2E Test 4: Fuel/Road percentages are editable
    test('should allow editing fuel and road percentages', async ({ page }) => {
        // Open surcharges accordion
        await page.click('text=Dopłaty % (TOD 2026 KR)');

        // Edit fuel percent
        await page.fill('#fuelPercent', '25');

        // Edit road percent
        await page.fill('#roadPercent', '18');

        // Fill in dimensions
        await page.fill('#lengthCm', '80');
        await page.fill('#widthCm', '60');
        await page.fill('#heightCm', '100');
        await page.fill('#weightKg', '50');

        // Submit form
        await page.click('button[type="submit"]');

        // Check breakdown shows new percentages
        await expect(page.locator('text=Korekta paliwowa (25%)')).toBeVisible();
        await expect(page.locator('text=Opłata drogowa (18%)')).toBeVisible();
    });

    // E2E Test 5: Transport rate calculation shown
    test('should show transport rate (freight + fuel + road) in breakdown', async ({ page }) => {
        // Fill in dimensions
        await page.fill('#lengthCm', '80');
        await page.fill('#widthCm', '60');
        await page.fill('#heightCm', '100');
        await page.fill('#weightKg', '50');

        // Submit form
        await page.click('button[type="submit"]');

        // Check for transport rate line
        await expect(page.locator('text=Stawka transportowa:')).toBeVisible();
    });

    // E2E Test 6: TOD settings persist after page reload
    test('should persist TOD settings in localStorage', async ({ page }) => {
        // Open surcharges accordion
        await page.click('text=Dopłaty % (TOD 2026 KR)');

        // Change fuel percent
        await page.fill('#fuelPercent', '30');

        // Open services accordion
        await page.click('text=Usługi dodatkowe TOD');

        // Enable repickup
        await page.click('#repickupEnabled');

        // Reload page
        await page.reload();

        // Open accordions
        await page.click('text=Dopłaty % (TOD 2026 KR)');

        // Verify fuel percent is saved
        await expect(page.locator('#fuelPercent')).toHaveValue('30');

        // Open services
        await page.click('text=Usługi dodatkowe TOD');

        // Verify repickup is still enabled
        await expect(page.locator('#repickupEnabled')).toBeChecked();
    });
});
