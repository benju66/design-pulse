import { test, expect } from '@playwright/test';

/**
 * E2E: Core Decision Engine Flow
 *
 * Tests the critical user journey:
 * 1. Login → Dashboard
 * 2. Navigate to project → Value Matrix
 * 3. Verify grid loads with data
 * 4. Switch to Coordination view
 * 5. Verify coordination board/table renders
 *
 * Prerequisites:
 * - Dev server running on http://localhost:8000 (`npm run dev`)
 * - Test credentials: burness@fpcinc.com / BuildIt2026!!
 */

const TEST_EMAIL = 'burness@fpcinc.com';
const TEST_PASSWORD = 'BuildIt2026!!';

// ---------------------------------------------------------------------------
// Auth helper: shared login flow that stores session for subsequent tests
// ---------------------------------------------------------------------------

test.describe.serial('Core Decision Engine Flow', () => {

  test('Step 1: Login and reach Dashboard', async ({ page }) => {
    // Navigate to login
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Fill credentials
    await page.fill('#email', TEST_EMAIL);
    await page.fill('#password', TEST_PASSWORD);

    // Submit login form (use type=submit to avoid matching Procore SSO button)
    await page.locator('button[type="submit"]').click();

    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    // Verify dashboard renders
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('Step 2: Navigate to a project workspace', async ({ page }) => {
    // Login first (each test gets a fresh page)
    await page.goto('/login');
    await page.fill('#email', TEST_EMAIL);
    await page.fill('#password', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    // Click the first project card/link to enter a project
    const projectLink = page.locator('a[href*="/project/"]').first();
    await expect(projectLink).toBeVisible({ timeout: 10000 });

    const href = await projectLink.getAttribute('href');
    expect(href).toBeTruthy();
    await projectLink.click();

    // Wait for the project page to load
    await page.waitForURL('**/project/**', { timeout: 15000 });

    // Verify the sidebar or project chrome loads
    // The project view should have a sidebar with navigation items
    const sidebar = page.locator('nav, [class*="sidebar"], aside').first();
    await expect(sidebar).toBeVisible({ timeout: 10000 });
  });

  test('Step 3: Value Matrix grid loads with data', async ({ page }) => {
    // Login and navigate to first project
    await page.goto('/login');
    await page.fill('#email', TEST_EMAIL);
    await page.fill('#password', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    const projectLink = page.locator('a[href*="/project/"]').first();
    await expect(projectLink).toBeVisible({ timeout: 10000 });
    await projectLink.click();
    await page.waitForURL('**/project/**', { timeout: 15000 });

    // Look for the Budget Ledger / Value Matrix heading or the grid container
    // The VE grid should be visible on the default "dashboard-v2" or "budget-compare" view
    // Navigate to the budget/VE view via sidebar
    const budgetNav = page.locator('text=Budget Ledger').or(page.locator('text=Value Matrix'));
    
    if (await budgetNav.count() > 0) {
      await budgetNav.first().click();
      await page.waitForTimeout(2000);
    }

    // The grid should contain table rows with VE- or KD- display IDs
    // Wait for any table content to appear (grid rows with data)
    const gridContent = page.locator('table, [role="grid"], [class*="grid"]').first();
    await expect(gridContent).toBeVisible({ timeout: 15000 });
  });

  test('Step 4: Switch to Coordination view', async ({ page }) => {
    // Login and navigate to first project
    await page.goto('/login');
    await page.fill('#email', TEST_EMAIL);
    await page.fill('#password', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    const projectLink = page.locator('a[href*="/project/"]').first();
    await expect(projectLink).toBeVisible({ timeout: 10000 });
    await projectLink.click();
    await page.waitForURL('**/project/**', { timeout: 15000 });

    // Navigate to coordination view via sidebar
    const coordNav = page.locator('text=Coordination').first();
    await expect(coordNav).toBeVisible({ timeout: 10000 });
    await coordNav.click();
    await page.waitForTimeout(2000);

    // Verify coordination view renders — look for the coordination header,
    // view mode toggles, or status columns
    const coordContent = page
      .locator('text=Design Coordination')
      .or(page.locator('text=Coordination Items'))
      .or(page.locator('text=Pending Plan Update'))
      .or(page.locator('text=Ready for Review'));
    
    await expect(coordContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('Step 5: Budget Summary panel renders metrics', async ({ page }) => {
    // Login and navigate to first project
    await page.goto('/login');
    await page.fill('#email', TEST_EMAIL);
    await page.fill('#password', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    const projectLink = page.locator('a[href*="/project/"]').first();
    await expect(projectLink).toBeVisible({ timeout: 10000 });
    await projectLink.click();
    await page.waitForURL('**/project/**', { timeout: 15000 });

    // Navigate to budget view
    const budgetNav = page.locator('text=Budget Ledger').or(page.locator('text=Value Matrix'));
    if (await budgetNav.count() > 0) {
      await budgetNav.first().click();
      await page.waitForTimeout(2000);
    }

    // Look for budget metric labels — these should be in the BudgetSummary panel
    const budgetMetric = page
      .locator('text=Approved Changes')
      .or(page.locator('text=Pending Changes'))
      .or(page.locator('text=Potential Exposure'))
      .or(page.locator('text=Revised Budget'))
      .or(page.locator('text=Original Budget'));

    await expect(budgetMetric.first()).toBeVisible({ timeout: 15000 });
  });

  test('Step 6: Settings page is accessible', async ({ page }) => {
    // Login and navigate to first project
    await page.goto('/login');
    await page.fill('#email', TEST_EMAIL);
    await page.fill('#password', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    const projectLink = page.locator('a[href*="/project/"]').first();
    await expect(projectLink).toBeVisible({ timeout: 10000 });
    await projectLink.click();
    await page.waitForURL('**/project/**', { timeout: 15000 });

    // Navigate to settings
    const settingsNav = page.locator('text=Settings').first();
    await expect(settingsNav).toBeVisible({ timeout: 10000 });
    await settingsNav.click();
    await page.waitForTimeout(2000);

    // Verify settings page renders with tab navigation
    const settingsContent = page
      .locator('text=Project Info')
      .or(page.locator('text=Team Members'))
      .or(page.locator('text=Building Areas'))
      .or(page.locator('text=Categories'));

    await expect(settingsContent.first()).toBeVisible({ timeout: 10000 });
  });
});
