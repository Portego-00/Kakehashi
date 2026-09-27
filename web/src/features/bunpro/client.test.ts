import { afterEach, describe, expect, it, vi } from "vitest";
import { bunpro } from "./client";

describe("Bunpro browser client", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it.each([401, 403, 500])("preserves HTTP %i so review sessions can distinguish authentication failures", async (status) => {
    const message = status === 500 ? "Bunpro request failed (500)." : "Bunpro rejected this API key. Reconnect in Settings.";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: message }), { status }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(bunpro("", { method: "POST", body: JSON.stringify({ action: "review" }) })).rejects.toMatchObject({
      name: "BunproClientError", message, status,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([401, 503])("preserves HTTP %i even when a failed response is not JSON", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>Unavailable</html>", { status })));

    await expect(bunpro("", { method: "POST" })).rejects.toMatchObject({
      name: "BunproClientError", message: "Bunpro request failed.", status,
    });
  });

  it("returns successful review data unchanged", async () => {
    const result = { data: [], updated_review: { id: "17", type: "review" } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(result)));

    await expect(bunpro("", { method: "POST" })).resolves.toEqual(result);
  });
});
