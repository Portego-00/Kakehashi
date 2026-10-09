import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sdk = process.env.ANDROID_HOME ?? path.join(os.homedir(), "Library/Android/sdk");
const adb = path.join(sdk, "platform-tools/adb");
const run = (file, args, options = {}) => execFileSync(file, args, {
  cwd: root, encoding: "utf8", stdio: "pipe", ...options,
});
const devices = run(adb, ["devices"]).split("\n").filter((line) => /\tdevice$/.test(line));
const serial = process.env.ANDROID_SERIAL ?? devices.find((line) => line.startsWith("emulator-"))?.split("\t")[0];
if (!serial) throw new Error("Start an Android emulator before running widget checks.");
const device = (...args) => run(adb, ["-s", serial, ...args]);
const architecture = device("shell", "getprop", "ro.product.cpu.abi").trim();
const output = path.join(root, "output/android-widgets");
mkdirSync(output, { recursive: true });

console.log(`Building and testing widgets on ${serial}. Synthetic statistics are saved in this emulator.`);
run("./gradlew", [":app:assembleDebug", ":app:assembleDebugAndroidTest", `-PreactNativeArchitectures=${architecture}`], {
  cwd: path.join(root, "android"), stdio: "inherit", env: { ...process.env, ANDROID_HOME: sdk },
});
device("install", "-r", "android/app/build/outputs/apk/debug/app-debug.apk");
device("install", "-r", "android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk");
device("shell", "appwidget", "grantbind", "--package", "com.portego00.kakehashi");
try {
  const result = device("shell", "am", "instrument", "-w", "-e", "class",
    "expo.modules.kakehashiwidget.HomeWidgetTest",
    "com.portego00.kakehashi.test/androidx.test.runner.AndroidJUnitRunner");
  writeFileSync(path.join(output, "device-tests.log"), result);
  console.log(result);
  if (!/OK \(\d+ tests\)/.test(result)) throw new Error("Android widget device tests failed.");
  device("pull", "/sdcard/Android/data/com.portego00.kakehashi/files/widget-proof/.", path.join(output, "rendered"));
  console.log(`Widget rendering evidence saved to ${output}.`);
} finally {
  device("shell", "appwidget", "revokebind", "--package", "com.portego00.kakehashi");
}
