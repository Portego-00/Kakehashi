/** One tick for every available level, on the same 270° arc on native and web. */
export function levelGoalDialTicks(currentLevel: number, targetLevel: number) {
  const count = Math.max(0, 60 - currentLevel);
  return Array.from({ length: count }, (_, index) => {
    const level = currentLevel + index + 1;
    const angle =
      ((135 + (count > 1 ? (index * 270) / (count - 1) : 135)) * Math.PI) / 180;
    const inner =
      index === 0 || index === count - 1 || level % 5 === 0 ? 94 : 101;
    return {
      level,
      active: level <= targetLevel,
      x1: 120 + Math.cos(angle) * inner,
      y1: 120 + Math.sin(angle) * inner,
      x2: 120 + Math.cos(angle) * 110,
      y2: 120 + Math.sin(angle) * 110,
    };
  });
}
