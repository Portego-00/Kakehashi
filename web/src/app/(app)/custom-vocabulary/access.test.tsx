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
vi.mock("@/features/custom-srs/CustomVocabularyHub", () => ({ CustomVocabularyHub: () => null }));
vi.mock("@/features/custom-srs/CustomSrsSession", () => ({ CustomSrsSession: () => null }));
vi.mock("@/features/custom-srs/CustomVocabularyDetail", () => ({ CustomVocabularyDetail: () => null }));

import CustomVocabularyPage from "./page";
import CustomVocabularyLessonsPage from "./lessons/page";
import CustomVocabularyReviewsPage from "./reviews/page";
import CustomVocabularyWordPage from "./words/[wordId]/page";

const pages = [
  { name: "packs", render: () => CustomVocabularyPage() },
  { name: "lessons", render: () => CustomVocabularyLessonsPage() },
  { name: "reviews", render: () => CustomVocabularyReviewsPage() },
  { name: "word details", render: () => CustomVocabularyWordPage({ params: Promise.resolve({ wordId: "conversation-douzo" }) }) },
];

describe.each(pages)("custom vocabulary $name page access", ({ render }) => {
  beforeEach(() => {
    mocks.cookie.mockReset().mockReturnValue({ value: "sealed-session" });
    mocks.identity.mockReset().mockResolvedValue({ id: "123", username: "Portego", level: 12 });
    mocks.notFound.mockClear();
  });

  it.each(["Portego", " PORTEGO "])("renders for the verified username %j", async (username) => {
    mocks.identity.mockResolvedValue({ id: "123", username, level: 12 });
    expect(await render()).toBeTruthy();
    expect(mocks.cookie).toHaveBeenCalledWith("kakehashi_wk_session");
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

  it("fails closed when the identity cannot be verified", async () => {
    mocks.identity.mockRejectedValue(new Error("Session invalid"));
    await expect(render()).rejects.toThrow("not found");
  });
});
