import type { CustomSrsMutation } from "./types";

type Disk = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const customSrsPendingKey = (accountId: string) => `kakehashi:custom-srs:native:v1:pending:${encodeURIComponent(accountId)}`;

function validAction(value: unknown): value is CustomSrsMutation {
  if (!value || typeof value !== "object") return false;
  const action = value as CustomSrsMutation;
  if (typeof action.eventId !== "string" || !UUID.test(action.eventId)) return false;
  if (action.action === "enroll_pack") return typeof action.packId === "string" && action.packId.length > 0;
  if (typeof action.wordId !== "string" || !action.wordId) return false;
  if (action.action === "complete_lesson") return true;
  return action.action === "submit_review" && Number.isInteger(action.incorrectAnswers) && action.incorrectAnswers >= 0 && action.incorrectAnswers <= 100
    && typeof action.expectedAssignmentUpdatedAt === "string" && Number.isFinite(Date.parse(action.expectedAssignmentUpdatedAt));
}

/** Commands contain no credentials. The queue is persisted before the first network attempt. */
export function createCustomSrsPendingStore(disk: Disk) {
  // Survives account changes; old in-flight operations cannot race a new account's queue writes.
  let tail: Promise<unknown> = Promise.resolve();
  const serial = <T>(operation: () => Promise<T>): Promise<T> => {
    const next = tail.catch(() => undefined).then(operation);
    tail = next;
    return next;
  };
  const read = async (accountId: string): Promise<CustomSrsMutation[]> => {
    const raw = await disk.getItem(customSrsPendingKey(accountId));
    if (!raw) return [];
    try {
      const value = JSON.parse(raw);
      if (value.version !== 1 || value.accountId !== accountId || !Array.isArray(value.pending) || !value.pending.every(validAction)) throw new Error();
      return value.pending;
    } catch { throw new Error("Your saved answers could not be read safely. Keep this app's data and retry."); }
  };
  const write = (accountId: string, pending: CustomSrsMutation[]) => disk.setItem(customSrsPendingKey(accountId), JSON.stringify({ version: 1, accountId, pending }));
  return {
    read: (accountId: string) => serial(() => read(accountId)),
    add: (accountId: string, action: CustomSrsMutation) => serial(async () => {
      if (!validAction(action)) throw new Error("Your answer cannot be saved safely. Refresh your progress and try again.");
      const pending = await read(accountId);
      if (!pending.some((item) => item.eventId === action.eventId)) await write(accountId, [...pending, action]);
    }),
    remove: (accountId: string, eventId: string) => serial(async () => {
      const pending = await read(accountId);
      await write(accountId, pending.filter((item) => item.eventId !== eventId));
    }),
  };
}
