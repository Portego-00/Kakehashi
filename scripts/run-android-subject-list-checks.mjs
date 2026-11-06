import {spawn, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, copyFileSync} from 'node:fs';
import {homedir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import net from 'node:net';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const output = path.resolve(option('--output', 'output/android-native-storage'));
mkdirSync(output, {recursive: true});
const sdk = process.env.ANDROID_HOME || path.join(homedir(), 'Library/Android/sdk');
const adb = path.join(sdk, 'platform-tools/adb');
function run(command, parameters, options = {}) {
  const result = spawnSync(command, parameters, {cwd: root, encoding: 'utf8', ...options});
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${command} failed`);
  return result.stdout;
}
const devices = run(adb, ['devices']).split('\n').filter(line => /\tdevice$/.test(line)).map(line => line.split('\t')[0]);
const device = option('--device', process.env.ANDROID_SERIAL || (devices.length === 1 ? devices[0] : null));
if (!device) throw new Error('Choose an existing Android emulator with --device.');
const adbArgs = ['-s', device];
const androidJar = path.join(sdk, 'platforms/android-36/android.jar');
const buildTools = path.join(sdk, 'build-tools', readdirSync(path.join(sdk, 'build-tools')).sort((a, b) => a.localeCompare(b, undefined, {numeric: true})).at(-1));
const build = path.resolve(option('--build-dir', path.join(output, 'native')));
const source = path.join(build, 'src');
const files = {
  'com/reactnativecommunity/asyncstorage/BuildConfig.java': 'package com.reactnativecommunity.asyncstorage; public class BuildConfig {public static final int AsyncStorage_db_size = 6;}',
  'com/facebook/react/common/ReactConstants.java': 'package com.facebook.react.common; public class ReactConstants {public static final String TAG = "ReactNative";}',
  'com/facebook/common/logging/FLog.java': 'package com.facebook.common.logging; public class FLog {public static void d(String tag, String message) {}}',
  'javax/annotation/Nullable.java': 'package javax.annotation; public @interface Nullable {}',
};
for (const [name, contents] of Object.entries(files)) {
  const file = path.join(source, name); mkdirSync(path.dirname(file), {recursive: true}); writeFileSync(file, contents);
}
const supplier = path.join(root, 'node_modules/@react-native-async-storage/async-storage/android/src/main/java/com/reactnativecommunity/asyncstorage/ReactDatabaseSupplier.java');
const serverSource = path.join(root, 'scripts/android-subject-lists/StorageServer.java');
const targetPackage = path.join(source, 'com/reactnativecommunity/asyncstorage');
copyFileSync(supplier, path.join(targetPackage, 'ReactDatabaseSupplier.java'));
copyFileSync(serverSource, path.join(targetPackage, 'StorageServer.java'));
mkdirSync(path.join(build, 'classes'), {recursive: true});
mkdirSync(path.join(build, 'dex'), {recursive: true});
const jar = path.join(build, 'probe.jar');
const stamp = path.join(build, 'source-hash');
const digest = createHash('sha256').update(readFileSync(supplier)).update(readFileSync(serverSource)).update(JSON.stringify(files)).digest('hex');
if (!existsSync(jar) || !existsSync(stamp) || readFileSync(stamp, 'utf8') !== digest) {
  const sources = [...Object.keys(files).map(name => path.join(source, name)), path.join(targetPackage, 'ReactDatabaseSupplier.java'), path.join(targetPackage, 'StorageServer.java')];
  run('javac', ['-J-Xmx256m', '-source', '8', '-target', '8', '-classpath', androidJar, '-d', path.join(build, 'classes'), ...sources]);
  const list = run('rg', ['--files', path.join(build, 'classes')]).trim().split('\n').filter(name => name.endsWith('.class'));
  run(path.join(buildTools, 'd8'), ['--lib', androidJar, '--output', path.join(build, 'dex'), ...list]);
  run('python3', ['-c', 'import sys,zipfile,pathlib; z=zipfile.ZipFile(sys.argv[1],"w"); [z.write(p,p.name) for p in pathlib.Path(sys.argv[2]).glob("*.dex")]; z.close()', jar, path.join(build, 'dex')]);
  writeFileSync(stamp, digest);
}
const remoteJar = '/data/local/tmp/kakehashi-list-storage-probe.jar';
const remoteDb = '/data/local/tmp/kakehashi-list-storage-probe.db';
const port = 8127;
let server;
try {
  run(adb, [...adbArgs, 'push', jar, remoteJar]);
  run(adb, [...adbArgs, 'shell', 'rm', '-f', remoteDb, `${remoteDb}-journal`, `${remoteDb}-wal`, `${remoteDb}-shm`]);
  run(adb, [...adbArgs, 'forward', `tcp:${port}`, `tcp:${port}`]);
  server = spawn(adb, [...adbArgs, 'shell', 'env', `CLASSPATH=${remoteJar}`, 'app_process', '/system/bin', 'com.reactnativecommunity.asyncstorage.StorageServer', remoteDb, String(port)], {stdio: ['ignore', 'pipe', 'pipe']});
  let logs = '';
  for (const stream of [server.stdout, server.stderr]) stream.on('data', data => {logs += data; writeFileSync(path.join(output, 'native.log'), logs);});
  for (let i = 0; i < 180; i++) {
    if (server.exitCode !== null) throw new Error(`Native storage failed: ${logs}`);
    if (logs.includes('ANDROID_STORAGE_READY')) break;
    if (i === 179) throw new Error(`Native storage did not start: ${logs}`);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  console.log('Native Android storage ready');
  const test = spawn(process.execPath, [path.join(root, 'node_modules/jest/bin/jest.js'), '--runInBand', '--watchman=false', 'src/utils/__tests__/subjectLists.androidStorage.test.ts'], {cwd: root, stdio: 'inherit', env: {...process.env, ANDROID_STORAGE_PROBE_PORT: String(port), ANDROID_STORAGE_PROBE_RESULT: path.join(output, 'result.json'), ...(args.includes('--database-size-mb') ? {ANDROID_STORAGE_PROBE_CAPACITY_MB: option('--database-size-mb')} : {})}});
  process.exitCode = await new Promise(resolve => test.once('exit', resolve));
} finally {
  if (server && server.exitCode === null) {
    await new Promise(resolve => {
      const socket = net.createConnection({host: '127.0.0.1', port});
      const finish = () => {socket.destroy(); resolve();};
      socket.setTimeout(2000, finish);
      socket.on('error', finish);
      socket.on('connect', () => socket.write('{"operation":"shutdown"}\n'));
      socket.on('data', finish);
    });
    if (server.exitCode === null) server.kill('SIGTERM');
  }
  spawnSync(adb, [...adbArgs, 'forward', '--remove', `tcp:${port}`], {stdio: 'ignore'});
  spawnSync(adb, [...adbArgs, 'shell', 'rm', '-f', remoteJar, remoteDb, `${remoteDb}-journal`, `${remoteDb}-wal`, `${remoteDb}-shm`], {stdio: 'ignore'});
}
