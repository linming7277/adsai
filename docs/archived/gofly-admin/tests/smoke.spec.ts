import { test, expect } from '@playwright/test'

test.describe('Console smoke', () => {
  test('dashboard loads', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('管理后台 · 仪表盘')).toBeVisible()
  })

  test('users page responds (unauth redirects to login)', async ({ page }) => {
    await page.goto('/users')
    // either table or login prompt
    const hasLogin = await page.getByText('管理员登录').first().isVisible().catch(()=>false)
    const hasUsers = await page.getByText('用户与套餐').first().isVisible().catch(()=>false)
    expect(hasLogin || hasUsers).toBeTruthy()
  })

  test('alerts page loads', async ({ page }) => {
    await page.goto('/alerts')
    const hasHdr = await page.getByText('系统告警').first().isVisible().catch(()=>false)
    expect(hasHdr).toBeTruthy()
  })

  test('configs manage page loads editor', async ({ page }) => {
    await page.goto('/configs/manage')
    const txt = await page.getByText('动态配置（草稿→发布→回滚）').first().isVisible().catch(()=>false)
    expect(txt).toBeTruthy()
  })
})
