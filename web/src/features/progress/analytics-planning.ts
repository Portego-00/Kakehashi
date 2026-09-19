export function requiredLevelPace(daysUntilGoal: number, levelsRemaining: number, currentLevelElapsed: number): number | null {
  if (!Number.isFinite(daysUntilGoal) || daysUntilGoal <= 0 || !Number.isInteger(levelsRemaining) || levelsRemaining < 1 || !Number.isFinite(currentLevelElapsed) || currentLevelElapsed < 0) return null;
  if (levelsRemaining === 1) return daysUntilGoal + currentLevelElapsed;
  // Once the current level has exceeded the target pace, it contributes no remaining wait.
  return Math.min((daysUntilGoal + currentLevelElapsed) / levelsRemaining, daysUntilGoal / (levelsRemaining - 1));
}

export function levelPaceQuartiles(durations: number[]): [number, number] | null {
  const sorted = durations.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const quantile = (fraction: number) => {
    const position = (sorted.length - 1) * fraction;
    const lower = Math.floor(position);
    return sorted[lower] + (sorted[Math.ceil(position)] - sorted[lower]) * (position - lower);
  };
  return [quantile(0.25), quantile(0.75)];
}
