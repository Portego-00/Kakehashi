#!/usr/bin/env node

// Private operator staging only. Import and default dry-run never use the network
// or write files. This is not a public-release or pronunciation/license approval.
import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPlan, credentialsFromEnv, MAX_FILE_BYTES, objectPath, releaseIssues, sha256 } from './publish-custom-vocabulary-audio.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const PRIVATE_BUCKET = 'custom-vocabulary-audio-private';
export const PRIVATE_BUCKET_CONFIG = Object.freeze({ id: PRIVATE_BUCKET, name: PRIVATE_BUCKET, public: false, allowed_mime_types: ['audio/mpeg'], file_size_limit: MAX_FILE_BYTES });
export const RECEIPT = resolve(ROOT, 'output/custom-vocabulary-audio/private-staging/receipt.json');
const PROJECT = /^[a-z0-9]{20}$/;
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);

export function validatePrivateBucket(bucket) {
  assert(bucket?.id === PRIVATE_BUCKET && bucket.name === PRIVATE_BUCKET && bucket.public === false && bucket.file_size_limit === MAX_FILE_BYTES && Array.isArray(bucket.allowed_mime_types) && bucket.allowed_mime_types.length === 1 && bucket.allowed_mime_types[0] === 'audio/mpeg', 'Private bucket configuration differs. No bucket update, policy change, or public fallback is permitted.');
  return bucket;
}

function validateFile(file) {
  const item = file?.staged;
  assert(item && Number.isInteger(item.bytes) && item.bytes > 0 && item.bytes <= MAX_FILE_BYTES && typeof item.reading === 'string' && item.reading.trim(), 'Invalid private staging file.');
  assert(Object.keys(item).sort().join(',') === 'bytes,objectPath,packId,reading,sha256', 'Private staging accepts object metadata only, never URLs or attestations.');
  assert(item.objectPath === objectPath({ id: file.id, packId: item.packId }, item.sha256), 'Private object identity/path mismatch.');
  assert(Buffer.isBuffer(file.data) && file.data.length === item.bytes && sha256(file.data) === item.sha256, 'Local private audio changed before upload.');
  assert(JSON.stringify(file.pendingReleaseIssues) === JSON.stringify(releaseIssues(null, { id: file.id }, item.sha256)), 'Private staging must retain unresolved public-release issues; it cannot attest license or pronunciation approval.');
}

export function validateReceipt(value, projectRef) {
  assert(PROJECT.test(projectRef ?? '') && value?.schemaVersion === 1 && value.bucket === PRIVATE_BUCKET && value.projectRef === projectRef && value.visibility === 'private' && value.publicDistributionApproved === false && value.entries && typeof value.entries === 'object' && !Array.isArray(value.entries), 'Invalid private receipt or different project.');
  assert(Object.keys(value).sort().join(',') === 'bucket,entries,projectRef,publicDistributionApproved,schemaVersion,visibility', 'Private receipt contains unexpected metadata.');
  for (const [path, entry] of Object.entries(value.entries)) {
    assert(Object.keys(entry).sort().join(',') === 'bytes,id,objectPath,packId,pendingReleaseIssues,reading,sha256,verifiedAt', 'Private receipt contains unexpected entry metadata or a URL.');
    assert(path === entry.objectPath && path === objectPath(entry, entry.sha256) && Number.isInteger(entry.bytes) && entry.bytes > 0 && entry.bytes <= MAX_FILE_BYTES && typeof entry.reading === 'string' && entry.reading.trim() && Number.isFinite(Date.parse(entry.verifiedAt)), 'Invalid private receipt entry.');
    assert(JSON.stringify(entry.pendingReleaseIssues) === JSON.stringify(releaseIssues(null, entry, entry.sha256)), 'Private receipt must preserve unresolved public-release issues.');
  }
  return value;
}

export const emptyReceipt = (projectRef) => validateReceipt({ schemaVersion: 1, bucket: PRIVATE_BUCKET, projectRef, visibility: 'private', publicDistributionApproved: false, entries: {} }, projectRef);

function receiptDestination(path) {
  const absolute = resolve(path);
  // The CLI has no destination override. Programmatic fixture callers may use an
  // isolated private-staging folder, never an app publication/source filename.
  assert(basename(absolute) === 'receipt.json' && basename(dirname(absolute)) === 'private-staging', 'Private receipts must use a separate private-staging/receipt.json destination.');
  return absolute;
}

export async function buildPrivatePlan(options = {}) {
  assert(!options.approval, 'Private staging does not accept release attestations. Use the separate gated publisher for public release.');
  const source = await buildPlan({ ...options, approval: undefined });
  const files = source.files.map((file) => ({ id: file.id, path: file.path, data: file.data, staged: file.published, pendingReleaseIssues: releaseIssues(null, { id: file.id }, file.published.sha256) }));
  for (const file of files) validateFile(file);
  return { files, bytes: source.bytes, receiptPath: receiptDestination(options.receiptPath ?? RECEIPT) };
}

async function limitedBody(response, maximum) {
  const length = response.headers.get('content-length');
  assert(!length || (Number.isInteger(Number(length)) && Number(length) >= 0 && Number(length) <= maximum), 'Private storage response is larger than expected.');
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; total += value.length; assert(total <= maximum, 'Private storage response is larger than expected.'); chunks.push(value); }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
async function smallJson(response) { try { return JSON.parse((await limitedBody(response, 65536)).toString('utf8')); } catch (error) { if (error instanceof SyntaxError) return {}; throw error; } }
async function isMissing(response) {
  if (response.status === 404) return true;
  if (response.status !== 400) return false;
  const error = await smallJson(response.clone());
  return error.code === 'NoSuchKey' || error.code === 'NoSuchBucket' || (String(error.statusCode) === '404' && ['not_found', 'Not Found'].includes(error.error));
}

export function privateStorageClient(credentials, fetchImpl = globalThis.fetch) {
  const { origin, key } = credentials;
  const projectRef = new URL(origin).hostname.split('.')[0];
  credentialsFromEnv({ SUPABASE_URL: origin, SUPABASE_SERVICE_ROLE_KEY: key }, projectRef);
  let bucketChecked = false;
  async function request(path, init = {}) {
    assert(path === `/storage/v1/bucket/${PRIVATE_BUCKET}` || path === '/storage/v1/bucket' || path.startsWith(`/storage/v1/object/authenticated/${PRIVATE_BUCKET}/`) || path.startsWith(`/storage/v1/object/${PRIVATE_BUCKET}/`), 'Only the exact private staging bucket endpoints are allowed.');
    assert(!/[?#%]/.test(path) && !path.includes('..'), 'Unsafe private storage path.');
    const url = new URL(path, origin);
    assert(url.origin === origin, 'Private storage credential host guard rejected another origin.');
    const headers = new Headers(init.headers);
    assert(!headers.has('authorization') && !headers.has('apikey') && !headers.has('cookie'), 'Caller-supplied request credentials are forbidden.');
    headers.set('apikey', key);
    if (!key.startsWith('sb_secret_')) headers.set('authorization', `Bearer ${key}`);
    let response;
    try { response = await fetchImpl(url.href, { ...init, headers, credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(30000) }); }
    catch { throw new Error('Private storage request failed. No automatic retry was made; rerun to reconcile verified immutable objects.'); }
    assert(!response.redirected && (response.status < 300 || response.status >= 400), 'Private storage redirect rejected; credentials were not forwarded.');
    return response;
  }
  async function getBucket() {
    bucketChecked = false;
    const response = await request(`/storage/v1/bucket/${PRIVATE_BUCKET}`);
    if (await isMissing(response)) return null;
    assert(response.ok, `Private bucket inspection failed (HTTP ${response.status}).`);
    const bucket = validatePrivateBucket(await smallJson(response));
    bucketChecked = true;
    return bucket;
  }
  async function ensureBucket() {
    if (await getBucket()) return { created: false, bucket: PRIVATE_BUCKET, public: false };
    const response = await request('/storage/v1/bucket', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(PRIVATE_BUCKET_CONFIG) });
    assert(response.ok || [400, 409].includes(response.status), `Private bucket creation failed (HTTP ${response.status}).`);
    assert(await getBucket(), 'Private bucket creation could not be verified.');
    return { created: response.ok, bucket: PRIVATE_BUCKET, public: false };
  }
  async function verifyObject(file, allowMissing = false) {
    validateFile(file);
    assert(bucketChecked, 'Inspect the exact private bucket before staging or verifying objects.');
    // Supabase private-download API; no public route or signed URL is used.
    const response = await request(`/storage/v1/object/authenticated/${PRIVATE_BUCKET}/${file.staged.objectPath}`);
    if (allowMissing && await isMissing(response)) return false;
    assert(response.ok, `Authenticated private audio verification failed for ${file.id} (HTTP ${response.status}).`);
    assert(response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() === 'audio/mpeg', `Unexpected private audio type: ${file.id}`);
    const bytes = await limitedBody(response, file.staged.bytes);
    assert(bytes.length === file.staged.bytes && sha256(bytes) === file.staged.sha256, `Immutable private object hash/size collision: ${file.id}`);
    return true;
  }
  async function stageObject(file) {
    validateFile(file);
    if (await verifyObject(file, true)) return 'existing-verified';
    const response = await request(`/storage/v1/object/${PRIVATE_BUCKET}/${file.staged.objectPath}`, { method: 'POST', headers: { 'content-type': 'audio/mpeg', 'cache-control': 'max-age=0', 'x-upsert': 'false' }, body: file.data });
    assert(response.ok || [400, 409].includes(response.status), `Private audio upload failed for ${file.id} (HTTP ${response.status}).`);
    await verifyObject(file); // Reconcile duplicate races using bytes, not receipts.
    return response.ok ? 'uploaded-verified' : 'existing-verified';
  }
  return { projectRef, getBucket, ensureBucket, verifyObject, stageObject };
}

async function ensureRegularDirectory(path) {
  if (dirname(path) !== path) await ensureRegularDirectory(dirname(path));
  let info;
  try { info = await lstat(path); } catch (error) { if (error.code !== 'ENOENT') throw error; try { await mkdir(path, { mode: 0o700 }); } catch (collision) { if (collision.code !== 'EEXIST') throw collision; } info = await lstat(path); }
  assert(info.isDirectory() && !info.isSymbolicLink(), 'Private receipt path contains a non-directory or symlink.');
}
async function optionalReceiptBytes(path) {
  let handle;
  try { handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  try { assert((await handle.stat()).isFile(), 'Private receipt must be a regular file.'); return await handle.readFile(); } finally { await handle.close(); }
}

export async function stagePlan(plan, client) {
  assert(Array.isArray(plan.files) && plan.files.length > 0 && new Set(plan.files.map((file) => file.id)).size === plan.files.length, 'Invalid or duplicated private staging selection.');
  for (const file of plan.files) validateFile(file);
  const receiptPath = receiptDestination(plan.receiptPath);
  assert(PROJECT.test(client.projectRef ?? ''), 'A pinned staging project is required.');
  const bucket = await client.getBucket();
  assert(bucket, 'Private bucket is missing. Run the explicit create-only --ensure-bucket step first.');
  validatePrivateBucket(bucket);
  await ensureRegularDirectory(dirname(receiptPath));
  const lockPath = `${receiptPath}.stage.lock`;
  const lock = await open(lockPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600).catch(() => { throw new Error('Private staging receipt is locked; inspect the exact lock before retrying.'); });
  const temporary = `${receiptPath}.${randomUUID()}.tmp`;
  try {
    let previous = await optionalReceiptBytes(receiptPath);
    let receipt = previous ? validateReceipt(JSON.parse(previous), client.projectRef) : emptyReceipt(client.projectRef);
    const results = [];
    for (const file of plan.files) {
      const status = await client.stageObject(file);
      const current = await optionalReceiptBytes(receiptPath);
      assert(previous === null ? current === null : current !== null && previous.equals(current), 'Private receipt was edited during upload; external edits were preserved.');
      const value = { id: file.id, ...file.staged, verifiedAt: new Date().toISOString(), pendingReleaseIssues: file.pendingReleaseIssues };
      const existing = receipt.entries[value.objectPath];
      if (existing) {
        const comparable = ({ verifiedAt, ...rest }) => rest;
        assert(JSON.stringify(comparable(existing)) === JSON.stringify(comparable(value)), 'Immutable private receipt collision.');
      } else {
        receipt = validateReceipt({ ...receipt, entries: Object.fromEntries(Object.entries({ ...receipt.entries, [value.objectPath]: value }).sort(([left], [right]) => left.localeCompare(right))) }, client.projectRef);
        const next = jsonBytes(receipt);
        const handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
        try { await handle.writeFile(next); await handle.sync(); } finally { await handle.close(); }
        const beforeRename = await optionalReceiptBytes(receiptPath);
        assert(previous === null ? beforeRename === null : beforeRename !== null && previous.equals(beforeRename), 'Private receipt changed before atomic replacement; external edits were preserved.');
        await rename(temporary, receiptPath);
        previous = next;
      }
      results.push({ id: file.id, status });
    }
    validatePrivateBucket(await client.getBucket());
    return { bucket: PRIVATE_BUCKET, public: false, count: results.length, uploaded: results.filter((result) => result.status === 'uploaded-verified').length, existingVerified: results.filter((result) => result.status === 'existing-verified').length, bytes: plan.bytes, pendingPublicRelease: true, receiptPath };
  } finally {
    await unlink(temporary).catch((error) => { if (error.code !== 'ENOENT') throw error; });
    await lock.close();
    await unlink(lockPath);
  }
}

export function parseArgs(args) {
  const options = { mode: 'dry-run' };
  const modes = [];
  const paths = { '--manifest': 'manifest', '--audit': 'audit', '--audio-dir': 'audioDir' };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (['--upload', '--ensure-bucket', '--dry-run'].includes(arg)) { modes.push(arg); options.mode = arg.slice(2); }
    else if (arg === '--all') options.all = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (paths[arg] || ['--project-ref', '--ids'].includes(arg)) {
      const value = args[++index];
      assert(value && !value.startsWith('--'), `${arg} requires a value.`);
      if (paths[arg]) options[paths[arg]] = resolve(value);
      else if (arg === '--project-ref') options.projectRef = value;
      else { options.ids = value.split(','); assert(options.ids.every((id) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) && new Set(options.ids).size === options.ids.length, 'Use unique exact word IDs.'); }
    } else throw new Error(`Unknown private staging option: ${arg}`);
  }
  assert(modes.length <= 1, 'Choose one private staging operation.');
  assert(!(options.all && options.ids), 'Choose --all or --ids, not both.');
  if (options.mode === 'upload' && !options.help) assert(options.all || options.ids, 'Private upload requires explicit --all or --ids selection.');
  if (options.mode === 'ensure-bucket') assert(!options.all && !options.ids && !Object.values(paths).some((key) => options[key]), '--ensure-bucket only creates or validates the exact empty private bucket.');
  return options;
}

export async function run(args, { env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const options = parseArgs(args);
  if (options.help) return { help: 'Private staging only; default dry-run. Use --ensure-bucket --project-ref REF, then explicit --upload --all (or --ids IDS) --project-ref REF. No public URLs, signed URLs, app index, bucket updates, policy changes, or release approvals. Credentials only from the operator environment.' };
  if (options.mode === 'ensure-bucket') return privateStorageClient(credentialsFromEnv(env, options.projectRef), fetchImpl).ensureBucket();
  const plan = await buildPrivatePlan(options);
  if (options.mode === 'dry-run') return { mode: 'dry-run', networkRequests: 0, localFilesWritten: 0, bucket: PRIVATE_BUCKET, public: false, words: plan.files.length, bytes: plan.bytes, pendingPublicRelease: true, reasons: [...new Set(plan.files.flatMap((file) => file.pendingReleaseIssues))] };
  return stagePlan(plan, privateStorageClient(credentialsFromEnv(env, options.projectRef), fetchImpl));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run(process.argv.slice(2)).then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
