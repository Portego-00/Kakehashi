import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const activeRow = {
  user_id: "wk-user-123",
  list_id: "mobile-review",
  name: "Mobile review",
  subject_ids: [440, 441],
  created_at: "2026-08-20T10:00:00.000Z",
  updated_at: "2026-08-24T10:00:00.000Z",
  deleted_at: null,
};

describe("subject-list cloud store", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("SUPABASE_URL", "https://supabase.test");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
  });

  it("maps the mobile subject-list rows and ignores tombstones", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([
      activeRow,
      { ...activeRow, list_id: "deleted-list", deleted_at: "2026-08-25T00:00:00.000Z" },
    ]), { status: 200, headers: { "Content-Type": "application/json" } })));
    const { readCloudSubjectLists } = await import("./subject-lists-server");

    await expect(readCloudSubjectLists("wk-user-123")).resolves.toEqual([{
      id: "mobile-review",
      name: "Mobile review",
      subjectIds: [440, 441],
      createdAt: "2026-08-20T10:00:00.000Z",
      updatedAt: "2026-08-24T10:00:00.000Z",
    }]);
  });

  it("upserts the browser snapshot and tombstones lists removed on the web", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([activeRow, { ...activeRow, list_id: "removed-list" }]), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const { replaceCloudSubjectLists } = await import("./subject-lists-server");

    await expect(replaceCloudSubjectLists("wk-user-123", [{
      id: "mobile-review",
      name: "Mobile review",
      subjectIds: [440, 441, 442],
      createdAt: activeRow.created_at,
      updatedAt: "2026-08-25T10:00:00.000Z",
    }])).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))[0]).toMatchObject({
      user_id: "wk-user-123",
      list_id: "mobile-review",
      subject_ids: [440, 441, 442],
      deleted_at: null,
    });
    expect(String(fetchMock.mock.calls[2][0])).toContain("removed-list");
    expect(fetchMock.mock.calls[2][1]?.method).toBe("PATCH");
  });
});
