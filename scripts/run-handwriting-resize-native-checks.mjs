// Run with: node scripts/run-handwriting-resize-native-checks.mjs --simulator BOOTED_UDID [--output report.json]
// Compiles the real UIKit/PencilKit sources into a disposable simulator app.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: { simulator: { type: 'string' }, output: { type: 'string' } } });
if (!values.simulator) throw new Error('Pass --simulator with a booted iOS simulator UDID.');
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const run = (command, args) => execFileSync(command, args, { encoding: 'utf8', timeout: 60_000 });
const simctl = (...args) => run('xcrun', ['simctl', ...args]);
const simulator = Object.values(JSON.parse(simctl('list', 'devices', 'available', '-j')).devices)
  .flat().find((device) => device.udid === values.simulator);
if (simulator?.state !== 'Booted') throw new Error('The requested simulator must already be booted.');

const dir = mkdtempSync(join(tmpdir(), 'kakehashi-native-resize-checks-'));
const app = join(dir, 'ResizeChecks.app');
const bundle = `com.portego00.kakehashi.resizechecks.p${process.pid}`;
const sourceDir = join(root, 'modules/notebook-handwriting/ios');
let installed = false;
try {
  mkdirSync(app);
  const sdk = run('xcrun', ['--sdk', 'iphonesimulator', '--show-sdk-path']).trim();
  const architecture = process.arch === 'arm64' ? 'arm64' : 'x86_64';
  const sources = ['HandwritingDraftStore.swift', 'HandwritingViewController.swift',
    'InlineHandwritingCanvas.swift', 'InlineHandwritingImport.swift'].map((file) => join(sourceDir, file));
  run('xcrun', ['--sdk', 'iphonesimulator', 'swiftc', '-parse-as-library', '-sdk', sdk,
    '-target', `${architecture}-apple-ios15.1-simulator`, '-o', join(app, 'ResizeChecks'),
    join(root, 'scripts/handwriting-resize-native-checks.swift'), ...sources]);
  writeFileSync(join(app, 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>${bundle}</string>
<key>CFBundleName</key><string>Handwriting Resize Checks</string>
<key>CFBundleExecutable</key><string>ResizeChecks</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleVersion</key><string>1</string>
<key>CFBundleShortVersionString</key><string>1.0</string>
<key>MinimumOSVersion</key><string>15.1</string>
<key>LSRequiresIPhoneOS</key><true/>
<key>UIDeviceFamily</key><array><integer>2</integer></array>
<key>UILaunchScreen</key><dict/>
</dict></plist>`);
  run('codesign', ['--force', '--sign', '-', app]);
  simctl('install', values.simulator, app);
  installed = true;
  const container = simctl('get_app_container', values.simulator, bundle, 'data').trim();
  const result = join(container, 'Documents', 'resize-checks.json');
  simctl('launch', values.simulator, bundle);
  const deadline = Date.now() + 15_000;
  while (!existsSync(result) && Date.now() < deadline) {
    await new Promise((done) => setTimeout(done, 100));
  }
  if (!existsSync(result)) throw new Error('Timed out waiting for native resize assertions.');
  const report = JSON.parse(readFileSync(result, 'utf8'));
  if (values.output) writeFileSync(resolve(values.output), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ passed: report.passed, total: report.total, failures: report.failures }));
  process.exitCode = report.failures.length ? 1 : 0;
} finally {
  if (installed) {
    try { simctl('terminate', values.simulator, bundle); } catch { /* The fixture may have already exited. */ }
    simctl('uninstall', values.simulator, bundle);
  }
  rmSync(dir, { recursive: true, force: true });
}
