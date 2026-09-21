import { expect, test } from '@playwright/test';
import { DEMO_USER } from '../src/features/demo/runtime';
import { bunproAnalyticsFixture } from '../src/features/bunpro/analytics-fixture';

test('connected Bunpro analytics filter, recover, and fit desktop and mobile', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const user = DEMO_USER;
  await page.route('**/api/session/wanikani', route => route.fulfill({ json: { user: { ...user, data: { ...user.data, username: 'Portego' } } } }));
  await page.route('**/api/wanikani/**', async route => {
    await route.fulfill({ json: { object: 'collection', data: [], pages: { next_url: null, previous_url: null, per_page: 500 }, total_count: 0, data_updated_at: null } });
  });
  let partial = false;
  await page.route('**/api/bunpro?*', route => route.fulfill({ json: new URL(route.request().url()).searchParams.get('action') === 'connection' ? { connected: true } : partial ? { ...bunproAnalyticsFixture, srs: null, unavailable: ['srs'] } : bunproAnalyticsFixture }));
  await page.goto('/analytics');
  await page.getByRole('group', { name: 'Analytics source' }).getByRole('button', { name: 'Bunpro', exact: true }).click();
  const dashboard = page.getByRole('region', { name: 'Bunpro analytics', exact: true });
  await expect(dashboard.locator('dd').filter({ hasText: /^710$/ })).toBeVisible();
  await expect(dashboard.locator('.recharts-surface')).toHaveCount(1);
  const reviewDay = dashboard.getByRole('button', { name: '2026-09-19: 55 reviews', exact: true });
  await reviewDay.hover();
  await expect(page.getByRole('tooltip')).toContainText('55 reviews');
  await expect(page.getByRole('tooltip')).toContainText('Grammar: 25 · Vocabulary: 30');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await reviewDay.focus();
  await reviewDay.press('ArrowDown');
  await expect(page.getByRole('tooltip')).toContainText('10 reviews');
  await page.keyboard.press('Escape');

  await dashboard.getByRole('button', { name: 'Grammar', exact: true }).click();
  await expect(dashboard.locator('dd').filter({ hasText: /^230$/ })).toBeVisible();
  await expect(dashboard.getByRole('link', { name: 'Review', exact: true })).toHaveAttribute('href', '/bunpro-reviews?mode=grammar');
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const label of ['Grammar', 'Vocabulary']) {
      await dashboard.getByRole('button', { name: label, exact: true }).click();
      const knowledge = await dashboard.getByRole('region', { name: `${label} knowledge`, exact: true }).boundingBox();
      const jlpt = await dashboard.getByRole('region', { name: `${label} · JLPT`, exact: true }).boundingBox();
      if (width > 600) {
        await expect.poll(async () => {
          const a = await dashboard.getByRole('region', { name: `${label} knowledge`, exact: true }).boundingBox();
          const b = await dashboard.getByRole('region', { name: `${label} · JLPT`, exact: true }).boundingBox();
          return Math.abs(a!.y - b!.y);
        }).toBeLessThan(2);
        await expect.poll(async () => (await dashboard.getByRole('region', { name: `${label} · JLPT`, exact: true }).boundingBox())!.x).toBeGreaterThan(knowledge!.x + knowledge!.width);
      } else {
        expect(jlpt!.y).toBeGreaterThan(knowledge!.y);
      }
      await expect(dashboard.getByRole('region', { name: 'Upcoming reviews' }).locator('pattern')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`bunpro-${label}-${width}.png`), fullPage: true });
    }
  }
  await dashboard.getByRole('button', { name: 'All study', exact: true }).click();
  for (const width of [1440, 768, 414, 375, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ['light', 'dark']) {
      const toggle = page.getByRole('button', { name: `Switch to ${theme} theme`, exact: true });
      if (await toggle.count()) await toggle.click();
      await expect(dashboard.getByRole('heading', { name: 'Grammar · JLPT' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      for (const plot of await dashboard.locator('[data-chart-plot]').all()) {
        expect((await plot.boundingBox())!.width).toBeGreaterThan(200);
        expect(await plot.locator('svg path').count()).toBeGreaterThan(0);
      }
      await page.screenshot({ path: testInfo.outputPath(`bunpro-${width}-${theme}.png`), fullPage: true });
    }
  }
  partial = true;
  await dashboard.getByRole('button', { name: 'Refresh Bunpro analytics' }).click();
  await expect(dashboard.getByRole('status')).toContainText('Some Bunpro statistics are unavailable');
  await expect(dashboard.locator('dd').filter({ hasText: /^710$/ })).toBeVisible();
  partial = false;
  await dashboard.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(dashboard.getByRole('status')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('group', { name: 'Analytics source' }).getByRole('button', { name: 'WaniKani', exact: true }).click();
  await expect(page.locator('main:visible')).toHaveCSS('animation-name', 'none');
  await expect(page.getByRole('combobox', { name: 'Dashboard preset' })).toBeVisible();
  expect(errors).toEqual([]);
});
