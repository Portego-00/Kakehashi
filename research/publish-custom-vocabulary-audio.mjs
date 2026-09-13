#!/usr/bin/env node

// Operator-only publisher. Dry-run by default; never imported into an app bundle.
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, realpath, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const BUCKET = 'custom-vocabulary-audio';
export const CACHE_SECONDS = 31536000;
export const MAX_FILE_BYTES = 1048576;
export const VOICE = Object.freeze({ name: 'Shizuka', gender: 'female', description: 'AI-generated Japanese pronunciation', actorId: 1500000001 });
export const BUCKET_CONFIG = Object.freeze({ id: BUCKET, name: BUCKET, public: true, allowed_mime_types: ['audio/mpeg'], file_size_limit: MAX_FILE_BYTES });
const HASH = /^[a-f0-9]{64}$/;
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PROJECT = /^[a-z0-9]{20}$/;
const defaults = {
  manifest: resolve(ROOT, 'research/data/custom-vocabulary-audio-manifest.json'),
  audit: resolve(ROOT, 'output/custom-vocabulary-audio/audio-audit.json'),
  audioDir: resolve(ROOT, 'output/custom-vocabulary-audio/split audios'),
  publication: resolve(ROOT, 'web/src/features/custom-srs/audio-publication.generated.json'),
};

export const sha256 = (value) => createHash('sha256').update(value).digest('hex');
export const emptyPublication = () => ({ schemaVersion: 1, bucket: BUCKET, voice: { ...VOICE }, entries: {} });
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const within = (root, path) => { const child = relative(root, path); return child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child); };

export function objectPath(entry, hash) {
  assert(ID.test(entry.id) && ID.test(entry.packId) && HASH.test(hash), 'Invalid audio identity or hash.');
  return `v1/${entry.packId}/${entry.id}/${hash}.mp3`;
}

export function validatePublication(value) {
  assert(value?.schemaVersion === 1 && value.bucket === BUCKET && value.entries && typeof value.entries === 'object' && !Array.isArray(value.entries), 'Invalid publication manifest.');
  assert(JSON.stringify(value.voice) === JSON.stringify(VOICE), 'Unexpected publication voice metadata.');
  const paths = new Set();
  for (const [id, entry] of Object.entries(value.entries)) {
    assert(entry && text(entry.reading) && Number.isInteger(entry.bytes) && entry.bytes > 0 && entry.bytes <= MAX_FILE_BYTES, `Invalid published entry: ${id}`);
    assert(entry.objectPath === objectPath({ id, packId: entry.packId }, entry.sha256), `Invalid immutable path: ${id}`);
    assert(!paths.has(entry.objectPath), 'Duplicate published object path.');
    paths.add(entry.objectPath);
  }
  return value;
}

export function releaseIssues(approval, entry, hash) {
  const issues = [];
  if (approval?.schemaVersion !== 1 || approval.publicDistribution !== true || !text(approval.approvedBy) || !text(approval.releaseId) || !Number.isFinite(Date.parse(approval.approvedAt))) issues.push('No explicit public release approval.');
  const item = approval?.entries?.[entry.id];
  if (item?.sha256 !== hash) issues.push('No approval bound to this exact audio hash.');
  if (item?.license?.approved !== true || item.license.commercialUse !== true || !text(item.license.evidence)) issues.push('Commercial/public distribution license evidence is not approved.');
  if (item?.pronunciation?.approved !== true || !text(item.pronunciation.reviewedBy) || !Number.isFinite(Date.parse(item.pronunciation.reviewedAt)) || !text(item.pronunciation.evidence)) issues.push('Pronunciation listening approval is missing.');
  return issues;
}

async function optionalJson(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

export async function buildPlan(options = {}) {
  const paths = { ...defaults, ...options };
  const rawManifest = await readFile(paths.manifest);
  const manifest = JSON.parse(rawManifest);
  const audit = JSON.parse(await readFile(paths.audit, 'utf8'));
  assert(manifest.schemaVersion === 1 && Array.isArray(manifest.entries) && manifest.entries.length > 0, 'Invalid source manifest.');
  assert(audit.schemaVersion === 1 && audit.status === 'complete' && audit.strict === true && audit.fullDecode === true && audit.manifestSha256 === sha256(rawManifest), 'A complete strict decode audit for this exact source manifest is required.');
  assert(audit.expectedCount === manifest.entries.length && audit.validCount === manifest.entries.length && audit.invalidCount === 0 && audit.missingCount === 0 && audit.strictIssues?.length === 0, 'Source audio audit is incomplete or has strict failures.');
  assert(Array.isArray(audit.files) && audit.files.length === manifest.entries.length, 'Audit file inventory does not match the source manifest.');
  const auditById = new Map(audit.files.map((entry) => [entry.id, entry]));
  assert(auditById.size === audit.files.length, 'Duplicate audit identities.');
  const allIds = new Set();
  for (const entry of manifest.entries) {
    assert(ID.test(entry.id) && ID.test(entry.packId) && text(entry.reading) && entry.filename === `${entry.packId}/${entry.id}.mp3`, 'Unsafe or mismatched source file identity.');
    assert(!allIds.has(entry.id), 'Duplicate source word identity.');
    allIds.add(entry.id);
  }
  const selectedIds = options.ids ? new Set(options.ids) : allIds;
  assert(selectedIds.size > 0, 'Select at least one word.');
  for (const id of selectedIds) assert(allIds.has(id), `Unknown selected word: ${id}`);
  const approval = paths.approval ? await optionalJson(paths.approval) : null;
  const root = await realpath(paths.audioDir);
  const publication = validatePublication(await optionalJson(paths.publication) ?? emptyPublication());
  const files = [];
  for (const entry of manifest.entries.filter((entry) => selectedIds.has(entry.id))) {
    const path = resolve(paths.audioDir, entry.filename);
    const stat = await lstat(path);
    assert(stat.isFile() && !stat.isSymbolicLink() && within(root, await realpath(path)), `Audio must be a regular file inside the audio folder: ${entry.id}`);
    assert(stat.size > 0 && stat.size <= MAX_FILE_BYTES, `Invalid audio file size: ${entry.id}`);
    const bytes = await readFile(path);
    const hash = sha256(bytes);
    const checked = auditById.get(entry.id);
    assert(checked?.present === true && checked.valid === true && checked.decoded === true && checked.errors?.length === 0 && checked.sha256 === hash && checked.bytes === bytes.length && checked.filename === entry.filename && checked.packId === entry.packId && checked.reading === entry.reading, `Missing, stale, or mismatched audit for ${entry.id}. Re-run the strict audit.`);
    const published = { packId: entry.packId, reading: entry.reading, sha256: hash, bytes: bytes.length, objectPath: objectPath(entry, hash) };
    const previous = publication.entries[entry.id];
    // New approved bytes can replace a word's index entry, never an existing object.
    if (previous?.objectPath === published.objectPath) assert(JSON.stringify(previous) === JSON.stringify(published), `Immutable publication collision: ${entry.id}`);
    files.push({ id: entry.id, path, data: bytes, published, issues: releaseIssues(approval, entry, hash) });
  }
  return { files, publication, publicationPath: paths.publication, bytes: files.reduce((total, file) => total + file.data.length, 0) };
}

export function credentialsFromEnv(env, projectRef) {
  assert(PROJECT.test(projectRef ?? ''), 'Remote operations require --project-ref with the exact Supabase project reference.');
  let url;
  try { url = new URL(env.SUPABASE_URL); } catch { throw new Error('Set SUPABASE_URL to the exact hosted Supabase project URL.'); }
  assert(url.protocol === 'https:' && url.hostname === `${projectRef}.supabase.co` && url.port === '' && url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password, 'Credential host guard: SUPABASE_URL must be the exact HTTPS project origin.');
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  assert(text(key) && !/[\r\n\s]/.test(key), 'Set the operator-only SUPABASE_SERVICE_ROLE_KEY environment variable.');
  if (!key.startsWith('sb_secret_')) {
    let payload;
    try { payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8')); } catch { throw new Error('Expected a Supabase service-role JWT or secret key, not a public key.'); }
    assert(key.split('.').length === 3 && payload.role === 'service_role', 'A server-side service-role key is required; public/anonymous keys are not accepted.');
    assert(!payload.ref || payload.ref === projectRef, 'Credential project does not match the explicitly selected project.');
    assert(!payload.exp || payload.exp * 1000 > Date.now(), 'The service-role key is expired.');
  }
  return { origin: url.origin, key };
}

async function smallJson(response) {
  const body = await limitedBody(response, 65536);
  try { return JSON.parse(body.toString('utf8')); } catch { return {}; }
}

async function limitedBody(response, maximum) {
  const length = response.headers.get('content-length');
  assert(!length || (Number.isInteger(Number(length)) && Number(length) >= 0 && Number(length) <= maximum), 'Remote response is larger than expected.');
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      assert(total <= maximum, 'Remote response is larger than expected.');
      chunks.push(value);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}

async function isMissing(response) {
  if (response.status === 404) return true;
  if (response.status !== 400) return false;
  const error = await smallJson(response.clone());
  return error.code === 'NoSuchKey' || error.code === 'NoSuchBucket' || (String(error.statusCode) === '404' && ['not_found', 'Not Found'].includes(error.error));
}

export function validateBucket(bucket) {
  assert(bucket?.id === BUCKET && bucket.name === BUCKET && bucket.public === true && bucket.file_size_limit === MAX_FILE_BYTES && Array.isArray(bucket.allowed_mime_types) && bucket.allowed_mime_types.length === 1 && bucket.allowed_mime_types[0] === 'audio/mpeg', 'Existing bucket configuration differs. Nothing was changed; review the bucket manually.');
  return bucket;
}

export function storageClient(credentials, fetchImpl = globalThis.fetch) {
  const { origin, key } = credentials;
  // Revalidate the origin even when callers construct credentials programmatically.
  const projectRef = new URL(origin).hostname.split('.')[0];
  credentialsFromEnv({ SUPABASE_URL: origin, SUPABASE_SERVICE_ROLE_KEY: key }, projectRef);
  async function request(path, { privileged = false, ...init } = {}) {
    assert(path.startsWith('/storage/v1/') && !path.includes('..') && !path.includes('?') && !path.includes('#'), 'Unsafe storage request path.');
    const url = new URL(path, origin);
    assert(url.origin === origin, 'Credential host guard rejected a different origin.');
    const headers = new Headers(init.headers);
    assert(!headers.has('authorization') && !headers.has('apikey') && !headers.has('cookie'), 'Caller-supplied credentials are forbidden.');
    if (privileged) {
      headers.set('apikey', key);
      if (!key.startsWith('sb_secret_')) headers.set('authorization', `Bearer ${key}`);
    }
    let response;
    try { response = await fetchImpl(url.href, { ...init, headers, redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(30000) }); }
    catch { throw new Error('Storage request failed. No automatic write retry was made; rerun to reconcile safely.'); }
    assert(!response.redirected && (response.status < 300 || response.status >= 400), 'Storage redirect rejected; credentials were not forwarded.');
    return response;
  }
  async function getBucket() {
    const response = await request(`/storage/v1/bucket/${BUCKET}`, { privileged: true });
    if (await isMissing(response)) return null;
    assert(response.ok, `Bucket inspection failed (HTTP ${response.status}).`);
    return validateBucket(await smallJson(response));
  }
  async function ensureBucket() {
    if (await getBucket()) return { created: false, bucket: BUCKET };
    const response = await request('/storage/v1/bucket', { method: 'POST', privileged: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify(BUCKET_CONFIG) });
    // An uncertain/concurrent create is reconciled read-only, never by update/delete.
    if (!response.ok && ![400, 409].includes(response.status)) throw new Error(`Bucket creation failed (HTTP ${response.status}).`);
    assert(await getBucket(), 'Created bucket could not be verified.');
    return { created: response.ok, bucket: BUCKET };
  }
  async function verifyObject(file, allowMissing = false) {
    const response = await request(`/storage/v1/object/public/${BUCKET}/${file.published.objectPath}`);
    if (allowMissing && await isMissing(response)) return false;
    assert(response.ok, `Public audio verification failed for ${file.id} (HTTP ${response.status}).`);
    assert(response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() === 'audio/mpeg', `Unexpected remote audio type: ${file.id}`);
    const maxAge = response.headers.get('cache-control')?.match(/(?:^|[,\s])max-age=(\d+)(?:[,\s]|$)/i)?.[1];
    assert(Number(maxAge) >= CACHE_SECONDS, `Remote audio lacks the configured long-lived cache: ${file.id}`);
    const content = await limitedBody(response, file.published.bytes);
    assert(content.length === file.published.bytes && sha256(content) === file.published.sha256, `Immutable remote object hash/size collision: ${file.id}`);
    return true;
  }
  async function publishObject(file) {
    assert(file.data.length === file.published.bytes && sha256(file.data) === file.published.sha256 && file.published.objectPath === objectPath({ id: file.id, packId: file.published.packId }, file.published.sha256), 'Local audio changed before upload.');
    assert(file.issues.length === 0, `Release approval blocked: ${file.id}`);
    if (await verifyObject(file, true)) return 'existing-verified';
    const response = await request(`/storage/v1/object/${BUCKET}/${file.published.objectPath}`, { method: 'POST', privileged: true, headers: { 'content-type': 'audio/mpeg', 'cache-control': `max-age=${CACHE_SECONDS}`, 'x-upsert': 'false' }, body: file.data });
    if (!response.ok && ![400, 409].includes(response.status)) throw new Error(`Audio upload failed for ${file.id} (HTTP ${response.status}).`);
    // Includes duplicate-object race resolution. Never trust an upload receipt alone.
    await verifyObject(file);
    return response.ok ? 'uploaded-verified' : 'existing-verified';
  }
  return { getBucket, ensureBucket, verifyObject, publishObject };
}

export async function publishPlan(plan, client) {
  const blocked = plan.files.filter((file) => file.issues.length > 0);
  assert(blocked.length === 0, `Release blocked for ${blocked.length} selected word(s). No remote changes were attempted.`);
  assert(await client.getBucket(), 'Audio bucket is missing. Run the explicit --ensure-bucket operation first.');
  const original = await readFile(plan.publicationPath).catch((error) => { if (error.code === 'ENOENT') return null; throw error; });
  assert(JSON.stringify(validatePublication(original ? JSON.parse(original) : emptyPublication())) === JSON.stringify(plan.publication), 'Publication changed since preflight; rerun.');
  await mkdir(dirname(plan.publicationPath), { recursive: true });
  const lockPath = `${plan.publicationPath}.publish.lock`;
  const lock = await open(lockPath, 'wx', 0o600).catch(() => { throw new Error('Publication is locked. Another publisher may be running; inspect before removing its lock.'); });
  const tempPath = `${plan.publicationPath}.${randomUUID()}.tmp`;
  try {
    const results = [];
    // Sequential, tiny uploads keep memory, request bursts and duplicate work bounded.
    for (const file of plan.files) results.push({ id: file.id, status: await client.publishObject(file) });
    const current = await readFile(plan.publicationPath).catch((error) => { if (error.code === 'ENOENT') return null; throw error; });
    assert(original === null ? current === null : current !== null && original.equals(current), 'Publication was edited during upload. Verified objects remain resumable; the manifest was not overwritten.');
    const merged = validatePublication({ ...plan.publication, entries: Object.fromEntries(Object.entries({ ...plan.publication.entries, ...Object.fromEntries(plan.files.map((file) => [file.id, file.published])) }).sort(([left], [right]) => left.localeCompare(right))) });
    if (JSON.stringify(merged) !== JSON.stringify(plan.publication)) {
      await writeFile(tempPath, `${JSON.stringify(merged, null, 2)}\n`, { flag: 'wx', mode: 0o644 });
      await rename(tempPath, plan.publicationPath);
    }
    return { count: results.length, uploaded: results.filter((result) => result.status === 'uploaded-verified').length, existingVerified: results.filter((result) => result.status === 'existing-verified').length, bytes: plan.bytes };
  } finally {
    await unlink(tempPath).catch((error) => { if (error.code !== 'ENOENT') throw error; });
    await lock.close();
    await unlink(lockPath);
  }
}

export function parseArgs(args) {
  const options = { ...defaults, mode: 'dry-run' };
  const modes = [];
  const paths = { '--manifest': 'manifest', '--audit': 'audit', '--audio-dir': 'audioDir', '--publication': 'publication', '--approval': 'approval' };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (['--upload', '--ensure-bucket', '--dry-run'].includes(arg)) { modes.push(arg); options.mode = arg.slice(2); }
    else if (arg === '--all') options.all = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (paths[arg] || ['--project-ref', '--ids'].includes(arg)) {
      const value = args[++index];
      assert(value && !value.startsWith('--'), `${arg} requires a value.`);
      if (paths[arg]) options[paths[arg]] = resolve(value);
      else if (arg === '--project-ref') options.projectRef = value;
      else options.ids = value.split(',');
    } else throw new Error(`Unknown option: ${arg}`);
  }
  assert(modes.length <= 1, 'Choose exactly one operation mode.');
  assert(!(options.all && options.ids), 'Choose --all or --ids, not both.');
  if (options.mode === 'upload' && !options.help) {
    assert(options.all || options.ids, 'Upload requires explicit --all or --ids selection.');
    assert(options.approval, 'Upload requires --approval with an explicit hash-bound release approval file.');
  }
  if (options.mode === 'ensure-bucket') assert(!options.all && !options.ids && !options.approval, '--ensure-bucket only creates/validates the empty bucket; do not combine it with audio release options.');
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(`Custom vocabulary audio publisher (local dry-run by default).

  node research/publish-custom-vocabulary-audio.mjs
  node research/publish-custom-vocabulary-audio.mjs --ensure-bucket --project-ref EXACT_PROJECT_REF
  node research/publish-custom-vocabulary-audio.mjs --upload --all --approval PATH --project-ref EXACT_PROJECT_REF

Options: --ids WORD_ID,WORD_ID instead of --all; --manifest PATH; --audit PATH;
--audio-dir PATH; --publication PATH; --approval PATH; --dry-run.
Remote operations read SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the environment.
No credentials in arguments, no overwrite/delete, no automatic write retries.
See docs/custom-vocabulary-audio-hosting.md for required license/listening approvals.`);
    return;
  }
  if (options.mode === 'ensure-bucket') {
    const client = storageClient(credentialsFromEnv(process.env, options.projectRef));
    console.log(JSON.stringify(await client.ensureBucket(), null, 2));
    return;
  }
  const plan = await buildPlan(options);
  const blocked = plan.files.filter((file) => file.issues.length > 0);
  if (options.mode === 'dry-run') {
    console.log(JSON.stringify({ mode: 'dry-run', networkRequests: 0, localFilesWritten: 0, bucket: BUCKET, words: plan.files.length, bytes: plan.bytes, approved: plan.files.length - blocked.length, blocked: blocked.length, reasons: [...new Set(blocked.flatMap((file) => file.issues))], exampleObjectPath: plan.files[0]?.published.objectPath }, null, 2));
    return;
  }
  assert(blocked.length === 0, `Release blocked for ${blocked.length} selected word(s). No network requests were made.`);
  console.log(JSON.stringify(await publishPlan(plan, storageClient(credentialsFromEnv(process.env, options.projectRef))), null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
