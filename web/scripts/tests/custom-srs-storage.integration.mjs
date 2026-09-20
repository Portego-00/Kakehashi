import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const root = new URL('../../../', import.meta.url);
const migration = (name) => readFile(new URL(`supabase/migrations/${name}`, root), 'utf8');

test('migrates real PostgreSQL data, preserves history, isolates roles, and updates cards atomically', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role;');
    await db.exec(await migration('20260831010000_custom_srs_states.sql'));
    const metadata = { version: 1, policy: { id: 'test' }, enrolledPackIds: ['pack'], updatedAt: '2026-09-17T12:00:00Z' };
    const original = { ...metadata, assignments: { a: { stage: 1 }, b: { stage: 0 } }, reviewLog: [{ eventId: 'old', wordId: 'a' }] };
    await db.query('select compare_and_set_custom_srs_state($1, -1, $2)', ['user', original]);
    await db.exec(await migration('20260917000000_custom_srs_durable_storage.sql'));
    const snapshot = async () => (await db.query('select state, revision from custom_srs_states where user_id = $1', ['user'])).rows[0];
    assert.deepEqual((await snapshot()).state, original);
    const patch = async (revision, assignments, reviews = [], meta = metadata) => (await db.query(
      'select patch_custom_srs_state($1, $2, $3, $4, $5) as result', ['user', revision, meta, assignments, reviews],
    )).rows[0].result;
    assert.deepEqual(await patch(0, { a: { stage: 2 } }, [{ eventId: 'new', wordId: 'a' }]), { revision: 1 });
    assert.equal(await patch(0, { b: { stage: 9 } }), null);
    assert.deepEqual((await snapshot()).state.assignments, { a: { stage: 2 }, b: { stage: 0 } });
    await assert.rejects(patch(1, {}, [], { ...metadata, policy: { id: 'incompatible' } }), /unsafe metadata/);
    await assert.rejects(db.query('select compare_and_set_custom_srs_state($1, 1, $2)', ['user', { ...original, assignments: {} }]), /unsafe assignment removal/);
    await assert.rejects(patch(1, { a: { stage: 0 } }), /unsafe learned card reset/);
    assert.equal((await snapshot()).revision, 1);
    const events = Array.from({ length: 2100 }, (_, i) => ({ eventId: `review-${i}`, wordId: 'a' }));
    await patch(1, {}, events);
    await patch(2, {}, events); // duplicate delivery cannot duplicate the archive
    assert.equal((await db.query('select count(*)::int as n from custom_srs_review_history')).rows[0].n, 2102);
    assert.equal((await snapshot()).state.reviewLog.length, 2000);
    const selected = (await db.query("select read_custom_srs_cards('user', array['a'], 'old') as value")).rows[0].value;
    assert.deepEqual(Object.keys(selected.state.assignments), ['a']);
    assert.deepEqual(selected.state.reviewLog, [{ eventId: 'old', wordId: 'a' }]);
    // Account size can exceed the old 2 MB ceiling, while individual writes remain bounded.
    await patch(3, { large1: { note: 'x'.repeat(1_100_000) } });
    await patch(4, { large2: { note: 'y'.repeat(1_100_000) } });
    assert.equal((await snapshot()).revision, 5);
    assert.deepEqual((await db.query('select state from custom_srs_states_legacy_backup')).rows[0].state, original);
    await db.exec('set role anon');
    await assert.rejects(db.query('select * from custom_srs_states'), /permission denied/);
    await assert.rejects(db.query('select * from custom_srs_review_history'), /permission denied/);
    await assert.rejects(db.query("select read_custom_srs_cards('user', array['a'], 'old')"), /permission denied/);
    await db.exec('reset role; set role service_role;');
    assert.equal((await db.query('select revision from custom_srs_states')).rows[0].revision, 5);
  } finally { await db.close(); }
});

test('scheduling policy upgrades are account-scoped, revision-locked, and protected from old writers', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role;');
    await db.exec(await migration('20260831010000_custom_srs_states.sql'));
    await db.exec(await migration('20260917000000_custom_srs_durable_storage.sql'));
    await db.exec(await migration('20260919000000_custom_srs_settings.sql'));
    const meta = { version: 1, policy: { id: 'fsrs-wk-shaped', version: 1 }, enrolledPackIds: [], updatedAt: '2026-09-19T10:00:00Z' };
    const patch = async (user, revision, metadata, assignments = {}, rpc = 'patch_custom_srs_state_v2') => (await db.query(
      `select ${rpc}($1, $2, $3, $4, '[]'::jsonb) as result`, [user, revision, metadata, assignments],
    )).rows[0].result;
    await patch('a', -1, meta, { word: { stage: 1, availableAt: '2026-09-20T10:00:00Z' } });
    await patch('b', -1, meta);
    const configured = { ...meta, policy: { id: 'custom-srs', version: 2, settingsRevision: 1, settings: { mode: 'wanikani' } } };
    assert.deepEqual(await patch('a', 0, configured), { revision: 1 });
    assert.equal(await patch('a', 0, configured), null);
    const rows = (await db.query('select user_id, state from custom_srs_states order by user_id')).rows;
    assert.deepEqual(rows[0].state.assignments.word, { stage: 1, availableAt: '2026-09-20T10:00:00Z' });
    assert.deepEqual(rows[1].state.policy, meta.policy);
    await assert.rejects(patch('a', 1, meta, {}, 'patch_custom_srs_state'), /unsafe metadata/);
    await assert.rejects(patch('a', 1, meta), /unsafe metadata/);
    const stalePolicy = { ...configured, policy: { ...configured.policy, settings: { mode: 'fsrs' } } };
    await assert.rejects(patch('a', 1, stalePolicy), /unsafe metadata/);
    assert.deepEqual(await patch('a', 1, { ...stalePolicy, policy: { ...stalePolicy.policy, settingsRevision: 2 } }), { revision: 2 });
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(patch('a', 2, configured), /permission denied/);
      await db.exec('reset role');
    }
  } finally { await db.close(); }
});

test('private decks import atomically, deduplicate, isolate accounts, and preserve SRS through edits and archive', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role;');
    for (const name of ['20260831010000_custom_srs_states.sql', '20260917000000_custom_srs_durable_storage.sql', '20260919000000_custom_srs_settings.sql', '20260920000000_personal_vocabulary.sql']) await db.exec(await migration(name));
    const id = (number) => `personal:00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
    const meta = { version: 1, policy: { id: 'test' }, enrolledPackIds: [], updatedAt: '2026-09-20T10:00:00Z' };
    let sequence = 0;
    const write = async (user, revision, operations, event = `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`) => (await db.query(
      'select mutate_custom_vocabulary($1,$2,$3,$4,$5) as result', [user, revision, event, operations, meta],
    )).rows[0].result;
    const read = async (user, after = 0, afterId = '', until = null) => (await db.query('select read_custom_vocabulary($1,$2,$3,$4) as result', [user, after, afterId, until])).rows[0].result;
    const word = { characters: '木漏れ日', reading: 'こもれび', meanings: ['sunlight through trees'], partsOfSpeech: [], meaningMnemonic: '', contextSentences: [] };
    const operations = [{ action: 'create_deck', id: id(1), title: 'Reading' }, { action: 'create_word', id: id(2), deckId: id(1), identityKey: 'komorebi', word }];
    const event = '10000000-0000-4000-8000-000000000000';
    assert.deepEqual(await write('one', 0, operations, event), { revision: 1, added: 1, skipped: 0, changed: 1 });
    assert.deepEqual(await write('one', 0, operations, event), { revision: 1, added: 1, skipped: 0, changed: 1 });
    await assert.rejects(write('one', 0, [operations[0]], event), /different content/);
    assert.deepEqual(await read('two'), { revision: 0, entries: [], cursor: null });
    await assert.rejects(write('two', 0, [{ ...operations[1], id: id(3) }]), /Deck not found/);
    await assert.rejects(write('two', 0, [{ action: 'edit_word', id: id(2), word, identityKey: 'other' }]), /Word not found/);
    assert.equal((await write('one', 1, [{ ...operations[1], id: id(3) }])).skipped, 1);
    const due = '2026-09-21T12:00:00.000Z';
    await db.query("update custom_srs_assignments set assignment = assignment || $1::jsonb where user_id='one' and word_id=$2", [{ stage: 4, availableAt: due, correctReviews: 3, startedAt: '2026-09-20T10:00:00Z', card: { stability: 12, state: 'Review' } }, id(2)]);
    await write('one', 2, [{ action: 'edit_word', id: id(2), word: { ...word, meanings: ['dappled sunlight'] }, identityKey: 'komorebi' }]);
    await write('one', 3, [{ action: 'archive_word', id: id(2), archived: true }]);
    let assignment = (await db.query("select assignment from custom_srs_assignments where user_id='one' and word_id=$1", [id(2)])).rows[0].assignment;
    assert.equal(assignment.stage, 4); assert.equal(assignment.availableAt, due); assert.equal(assignment.card.stability, 12); assert.ok(assignment.archivedAt);
    await write('one', 4, [{ action: 'archive_word', id: id(2), archived: false }]);
    assignment = (await db.query("select assignment from custom_srs_assignments where user_id='one' and word_id=$1", [id(2)])).rows[0].assignment;
    assert.equal(assignment.archivedAt, null); assert.equal(assignment.availableAt, due);
    await assert.rejects(write('one', 3, [{ action: 'rename_deck', id: id(1), title: 'Stale' }]), /changed on another device/);
    const delta = await read('one', 1);
    assert.equal(delta.entries.length, 1); assert.equal(delta.entries[0].id, id(2));
    assert.deepEqual((await read('one', delta.revision)).entries, []);
    // A late invalid row rolls back earlier rows and the library revision.
    await assert.rejects(write('one', 5, [{ ...operations[1], id: id(4), identityKey: 'new' }, { ...operations[1], id: id(5), deckId: id(999) }]), /Deck not found/);
    assert.equal((await read('one')).revision, 5);
    assert.equal((await read('one')).entries.length, 2);
    const batch = Array.from({ length: 205 }, (_, i) => ({ ...operations[1], id: id(100 + i), identityKey: `word-${i}` }));
    await write('one', 5, batch);
    const first = await read('one');
    assert.equal(first.entries.length, 200); assert.ok(first.cursor);
    const second = await read('one', first.cursor.revision, first.cursor.id, first.revision);
    assert.equal(second.entries.length, 7); assert.equal(second.cursor, null);
    assert.equal(new Set([...first.entries, ...second.entries].map((entry) => entry.id)).size, 207);
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(read('one'), /permission denied/);
      await assert.rejects(write('one', 6, operations), /permission denied/);
      await assert.rejects(db.query('select * from custom_vocabulary_entries'), /permission denied/);
      await db.exec('reset role');
    }
  } finally { await db.close(); }
});
