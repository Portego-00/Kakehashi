import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const temporary = await mkdtemp(join(tmpdir(), 'kakehashi-watch-review-checks-'));
try {
  const source = (await readFile(join(root, 'targets/kakehashi-watch/WatchReviewStore.swift'), 'utf8'))
    .replace(/^import (Combine|WatchConnectivity)\n/gm, '');
  await writeFile(join(temporary, 'WatchReviewStore.swift'), source);
  const binary = join(temporary, 'checks');
  const inputs = [
    join(temporary, 'WatchReviewStore.swift'),
    join(root, 'scripts/watch-tests/WatchConnectivityStub.swift'),
    join(root, 'scripts/watch-tests/WatchReviewStoreChecks.swift'),
  ];
  for (const optional of ['WatchReviewOutbox.swift', 'WatchForecastDetail.swift']) {
    const path = join(root, 'targets/kakehashi-watch', optional);
    try { await readFile(path); inputs.push(path); } catch {}
  }
  const compilation = spawnSync('xcrun', ['swiftc', '-swift-version', '5', ...inputs, '-o', binary], { encoding: 'utf8' });
  process.stdout.write(compilation.stdout);
  process.stderr.write(compilation.stderr);
  if (compilation.status !== 0) process.exitCode = compilation.status ?? 1;
  else {
    const checks = spawnSync(binary, [], { encoding: 'utf8' });
    process.stdout.write(checks.stdout);
    process.stderr.write(checks.stderr);
    process.exitCode = checks.status ?? 1;
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
