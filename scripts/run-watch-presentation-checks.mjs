#!/usr/bin/env node

// Run with: node scripts/run-watch-presentation-checks.mjs
// Requires Node.js and a local Swift toolchain; no simulator or dependencies.
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const project = new URL("../", import.meta.url);
const watchDirectory = new URL("targets/kakehashi-watch/", project);
const [store, presentation, detail, checks] = await Promise.all([
  readFile(new URL("WatchReviewStore.swift", watchDirectory), "utf8"),
  readFile(new URL("WatchSnapshotPresentation.swift", watchDirectory), "utf8"),
  readFile(new URL("WatchForecastDetail.swift", watchDirectory), "utf8"),
  readFile(new URL("scripts/watch-presentation-checks.swift", project), "utf8"),
]);

function extractProductionType(startDeclaration, nextDeclaration) {
  const start = store.indexOf(startDeclaration);
  const end = store.indexOf(nextDeclaration, start);
  if (start < 0 || end <= start) {
    throw new Error(
      `Cannot extract ${startDeclaration} from WatchReviewStore.swift. ` +
        "Update the source boundaries if the production types have moved.",
    );
  }
  return store.slice(start, end);
}

// Use the real model definitions without importing WatchConnectivity or
// constructing the live store. The presentation implementation is unchanged.
const snapshot = extractProductionType(
  "struct ReviewSnapshot:",
  "\nstruct WatchReviewCard:",
);
const connection = extractProductionType(
  "enum WatchConnectionState:",
  "\n@MainActor",
);
const temporaryDirectory = await mkdtemp(join(tmpdir(), "watch-presentation-checks-"));

try {
  const generatedSource = join(temporaryDirectory, "main.swift");
  await writeFile(
    generatedSource,
    ["import Foundation", detail, snapshot, connection, presentation, checks].join("\n\n"),
  );
  const result = spawnSync("swift", [generatedSource], { stdio: "inherit" });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
