import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  BUCKET, BUCKET_CONFIG, CACHE_SECONDS, MAX_FILE_BYTES, buildPlan, credentialsFromEnv,
  emptyPublication, objectPath, parseArgs, publishPlan, releaseIssues, sha256, storageClient, validatePublication,
} from './publish-custom-vocabulary-audio.mjs';

const ref = 'abcdefghijklmnopqrst';
const origin = `https://${ref}.supabase.co`;
const jwt = (payload) => `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
const key = jwt({ ref, role: 'service_role', exp: 4102444800 });
const credentials = { origin, key };
const entry = { id: 'test-word', packId: 'test-pack', reading: 'ことば', filename: 'test-pack/test-word.mp3' };
const data = Buffer.from('test audio fixture');
const hash = sha256(data);
const approved = () => ({ schemaVersion: 1, releaseId: 'explicit-human-release', publicDistribution: true, approvedBy: 'Owner', approvedAt: '2026-09-08T12:00:00Z', entries: { [entry.id]: { sha256: hash, license: { approved: true, commercialUse: true, evidence: 'Paid-plan generation receipt covering these exact bytes.' }, pronunciation: { approved: true, reviewedBy: 'Listener', reviewedAt: '2026-09-08T11:00:00Z', evidence: 'Listened to the exact approved take; reading matches.' } } } });
const file = () => ({ id: entry.id, data, issues: [], published: { packId: entry.packId, reading: entry.reading, sha256: hash, bytes: data.length, objectPath: objectPath(entry, hash) } });
const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const audioResponse = (bytes = data, options = {}) => new Response(bytes, { status: 200, headers: { 'content-type': 'audio/mpeg', 'cache-control': `public, max-age=${CACHE_SECONDS}`, ...options } });

function remote({ bucket = BUCKET_CONFIG, existing, uploadFails = false, verifyWrong = false } = {}) {
  const calls = [];
  const objects = new Map(existing === undefined ? [] : [[file().published.objectPath, existing]]);
  let storedBucket = bucket;
  const fetch = async (url, init) => {
    calls.push({ url, ...init });
    const path = new URL(url).pathname;
    if (path === `/storage/v1/bucket/${BUCKET}`) return storedBucket ? jsonResponse(storedBucket) : jsonResponse({ error: 'not_found' }, 404);
    if (path === '/storage/v1/bucket' && init.method === 'POST') { storedBucket = JSON.parse(init.body); return jsonResponse({ name: BUCKET }); }
    if (path.startsWith(`/storage/v1/object/public/${BUCKET}/`)) {
      const object = path.slice(`/storage/v1/object/public/${BUCKET}/`.length);
      const bytes = objects.get(object);
      return bytes ? audioResponse(verifyWrong ? Buffer.from('wrong') : bytes) : jsonResponse({ error: 'not_found' }, 404);
    }
    if (path.startsWith(`/storage/v1/object/${BUCKET}/`) && init.method === 'POST') {
      if (uploadFails) return jsonResponse({}, 500);
      const object = path.slice(`/storage/v1/object/${BUCKET}/`.length);
      if (objects.has(object)) return jsonResponse({ error: 'Duplicate' }, 409);
      objects.set(object, Buffer.from(init.body));
      return jsonResponse({ Key: `${BUCKET}/${object}` });
    }
    throw new Error('Unexpected mock request');
  };
  return { calls, objects, fetch, client: storageClient(credentials, fetch) };
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'kakehashi-audio-publish-test-'));
  const { mkdir } = await import('node:fs/promises');
  await mkdir(join(root, 'audio', entry.packId), { recursive: true });
  const options = { manifest: join(root, 'manifest.json'), audit: join(root, 'audit.json'), audioDir: join(root, 'audio'), publication: join(root, 'publication.json'), approval: join(root, 'approval.json') };
  const manifest = JSON.stringify({ schemaVersion: 1, entries: [entry] });
  const audit = { schemaVersion: 1, status: 'complete', strict: true, fullDecode: true, manifestSha256: sha256(manifest), expectedCount: 1, validCount: 1, invalidCount: 0, missingCount: 0, strictIssues: [], files: [{ ...entry, sha256: hash, bytes: data.length, present: true, valid: true, decoded: true, errors: [] }] };
  await writeFile(options.manifest, manifest);
  await writeFile(options.audit, JSON.stringify(audit));
  await writeFile(join(options.audioDir, entry.filename), data);
  await writeFile(options.publication, JSON.stringify(emptyPublication()));
  await writeFile(options.approval, JSON.stringify(approved()));
  return { root, options, audit };
}

test('dry-run is the default; remote upload needs explicit selection and approval', () => {
  assert.equal(parseArgs([]).mode, 'dry-run');
  assert.throws(() => parseArgs(['--upload']), /selection/);
  assert.throws(() => parseArgs(['--upload', '--all']), /approval/);
  assert.throws(() => parseArgs(['--all', '--ids', entry.id]), /not both/);
  assert.throws(() => parseArgs(['--ensure-bucket', '--all']), /only creates/);
  assert.throws(() => parseArgs(['--upload', '--dry-run']), /exactly one/);
});

test('unapproved free-plan recordings are blocked; each exact hash needs license and listening approval', () => {
  assert.equal(releaseIssues(approved(), entry, hash).length, 0);
  assert.equal(releaseIssues(null, entry, hash).length, 4);
  const altered = approved();
  altered.entries[entry.id].license.commercialUse = false;
  assert.match(releaseIssues(altered, entry, hash).join(' '), /license/);
  const unchecked = approved();
  unchecked.entries[entry.id].pronunciation.approved = false;
  assert.match(releaseIssues(unchecked, entry, hash).join(' '), /Pronunciation/);
  assert.match(releaseIssues(approved(), entry, 'f'.repeat(64)).join(' '), /exact audio hash/);
  const unspecified = approved();
  unspecified.publicDistribution = false;
  assert.match(releaseIssues(unspecified, entry, hash).join(' '), /public release/);
});

test('credential origin is pinned to explicit hosted project; credentials are never accepted on alternate hosts', () => {
  assert.deepEqual(credentialsFromEnv({ SUPABASE_URL: origin, SUPABASE_SERVICE_ROLE_KEY: key }, ref), credentials);
  for (const url of ['http://abcdefghijklmnopqrst.supabase.co', `${origin}.evil.test`, `${origin}/path`, `${origin}?x=1`, `https://user:pass@${ref}.supabase.co`, 'https://example.com', `https://${ref}.supabase.co:8443`]) {
    assert.throws(() => credentialsFromEnv({ SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key }, ref), /host guard/);
  }
  assert.throws(() => credentialsFromEnv({ SUPABASE_URL: origin, SUPABASE_SERVICE_ROLE_KEY: key }), /project-ref/);
  assert.throws(() => credentialsFromEnv({ SUPABASE_URL: origin, SUPABASE_SERVICE_ROLE_KEY: jwt({ ref: 'xxxxxxxxxxxxxxxxxxxx', role: 'service_role' }) }, ref), /project does not match/);
  assert.throws(() => credentialsFromEnv({ SUPABASE_URL: origin, SUPABASE_SERVICE_ROLE_KEY: jwt({ role: 'anon' }) }, ref), /service-role/);
  assert.throws(() => credentialsFromEnv({ SUPABASE_URL: origin, SUPABASE_SERVICE_ROLE_KEY: jwt({ role: 'service_role', exp: 1 }) }, ref), /expired/);
});

test('every public verification omits credentials and every request rejects redirects', async () => {
  const mock = remote();
  await mock.client.publishObject(file());
  const reads = mock.calls.filter((call) => call.url.includes('/object/public/'));
  assert.equal(reads.length, 2);
  for (const call of reads) {
    assert.equal(call.headers.has('authorization'), false);
    assert.equal(call.headers.has('apikey'), false);
    assert.equal(call.headers.has('cookie'), false);
    assert.equal(call.credentials, 'omit');
  }
  for (const call of mock.calls) assert.equal(call.redirect, 'error');
  const upload = mock.calls.find((call) => call.method === 'POST');
  assert.equal(upload.headers.get('x-upsert'), 'false');
  assert.equal(upload.headers.get('content-type'), 'audio/mpeg');
  assert.equal(upload.headers.get('cache-control'), `max-age=${CACHE_SECONDS}`);
  assert.equal(upload.headers.get('authorization'), `Bearer ${key}`);
  assert.equal(upload.headers.get('apikey'), key);
});

test('redirects and network errors fail safely without echoing credentials', async () => {
  let calls = 0;
  const client = storageClient(credentials, async (_url, init) => { calls++; assert.equal(init.redirect, 'error'); return new Response(null, { status: 307, headers: { location: 'https://evil.test' } }); });
  await assert.rejects(client.getBucket(), /redirect rejected/);
  assert.equal(calls, 1);
  const failure = storageClient(credentials, async () => { throw new Error(`transport contained ${key}`); });
  await assert.rejects(failure.getBucket(), (error) => !error.message.includes(key) && /No automatic write retry/.test(error.message));
});

test('modern secret keys use server apikey header, never as a public request credential', async () => {
  const calls = [];
  const client = storageClient({ origin, key: 'sb_secret_operator_key' }, async (_url, init) => { calls.push(init); return jsonResponse(BUCKET_CONFIG); });
  await client.getBucket();
  assert.equal(calls[0].headers.get('apikey'), 'sb_secret_operator_key');
  assert.equal(calls[0].headers.has('authorization'), false);
});

test('ensure-bucket creates only the dedicated bucket, verifies it, and is idempotent', async () => {
  const mock = remote({ bucket: null });
  assert.deepEqual(await mock.client.ensureBucket(), { created: true, bucket: BUCKET });
  assert.deepEqual(await mock.client.ensureBucket(), { created: false, bucket: BUCKET });
  const writes = mock.calls.filter((call) => call.method === 'POST');
  assert.equal(writes.length, 1);
  assert.deepEqual(JSON.parse(writes[0].body), BUCKET_CONFIG);
  assert.equal(mock.calls.some((call) => ['PUT', 'DELETE', 'PATCH'].includes(call.method)), false);
});

test('existing incompatible buckets are not modified', async () => {
  for (const change of [{ public: false }, { allowed_mime_types: null }, { file_size_limit: MAX_FILE_BYTES * 2 }]) {
    const mock = remote({ bucket: { ...BUCKET_CONFIG, ...change } });
    await assert.rejects(mock.client.ensureBucket(), /configuration differs/);
    assert.equal(mock.calls.length, 1);
    assert.equal(mock.calls[0].method, undefined);
  }
});

test('already uploaded objects are hash-verified and skipped without another write', async () => {
  const mock = remote({ existing: data });
  assert.equal(await mock.client.publishObject(file()), 'existing-verified');
  assert.equal(mock.calls.length, 1);
  assert.equal(mock.calls[0].method, undefined);
});

test('a hash collision is a hard failure and never overwrites an existing object', async () => {
  const mock = remote({ existing: Buffer.from('bad') });
  await assert.rejects(mock.client.publishObject(file()), /hash\/size collision/);
  assert.equal(mock.calls.length, 1);
  assert.equal(mock.calls[0].method, undefined);
});

test('remote type and cache settings must match before an existing object is reused', async () => {
  for (const headers of [{ 'content-type': 'text/plain' }, { 'cache-control': 'max-age=60' }]) {
    const client = storageClient(credentials, async () => audioResponse(data, headers));
    await assert.rejects(client.publishObject(file()), /type|cache/);
  }
});

test('a duplicate upload race is reconciled by exact public readback, never upsert', async () => {
  let calls = 0;
  const client = storageClient(credentials, async (_url, init) => {
    calls++;
    if (calls === 1) return jsonResponse({}, 404);
    if (calls === 2) { assert.equal(init.headers.get('x-upsert'), 'false'); return jsonResponse({}, 409); }
    return audioResponse();
  });
  assert.equal(await client.publishObject(file()), 'existing-verified');
  assert.equal(calls, 3);
});

test('Supabase legacy 400 Object not found envelopes permit create, not arbitrary 400 errors', async () => {
  let calls = 0;
  const client = storageClient(credentials, async () => {
    calls++;
    return calls === 1 ? jsonResponse({ statusCode: '404', error: 'not_found' }, 400) : calls === 2 ? jsonResponse({}) : audioResponse();
  });
  assert.equal(await client.publishObject(file()), 'uploaded-verified');
  const forbidden = storageClient(credentials, async () => jsonResponse({ statusCode: '403', error: 'permission_denied' }, 400));
  await assert.rejects(forbidden.publishObject(file()), /verification failed/);
});

test('large remote responses and mismatched local bytes are rejected', async () => {
  const oversized = storageClient(credentials, async () => audioResponse(data, { 'content-length': String(MAX_FILE_BYTES * 2) }));
  await assert.rejects(oversized.publishObject(file()), /larger than expected/);
  const mock = remote();
  await assert.rejects(mock.client.publishObject({ ...file(), data: Buffer.from('changed') }), /changed before upload/);
  assert.equal(mock.calls.length, 0);
});

test('strict local preflight selects only canonical MP3s and rejects stale audio/audit', async () => {
  const { options } = await fixture();
  await writeFile(join(options.audioDir, entry.filename + '.json'), 'sidecar not uploaded');
  const plan = await buildPlan(options);
  assert.equal(plan.files.length, 1);
  assert.equal(plan.files[0].issues.length, 0);
  assert.equal(plan.bytes, data.length);
  assert.deepEqual(plan.files[0].data, data);
  await writeFile(join(options.audioDir, entry.filename), Buffer.from('changed'));
  await assert.rejects(buildPlan(options), /stale/);
});

test('local preflight fails closed on incomplete decode and manifest tampering', async () => {
  const { options, audit } = await fixture();
  await writeFile(options.audit, JSON.stringify({ ...audit, fullDecode: false }));
  await assert.rejects(buildPlan(options), /strict decode audit/);
  await writeFile(options.audit, JSON.stringify(audit));
  await writeFile(options.manifest, JSON.stringify({ schemaVersion: 1, entries: [{ ...entry, reading: 'altered' }] }));
  await assert.rejects(buildPlan(options), /exact source manifest/);
});

test('unapproved publication makes no network requests and leaves index unchanged', async () => {
  const { options } = await fixture();
  const plan = await buildPlan({ ...options, approval: undefined });
  const original = await readFile(options.publication);
  const mock = remote();
  await assert.rejects(publishPlan(plan, mock.client), /No remote changes/);
  assert.equal(mock.calls.length, 0);
  assert.deepEqual(await readFile(options.publication), original);
});

test('publication is written only after successful readbacks, preserves unselected words, and resumes idempotently', async () => {
  const { options } = await fixture();
  const old = { ...emptyPublication(), entries: { 'other-word': { ...file().published, objectPath: objectPath({ id: 'other-word', packId: entry.packId }, hash) } } };
  await writeFile(options.publication, JSON.stringify(old));
  const plan = await buildPlan(options);
  const mock = remote();
  const result = await publishPlan(plan, mock.client);
  assert.equal(result.uploaded, 1);
  const publication = JSON.parse(await readFile(options.publication, 'utf8'));
  assert.deepEqual(publication.entries['other-word'], old.entries['other-word']);
  assert.deepEqual(publication.entries[entry.id], file().published);
  assert.deepEqual(Object.keys(publication).sort(), ['bucket', 'entries', 'schemaVersion', 'voice']);
  const second = await publishPlan(await buildPlan(options), mock.client);
  assert.equal(second.existingVerified, 1);
  assert.equal(second.uploaded, 0);
  assert.equal(mock.calls.filter((call) => call.method === 'POST').length, 1);
});

test('upload failures do not publish broken URLs or remove any remote object', async () => {
  const { options, root } = await fixture();
  const original = await readFile(options.publication);
  const mock = remote({ uploadFails: true });
  await assert.rejects(publishPlan(await buildPlan(options), mock.client), /upload failed/);
  assert.deepEqual(await readFile(options.publication), original);
  assert.equal(mock.calls.some((call) => call.method === 'DELETE'), false);
  assert.equal((await readdir(root)).some((name) => /\.tmp$|\.lock$/.test(name)), false);
});

test('successful upload with failed public readback does not publish its URL', async () => {
  const { options } = await fixture();
  const mock = remote({ verifyWrong: true });
  await assert.rejects(publishPlan(await buildPlan(options), mock.client), /hash\/size collision/);
  assert.deepEqual(JSON.parse(await readFile(options.publication, 'utf8')), emptyPublication());
  assert.equal(mock.objects.size, 1);
});

test('concurrent manifest edits survive and can be reconciled on a later run', async () => {
  const { options } = await fixture();
  const plan = await buildPlan(options);
  const changed = `${JSON.stringify(emptyPublication())}\n`;
  const client = { getBucket: async () => BUCKET_CONFIG, publishObject: async () => { await writeFile(options.publication, changed); return 'uploaded-verified'; } };
  await assert.rejects(publishPlan(plan, client), /edited during upload/);
  assert.equal(await readFile(options.publication, 'utf8'), changed);
});

test('only content-addressed safe paths can enter the public index', () => {
  assert.equal(objectPath(entry, hash), `v1/test-pack/test-word/${hash}.mp3`);
  assert.throws(() => objectPath({ ...entry, id: '../escape' }, hash), /identity/);
  assert.throws(() => validatePublication({ ...emptyPublication(), entries: { [entry.id]: { ...file().published, objectPath: 'https://evil.test/file.mp3' } } }), /immutable path/);
});
