import { createCustomSrsClient } from "../client";
import { customSrsPendingKey } from "../pending";
import { customVocabularyPacks } from "../catalog";
import { createCustomSrsState, enrollCustomVocabularyPack, completeCustomLesson } from "../../../../web/src/features/custom-srs/model";

const pack = customVocabularyPacks[0];
const initial = enrollCustomVocabularyPack(createCustomSrsState(), pack);
const learned = completeCustomLesson(initial, pack.words[0].id);
const action = { action: "complete_lesson", wordId: pack.words[0].id, eventId: "ff0b0dd3-9a7e-4f36-9017-f0f852aa584f" } as const;
function storage() {
  const values = new Map<string, string>();
  return { values, getItem: jest.fn(async (key: string) => values.get(key) ?? null), setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }) };
}

it("persists before sending and recovers the identical action after process restart", async () => {
  const disk = storage();
  const failed = jest.fn(async () => {
    expect(JSON.parse(disk.values.get(customSrsPendingKey("one"))!).pending).toEqual([action]);
    throw new Error("Offline");
  });
  const first = createCustomSrsClient({ request: failed, cache: disk });
  first.setAccount({ id: "one", token: "secret" });
  await expect(first.mutate(action)).rejects.toThrow("Offline");
  expect([...disk.values.values()].join()).not.toContain("secret");
  const send = jest.fn().mockResolvedValue({ state: learned, revision: 2 });
  const restarted = createCustomSrsClient({ request: send, cache: disk });
  restarted.setAccount({ id: "one", token: "new-token" });
  await restarted.refresh();
  expect(send.mock.calls[0].slice(0, 2)).toEqual(["new-token", action]);
  expect(JSON.parse(disk.values.get(customSrsPendingKey("one"))!).pending).toEqual([]);
  expect(restarted.getSnapshot().state).toEqual(learned);
});

it("does not send a command when durable storage fails", async () => {
  const disk = storage();
  disk.setItem.mockRejectedValue(new Error("Disk full"));
  const request = jest.fn();
  const client = createCustomSrsClient({ request, cache: disk });
  client.setAccount({ id: "one", token: "token" });
  await expect(client.mutate(action)).rejects.toThrow("Disk full");
  expect(request).not.toHaveBeenCalled();
});

it("keeps an unreadable queue intact and never delivers another account's answers", async () => {
  const disk = storage();
  disk.values.set(customSrsPendingKey("one"), "unreadable");
  const request = jest.fn().mockResolvedValue({ state: initial, revision: 1 });
  const client = createCustomSrsClient({ request, cache: disk });
  client.setAccount({ id: "one", token: "one-token" });
  await expect(client.refresh()).rejects.toThrow("could not be read safely");
  expect(request).not.toHaveBeenCalled();
  client.setAccount({ id: "two", token: "two-token" });
  await client.refresh();
  expect(request.mock.calls[0].slice(0, 2)).toEqual(["two-token", { action: "read" }]);
  expect(disk.values.get(customSrsPendingKey("one"))).toBe("unreadable");
});

it("keeps a review's original occurrence across retries", async () => {
  const disk = storage();
  const request = jest.fn().mockResolvedValueOnce({ state: learned, revision: 1 }).mockRejectedValue(new Error("Offline"));
  const client = createCustomSrsClient({ request, cache: disk });
  client.setAccount({ id: "one", token: "token" });
  await client.refresh();
  await expect(client.mutate({ ...action, action: "submit_review", incorrectAnswers: 0 })).rejects.toThrow("Offline");
  expect(JSON.parse(disk.values.get(customSrsPendingKey("one"))!).pending[0].expectedAssignmentUpdatedAt).toBe(learned.assignments[action.wordId].updatedAt);
});
