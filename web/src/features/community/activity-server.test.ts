import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const request = vi.hoisted(() => vi.fn());
vi.mock("./server", () => ({ supabaseRequest: request, communityMode: () => "supabase" }));
import { communityActivity } from "./activity-server";

describe("personal community activity", () => {
  it("includes older participation pages, closed threads, own comments and likes; ignores earlier replies", async () => {
    request.mockImplementation(async (path: string) => {
      const params = new URL(path, "https://test/");
      expect(path).not.toContain("user_id=eq.someone-else");
      if (params.pathname === "/issues" && !params.searchParams.has("id")) return [{ id: "own", created_at: "2026-10-01" }];
      if (params.pathname === "/issue_comments") return params.searchParams.get("offset") === "0" ? Array.from({ length: 50 }, (_, i) => ({ id: `reply${i}`, issue_id: "joined", content: `My comment ${i}`, created_at: "2026-10-03" })) : [{ id: "old-comment", issue_id: "old", content: "My historical post", created_at: "2026-09-01" }];
      if (params.pathname === "/issue_likes") return [{ issue_id: "liked", created_at: "2026-10-05" }];
      expect(params.searchParams.get("latest_reply.or")).toBe('(user_id.neq."viewer",and(user_id.is.null,user_username.neq."Viewer"))');
      return [
        { id: "own", title: "My issue", status: "closed", created_at: "2026-10-01", latest_reply: [{ id: "new", created_at: "2026-10-08", user_username: "Other" }], user_email: "private@example.com", user_id: "viewer" },
        { id: "joined", title: "Joined", created_at: "2026-10-01", latest_reply: [{ id: "before", created_at: "2026-10-02", user_username: "Other" }] },
        { id: "old", title: "Older", created_at: "2026-09-01", latest_reply: [] },
        { id: "liked", title: "Liked", created_at: "2026-10-01", latest_reply: [] },
      ];
    });
    const items = await communityActivity({ id: "viewer", username: "Viewer", level: 1, email: "private@example.com" });
    expect(items).toHaveLength(4);
    expect(items.find((item) => item.issue?.id === "old")?.comments[0].content).toBe("My historical post");
    expect(items.find((item) => item.issue?.id === "joined")?.latestReply).toBeNull();
    expect(items.find((item) => item.issue?.id === "own")?.latestReply?.id).toBe("new");
    expect(items[0].issue).not.toHaveProperty("user_email");
    expect(items[0].issue).not.toHaveProperty("user_id");
  });
});
