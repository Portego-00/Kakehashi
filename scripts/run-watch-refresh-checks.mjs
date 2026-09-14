import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const temporary = await mkdtemp(join(tmpdir(), 'kakehashi-watch-refresh-checks-'));
try {
  const binary = join(temporary, 'checks');
  const compilation = spawnSync('xcrun', ['swiftc', '-swift-version', '5',
    join(root, 'targets/kakehashi-watch/WatchRefreshGestureState.swift'),
    join(root, 'scripts/watch-tests/WatchRefreshGestureChecks.swift'),
    '-o', binary], { encoding: 'utf8' });
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
