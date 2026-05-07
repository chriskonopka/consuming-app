import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('App', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders the main heading', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: 'Your App is Ready to Go!' })).toBeVisible();
  });

  test('renders a main landmark element', async ({ page }) => {
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('has no accessibility violations', async ({ page }) => {
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toHaveLength(0);
  });
});
