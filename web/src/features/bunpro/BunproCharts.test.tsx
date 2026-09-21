import { expect, it } from 'vitest';
import { allocateTiles } from './BunproCharts';
it('allocates all tiles proportionally, preserving zero stages', () => {
  const counts = allocateTiles([7, 12, 39, 0, 0], 200);
  expect(counts.reduce((a, b) => a + b, 0)).toBe(200);
  expect(counts.slice(3)).toEqual([0, 0]);
  counts.forEach((count, index) => expect(Math.abs(count - [7, 12, 39, 0, 0][index] / 58 * 200)).toBeLessThan(1));
  expect(allocateTiles([0, 0], 200)).toEqual([0, 0]);
});
