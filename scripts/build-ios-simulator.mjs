// Build for an existing simulator. Google ML Kit OCR reports unavailable there.
import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    simulator: { type: "string" },
    configuration: { type: "string", default: "Debug" },
    "derived-data": { type: "string" },
    "skip-pods": { type: "boolean", default: false },
  },
});
if (!values.simulator) {
  throw new Error("Pass --simulator with an existing iOS Simulator UDID.");
}

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cacheVolume = "/Volumes/XcodeBuildCache";
const derivedData = path.resolve(values["derived-data"] ?? path.join(cacheVolume, "DerivedData/Kakehashi-Simulator"));
if (!derivedData.startsWith(`${cacheVolume}/`)) {
  throw new Error("Keep --derived-data on the required Xcode build-cache SSD volume.");
}
const env = { ...process.env, KAKEHASHI_IOS_SIMULATOR: "1" };
function run(command, args, { cwd = root, capture = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr || `${command} failed (${result.status}).`);
  }
  return result.stdout;
}

run(path.join(homedir(), ".local/bin/mount-xcode-build-cache-ssd"), ["--required"]);
if (statSync(cacheVolume).dev === statSync(path.dirname(cacheVolume)).dev) {
  throw new Error("The Xcode build-cache volume must be mounted before building.");
}

const inventory = JSON.parse(run("xcrun", ["simctl", "list", "devices", "available", "--json"], { capture: true }));
const simulator = Object.values(inventory.devices).flat().find((device) => device.udid === values.simulator);
if (!simulator) throw new Error("The requested simulator is unavailable. Reuse a compatible existing device.");

if (!values["skip-pods"]) {
  run("pod", ["install"], { cwd: path.join(root, "ios") });
} else {
  const installedSpec = JSON.parse(readFileSync(path.join(root, "ios/Pods/Local Podspecs/RNMLKitTextRecognition.podspec.json"), "utf8"));
  if (!installedSpec.pod_target_xcconfig?.GCC_PREPROCESSOR_DEFINITIONS?.includes("KAKEHASHI_MLKIT_SIMULATOR_ONLY=1")) {
    throw new Error("Simulator-only pods are not installed. Run again without --skip-pods.");
  }
}

console.log("Building with simulator-only ML Kit OCR unavailable. Physical-device OCR is unchanged.");
run("xcodebuild", [
  "-workspace", path.join(root, "ios/wanikani.xcworkspace"),
  "-scheme", "wanikani",
  "-configuration", values.configuration,
  "-jobs", "4",
  // The destination selects the SDK for each app/watch target independently.
  "-destination", `id=${values.simulator}`,
  "-derivedDataPath", derivedData,
  "ONLY_ACTIVE_ARCH=YES",
  // Ad-hoc signing keeps Xcode's app/extension entitlements and private Keychain access.
  "CODE_SIGNING_ALLOWED=YES",
  "CODE_SIGN_IDENTITY=-",
  "CODE_SIGNING_REQUIRED=YES",
  "build",
]);

console.log("Simulator build complete. Run pod install without KAKEHASHI_IOS_SIMULATOR before a physical-device build.");
