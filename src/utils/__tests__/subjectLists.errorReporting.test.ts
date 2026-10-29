import AsyncStorage from "@react-native-async-storage/async-storage";
import { errorService } from "../../services/errorService";
import { createSubjectList } from "../subjectLists";

const mockInsert = jest.fn();

jest.mock("../../lib/supabase", () => ({
  supabase: { from: jest.fn(() => ({ insert: mockInsert })) },
}));
jest.mock("../store", () => ({
  useAuthStore: { getState: () => ({ userData: null }) },
}));
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { version: "test-version" } },
}));

const storage = jest.mocked(AsyncStorage);

describe("subject-list save error reporting", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage.getItem.mockResolvedValue(null);
    storage.setItem.mockResolvedValue();
    mockInsert.mockResolvedValue({ error: null });
    errorService.setUser({ id: "test-account", username: "Test learner" });
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it("reports a failed first local save with attribution and preserves the original failure", async () => {
    const failure = new Error("database or disk is full (code 13 SQLITE_FULL)");
    storage.setItem.mockRejectedValueOnce(failure);

    await expect(createSubjectList("Private list name", [1, 2])).rejects.toBe(failure);

    expect(mockInsert).toHaveBeenCalledTimes(1);
    const [row] = mockInsert.mock.calls[0];
    expect(row).toMatchObject({
      message: failure.message,
      stack: failure.stack,
      is_fatal: false,
      user_id: "test-account",
      username: "Test learner",
      extra: {
        context: "subject_lists",
        operation: "write_local",
        listCount: 1,
        payloadCharacters: expect.any(Number),
      },
    });
    expect(JSON.stringify(row.extra)).not.toContain("Private list name");
  });

  it("keeps the save failure when reporting is unavailable", async () => {
    const failure = new Error("Could not write to the device database");
    storage.setItem.mockRejectedValueOnce(failure);
    mockInsert.mockRejectedValueOnce(new Error("Network unavailable"));

    await expect(createSubjectList("New list")).rejects.toBe(failure);
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("does not report successful saves", async () => {
    await expect(createSubjectList("New list")).resolves.toMatchObject({
      name: "New list",
      subjectIds: [],
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
