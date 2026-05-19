import { test, expect, Page } from '@playwright/test'

const BASE = 'http://localhost:5173'

interface PageAction {
  name: string
  url: string
  /** 等待某个元素可见，确认页面加载成功 */
  waitFor: string
  /** 需要点击的按钮或交互 */
  clicks?: { label: string; selector: string; waitAfter?: number }[]
  /** 每个 action 的额外断言 */
  asserts?: { selector: string; desc: string }[]
}

// ─── 页面清单：URL + 要点的按钮 + 断言 ───
const pages: PageAction[] = [
  {
    name: '首页 - 创建房间表单',
    url: BASE,
    waitFor: '.hero-title',
    clicks: [
      { label: '切换到加入房间', selector: 'text=加入房间', waitAfter: 500 },
      { label: '切回创建房间', selector: 'text=创建房间', waitAfter: 500 },
    ],
  },
  {
    name: '首页 - 创建房间输入框可用',
    url: BASE,
    waitFor: '.hero-title',
    clicks: [
      { label: '填写昵称', selector: '#nickname-create' },
    ],
  },
  // ─── 在上面继续加页面 ───
  // 示例：需要登录态或 cookie 的页面
  // {
  //   name: '管理后台 - 用户列表',
  //   url: `${BASE}/admin/users`,
  //   waitFor: '.user-table',
  //   clicks: [
  //     { label: '点击新增用户', selector: '.btn-add-user', waitAfter: 1000 },
  //   ],
  //   asserts: [
  //     { selector: '.user-form', desc: '新增用户弹窗出现' },
  //   ],
  // },
]

// ─── 统一的页面巡检逻辑 ───
async function visitPage(page: Page, action: PageAction) {
  await test.step(`访问 ${action.name}`, async () => {
    const response = await page.goto(action.url, { waitUntil: 'networkidle' })
    expect(response?.status(), `${action.name} 应返回 200`).toBeLessThan(400)

    // 等待关键元素
    await expect(page.locator(action.waitFor)).toBeVisible({ timeout: 15000 })

    // 执行点击
    for (const click of action.clicks ?? []) {
      await test.step(`点击: ${click.label}`, async () => {
        const locator = page.locator(click.selector)
        await locator.waitFor({ state: 'visible', timeout: 10000 })
        await locator.click()
        if (click.waitAfter) await page.waitForTimeout(click.waitAfter)
      })
    }

    // 额外断言
    for (const assert of action.asserts ?? []) {
      await test.step(`断言: ${assert.desc}`, async () => {
        await expect(page.locator(assert.selector)).toBeVisible({ timeout: 10000 })
      })
    }
  })
}

// ─── 每条 action 独立成一个 test case，失败互不影响 ───
for (const action of pages) {
  test(`巡检: ${action.name}`, async ({ page }, testInfo) => {
    await visitPage(page, action)
  })
}

// ─── 或者全部合并在一个 test 里跑（更快，但一个失败后面的跳过） ───
test.describe('批量页面巡检（合并模式）', () => {
  pages.forEach((action) => {
    test(action.name, async ({ page }) => {
      await visitPage(page, action)
    })
  })
})
