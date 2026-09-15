import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = readFileSync(join(root, 'ios/ReviewNotificationManager.swift'), 'utf8');
const api = source.slice(source.indexOf('private enum KakehashiWatchReviewAPI'), source.indexOf('\nextension KakehashiWatchBridge'));
const snapshot = source.slice(source.indexOf('func makeKakehashiReviewPayloadFromAssignments'), source.indexOf('@discardableResult\nfunc saveKakehashiReviewSnapshot'));
const auth = source.slice(source.indexOf('struct KakehashiNativeAuthSessionSnapshot'), source.indexOf('private let kakehashiLegacyReviewNotificationPrefixes'));
const imageStub = `private func renderKakehashiWatchRadicalImage(_ data: Data, isSVG: Bool) -> Data? { data == Data("mock-radical-svg".utf8) ? Data(base64Encoded: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=") : nil }`;
const tests = readFileSync(join(root, 'scripts/watch-native-api-checks.swift'), 'utf8');
const dir = mkdtempSync(join(tmpdir(), 'kakehashi-watch-native-'));
try {
  writeFileSync(join(dir, 'main.swift'), `import Foundation\nimport CryptoKit\nlet testDefaultsPrefix = "watch-native-test-" + UUID().uuidString\nlet kakehashiStoredAPITokenKey = testDefaultsPrefix + ".token"\nlet kakehashiVacationModeKey = testDefaultsPrefix + ".vacation"\nlet kakehashiVacationStartedAtKey = testDefaultsPrefix + ".vacationDate"\nlet waniKaniAPIBaseURL = "https://api.wanikani.com/v2"\nlet waniKaniAPIRevision = "20170710"\n${auth}\n${snapshot}\n${imageStub}\n${api.replace('"kakehashi.watch.submissionReceipts.v1"', 'testDefaultsPrefix + ".receipts"').replace('"kakehashi.watch.subjectCache.v2"', 'testDefaultsPrefix + ".subjects"')}\n${tests}`);
  const result = spawnSync('swift', [join(dir, 'main.swift')], { cwd: root, encoding: 'utf8', timeout: 90_000 });
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  process.exitCode = result.status ?? 1;
} finally { rmSync(dir, { recursive: true, force: true }); }
