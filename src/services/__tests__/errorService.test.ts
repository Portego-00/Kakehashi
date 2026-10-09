import { errorService } from "../errorService";

const mockInsert = jest.fn();

jest.mock("../../lib/supabase", () => ({
  supabase: { from: jest.fn(() => ({ insert: mockInsert })) },
}));
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { version: "test-version" } },
}));

describe("Supabase error logging", () => {
  beforeEach(() => {
    mockInsert.mockReset().mockResolvedValue({ error: null });
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    errorService.setUser({ id: "account-a", username: "Learner A" });
  });

  afterEach(() => jest.restoreAllMocks());

  it("keeps concurrent errors and attributes each to the account at the time of failure", async () => {
    let finish!: (result: { error: null }) => void;
    mockInsert.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));

    const first = errorService.logError(new Error("Releases failed"), { extra: { section: "releases" } });
    const second = errorService.logError(new Error("Popular songs failed"), { extra: { section: "popular" } });
    errorService.setUser({ id: "account-b", username: "Learner B" });
    const third = errorService.logError(new Error("Anime failed"), { extra: { section: "anime" } });
    await Promise.resolve();
    finish({ error: null });
    await Promise.all([first, second, third]);

    expect(mockInsert).toHaveBeenCalledTimes(3);
    expect(mockInsert.mock.calls.map(([row]) => [row.message, row.user_id, row.username])).toEqual([
      ["Releases failed", "account-a", "Learner A"],
      ["Popular songs failed", "account-a", "Learner A"],
      ["Anime failed", "account-b", "Learner B"],
    ]);
  });

  it("does not let a failed insert block the next error or escape to the app", async () => {
    mockInsert.mockRejectedValueOnce(new TypeError("Logging connection failed"));
    await expect(Promise.all([
      errorService.logError(new Error("First music error")),
      errorService.logError(new Error("Second music error")),
    ])).resolves.toEqual([undefined, undefined]);
    expect(mockInsert).toHaveBeenCalledTimes(2);
  });
});
