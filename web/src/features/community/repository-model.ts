type RecordValue = Record<string, unknown>;

export function findMutationReceipt(receipts: RecordValue[], requestId: string) {
  return receipts.find((entry) => entry.id === requestId)?.result;
}

export function applyLocalLikeToggle(input: {
  kind: "issue" | "comment";
  targetId: string;
  requestId: string;
  userId: string;
  likes: RecordValue[];
  targets: RecordValue[];
  receipts: RecordValue[];
  likeId: string;
  now: string;
}) {
  const prior = findMutationReceipt(input.receipts, input.requestId);
  if (prior) return prior as { liked: boolean; likes_count: number };
  const target = input.targets.find((entry) => entry.id === input.targetId);
  if (!target) throw new Error(`${input.kind === "issue" ? "Issue" : "Comment"} not found.`);
  const column = input.kind === "issue" ? "issue_id" : "comment_id";
  const existing = input.likes.findIndex((entry) => entry[column] === input.targetId && entry.user_id === input.userId);
  let liked: boolean;
  if (existing >= 0) { input.likes.splice(existing, 1); liked = false; }
  else { input.likes.push({ id: input.likeId, [column]: input.targetId, user_id: input.userId, created_at: input.now }); liked = true; }
  const likesCount = input.likes.filter((entry) => entry[column] === input.targetId).length;
  target.likes_count = likesCount;
  const result = { liked, likes_count: likesCount };
  input.receipts.push({ id: input.requestId, user_id: input.userId, action: `toggle${input.kind}Like`, target_id: input.targetId, result, created_at: input.now });
  return result;
}
