import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
test('subject history opens on demand and presents readable before and after values', async ({ page }) => {
  if (test.info().project.name === 'desktop') await page.setViewportSize({ width: 1440, height: 1100 });
  let requests = 0;
  await page.route('**/api/subjects/history?*', async route => {
    requests++;
    await route.fulfill({ json: { level: 1, cursor: null, baselineAt: '2026-09-19T00:00:00Z', entries: [{ id: 'test', updatedAt: '2026-09-20T00:00:00Z', observedAt: '2026-09-20T03:15:00Z', labels: { '1': '一 — Ground', '2': '囗 — Prison', '3': '十 — Leaf', '4': '刀 — Sword' }, changes: [{ field: 'component_subject_ids', before: [3,4], after: [1,2] }, { field: 'reading_mnemonic', before: 'On the <radical>ground</radical>, you find <kanji>one</kanji> leaf. Imagine picking it up and feeling an <reading>itch</reading> on your hand.', after: 'On the <radical>ground</radical>, you find <kanji>one</kanji> sword. Imagine picking it up and feeling an <reading>itch</reading> on your hand.' }, { field: 'readings', before: [{ reading: 'めい', primary: true }], after: [{ reading: 'あ', primary: true }] }] }] } });
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Explore the demo', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 45_000 });
  await page.goto('/subjects/440');
  const button = page.getByRole('button', { name: 'Change history', exact: true });
  await expect(button).toBeVisible();
  expect(requests).toBe(0);
  await button.click();
  const dialog = page.getByRole('dialog', { name: 'Change history', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Composition' })).toBeVisible();
  await expect(dialog.getByText('Leaf', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Prison', { exact: true })).toBeVisible();
  await expect(dialog.locator('del').filter({ hasText: 'leaf' })).toBeVisible();
  await expect(dialog.locator('ins').filter({ hasText: 'sword' })).toBeVisible();
  await page.screenshot({ path: fileURLToPath(new URL(`../../output/subject-history-${test.info().project.name}.png`, import.meta.url)) });
  if (test.info().project.name === 'desktop') {
    await page.locator('html').evaluate(element => element.setAttribute('data-theme', 'dark'));
    await page.screenshot({ path: fileURLToPath(new URL('../../output/subject-history-dark.png', import.meta.url)) });
  }
  await dialog.getByRole('button', { name: 'Close change history' }).click();
  await button.click();
  await expect(dialog).toBeVisible();
  expect(requests).toBe(1);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(button).toBeFocused();
});
