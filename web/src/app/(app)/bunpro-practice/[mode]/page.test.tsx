// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const identity = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "sealed" }) }) }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not-found"); } }));
vi.mock("@/lib/server/bunpro", () => ({ bunproIdentity: identity }));
vi.mock("@/features/bunpro/BunproPractice", () => ({ BunproPractice: () => null }));
import Page from "./page";
beforeEach(() => { identity.mockReset().mockResolvedValue({ id: "1", username: "Portego" }); });
it.each(["sentence-drill", "mastery-loop", "no-hints", "listening-cloze"])("opens %s for verified Portego", async mode => {
  expect((await Page({ params: Promise.resolve({ mode }) })).props.mode).toBe(mode);
});
it.each(["Learner", "Portego2", "", undefined])("blocks direct practice links for %j", async username => {
  identity.mockResolvedValue({ id: "1", username });
  for (const mode of ["sentence-drill", "mastery-loop", "no-hints", "listening-cloze"]) {
    await expect(Page({ params: Promise.resolve({ mode }) })).rejects.toThrow("not-found");
  }
});
it("blocks signed-out visitors and unknown modes", async () => {
  await expect(Page({ params: Promise.resolve({ mode: "unknown" }) })).rejects.toThrow("not-found");
  identity.mockRejectedValue(new Error("Sign in"));
  await expect(Page({ params: Promise.resolve({ mode: "sentence-drill" }) })).rejects.toThrow("not-found");
});
