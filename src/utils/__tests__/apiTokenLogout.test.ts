import * as SecureStore from "expo-secure-store";

import WaniKaniBackgroundFetch from "../../modules/WaniKaniBackgroundFetch";
import { clearApiToken } from "../api";

jest.mock("../../modules/WaniKaniBackgroundFetch", () => ({
  __esModule: true,
  default: {
    storeApiToken: jest.fn(),
  },
}));

jest.mock("../platformSupport", () => ({
  isIOSOnMac: jest.fn(() => false),
}));

describe("API token logout cleanup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.apiToken = "outgoing-account-token";
  });

  it("invalidates JS and native auth even when the Keychain delete fails", async () => {
    jest.mocked(SecureStore.deleteItemAsync).mockRejectedValueOnce(
      new Error("Keychain unavailable"),
    );

    await clearApiToken();

    expect(global.apiToken).toBeNull();
    expect(WaniKaniBackgroundFetch?.storeApiToken).toHaveBeenCalledWith("");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "wanikani_api_token",
      "",
    );
  });
});
