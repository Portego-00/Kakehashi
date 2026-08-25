import { describe, expect, it } from "vitest";
import { canManageIssueAuthor, resolveCommunityMode, resolveCommunityModeFromEnvironment } from "./security-model";

const identity = { id: "kakelearner", username: "KakeLearner" };

describe("community server boundary", () => {
  it("does not silently create a local board when durable configuration is absent", () => {
    expect(resolveCommunityMode({ url: "", serviceRoleKey: "", production: false })).toBe("unavailable");
    expect(resolveCommunityMode({ url: "", serviceRoleKey: "", production: true })).toBe("unavailable");
    expect(resolveCommunityMode({ url: "https://example.supabase.co", serviceRoleKey: "server-secret", production: true })).toBe("supabase");
    expect(resolveCommunityMode({ url: "https://example.supabase.co", serviceRoleKey: "", anonKey: "public-key", production: false })).toBe("supabase-native-dev");
    expect(resolveCommunityMode({ url: "https://example.supabase.co", serviceRoleKey: "", anonKey: "public-key", production: true })).toBe("supabase-readonly");
  });

  it("uses the local JSON board only after an explicit development opt-in", () => {
    expect(resolveCommunityMode({ url: "", serviceRoleKey: "", production: false, localStoreEnabled: true })).toBe("local-server");
    expect(resolveCommunityMode({ url: "", serviceRoleKey: "", production: true, localStoreEnabled: true })).toBe("unavailable");
  });

  it("recognizes the author from the stable id or legacy username", () => {
    expect(canManageIssueAuthor({ user_id: "kakelearner" }, identity)).toBe(true);
    expect(canManageIssueAuthor({ user_username: "KAKELEARNER" }, identity)).toBe(true);
    expect(canManageIssueAuthor({ user_id: "another-user", user_username: "AnotherUser" }, identity)).toBe(false);
  });
});

describe("community environment mode", () => {
  it("honors only the exact local-store environment opt-in", () => {
    expect(resolveCommunityModeFromEnvironment({ nodeEnv: "development", localStore: "1" })).toBe("local-server");
    expect(resolveCommunityModeFromEnvironment({ nodeEnv: "development", localStore: "true" })).toBe("unavailable");
    expect(resolveCommunityModeFromEnvironment({ nodeEnv: "production", localStore: "1" })).toBe("unavailable");
  });
});
