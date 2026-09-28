import { partitionTabs, TAB_INFO } from '../tabNavigation';

it.each([4, 5])('keeps %s slots and exposes every extra tab in More', maxTabs => {
  const order = TAB_INFO.map(tab => tab.id);
  const result = partitionTabs(order, maxTabs, true, true);
  expect(result.direct.length + 1).toBe(maxTabs);
  expect([...result.direct, ...result.overflow].map(tab => tab.id)).toEqual(order);
  expect(result.direct.slice(0, 2).map(tab => tab.id)).toEqual(['home', 'progress']);
});
it('does not add More when selected tabs fit', () => {
  expect(partitionTabs(['home', 'progress', 'news', 'songs'], 4, true, false).overflow).toEqual([]);
});
it('filters unavailable destinations before allocating slots and removes duplicates', () => {
  const result = partitionTabs(['home', 'news', 'songs', 'mangas', 'news', 'bunpro'], 4, false, false);
  expect(result.enabled.map(tab => tab.id)).toEqual(['home', 'progress', 'news']);
});
