import type { CustomSrsState } from "./types";

/** Send only changed cards and new events; immutable model updates retain untouched cards. */
export function customSrsStatePatch(previous: CustomSrsState, next: CustomSrsState) {
  const { assignments, reviewLog, ...metadata } = next;
  const events = new Set(previous.reviewLog.map((entry) => entry.eventId));
  return {
    p_metadata: metadata,
    p_assignments: Object.fromEntries(Object.entries(assignments).filter(([id, assignment]) => assignment !== previous.assignments[id])),
    p_reviews: reviewLog.filter((entry) => !events.has(entry.eventId)),
  };
}
