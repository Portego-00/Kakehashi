import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const feature = path.join(root, 'src/features/conversation');
const assets = path.join(feature, 'assets/voice-previews');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const voicesSource = readFileSync(path.join(feature, 'voices.ts'), 'utf8');
const voices = [...voicesSource.split('] as const;')[0].matchAll(/'([a-z]+)'/g)].map(match => match[1]);
const catalog = readFileSync(path.join(feature, 'voice-preview-samples.ts'), 'utf8');
const entries = [...catalog.matchAll(/(\w+): require\('\.\/assets\/voice-previews\/([^']+)'\)/g)];
assert.deepEqual(entries.map(entry => entry[1]).sort(), [...voices].sort(), 'Every selectable voice needs a static asset');
const provenance = JSON.parse(readFileSync(path.join(assets, 'provenance.json'), 'utf8')).samples;
assert.deepEqual(provenance.map(sample => sample.voice).sort(), [...voices].sort(), 'Every sample needs provenance');
const hashes = new Set();
let bytes = 0;
for (const [, voice, filename] of entries) {
  assert.equal(path.parse(filename).name, voice, 'Voice must map to its own recording');
  const sample = provenance.find(item => item.voice === voice);
  assert.equal(sample.file, filename);
  const audio = readFileSync(path.join(assets, filename));
  const hash = sha256(audio);
  assert.equal(hash, sample.sha256, `${voice}: audio changed without provenance`);
  assert.equal(audio.length, sample.bytes, `${voice}: audio file is incomplete`);
  assert.ok(sample.durationSeconds > 0 && sample.language && sample.sourceUrl, `${voice}: incomplete source record`);
  assert.ok(!hashes.has(hash), `${voice}: duplicated another voice's recording`);
  hashes.add(hash);
  bytes += audio.length;
}

const directory = process.argv[2];
const platforms = [];
if (directory) {
  const metadata = JSON.parse(readFileSync(path.join(directory, 'metadata.json'), 'utf8'));
  for (const [platform, info] of Object.entries(metadata.fileMetadata)) {
    if (!['ios', 'android'].includes(platform)) continue;
    const included = new Set(info.assets.filter(asset => ['wav', 'm4a', 'mp3', 'aac'].includes(asset.ext))
      .map(asset => sha256(readFileSync(path.join(directory, asset.path)))));
    for (const hash of hashes) assert.ok(included.has(hash), `${platform}: voice audio omitted from update assets`);
    platforms.push(platform);
  }
  assert.ok(platforms.length, 'No native update assets found');
}
console.log(JSON.stringify({ voices: voices.length, verifiedFiles: hashes.size, bytes, exportedPlatforms: platforms }));
