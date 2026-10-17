import type { WebSettings } from "../settings";

export const REVIEW_ORDER_OPTIONS = [
  { value: "random", label: "Random" },
  { value: "ascendingSrsStage", label: "Lower SRS first" },
  { value: "descendingSrsStage", label: "Higher SRS first" },
  { value: "currentLevelFirst", label: "Current level first" },
  { value: "lowestLevelFirst", label: "Lowest level first" },
  { value: "newestAvailableFirst", label: "Newest available first" },
  { value: "oldestAvailableFirst", label: "Oldest available first" },
  { value: "longestRelativeWait", label: "Most overdue first" },
] as const satisfies ReadonlyArray<{ value: WebSettings["study"]["reviewOrder"]; label: string }>;
