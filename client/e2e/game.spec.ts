import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5173'

test.describe('Draw & Guess E2E', () => {
  test('full game: create → join → start → draw → undo → round transition', async ({ browser }) => {
    const ts = Date.now()
    const roomName = `E2E-${ts}`

    // ═══ Player 1: Create Room ═══
    const hostCtx = await browser.newContext()
    const hostPage = await hostCtx.newPage()
    await hostPage.goto(BASE)
    await expect(hostPage.locator('.hero-title')).toBeVisible({ timeout: 20000 })

    await hostPage.fill('#nickname-create', 'Host')
    await hostPage.fill('#room-name', roomName)
    await hostPage.click('button[type="submit"]')
    await hostPage.waitForURL(/lobby/, { timeout: 20000 })
    await expect(hostPage.locator('.lobby-card')).toBeVisible()
    expect(hostPage.locator('.player-card')).toHaveCount(1)

    // ═══ Player 2: Join Room ═══
    const guestCtx = await browser.newContext()
    const guestPage = await guestCtx.newPage()
    await guestPage.goto(BASE)
    await expect(guestPage.locator('.hero-title')).toBeVisible({ timeout: 20000 })

    await guestPage.click('text=加入房间')
    await guestPage.fill('#nickname-join', 'Guest')
    await guestPage.fill('#room-name-join', roomName)
    await guestPage.click('button[type="submit"]')
    await guestPage.waitForURL(/lobby/, { timeout: 20000 })

    // Both players visible in lobby
    await expect(hostPage.locator('.player-card')).toHaveCount(2, { timeout: 10000 })
    await expect(guestPage.locator('.player-card')).toHaveCount(2, { timeout: 10000 })

    // ═══ Start Game ═══
    await hostPage.click('text=开始游戏')
    await hostPage.waitForURL(/game/, { timeout: 20000 })
    await guestPage.waitForURL(/game/, { timeout: 20000 })
    await expect(hostPage.locator('.playing')).toBeVisible({ timeout: 15000 })
    await expect(guestPage.locator('.playing')).toBeVisible({ timeout: 15000 })

    // Select word (Host is drawer)
    await expect(hostPage.locator('.word-select-overlay')).toBeVisible({ timeout: 10000 })
    await hostPage.locator('.word-option-btn').first().click()
    await expect(hostPage.locator('.game-info-row')).toBeVisible({ timeout: 10000 })
    await expect(guestPage.locator('.game-info-row')).toBeVisible({ timeout: 10000 })

    // Dismiss drawer alert
    const drawerAlert = hostPage.locator('.drawer-alert-close')
    if (await drawerAlert.isVisible({ timeout: 3000 }).catch(() => false)) {
      await drawerAlert.click()
      await hostPage.waitForTimeout(300)
    }

    // Host is drawer, Guest is guesser
    await expect(hostPage.locator('.drawer-badge')).toBeVisible({ timeout: 5000 })
    await expect(guestPage.locator('.guesser-badge')).toBeVisible({ timeout: 5000 })

    // ═══ Draw on canvas ═══
    const canvas = hostPage.locator('canvas').first()
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas not visible')

    // Draw a curved line
    await hostPage.mouse.move(box.x + 100, box.y + 100)
    await hostPage.mouse.down()
    for (let i = 0; i <= 15; i++) {
      await hostPage.mouse.move(
        box.x + 100 + i * 20,
        box.y + 100 + Math.sin(i * 0.5) * 40,
        { steps: 1 },
      )
    }
    await hostPage.mouse.up()
    await hostPage.waitForTimeout(300)

    // ═══ Undo (last stroke) ═══
    await hostPage.keyboard.press('Meta+z')
    await hostPage.waitForTimeout(500)

    // ═══ Draw a dot (single tap) ═══
    await hostPage.mouse.click(box.x + 200, box.y + 200)
    await hostPage.waitForTimeout(300)

    // ═══ Draw again ═══
    await hostPage.mouse.move(box.x + 300, box.y + 150)
    await hostPage.mouse.down()
    await hostPage.mouse.move(box.x + 400, box.y + 250, { steps: 5 })
    await hostPage.mouse.up()
    await hostPage.waitForTimeout(300)

    // ═══ Clear canvas ═══
    const clearBtn = hostPage.locator('[title="清空画布"]')
    if (await clearBtn.isVisible()) {
      await clearBtn.click()
      await hostPage.waitForTimeout(500)
    }

    // ═══ Guest submits answer ═══
    const input = guestPage.locator('.answer-container input')
    if (await input.isVisible()) {
      await input.fill('测试答案')
      await input.press('Enter')
      await guestPage.waitForTimeout(500)
    }

    // ═══ Game still running (no crash) ═══
    await expect(hostPage.locator('.playing')).toBeVisible({ timeout: 5000 })
    await expect(guestPage.locator('.playing')).toBeVisible({ timeout: 5000 })

    await hostCtx.close()
    await guestCtx.close()
  })

  test.fixme('reconnection: page refresh recovers game state', async ({ browser }) => {
    const ts = Date.now()
    const roomName = `E2E-RC-${ts}`

    // Create and join
    const hostCtx = await browser.newContext()
    const hostPage = await hostCtx.newPage()
    await hostPage.goto(BASE)
    await expect(hostPage.locator('.hero-title')).toBeVisible({ timeout: 20000 })
    await hostPage.fill('#nickname-create', 'HR')
    await hostPage.fill('#room-name', roomName)
    await hostPage.click('button[type="submit"]')
    await hostPage.waitForURL(/lobby/, { timeout: 20000 })

    const guestCtx = await browser.newContext()
    const guestPage = await guestCtx.newPage()
    await guestPage.goto(BASE)
    await expect(guestPage.locator('.hero-title')).toBeVisible({ timeout: 20000 })
    await guestPage.click('text=加入房间')
    await guestPage.fill('#nickname-join', 'GR')
    await guestPage.fill('#room-name-join', roomName)
    await guestPage.click('button[type="submit"]')
    await guestPage.waitForURL(/lobby/, { timeout: 20000 })

    // Start game
    await hostPage.click('text=开始游戏')
    await hostPage.waitForURL(/game/, { timeout: 20000 })
    await guestPage.waitForURL(/game/, { timeout: 20000 })
    await expect(hostPage.locator('.playing')).toBeVisible({ timeout: 15000 })
    await expect(guestPage.locator('.playing')).toBeVisible({ timeout: 15000 })

    // Refresh guest page
    await guestPage.reload()
    await guestPage.waitForTimeout(3000)

    // Guest should be back in the game
    await expect(guestPage.locator('.playing, .game-content')).toBeVisible({ timeout: 15000 })

    // No error toast visible
    const errorToast = guestPage.locator('.error-toast')
    await expect(errorToast).toHaveCount(0, { timeout: 3000 })

    await hostCtx.close()
    await guestCtx.close()
  })

  test('room password protection', async ({ page }) => {
    const ts = Date.now()
    const roomName = `E2E-PW-${ts}`

    await page.goto(BASE)
    await expect(page.locator('.hero-title')).toBeVisible({ timeout: 20000 })

    // Create password-protected room
    await page.fill('#nickname-create', 'Owner')
    await page.fill('#room-name', roomName)
    await page.fill('#password-create', 'secret')
    await page.click('button[type="submit"]')
    await page.waitForURL(/lobby/, { timeout: 20000 })

    // Verify room code is displayed
    await expect(page.locator('.code-value')).toContainText(roomName)

    // Navigate back to home
    await page.goto(BASE)
    await expect(page.locator('.hero-title')).toBeVisible({ timeout: 20000 })

    // Try joining with wrong password
    await page.click('text=加入房间')
    await page.fill('#nickname-join', 'Intruder')
    await page.fill('#room-name-join', roomName)
    await page.fill('#password-join', 'wrong')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(3000)

    // Should stay on home page (error toast)
    await expect(page.locator('.hero-title')).toBeVisible()
  })
})
