import { test, expect } from '@playwright/test';

// Start the backend and frontend first (see README), with SEED_DEMO_DATA=true.
// Credentials come from the environment so nothing secret lives in the repo:
//   E2E_EMAIL=admin@yourcompany.com E2E_PASSWORD=... npm run test:e2e
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

test.skip(!EMAIL || !PASSWORD, 'Set E2E_EMAIL and E2E_PASSWORD to run end-to-end tests');

async function signIn(page) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL('/');
}

test('wrong password shows an error and stays on login', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/password/i).fill('definitely-wrong-1');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  await expect(page).toHaveURL(/login/);
});

test('signed-in user sees the dashboard and employees table', async ({ page }) => {
  await signIn(page);
  await expect(page.getByText('Total Employees')).toBeVisible();
  await page.goto('/employees');
  await expect(page.getByRole('table')).toBeVisible();
});

test('search narrows the employee list', async ({ page }) => {
  await signIn(page);
  await page.goto('/employees');
  await page.getByPlaceholder(/search/i).fill('zzz-no-such-person');
  await expect(page.getByText('No employees found')).toBeVisible();
});

test('protected pages redirect to login when signed out', async ({ page }) => {
  await page.goto('/employees');
  await expect(page).toHaveURL(/login/);
});
