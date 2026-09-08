import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookie: vi.fn(),
  identity: vi.fn(),
  notFound: vi.fn(() => { throw new Error("not found"); }),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.cookie }) }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/server/analytics-server", () => ({ analyticsIdentityFromSealedSession: mocks.identity }));
vi.mock("@/features/notebooks/NotebookWorkspace", () => ({ NotebookWorkspace: () => null }));

import NotebooksPage from "./page";
import NotebookPage from "./[pageId]/page";

const pages = [
  { name: "overview", render: () => NotebooksPage() },
  { name: "editor", render: () => NotebookPage({ params: Promise.resolve({ pageId: "grammar" }) }) },
];

describe.each(pages)("notebook $name page access", ({ render }) => {
  beforeEach(() => {
    mocks.cookie.mockReset().mockImplementation((name) => name === "kakehashi_wk_session" ? { value: "sealed-session" } : undefined);
    mocks.identity.mockReset().mockResolvedValue({ id: "123", username: "Portego", level: 12 });
    mocks.notFound.mockClear();
  });

  it.each(["Portego", " PORTEGO "])("renders for the verified username %j", async (username) => {
    mocks.identity.mockResolvedValue({ id: "123", username, level: 12 });
    expect(await render()).toBeTruthy();
    expect(mocks.identity).toHaveBeenCalledWith("sealed-session");
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it.each(["Tester", "PortegoFan", "", undefined])("hides direct links from username %j", async (username) => {
    mocks.identity.mockResolvedValue({ id: "123", username, level: 12 });
    await expect(render()).rejects.toThrow("not found");
  });

  it("hides direct links without a session", async () => {
    mocks.cookie.mockReturnValue(undefined);
    await expect(render()).rejects.toThrow("not found");
    expect(mocks.identity).not.toHaveBeenCalled();
  });

  it.each([false, true])("rejects demo mode with a real session present: %s", async (hasSession) => {
    mocks.cookie.mockImplementation((name) => name === "kakehashi_demo_session" ? { value: "1" } : hasSession ? { value: "sealed-session" } : undefined);
    await expect(render()).rejects.toThrow("not found");
    expect(mocks.identity).not.toHaveBeenCalled();
  });

  it("rejects a demo identity even if its username is Portego", async () => {
    mocks.identity.mockResolvedValue({ id: "demo-level-21", username: "Portego", level: 21 });
    await expect(render()).rejects.toThrow("not found");
  });

  it("fails closed when the identity cannot be verified", async () => {
    mocks.identity.mockRejectedValue(new Error("Session invalid"));
    await expect(render()).rejects.toThrow("not found");
  });
});
