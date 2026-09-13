import fs from "node:fs";
import path from "node:path";

describe("notification logout coordination", () => {
  it("suspends new work, drains each scheduler, then performs final cleanup", () => {
    const store = fs.readFileSync(
      path.join(process.cwd(), "src/utils/store.ts"),
      "utf8",
    );
    const suspendIndex = store.indexOf("suspendNotificationSessionForLogout();");
    const drainIndex = store.indexOf("const notificationDrains = Promise.all([");
    const tokenClearIndex = store.indexOf("await clearApiToken();", drainIndex);
    const awaitDrainIndex = store.indexOf("await notificationDrains;", drainIndex);
    const cancelIndex = store.indexOf(
      "await cancelAllNotificationsForLogout();",
      drainIndex,
    );

    expect(suspendIndex).toBeGreaterThan(-1);
    expect(drainIndex).toBeGreaterThan(suspendIndex);
    expect(tokenClearIndex).toBeGreaterThan(drainIndex);
    expect(awaitDrainIndex).toBeGreaterThan(tokenClearIndex);
    expect(cancelIndex).toBeGreaterThan(awaitDrainIndex);
    expect(store).toContain("invalidateBadgeNotificationUpdatesForLogout(),");
    expect(store).toContain("invalidateReviewNotificationSyncsForLogout(),");
    expect(store).toContain("invalidateReviewNotificationWorkForLogout(),");
  });
});
