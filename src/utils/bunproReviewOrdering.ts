import type { BunproReviewQueueItem } from "../types/bunpro";
import type { ReviewOrderSetting } from "./reviewOrdering";

function orderFields(item: BunproReviewQueueItem) {
  const attributes = item.data.attributes;
  const relation = item.data.relationships?.reviewable?.data;
  const content = item.included?.find((resource) => resource.id === relation?.id && resource.type === relation?.type)?.attributes ?? {};
  const jlpt = Number(String(content.level ?? content.jlpt_level ?? "").match(/[1-5]/)?.[0]);
  const available = Date.parse(String(attributes.next_review ?? "")) || 0;
  const previous = Date.parse(String(attributes.updated_at ?? attributes.started_studying_at ?? "")) || 0;
  return { stage: Number(attributes.streak) || 0, level: jlpt ? 6 - jlpt : 0, available, interval: available > previous && previous > 0 ? available - previous : 86400000 };
}

/** Match web ordering within Bunpro; mixed scheduling alternates these ordered queues. */
export function orderBunproReviews(items: BunproReviewQueueItem[], reviewOrder: ReviewOrderSetting, random = Math.random, now = Date.now()): BunproReviewQueueItem[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  const fields = new Map(result.map((item) => [item, orderFields(item)]));
  return result.sort((a, b) => {
    const left = fields.get(a)!;
    const right = fields.get(b)!;
    switch (reviewOrder) {
      case "ascendingSrsStage": return left.stage - right.stage;
      case "descendingSrsStage": return right.stage - left.stage;
      case "currentLevelFirst": return right.level - left.level;
      case "lowestLevelFirst": return left.level - right.level;
      case "newestAvailableFirst": return right.available - left.available;
      case "oldestAvailableFirst": return left.available - right.available;
      case "longestRelativeWait": return (now - right.available) / right.interval - (now - left.available) / left.interval;
      default: return 0;
    }
  });
}
