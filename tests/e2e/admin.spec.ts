import { test, expect, type Page } from '@playwright/test'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@robocode.io'
const ADMIN_PASS  = process.env.ADMIN_PASS  ?? 'admin123'

async function adminLogin(page: Page) {
  await page.goto('/admin/login')
  await page.getByPlaceholder(/email/i).fill(ADMIN_EMAIL)
  await page.getByPlaceholder(/пароль|password/i).fill(ADMIN_PASS)
  await page.getByRole('button', { name: /войти|login/i }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

test.describe('Admin panel', () => {
  test('login with valid credentials', async ({ page }) => {
    await page.goto('/admin/login')
    await expect(page.getByRole('heading', { name: /admin/i })).toBeVisible()

    await page.getByPlaceholder(/email/i).fill(ADMIN_EMAIL)
    await page.getByPlaceholder(/пароль|password/i).fill(ADMIN_PASS)
    await page.getByRole('button', { name: /войти|login/i }).click()

    await expect(page).toHaveURL(/\/admin/)
    await expect(page.getByText(/сессии|session/i)).toBeVisible()
  })

  test('rejects wrong password', async ({ page }) => {
    await page.goto('/admin/login')
    await page.getByPlaceholder(/email/i).fill(ADMIN_EMAIL)
    await page.getByPlaceholder(/пароль|password/i).fill('wrongpass')
    await page.getByRole('button', { name: /войти|login/i }).click()

    await expect(page.getByText(/неверн|invalid|error/i)).toBeVisible()
    await expect(page).toHaveURL(/\/admin\/login/)
  })

  test('create a new session', async ({ page }) => {
    await adminLogin(page)

    await page.getByRole('button', { name: /создать|new session/i }).click()
    await page.getByLabel(/название|name/i).fill('Test Session E2E')
    await page.getByRole('button', { name: /создать|create/i }).click()

    await expect(page.getByText('Test Session E2E')).toBeVisible()
  })

  test('session detail page shows player codes', async ({ page }) => {
    await adminLogin(page)

    // Create session first
    await page.getByRole('button', { name: /создать|new session/i }).click()
    await page.getByLabel(/название|name/i).fill('Detail Test')
    await page.getByRole('button', { name: /создать|create/i }).click()

    // Click on the created session
    await page.getByText('Detail Test').click()
    await expect(page).toHaveURL(/\/admin\/session\//)

    // Should show two player codes
    await expect(page.getByText(/код игрока 1/i)).toBeVisible()
    await expect(page.getByText(/код игрока 2/i)).toBeVisible()
  })
})
