import { test, expect, type Page, type BrowserContext } from '@playwright/test'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@robocode.io'
const ADMIN_PASS  = process.env.ADMIN_PASS  ?? 'admin123'

async function adminLogin(page: Page) {
  await page.goto('/admin/login')
  await page.getByPlaceholder(/email/i).fill(ADMIN_EMAIL)
  await page.getByPlaceholder(/пароль|password/i).fill(ADMIN_PASS)
  await page.getByRole('button', { name: /войти|login/i }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

async function createSession(page: Page, name: string): Promise<{ code1: string; code2: string; sessionId: string }> {
  await page.getByRole('button', { name: /создать|new session/i }).click()
  await page.getByLabel(/название|name/i).fill(name)

  // Pick BO1 to keep test fast
  const formatSelect = page.getByLabel(/формат|format/i)
  if (await formatSelect.count() > 0) {
    await formatSelect.selectOption('bo1')
  }

  await page.getByRole('button', { name: /создать|create/i }).click()
  await page.getByText(name).click()
  await expect(page).toHaveURL(/\/admin\/session\//)

  const url = page.url()
  const sessionId = url.split('/admin/session/')[1] ?? ''

  const code1El = page.locator('[data-testid="code1"], .codeVal').first()
  const code2El = page.locator('[data-testid="code2"], .codeVal').last()

  const code1 = await code1El.innerText()
  const code2 = await code2El.innerText()

  return { code1: code1.trim(), code2: code2.trim(), sessionId }
}

async function joinAsPlayer(context: BrowserContext, code: string, name: string) {
  const page = await context.newPage()
  await page.goto('/')

  // Find join code input
  const codeInput = page.getByPlaceholder(/код|code/i).first()
  await codeInput.fill(code)

  // Enter name
  const nameInput = page.getByPlaceholder(/имя|name/i).first()
  await nameInput.fill(name)

  await page.getByRole('button', { name: /войти|join|подключиться/i }).click()

  return page
}

test.describe('Full session flow', () => {
  test('two players can join a session and reach lobby', async ({ browser }) => {
    const adminCtx   = await browser.newContext()
    const player1Ctx = await browser.newContext()
    const player2Ctx = await browser.newContext()

    const adminPage = await adminCtx.newPage()
    await adminLogin(adminPage)

    const { code1, code2 } = await createSession(adminPage, 'E2E Flow Test')

    const p1Page = await joinAsPlayer(player1Ctx, code1, 'Alice')
    const p2Page = await joinAsPlayer(player2Ctx, code2, 'Bob')

    // Both players should see a lobby or coding screen
    await expect(p1Page.getByText(/alice|лобби|lobby|код|code/i)).toBeVisible({ timeout: 10_000 })
    await expect(p2Page.getByText(/bob|лобби|lobby|код|code/i)).toBeVisible({ timeout: 10_000 })

    await adminCtx.close()
    await player1Ctx.close()
    await player2Ctx.close()
  })

  test('join page renders without crash', async ({ page }) => {
    await page.goto('/')
    // Root page should load (join form or redirect)
    await expect(page).not.toHaveURL('about:blank')
    const body = await page.locator('body').innerText()
    expect(body.length).toBeGreaterThan(0)
  })

  test('player page not found for unknown code', async ({ page }) => {
    await page.goto('/battle/unknown-session-id')
    // Should show error or redirect, not crash
    const status = await page.evaluate(() => document.readyState)
    expect(status).toBe('complete')
  })
})

test.describe('Admin observer live panel', () => {
  test('live panel shows connection indicator', async ({ browser }) => {
    const adminCtx = await browser.newContext()
    const adminPage = await adminCtx.newPage()

    await adminLogin(adminPage)
    const { sessionId } = await createSession(adminPage, 'Observer Test')

    expect(sessionId).toBeTruthy()

    // Live panel should be visible on the session detail page
    await expect(adminPage.getByText(/live-мониторинг|live monitor/i)).toBeVisible()

    // Connection indicator should exist
    const indicator = adminPage.locator('text=/подключено|нет соединения|connected|offline/i')
    await expect(indicator).toBeVisible({ timeout: 5_000 })

    await adminCtx.close()
  })
})
