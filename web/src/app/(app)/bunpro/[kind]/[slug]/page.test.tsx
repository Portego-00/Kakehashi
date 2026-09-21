// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const access = vi.hoisted(() => ({ identity: vi.fn(), token: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "sealed" }) }) }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not-found"); }, redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/lib/server/bunpro", () => ({ BUNPRO_COOKIE: "bunpro", bunproIdentity: access.identity, bunproToken: access.token }));
vi.mock("@/features/bunpro/BunproDetails", () => ({ BunproDetails: () => null }));
import Page from "./page";
beforeEach(() => { access.identity.mockReset().mockResolvedValue({ id: "1" }); access.token.mockReset().mockReturnValue("key"); });
it.each(["grammar", "vocab"])("opens the requested %s subject", async kind => {
  const page = await Page({ params: Promise.resolve({ kind, slug: "desu" }) });
  expect(page.props).toEqual({ kind, slug: "desu" });
});
it("blocks direct access for other accounts", async () => {
  access.identity.mockRejectedValue(new Error("Portego only"));
  await expect(Page({ params: Promise.resolve({ kind: "grammar", slug: "desu" }) })).rejects.toThrow("not-found");
  expect(access.token).not.toHaveBeenCalled();
});
it("requires a connected Bunpro account", async () => {
  access.token.mockReturnValue(null);
  await expect(Page({ params: Promise.resolve({ kind: "grammar", slug: "desu" }) })).rejects.toThrow("redirect:/settings#bunpro-api-key");
});
it("rejects unsupported subject kinds", async () => {
  await expect(Page({ params: Promise.resolve({ kind: "other", slug: "desu" }) })).rejects.toThrow("not-found");
});
