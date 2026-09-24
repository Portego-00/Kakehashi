import type { Assignment } from "./api";

export function getLocalActivityDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getAssignmentActivityByDay(
  assignments: Assignment[],
  rangeStart: Date,
  rangeEnd: Date,
  now: Date = new Date(),
): Record<string, number> {
  const activityByDay: Record<string, number> = {};

  for (const assignment of assignments) {
    if (assignment.data.hidden || !assignment.data.started_at) continue;

    // Assignment updates and due dates can change during vacation mode.
    // Only lesson, Guru, and Burn milestones establish study activity.
    const activityDates = [
      assignment.data.started_at,
      assignment.data.passed_at,
      assignment.data.burned_at,
    ];
    const activeDays = new Set<string>();

    for (const timestamp of activityDates) {
      if (!timestamp) continue;
      const date = new Date(timestamp);
      if (date <= now && date >= rangeStart && date <= rangeEnd) {
        activeDays.add(getLocalActivityDateString(date));
      }
    }

    for (const day of activeDays) {
      activityByDay[day] = (activityByDay[day] ?? 0) + 1;
    }
  }

  return activityByDay;
}
