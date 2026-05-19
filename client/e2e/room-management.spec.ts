import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5173'

test.describe('Room Management', () => {

  test('duplicate room name is rejected', async ({ page }) => {
    const ts = Date.now()
    const roomName = `DUP-${ts}`

    await page.goto(BASE)
    await expect(page.locator('.hero-title')).toBeVisible({ timeout: 20000 })
    await page.fill('#nickname-create', 'Owner')
    await page.fill('#room-name', roomName)
    await page.click('button[type="submit"]')
    await page.waitForURL(/lobby/, { timeout: 20000 })

    const ctx2 = await page.context().browser()!.newContext()
    const page2 = await ctx2.newPage()
    await page2.goto(BASE)
    await expect(page2.locator('.hero-title')).toBeVisible({ timeout: 20000 })
    await page2.fill('#nickname-create', 'Other')
    await page2.fill('#room-name', roomName)
    await page2.click('button[type="submit"]')
    await page2.waitForTimeout(2000)

    await expect(page2.locator('.error-toast')).toBeVisible({ timeout: 5000 })
    await expect(page2).toHaveURL(BASE)

    await ctx2.close()
  })

  test('empty nickname is rejected on create', async ({ page }) => {
    const ts = Date.now()
    const roomName = `NN-${ts}`

    await page.goto(BASE)
    await expect(page.locator('.hero-title')).toBeVisible({ timeout: 20000 })
    await page.fill('#nickname-create', '')
    await page.fill('#room-name', roomName)
    await page.click('button[type="submit"]')

    await expect(page).toHaveURL(BASE)
  })

  test('join non-existent room shows error', async ({ page }) => {
    await page.goto(BASE)
    await expect(page.locator('.hero-title')).toBeVisible({ timeout: 20000 })

    await page.click('text=加入房间')
    await page.fill('#nickname-join', 'Player')
    await page.fill('#room-name-join', `nonexistent-${Date.now()}`)
    await page.click('button[type="submit"]')

    await page.waitForTimeout(2000)
    await expect(page.locator('.error-toast')).toBeVisible({ timeout: 5000 })
    await expect(page).toHaveURL(BASE)
  })

  test('host can kick a player', async ({ browser }) => {
    const ts = Date.now()
    const roomName = `KICK-${ts}`

    const hostCtx = await browser.newContext()
    const hostPage = await hostCtx.newPage()
    await hostPage.goto(BASE)
    await expect(hostPage.locator('.hero-title')).toBeVisible({ timeout: 20000 })
    await hostPage.fill('#nickname-create', 'Host')
    await hostPage.fill('#room-name', roomName)
    await hostPage.click('button[type="submit"]')
    await hostPage.waitForURL(/lobby/, { timeout: 20000 })

    const guestCtx = await browser.newContext()
    const guestPage = await guestCtx.newPage()
    await guestPage.goto(BASE)
    await expect(guestPage.locator('.hero-title')).toBeVisible({ timeout: 20000 })
    await guestPage.click('text=加入房间')
    await guestPage.fill('#nickname-join', 'Guest')
    await guestPage.fill('#room-name-join', roomName)
    await guestPage.click('button[type="submit"]')
    await guestPage.waitForURL(/lobby/, { timeout: 20000 })

    await expect(hostPage.locator('.player-card')).toHaveCount(2, { timeout: 10000 })

    await hostPage.locator('.btn-kick').first().click()
    await hostPage.waitForTimeout(500)

    await expect(hostPage.locator('.player-card')).toHaveCount(1, { timeout: 5000 })
    await expect(guestPage.locator('.error-toast')).toBeVisible({ timeout: 5000 })

    await hostCtx.close()
    await guestCtx.close()
  })

  test('leave room returns to home', async ({ browser }) => {
    const ts = Date.now()
    const roomName = `LEAVE-${ts}`

    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await page.goto(BASE)
    await expect(page.locator('.hero-title')).toBeVisible({ timeout: 20000 })
    await page.fill('#nickname-create', 'Leaver')
    await page.fill('#room-name', roomName)
    await page.click('button[type="submit"]')
    await page.waitForURL(/lobby/, { timeout: 20000 })

    await page.locator('.btn-leave').click()
    await page.waitForURL(BASE, { timeout: 10000 })
    await expect(page.locator('.hero-title')).toBeVisible({ timeout: 10000 })

    await ctx.close()
  })

  test('lobby shows correct player count and room name', async ({ browser }) => {
    const ts = Date.now()
    const roomName = `INFO-${ts}`

    const hostCtx = await browser.newContext()
    const hostPage = await hostCtx.newPage()
    await hostPage.goto(BASE)
    await expect(hostPage.locator('.hero-title')).toBeVisible({ timeout: 20000 })
    await hostPage.fill('#nickname-create', 'Host')
    await hostPage.fill('#room-name', roomName)
    await hostPage.click('button[type="submit"]')
    await hostPage.waitForURL(/lobby/, { timeout: 20000 })

    await expect(hostPage.locator('.code-value')).toContainText(roomName)
    await expect(hostPage.locator('.player-card')).toHaveCount(1)
    await expect(hostPage.locator('.tag-you')).toBeVisible()
    await expect(hostPage.locator('.tag-owner')).toBeVisible()

    await hostCtx.close()
  })
})
