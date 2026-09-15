import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = readFileSync(join(root, 'ios/ReviewNotificationManager.swift'), 'utf8');
const start = source.indexOf('  private func scheduleUpcomingNotifications(');
const end = source.indexOf('  private func setupNotificationActions()', start);
const helpersStart = source.indexOf('private let kakehashiLegacyReviewNotificationPrefixes');
const helpersEnd = source.indexOf('func removeDeliveredKakehashiReviewNotifications(', helpersStart);
if (start < 0 || end < 0 || helpersStart < 0 || helpersEnd < 0) {
  throw new Error('Could not locate the production native notification schedulers');
}

// Compile the production scheduling methods, replacing only their wall clock.
// Framework doubles model Apple's request-ID replacement rules; no iPhone,
// notification permission, app account, or real time delays are needed.
const withFixedClock = code => code
  .replace(/\bDate\(\)/g, 'notificationCheckNow')
  .replaceAll('.timeIntervalSinceNow', '.timeIntervalSince(notificationCheckNow)');
const scheduling = withFixedClock(source.slice(start, end));
const settingHelpers = withFixedClock(source.slice(helpersStart, helpersEnd));
const constants = source.split('\n').filter(line =>
  /^let kakehashiReview(?:Notification|Alert)/.test(line)
).join('\n');
const tests = readFileSync(join(root, 'scripts/review-notification-checks.swift'), 'utf8');
const dir = mkdtempSync(join(tmpdir(), 'kakehashi-review-notifications-'));
try {
  const main = join(dir, 'main.swift');
  writeFileSync(main, `import Foundation\n${constants}\n${settingHelpers}\nstruct NativeReviewScheduler {\n${scheduling}\n  private func setupNotificationActions() {}\n}\n${tests}`);
  const result = spawnSync('swift', ['-swift-version', '5', main], {
    cwd: root,
    encoding: 'utf8',
    timeout: 90_000,
    env: { ...process.env, TZ: 'UTC' },
  });
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  if (result.error) process.stderr.write(`${result.error.message}\n`);
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
