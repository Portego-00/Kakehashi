import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
let fixture = "";
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.resetModules(); if (fixture) rmSync(fixture, { recursive: true, force: true }); });
it("the development board scopes activity to the viewer, including legacy authors and liked threads", async () => {
  fixture = mkdtempSync(join(tmpdir(), "kakehashi-activity-fixture-"));
  mkdirSync(join(fixture, ".data"));
  writeFileSync(join(fixture, ".data/community.json"), JSON.stringify({
    issues: [
      { id: "own", user_id: "viewer", user_username: "Viewer", title: "Own", created_at: "2026-10-01" },
      { id: "legacy", user_id: null, user_username: "Viewer", title: "Legacy", created_at: "2026-10-01" },
      { id: "liked", user_id: "other", user_username: "Other", title: "Liked", created_at: "2026-10-01" },
      { id: "other", user_id: "other", user_username: "Other", title: "Unrelated", created_at: "2026-10-01" },
    ], issue_comments: [{ id: "peer", issue_id: "other", user_id: "other", user_username: "Other", content: "Someone else’s comment", created_at: "2026-10-02" }],
    issue_likes: [{ id: "like", issue_id: "liked", user_id: "viewer", created_at: "2026-10-02" }],
  }));
  vi.spyOn(process, "cwd").mockReturnValue(fixture);
  for (const key of ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY", "SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "EXPO_PUBLIC_SUPABASE_ANON_KEY"]) vi.stubEnv(key, "");
  vi.stubEnv("COMMUNITY_LOCAL_STORE", "1");
  const { communityActivity } = await import("./activity-server");
  const items = await communityActivity({ id: "viewer", username: "Viewer", level: 1, email: "" });
  expect(items.map((item) => item.issue?.id).sort()).toEqual(["legacy", "liked", "own"]);
  expect(items.flatMap((item) => item.comments)).toEqual([]);
});
