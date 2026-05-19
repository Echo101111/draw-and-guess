import { test, expect, type Page } from '@playwright/test'

const BASE = 'http://localhost:5173'

async function createAndJoin(browser: any, roomName: string): Promise<[Page, Page]> {
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
  await expect(guestPage.locator('.player-card')).toHaveCount(2, { timeout: 10000 })

  return [hostPage, guestPage]
}

async function startAndPlay(hostPage: Page, guestPage: Page) {
  await hostPage.locator('.btn-start').click()
  await hostPage.waitForURL(/game/, { timeout: 20000 })
  await guestPage.waitForURL(/game/, { timeout: 20000 })

  for (let i = 0; i < 10; i++) {
    const overlay = hostPage.locator('.word-select-overlay')
    if (await overlay.isVisible({ timeout: 2000 }).catch(() => false)) {
      await hostPage.locator('.word-option-btn').first().click()
      break
    }
    await hostPage.waitForTimeout(500)
  }

  await expect(hostPage.locator('.game-info-row')).toBeVisible({ timeout: 15000 })
  await expect(guestPage.locator('.game-info-row')).toBeVisible({ timeout: 15000 })

  const alert = hostPage.locator('.drawer-alert')
  if (await alert.isVisible({ timeout: 3000 }).catch(() => false)) {
    await hostPage.locator('.drawer-alert-close').click()
    await hostPage.waitForTimeout(300)
  }
}

test.describe('Gameplay Interactions', () => {

  test('toolbar: brush and eraser toggle', async ({ browser }) => {
    const ts = Date.now()
    const [hostPage, guestPage] = await createAndJoin(browser, `TB-${ts}`)
    await startAndPlay(hostPage, guestPage)

    const brushBtn = hostPage.locator('button[title="画笔"]')
    const eraserBtn = hostPage.locator('button[title="橡皮擦"]')

    await expect(brushBtn).toBeVisible()
    await expect(eraserBtn).toBeVisible()

    await eraserBtn.click()
    await hostPage.waitForTimeout(200)
    await brushBtn.click()
    await hostPage.waitForTimeout(200)

    await expect(brushBtn).toBeVisible()
    await hostPage.context().close()
  })

  test('toolbar: undo and clear canvas buttons visible', async ({ browser }) => {
    const ts = Date.now()
    const [hostPage, guestPage] = await createAndJoin(browser, `UNDO-${ts}`)
    await startAndPlay(hostPage, guestPage)

    await expect(hostPage.locator('button[title*="撤销"]')).toBeVisible()
    await expect(hostPage.locator('button[title="清空画布"]')).toBeVisible()

    await hostPage.context().close()
  })

  test('toolbar: color buttons are present', async ({ browser }) => {
    const ts = Date.now()
    const [hostPage, guestPage] = await createAndJoin(browser, `CLR-${ts}`)
    await startAndPlay(hostPage, guestPage)

    const colorBtns = hostPage.locator('.toolbar .color-btn')
    await expect(colorBtns).toHaveCount(12)

    await hostPage.context().close()
  })

  test('toolbar: width presets are present', async ({ browser }) => {
    const ts = Date.now()
    const [hostPage, guestPage] = await createAndJoin(browser, `WD-${ts}`)
    await startAndPlay(hostPage, guestPage)

    await expect(hostPage.locator('button[title="thin"]')).toBeVisible()
    await expect(hostPage.locator('button[title="medium"]')).toBeVisible()
    await expect(hostPage.locator('button[title="thick"]')).toBeVisible()

    await hostPage.context().close()
  })

  test('guesser can send chat message', async ({ browser }) => {
    const ts = Date.now()
    const [hostPage, guestPage] = await createAndJoin(browser, `CHAT-${ts}`)
    await startAndPlay(hostPage, guestPage)

    const chatInput = guestPage.locator('.sidebar-right .input-row input[type="text"]')
    await expect(chatInput).toBeEnabled({ timeout: 5000 })
    await chatInput.fill('Hello from guesser')
    await chatInput.press('Enter')

    await guestPage.waitForTimeout(500)
    const messages = guestPage.locator('.sidebar-right .message')
    await expect(messages.first()).toBeVisible({ timeout: 3000 })

    await hostPage.context().close()
  })

  test('scoreboard shows after correct answer', async ({ browser }) => {
    const ts = Date.now()
    const [hostPage, guestPage] = await createAndJoin(browser, `SC-${ts}`)
    await startAndPlay(hostPage, guestPage)

    await expect(hostPage.locator('.sidebar-left .scoreboard')).toBeVisible()

    const word = await hostPage.locator('.info-word').textContent()
    expect(word?.trim().length).toBeGreaterThan(0)

    const chatInput = guestPage.locator('.sidebar-right .input-row input[type="text"]')
    await expect(chatInput).toBeEnabled({ timeout: 5000 })
    await chatInput.fill(word!.trim())
    await chatInput.press('Enter')

    await expect(hostPage.locator('.sidebar-left .score-item')).toHaveCount(2, { timeout: 5000 })
    await expect(hostPage.locator('.sidebar-left .nickname').first()).toBeVisible()

    await hostPage.context().close()
  })

  test('timer is visible during playing state', async ({ browser }) => {
    const ts = Date.now()
    const [hostPage, guestPage] = await createAndJoin(browser, `TIMER-${ts}`)
    await startAndPlay(hostPage, guestPage)

    await expect(hostPage.locator('.timer')).toBeVisible()
    await expect(hostPage.locator('.timer .round')).toBeVisible()

    await hostPage.context().close()
  })

  test('canvas is present for interaction', async ({ browser }) => {
    const ts = Date.now()
    const [hostPage, guestPage] = await createAndJoin(browser, `CANV-${ts}`)
    await startAndPlay(hostPage, guestPage)

    const canvas = hostPage.locator('.game-canvas canvas').first()
    await expect(canvas).toBeVisible()

    const box = await canvas.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeGreaterThan(100)
    expect(box!.height).toBeGreaterThan(100)

    await hostPage.context().close()
  })

  test('draw on canvas', async ({ browser }) => {
    const ts = Date.now()
    const [hostPage, guestPage] = await createAndJoin(browser, `DRAW-${ts}`)
    await startAndPlay(hostPage, guestPage)

    const canvas = hostPage.locator('.game-canvas canvas').first()
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas bounding box not found')

    await hostPage.mouse.move(box.x + 50, box.y + 50)
    await hostPage.mouse.down()
    await hostPage.mouse.move(box.x + 150, box.y + 150, { steps: 5 })
    await hostPage.mouse.up()
    await hostPage.waitForTimeout(500)

    const guestCanvas = guestPage.locator('.game-canvas canvas').first()
    await expect(guestCanvas).toBeVisible()

    await hostPage.context().close()
  })
})
