import { afterEach, describe, expect, it, vi } from "vitest";
import { readAppSessionActiveDays } from "./usage-streak-reader";

const backend = { url: "https://supabase.test", key: "public-key" };
function json(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status }); }
function session(id: number, at = "2026-08-25T10:00:00Z") { return { id: `00000000-0000-0000-0000-${String(id).padStart(12, "0")}`, session_started_at: at }; }

describe("compact app-session reader", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns all active days in one request beyond PostgREST's normal row limit", async () => {
    const days = Array.from({ length: 1_100 }, (_, index) => new Date(Date.UTC(2023, 0, index + 1)).toISOString().slice(0, 10));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ activeDays: days })));
    expect(await readAppSessionActiveDays(backend, "123", "UTC")).toEqual(days);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toEqual({ p_user_id: "123", p_timezone: "UTC" });
  });

  it("uses timestamp/id cursors only when the compact function has not been deployed", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(json({ code: "PGRST202" }, 404))
      .mockResolvedValueOnce(json(Array.from({ length: 1_000 }, (_, index) => session(index))))
      .mockResolvedValueOnce(json([session(1_000, "2026-08-25T22:30:00Z")])));
    expect(await readAppSessionActiveDays(backend, "123", "Europe/Madrid")).toEqual(["2026-08-25", "2026-08-26"]);
    const url = new URL(String(vi.mocked(fetch).mock.calls[2][0]));
    expect(url.searchParams.get("order")).toBe("session_started_at.asc,id.asc");
    expect(url.searchParams.get("or")).toContain("id.gt.00000000-0000-0000-0000-000000000999");
    expect(url.searchParams.has("offset")).toBe(false);
  });

  it.each([401, 429, 503])("never downloads raw sessions after HTTP %s", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ code: "unavailable" }, status)));
    await expect(readAppSessionActiveDays(backend, "123", "UTC")).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("refuses a truncated legacy history at its bounded compatibility limit", async () => {
    let page = 0;
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => {
      page += 1;
      if (page === 1) return json({ code: "PGRST202" }, 404);
      const count = page === 32 ? 1 : 1_000;
      return json(Array.from({ length: count }, (_, index) => session((page - 2) * 1_000 + index)));
    }));
    await expect(readAppSessionActiveDays(backend, "123", "UTC")).rejects.toThrow("too many rows");
    expect(fetch).toHaveBeenCalledTimes(32);
  });

  it("rejects an invalid response without hiding it behind the old reader", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ activeDays: ["2026-02-31"] })));
    await expect(readAppSessionActiveDays(backend, "123", "UTC")).rejects.toThrow("invalid");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
