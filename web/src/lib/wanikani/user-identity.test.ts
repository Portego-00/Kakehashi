import { describe, expect, it } from "vitest";
import { waniKaniUserId } from "./user-identity";

describe("WaniKani user identity", () => {
  it("prefers the real nested user id and keeps legacy fixtures compatible", () => {
    expect(waniKaniUserId({ id: 1, data: { id: "wk-user-123" } })).toBe("wk-user-123");
    expect(waniKaniUserId({ id: 123, data: {} })).toBe("123");
    expect(waniKaniUserId({ data: {} })).toBe("");
  });
});
