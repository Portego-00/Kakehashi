import {spawn, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync} from 'node:fs';
import {homedir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = path.join(root, 'scripts/android-subject-details');
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const output = path.resolve(option('--output', path.join(root, 'output/android-subject-details')));
mkdirSync(output, {recursive: true});
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(homedir(), 'Library/Android/sdk');
const adb = path.join(sdk, 'platform-tools/adb');
function run(command, parameters, options = {}) {
  const result = spawnSync(command, parameters, {cwd: root, encoding: 'utf8', ...options});
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${command} failed`);
  return result.stdout;
}
const devices = run(adb, ['devices']).split('\n').filter(line => /\tdevice$/.test(line)).map(line => line.split('\t')[0]);
const device = option('--device', process.env.ANDROID_SERIAL || (devices.length === 1 ? devices[0] : null));
if (!device) throw new Error('Select an existing booted Android device with --device. This check never creates or wipes a device.');
const adbArgs = ['-s', device];
const appId = 'com.portego00.kakehashi';
run(adb, [...adbArgs, 'shell', 'run-as', appId, 'true']);
const probeId = `${appId}.probe`;
const build = path.join(output, 'probe');
mkdirSync(path.join(build, 'classes'), {recursive: true});
mkdirSync(path.join(build, 'dex'), {recursive: true});
const javaSource = path.join(fixture, 'SubjectDetailsResponsivenessTest.java');
const manifest = path.join(fixture, 'AndroidManifest.xml');
const toolsVersion = readdirSync(path.join(sdk, 'build-tools')).sort((a, b) => a.localeCompare(b, undefined, {numeric: true})).at(-1);
const buildTools = path.join(sdk, 'build-tools', toolsVersion);
const androidJar = path.join(sdk, 'platforms/android-36/android.jar');
const keystore = path.join(root, 'android/app/debug.keystore');
const digest = createHash('sha256').update(readFileSync(javaSource)).update(readFileSync(manifest)).update(readFileSync(keystore)).digest('hex');
const apk = path.join(build, 'probe.apk');
const stamp = path.join(build, 'source-hash');
if (!existsSync(apk) || !existsSync(stamp) || readFileSync(stamp, 'utf8') !== digest) {
  run('javac', ['-source', '8', '-target', '8', '-classpath', androidJar, '-d', path.join(build, 'classes'), javaSource]);
  const classes = readdirSync(path.join(build, 'classes/com/portego00/kakehashi')).filter(name => name.endsWith('.class')).map(name => path.join(build, 'classes/com/portego00/kakehashi', name));
  run(path.join(buildTools, 'd8'), ['--lib', androidJar, '--output', path.join(build, 'dex'), ...classes]);
  const unsigned = path.join(build, 'probe-unsigned.apk');
  run(path.join(buildTools, 'aapt2'), ['link', '-I', androidJar, '--manifest', manifest, '-o', unsigned]);
  run('python3', ['-c', 'import sys,zipfile,pathlib; base=pathlib.Path(sys.argv[1]); z=zipfile.ZipFile(base/"probe-unsigned.apk","a"); [z.write(p,p.name) for p in (base/"dex").glob("*.dex")]; z.close()', build]);
  run(path.join(buildTools, 'apksigner'), ['sign', '--ks', keystore, '--ks-pass', 'pass:android', '--key-pass', 'pass:android', '--out', apk, unsigned]);
  writeFileSync(stamp, digest);
}
const endpoint = 'com.portego00.kakehashi.probe/com.portego00.kakehashi.SubjectDetailsResponsivenessTest';
let metro;
let audioServer;
const metroLog = path.join(output, 'metro.log');
const subprocesses = [];
try {
  audioServer = createServer((request, response) => {
    if (request.url !== '/pronunciation.wav') { response.writeHead(404).end(); return; }
    response.writeHead(200, {'Content-Type': 'audio/wav'});
    response.end(readFileSync(path.join(fixture, 'pronunciation.wav')));
  });
  await new Promise((resolve, reject) => { audioServer.once('error', reject); audioServer.listen(8097, '127.0.0.1', resolve); });
  metro = spawn(process.execPath, [path.join(root, 'node_modules/expo/bin/cli'), 'start', '--dev-client', '--host', 'lan', '--port', '8096'], {
    cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env: {...process.env, EXPO_NO_DOTENV: '1', EXPO_PACKAGER_PROXY_URL: 'http://127.0.0.1:8096', EXPO_OVERRIDE_METRO_CONFIG: path.join(fixture, 'runtime/metro.config.cjs')},
  });
  metro.stdout.on('data', data => { writeFileSync(metroLog, data, {flag: 'a'}); });
  metro.stderr.on('data', data => { writeFileSync(metroLog, data, {flag: 'a'}); });
  for (let i = 0; i < 120; i++) {
    if (metro.exitCode !== null) throw new Error(`Metro exited; see ${metroLog}`);
    try { if ((await fetch('http://127.0.0.1:8096/status')).ok) break; } catch {}
    if (i === 119) throw new Error('Metro did not start within 60 seconds');
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  run(adb, [...adbArgs, 'reverse', 'tcp:8096', 'tcp:8096']);
  run(adb, [...adbArgs, 'reverse', 'tcp:8097', 'tcp:8097']);
  run(adb, [...adbArgs, 'install', '--no-incremental', '-r', apk]);
  const test = spawn(adb, [...adbArgs, 'shell', 'am', 'instrument', '-w', endpoint], {stdio: ['ignore', 'pipe', 'pipe']});
  subprocesses.push(test);
  let verdict = '';
  for (const stream of [test.stdout, test.stderr]) stream.on('data', data => { verdict += data; process.stdout.write(data); });
  const exitCode = await new Promise(resolve => test.once('exit', resolve));
  writeFileSync(path.join(output, 'native-test.log'), verdict);
  writeFileSync(path.join(output, 'runtime.log'), run(adb, [...adbArgs, 'logcat', '-d', '-t', '3500', 'ReactNativeJS:W', 'System.out:I', 'AndroidRuntime:E', '*:S']));
  run(adb, [...adbArgs, 'pull', `/sdcard/Android/data/${appId}/files/subject-details-proof`, output]);
  if (exitCode !== 0 || !verdict.includes('PASS: subject tabs')) throw new Error(`Native regression failed; see ${output}`);
  console.log(`Android details checks passed. Screenshots and timings: ${output}`);
} finally {
  for (const process of subprocesses) if (process.exitCode === null) process.kill('SIGTERM');
  if (metro && metro.exitCode === null) metro.kill('SIGTERM');
  if (audioServer) audioServer.close();
  spawnSync(adb, [...adbArgs, 'uninstall', probeId], {stdio: 'ignore'});
  for (const port of ['8096', '8097']) spawnSync(adb, [...adbArgs, 'reverse', '--remove', `tcp:${port}`], {stdio: 'ignore'});
}
