import { test, expect, type Page } from '@playwright/test'

const BASE = 'http://localhost:5173'

async function createRoom(page: Page, nickname: string, roomName: string) {
  await page.goto(BASE)
  await expect(page.locator('.hero-title')).toBeVisible({ timeout: 20000 })
  await page.fill('#nickname-create', nickname)
  await page.fill('#room-name', roomName)
  await page.click('button[type="submit"]')
  await page.waitForURL(/lobby/, { timeout: 20000 })
}

async function joinRoom(page: Page, nickname: string, roomName: string) {
  await page.goto(BASE)
  await expect(page.locator('.hero-title')).toBeVisible({ timeout: 20000 })
  await page.click('text=加入房间')
  await page.fill('#nickname-join', nickname)
  await page.fill('#room-name-join', roomName)
  await page.click('button[type="submit"]')
  await page.waitForURL(/lobby/, { timeout: 20000 })
}

async function startGame(hostPage: Page, guestPage: Page) {
  await expect(hostPage.locator('.player-card')).toHaveCount(2, { timeout: 10000 })
  await expect(guestPage.locator('.player-card')).toHaveCount(2, { timeout: 10000 })
  await hostPage.locator('.btn-start').click()
  await hostPage.waitForURL(/game/, { timeout: 20000 })
  await guestPage.waitForURL(/game/, { timeout: 20000 })
}

async function selectWord(drawerPage: Page) {
  for (let i = 0; i < 10; i++) {
    const overlay = drawerPage.locator('.word-select-overlay')
    if (await overlay.isVisible({ timeout: 2000 }).catch(() => false)) {
      await drawerPage.locator('.word-option-btn').first().click()
      return
    }
    await drawerPage.waitForTimeout(500)
  }
}

async function dismissDrawerAlert(page: Page) {
  const alert = page.locator('.drawer-alert')
  if (await alert.isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.locator('.drawer-alert-close').click()
    await page.waitForTimeout(300)
  }
}

async function waitForPlaying(page: Page) {
  await expect(page.locator('.game-info-row')).toBeVisible({ timeout: 15000 })
}

async function readWord(drawerPage: Page): Promise<string> {
  const word = await drawerPage.locator('.info-word').textContent()
  return word?.trim() ?? ''
}

async function submitAnswer(guesserPage: Page, word: string) {
  const input = guesserPage.locator('.sidebar-right .input-row input[type="text"]')
  await expect(input).toBeEnabled({ timeout: 5000 })
  await input.fill(word)
  await input.press('Enter')
}

async function waitForRoundEnd(page: Page) {
  await expect(page.locator('.round-transition')).toBeVisible({ timeout: 15000 })
}

async function playRound(
  drawerPage: Page,
  guesserPage: Page,
): Promise<boolean> {
  await selectWord(drawerPage)
  await waitForPlaying(drawerPage)
  await waitForPlaying(guesserPage)
  await dismissDrawerAlert(drawerPage)

  const word = await readWord(drawerPage)
  if (!word) return false

  await submitAnswer(guesserPage, word)

  const gameOver = drawerPage.locator('.game-over')
  const isOver = await gameOver.isVisible({ timeout: 10000 }).catch(() => false)
  if (isOver) return false

  await waitForRoundEnd(drawerPage)
  await waitForRoundEnd(guesserPage)
  return true
}

test.describe('Game Flow', () => {

  test('word selection and playing state', async ({ browser }) => {
    const ts = Date.now()
    const roomName = `SEL-${ts}`

    const hostCtx = await browser.newContext()
    const hostPage = await hostCtx.newPage()
    const guestCtx = await browser.newContext()
    const guestPage = await guestCtx.newPage()

    await createRoom(hostPage, 'Host', roomName)
    await joinRoom(guestPage, 'Guest', roomName)
    await startGame(hostPage, guestPage)

    await selectWord(hostPage)
    await waitForPlaying(hostPage)
    await waitForPlaying(guestPage)
    await dismissDrawerAlert(hostPage)

    const word = await readWord(hostPage)
    expect(word.length).toBeGreaterThan(0)

    await expect(guestPage.locator('.info-hint')).toBeVisible()
    await expect(guestPage.locator('.info-drawer')).toContainText('Host')
    await expect(hostPage.locator('.info-word')).toContainText(word)
    await expect(guestPage.locator('.guesser-badge')).toBeVisible()

    await hostCtx.close()
    await guestCtx.close()
  })

  test('correct answer triggers round end with reason', async ({ browser }) => {
    const ts = Date.now()
    const roomName = `ANS-${ts}`

    const hostCtx = await browser.newContext()
    const hostPage = await hostCtx.newPage()
    const guestCtx = await browser.newContext()
    const guestPage = await guestCtx.newPage()

    await createRoom(hostPage, 'Host', roomName)
    await joinRoom(guestPage, 'Guest', roomName)
    await startGame(hostPage, guestPage)

    await playRound(hostPage, guestPage)

    await expect(hostPage.locator('.rt-word')).toBeVisible()
    await expect(hostPage.locator('.rt-reason-tag')).toBeVisible()
    await expect(hostPage.locator('.rt-next-name')).toBeVisible()
    await expect(hostPage.locator('.rt-round-label')).toBeVisible()
    await expect(guestPage.locator('.rt-word')).toBeVisible()

    await hostCtx.close()
    await guestCtx.close()
  })

  test('round ends with all_guessed reason', async ({ browser }) => {
    const ts = Date.now()
    const roomName = `ALLG-${ts}`

    const hostCtx = await browser.newContext()
    const hostPage = await hostCtx.newPage()
    const guestCtx = await browser.newContext()
    const guestPage = await guestCtx.newPage()

    await createRoom(hostPage, 'Host', roomName)
    await joinRoom(guestPage, 'Guest', roomName)
    await startGame(hostPage, guestPage)

    await selectWord(hostPage)
    await waitForPlaying(hostPage)
    await waitForPlaying(guestPage)
    await dismissDrawerAlert(hostPage)

    const word = await readWord(hostPage)
    await submitAnswer(guestPage, word)

    await waitForRoundEnd(hostPage)
    await expect(hostPage.locator('.rt-reason-tag')).toContainText('全部猜对')

    await hostCtx.close()
    await guestCtx.close()
  })

  test('multiple rounds with role swap', async ({ browser }) => {
    const ts = Date.now()
    const roomName = `MULTI-${ts}`

    const hostCtx = await browser.newContext()
    const hostPage = await hostCtx.newPage()
    const guestCtx = await browser.newContext()
    const guestPage = await guestCtx.newPage()

    await createRoom(hostPage, 'Host', roomName)
    await joinRoom(guestPage, 'Guest', roomName)
    await startGame(hostPage, guestPage)

    await playRound(hostPage, guestPage)

    const played = await playRound(guestPage, hostPage)
    expect(played).toBe(true)

    await hostCtx.close()
    await guestCtx.close()
  })
})
