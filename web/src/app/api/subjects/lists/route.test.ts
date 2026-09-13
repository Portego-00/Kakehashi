import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { clearRateLimitsForTests } from "@/lib/server/rate-limit";

const mocks = vi.hoisted(() => ({
  analyticsIdentityFromSealedSession: vi.fn(),
  readCloudSubjectLists: vi.fn(),
  replaceCloudSubjectLists: vi.fn(),
  subjectListsBackendConfigured: vi.fn(() => true),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/analytics-server", () => ({ analyticsIdentityFromSealedSession: mocks.analyticsIdentityFromSealedSession }));
vi.mock("@/lib/server/subject-lists-server", () => ({
  readCloudSubjectLists: mocks.readCloudSubjectLists,
  replaceCloudSubjectLists: mocks.replaceCloudSubjectLists,
  subjectListsBackendConfigured: mocks.subjectListsBackendConfigured,
}));

import { GET, PUT } from "./route";

const list = {
  id: "mobile-review",
  name: "Mobile review",
  subjectIds: [440, 441],
  createdAt: "2026-08-20T10:00:00.000Z",
  updatedAt: "2026-08-24T10:00:00.000Z",
};

function request(method: "GET" | "PUT", body?: unknown) {
  return new NextRequest("http://localhost/api/subjects/lists", {
    method,
    headers: {
      host: "localhost",
      cookie: "kakehashi_wk_session=sealed-session",
      origin: "http://localhost",
      ...(body ? { "Content-Type": "application/json" } : null),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("subject-list sync route", () => {
  beforeEach(() => {
    clearRateLimitsForTests();
    mocks.subjectListsBackendConfigured.mockReturnValue(true);
    mocks.analyticsIdentityFromSealedSession.mockReset().mockResolvedValue({ id: "wk-user-123", username: "Tester", level: 21 });
    mocks.readCloudSubjectLists.mockReset().mockResolvedValue([list]);
    mocks.replaceCloudSubjectLists.mockReset().mockResolvedValue(true);
  });

  it("loads the mobile account's subject lists with the authenticated WaniKani id", async () => {
    const response = await GET(request("GET"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ lists: [list] });
    expect(mocks.readCloudSubjectLists).toHaveBeenCalledWith("wk-user-123");
  });

  it("syncs browser list changes back to the mobile account", async () => {
    const response = await PUT(request("PUT", { lists: [list] }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ synced: true });
    expect(mocks.replaceCloudSubjectLists).toHaveBeenCalledWith("wk-user-123", [list]);
  });

  it("accepts an edited cloud list whose original timestamp uses a UTC offset", async () => {
    const editedList = {
      ...list,
      name: "Edited in the browser",
      createdAt: "2026-08-20T10:00:00+00:00",
      updatedAt: "2026-08-25T20:07:09.000Z",
    };

    const response = await PUT(request("PUT", { lists: [editedList] }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ synced: true });
    expect(mocks.replaceCloudSubjectLists).toHaveBeenCalledWith("wk-user-123", [editedList]);
  });
});
