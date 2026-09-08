import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, realpath, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { credentialsFromEnv, emptyPublication, objectPath, releaseIssues, sha256 } from './publish-custom-vocabulary-audio.mjs';
import { PRIVATE_BUCKET, PRIVATE_BUCKET_CONFIG, buildPrivatePlan, emptyReceipt, parseArgs, privateStorageClient, run, stagePlan, validatePrivateBucket, validateReceipt } from './stage-custom-vocabulary-audio.mjs';

const ref = 'abcdefghijklmnopqrst';
const origin = `https://${ref}.supabase.co`;
const jwt = (payload) => `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
const key = jwt({ ref, role: 'service_role', exp: 4102444800 });
const credentials = { origin, key };
const entry = { id: 'test-word', packId: 'test-pack', reading: 'ことば', filename: 'test-pack/test-word.mp3' };
const data = Buffer.from('private test audio fixture');
const file = (id = entry.id, bytes = data) => ({ id, data: bytes, staged: { packId: entry.packId, reading: entry.reading, sha256: sha256(bytes), bytes: bytes.length, objectPath: objectPath({ id, packId: entry.packId }, sha256(bytes)) }, pendingReleaseIssues: releaseIssues(null, { id }, sha256(bytes)) });
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const audio = (bytes = data, headers = {}) => new Response(bytes, { headers: { 'content-type': 'audio/mpeg', ...headers } });

function remote({ bucket = PRIVATE_BUCKET_CONFIG, existing = [], failId, corrupt = false } = {}) {
  const calls = [];
  const objects = new Map(existing);
  let storedBucket = bucket;
  const fetch = async (url, init) => {
    calls.push({ url, ...init });
    const path = new URL(url).pathname;
    if (path === `/storage/v1/bucket/${PRIVATE_BUCKET}`) return storedBucket ? json(storedBucket) : json({}, 404);
    if (path === '/storage/v1/bucket' && init.method === 'POST') { storedBucket = JSON.parse(init.body); return json({ name: PRIVATE_BUCKET }); }
    if (path.startsWith(`/storage/v1/object/authenticated/${PRIVATE_BUCKET}/`)) {
      const bytes = objects.get(path.slice(`/storage/v1/object/authenticated/${PRIVATE_BUCKET}/`.length));
      return bytes ? audio(corrupt ? Buffer.from('corrupt') : bytes) : json({}, 404);
    }
    if (path.startsWith(`/storage/v1/object/${PRIVATE_BUCKET}/`) && init.method === 'POST') {
      const name = path.slice(`/storage/v1/object/${PRIVATE_BUCKET}/`.length);
      if (failId && name.includes(`/${failId}/`)) return json({}, 500);
      if (objects.has(name)) return json({}, 409);
      objects.set(name, Buffer.from(init.body));
      return json({ Key: name });
    }
    throw new Error('Unexpected mock endpoint; no external call was made.');
  };
  return { calls, objects, fetch, client: privateStorageClient(credentials, fetch) };
}

async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'kakehashi-private-audio-test-')));
  await mkdir(join(root, 'audio', entry.packId), { recursive: true });
  const options = { manifest: join(root, 'manifest.json'), audit: join(root, 'audit.json'), audioDir: join(root, 'audio'), publication: join(root, 'app-publication.json'), receiptPath: join(root, 'private-staging', 'receipt.json') };
  const source = JSON.stringify({ schemaVersion: 1, entries: [entry] });
  const audit = { schemaVersion: 1, status: 'complete', strict: true, fullDecode: true, manifestSha256: sha256(source), expectedCount: 1, validCount: 1, invalidCount: 0, missingCount: 0, strictIssues: [], files: [{ ...entry, present: true, valid: true, decoded: true, sha256: sha256(data), bytes: data.length, errors: [] }] };
  await writeFile(options.manifest, source);
  await writeFile(options.audit, JSON.stringify(audit));
  await writeFile(join(options.audioDir, entry.filename), data);
  await writeFile(options.publication, JSON.stringify(emptyPublication()));
  return { root, options, audit };
}

test('private dry-run is default and explicit operations never accept public-release/index options', () => {
  assert.equal(parseArgs([]).mode, 'dry-run');
  assert.throws(() => parseArgs(['--upload']), /explicit --all or --ids/);
  assert.equal(parseArgs(['--upload', '--all']).mode, 'upload');
  assert.throws(() => parseArgs(['--all', '--ids', entry.id]), /not both/);
  assert.throws(() => parseArgs(['--ids', `${entry.id},${entry.id}`]), /unique exact/);
  assert.throws(() => parseArgs(['--upload', '--dry-run']), /one private/);
  assert.throws(() => parseArgs(['--ensure-bucket', '--all']), /only creates/);
  for (const arg of ['--public', '--signed-url', '--publication', '--approval', '--receipt', '--bucket']) assert.throws(() => parseArgs([arg, 'arbitrary']), /Unknown private/);
});

test('default dry-run makes no network or credential reads and writes no files', async () => {
  const { root, options } = await fixture();
  const before = await readdir(root);
  const publication = await readFile(options.publication);
  let requests = 0;
  const env = new Proxy({}, { get() { throw new Error('Dry-run must not inspect credentials.'); } });
  const result = await run(['--manifest', options.manifest, '--audit', options.audit, '--audio-dir', options.audioDir], { env, fetchImpl: async () => { requests++; throw new Error('No network allowed.'); } });
  assert.equal(requests, 0);
  assert.equal(result.networkRequests, 0);
  assert.equal(result.localFilesWritten, 0);
  assert.equal(result.public, false);
  assert.equal(result.words, 1);
  assert.equal(result.pendingPublicRelease, true);
  assert.equal(result.reasons.length, 4);
  assert.deepEqual(await readdir(root), before);
  assert.deepEqual(await readFile(options.publication), publication);
});

test('local private plan reuses exact strict-audit validation without certifying public release', async () => {
  const { options, audit } = await fixture();
  const plan = await buildPrivatePlan(options);
  assert.equal(plan.files[0].pendingReleaseIssues.length, 4);
  assert.equal(plan.publicationPath, undefined);
  assert.equal(plan.publication, undefined);
  assert.equal(plan.files[0].staged.objectPath, file().staged.objectPath);
  await assert.rejects(buildPrivatePlan({ ...options, approval: 'must-not-be-read.json' }), /does not accept release attestations/);
  await assert.rejects(buildPrivatePlan({ ...options, receiptPath: options.publication }), /separate private-staging/);
  await writeFile(options.audit, JSON.stringify({ ...audit, fullDecode: false }));
  await assert.rejects(buildPrivatePlan(options), /strict decode audit/);
  await writeFile(options.audit, JSON.stringify(audit));
  await writeFile(join(options.audioDir, entry.filename), Buffer.from('changed'));
  await assert.rejects(buildPrivatePlan(options), /stale/);
});

test('the exact bucket is always private, MP3 only, 1 MiB and create-only', async () => {
  const mock = remote({ bucket: null });
  assert.deepEqual(await mock.client.ensureBucket(), { created: true, bucket: PRIVATE_BUCKET, public: false });
  assert.deepEqual(await mock.client.ensureBucket(), { created: false, bucket: PRIVATE_BUCKET, public: false });
  const writes = mock.calls.filter((call) => call.method === 'POST');
  assert.equal(writes.length, 1);
  assert.deepEqual(JSON.parse(writes[0].body), PRIVATE_BUCKET_CONFIG);
  assert.equal(JSON.parse(writes[0].body).public, false);
  assert.equal(mock.calls.some((call) => ['PUT', 'PATCH', 'DELETE'].includes(call.method)), false);
});

test('public, differently named or incompatible buckets fail before any write', async () => {
  for (const mismatch of [{ public: true }, { id: 'custom-vocabulary-audio' }, { name: 'elsewhere' }, { allowed_mime_types: ['audio/mpeg', 'text/plain'] }, { file_size_limit: 2 * 1048576 }]) {
    const mock = remote({ bucket: { ...PRIVATE_BUCKET_CONFIG, ...mismatch } });
    await assert.rejects(mock.client.ensureBucket(), /Private bucket configuration differs/);
    assert.equal(mock.calls.length, 1);
    assert.equal(mock.calls[0].method, undefined);
  }
  assert.throws(() => validatePrivateBucket({ ...PRIVATE_BUCKET_CONFIG, public: true }), /configuration differs/);
});

test('every upload and readback is authenticated at the pinned private endpoint, never public or signed', async () => {
  const mock = remote();
  await mock.client.getBucket();
  assert.equal(await mock.client.stageObject(file()), 'uploaded-verified');
  for (const call of mock.calls) {
    assert.equal(new URL(call.url).origin, origin);
    assert.equal(call.headers.get('apikey'), key);
    assert.equal(call.headers.get('authorization'), `Bearer ${key}`);
    assert.equal(call.headers.has('cookie'), false);
    assert.equal(call.redirect, 'error');
    assert.equal(call.credentials, 'omit');
    assert.equal(/\/object\/(?:public|sign)\//.test(call.url), false);
  }
  assert.equal(mock.calls.filter((call) => call.url.includes('/object/authenticated/')).length, 2);
  const upload = mock.calls.find((call) => call.method === 'POST');
  assert.equal(upload.headers.get('content-type'), 'audio/mpeg');
  assert.equal(upload.headers.get('x-upsert'), 'false');
  assert.equal(upload.headers.get('cache-control'), 'max-age=0');
});

test('secret keys use only server apikey; invalid origins and public credentials are rejected', async () => {
  const calls = [];
  const client = privateStorageClient({ origin, key: 'sb_secret_mock_operator' }, async (_url, init) => { calls.push(init); return json(PRIVATE_BUCKET_CONFIG); });
  await client.getBucket();
  assert.equal(calls[0].headers.get('apikey'), 'sb_secret_mock_operator');
  assert.equal(calls[0].headers.has('authorization'), false);
  for (const bad of [`${origin}.evil.test`, `${origin}/other`, `http://${ref}.supabase.co`, 'https://example.com']) assert.throws(() => privateStorageClient({ origin: bad, key }), /host guard|project-ref/);
  assert.throws(() => credentialsFromEnv({ SUPABASE_URL: origin, SUPABASE_SERVICE_ROLE_KEY: jwt({ role: 'anon' }) }, ref), /service-role/);
});

test('redirects and network failures do not retry or echo credential-bearing errors', async () => {
  let calls = 0;
  const redirected = privateStorageClient(credentials, async () => { calls++; return new Response(null, { status: 307, headers: { location: 'https://elsewhere.example' } }); });
  await assert.rejects(redirected.getBucket(), /redirect rejected/);
  assert.equal(calls, 1);
  calls = 0;
  const failed = privateStorageClient(credentials, async () => { calls++; throw new Error(`HTTP details included ${key}`); });
  await assert.rejects(failed.getBucket(), (error) => !error.message.includes(key) && /No automatic retry/.test(error.message));
  assert.equal(calls, 1);
});

test('preexisting private objects are hash-verified without upload; collisions never overwrite', async () => {
  const mock = remote({ existing: [[file().staged.objectPath, data]] });
  await mock.client.getBucket();
  assert.equal(await mock.client.stageObject(file()), 'existing-verified');
  assert.equal(mock.calls.some((call) => call.method), false);
  const collision = remote({ existing: [[file().staged.objectPath, Buffer.from('wrong')]] });
  await collision.client.getBucket();
  await assert.rejects(collision.client.stageObject(file()), /hash\/size collision/);
  assert.equal(collision.calls.some((call) => call.method), false);
});

test('staging cannot bypass private bucket inspection or substitute unverified bytes/attestations', async () => {
  const mock = remote();
  await assert.rejects(mock.client.stageObject(file()), /Inspect the exact private bucket/);
  assert.equal(mock.calls.length, 0);
  await mock.client.getBucket();
  const requests = mock.calls.length;
  await assert.rejects(mock.client.stageObject({ ...file(), data: Buffer.from('changed') }), /changed before upload/);
  await assert.rejects(mock.client.stageObject({ ...file(), pendingReleaseIssues: [] }), /retain unresolved/);
  await assert.rejects(mock.client.stageObject({ ...file(), staged: { ...file().staged, publicUrl: 'https://example.com' } }), /never URLs/);
  assert.equal(mock.calls.length, requests);
});

test('duplicate races are reconciled through authenticated hash readback without an upsert', async () => {
  let calls = 0;
  const client = privateStorageClient(credentials, async (url, init) => {
    if (url.endsWith(`/bucket/${PRIVATE_BUCKET}`)) return json(PRIVATE_BUCKET_CONFIG);
    calls++;
    if (calls === 1) return json({ statusCode: '404', error: 'not_found' }, 400);
    if (calls === 2) { assert.equal(init.method, 'POST'); assert.equal(init.headers.get('x-upsert'), 'false'); return json({}, 409); }
    assert.match(url, /\/object\/authenticated\//);
    return audio();
  });
  await client.getBucket();
  assert.equal(await client.stageObject(file()), 'existing-verified');
  assert.equal(calls, 3);
});

test('wrong MIME, oversized readbacks and arbitrary error envelopes stop before write', async () => {
  for (const response of [() => audio(data, { 'content-type': 'text/plain' }), () => audio(data, { 'content-length': '9999999' }), () => json({ statusCode: '403', error: 'permission_denied' }, 400)]) {
    let writes = 0;
    const client = privateStorageClient(credentials, async (url, init) => { if (init.method) writes++; return url.includes('/bucket/') ? json(PRIVATE_BUCKET_CONFIG) : response(); });
    await client.getBucket();
    await assert.rejects(client.stageObject(file()), /type|larger than expected|verification failed/);
    assert.equal(writes, 0);
  }
});

test('private receipts never contain URLs, license/quality approvals, or public visibility', () => {
  const receipt = emptyReceipt(ref);
  assert.throws(() => validateReceipt({ ...receipt, visibility: 'public' }, ref), /Invalid private/);
  assert.throws(() => validateReceipt({ ...receipt, publicDistributionApproved: true }, ref), /Invalid private/);
  assert.throws(() => validateReceipt({ ...receipt, signedUrl: 'https://example.com' }, ref), /unexpected metadata/);
  const record = { id: entry.id, ...file().staged, verifiedAt: new Date().toISOString(), pendingReleaseIssues: file().pendingReleaseIssues };
  assert.equal(validateReceipt({ ...receipt, entries: { [record.objectPath]: record } }, ref).entries[record.objectPath].pendingReleaseIssues.length, 4);
  assert.throws(() => validateReceipt({ ...receipt, entries: { [record.objectPath]: { ...record, publicUrl: 'https://example.com' } } }, ref), /unexpected entry/);
  assert.throws(() => validateReceipt({ ...receipt, entries: { [record.objectPath]: { ...record, pendingReleaseIssues: [] } } }, ref), /preserve unresolved/);
  assert.throws(() => validateReceipt(receipt, 'xxxxxxxxxxxxxxxxxxxx'), /different project/);
});

test('verified staging writes only a private receipt and idempotently preserves app index and prior entries', async () => {
  const { options } = await fixture();
  const before = await readFile(options.publication);
  const plan = await buildPrivatePlan(options);
  const mock = remote();
  const first = await stagePlan(plan, mock.client);
  assert.equal(first.uploaded, 1);
  const receipt = validateReceipt(JSON.parse(await readFile(plan.receiptPath, 'utf8')), ref);
  assert.equal(Object.keys(receipt.entries).length, 1);
  assert.equal(receipt.entries[file().staged.objectPath].pendingReleaseIssues.length, 4);
  assert.equal(JSON.stringify(receipt).includes('https://'), false);
  assert.equal(JSON.stringify(receipt).includes(key), false);
  assert.deepEqual(await readFile(options.publication), before);
  const oldReceipt = await readFile(plan.receiptPath);
  const second = await stagePlan(plan, mock.client);
  assert.equal(second.uploaded, 0);
  assert.equal(second.existingVerified, 1);
  assert.deepEqual(await readFile(plan.receiptPath), oldReceipt);
  const next = file('other-word');
  await stagePlan({ ...plan, files: [next], bytes: next.data.length }, mock.client);
  assert.equal(Object.keys(JSON.parse(await readFile(plan.receiptPath, 'utf8')).entries).length, 2);
  assert.deepEqual(await readFile(options.publication), before);
  assert.deepEqual((await readdir(join(options.receiptPath, '..'))).sort(), ['receipt.json']);
});

test('partial failures keep verified receipt entries; reruns reuse remote bytes and never mutate app index', async () => {
  const { options } = await fixture();
  const before = await readFile(options.publication);
  const plan = await buildPrivatePlan(options);
  const second = file('second-word');
  const two = { ...plan, files: [plan.files[0], second], bytes: data.length * 2 };
  const failed = remote({ failId: second.id });
  await assert.rejects(stagePlan(two, failed.client), /upload failed/);
  assert.equal(Object.keys(JSON.parse(await readFile(plan.receiptPath, 'utf8')).entries).length, 1);
  assert.deepEqual(await readFile(options.publication), before);
  const resumed = remote({ existing: [...failed.objects] });
  const result = await stagePlan(two, resumed.client);
  assert.equal(result.existingVerified, 1);
  assert.equal(result.uploaded, 1);
  assert.equal(Object.keys(JSON.parse(await readFile(plan.receiptPath, 'utf8')).entries).length, 2);
  assert.equal([...failed.calls, ...resumed.calls].some((call) => ['DELETE', 'PUT', 'PATCH'].includes(call.method)), false);
});

test('new hashes keep prior staged versions while conflicting metadata for an existing hash is rejected', async () => {
  const { options } = await fixture();
  const plan = await buildPrivatePlan(options);
  const mock = remote();
  await stagePlan(plan, mock.client);
  const changed = file(entry.id, Buffer.from('a newly corrected private take'));
  await stagePlan({ ...plan, files: [changed], bytes: changed.data.length }, mock.client);
  const receipt = JSON.parse(await readFile(plan.receiptPath, 'utf8'));
  assert.equal(Object.keys(receipt.entries).length, 2);
  assert.equal(receipt.entries[file().staged.objectPath].sha256, sha256(data));
  assert.equal(receipt.entries[changed.staged.objectPath].sha256, sha256(changed.data));
  const before = await readFile(plan.receiptPath);
  const wrongReading = { ...file(), staged: { ...file().staged, reading: 'ちがう' } };
  await assert.rejects(stagePlan({ ...plan, files: [wrongReading] }, mock.client), /Immutable private receipt collision/);
  assert.deepEqual(await readFile(plan.receiptPath), before);
  assert.equal(mock.calls.filter((call) => call.method === 'POST').length, 2);
});

test('failed authenticated readback leaves no verified receipt or public index change', async () => {
  const { options } = await fixture();
  const plan = await buildPrivatePlan(options);
  const before = await readFile(options.publication);
  const mock = remote({ corrupt: true });
  await assert.rejects(stagePlan(plan, mock.client), /hash\/size collision/);
  await assert.rejects(readFile(plan.receiptPath), /ENOENT/);
  assert.equal(mock.objects.size, 1);
  assert.deepEqual(await readFile(options.publication), before);
});

test('external receipt edits and existing locks are preserved instead of overwritten', async () => {
  const { options } = await fixture();
  const plan = await buildPrivatePlan(options);
  const external = Buffer.from('external edit must survive');
  const client = { projectRef: ref, getBucket: async () => PRIVATE_BUCKET_CONFIG, stageObject: async () => { await writeFile(plan.receiptPath, external); return 'uploaded-verified'; } };
  await assert.rejects(stagePlan(plan, client), /edited during upload/);
  assert.deepEqual(await readFile(plan.receiptPath), external);
  await writeFile(`${plan.receiptPath}.stage.lock`, 'owned by someone else');
  await assert.rejects(stagePlan(plan, client), /receipt is locked/);
  assert.equal(await readFile(`${plan.receiptPath}.stage.lock`, 'utf8'), 'owned by someone else');
});

test('receipt symlinks and public bucket returns cannot redirect staging into app files', async () => {
  const { options } = await fixture();
  const plan = await buildPrivatePlan(options);
  const before = await readFile(options.publication);
  await mkdir(join(options.receiptPath, '..'), { recursive: true });
  await symlink(options.publication, plan.receiptPath);
  const mock = remote();
  await assert.rejects(stagePlan(plan, mock.client), /ELOOP/);
  assert.deepEqual(await readFile(options.publication), before);
  const publicClient = { projectRef: ref, getBucket: async () => ({ ...PRIVATE_BUCKET_CONFIG, public: true }), stageObject: async () => { throw new Error('Must never stage'); } };
  await assert.rejects(stagePlan(plan, publicClient), /Private bucket configuration differs/);
});
