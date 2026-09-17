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
