import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("study time transport policy", () => {
  it("keeps native sync and history off Supabase Edge Functions", () => {
    const productionSources = [
      "../timeTrackingSyncService.ts",
      "../studyTimeHistoryService.ts",
      "../studyTimeRpcClient.ts",
    ].map((relativePath) =>
      readFileSync(resolve(__dirname, relativePath), "utf8"),
    );

    for (const source of productionSources) {
      expect(source).not.toMatch(/\/functions\/v1\//);
      expect(source).not.toMatch(/postStudyTimeEdge/);
      expect(source).not.toMatch(/study-time-(?:sync|history)/);
    }
  });
});
