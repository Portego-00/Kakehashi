import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../lib/supabase";
import { analyticsService } from "../analyticsService";
import { confirmUsageStreakSession } from "../usageStreakService";

jest.mock("../../lib/supabase", () => ({ supabase: { from: jest.fn() } }));
jest.mock("../usageStreakService", () => ({ confirmUsageStreakSession: jest.fn().mockResolvedValue(undefined) }));
const from = jest.mocked(supabase.from);

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  jest.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it("confirms the database timestamp after a successful insert", async () => {
  const select = jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({
    data: { session_started_at: "2026-09-08T11:01:02.123456+00:00" }, error: null,
  }) });
  const insert = jest.fn().mockReturnValue({ select });
  from.mockReturnValue({ insert } as never);
  await analyticsService.logSession("account-a");
  expect(select).toHaveBeenCalledWith("session_started_at");
  expect(insert.mock.calls[0][0]).not.toHaveProperty("session_started_at");
  expect(confirmUsageStreakSession).toHaveBeenCalledWith("account-a", "2026-09-08T11:01:02.123456+00:00");
});

it("does not persist optimistic activity when the session insert fails", async () => {
  from.mockReturnValue({ insert: () => ({ select: () => ({ single: async () => ({
    data: null, error: { message: "Offline" },
  }) }) }) } as never);
  await analyticsService.logSession("account-a");
  expect(confirmUsageStreakSession).not.toHaveBeenCalled();
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});
