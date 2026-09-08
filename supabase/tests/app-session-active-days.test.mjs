/**
 * Executes the real migration against isolated in-memory PostgreSQL (PGlite).
 * No Supabase connection or production data is used.
 *
 * Install the test runtime outside the repository, then run:
 *   npm install --prefix /tmp/kakehashi-streak-test --no-audit --no-fund --ignore-scripts @electric-sql/pglite@0.3.15
 *   STREAK_TEST_PGLITE_MODULE=/tmp/kakehashi-streak-test/node_modules/@electric-sql/pglite/dist/index.js node --test supabase/tests/app-session-active-days.test.mjs
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { PGlite } = await import(
  process.env.STREAK_TEST_PGLITE_MODULE || "@electric-sql/pglite"
);
const migration = await readFile(
  new URL("../migrations/20260908180000_app_session_active_days.sql", import.meta.url),
  "utf8",
);

function datesForSessions(timestamps, timezone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return [...new Set(timestamps.map((timestamp) => {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(timestamp)).map(({ type, value }) => [type, value]),
    );
    return `${parts.year}-${parts.month}-${parts.day}`;
  }))].sort();
}

test("compact streak history uses PostgreSQL without changing session data or access", async (t) => {
  const db = new PGlite();
  try {
    // The relevant production schema and policies were verified read-only.
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create table public.app_sessions (
        id uuid primary key default gen_random_uuid(),
        user_id text not null,
        session_started_at timestamptz not null default now()
      );
      create index idx_app_sessions_user_date
        on public.app_sessions (user_id, session_started_at);
      alter table public.app_sessions enable row level security;
      create policy app_sessions_public_read on public.app_sessions
        for select to anon, authenticated using (true);
      grant usage on schema public to anon, authenticated, service_role;
      grant select on public.app_sessions to anon, authenticated, service_role;
    `);
    await db.exec(migration);

    const read = async (userId, timezone = "UTC") => {
      const result = await db.query(
        "select public.get_app_session_active_days($1, $2) as history",
        [userId, timezone],
      );
      assert.equal(result.rows.length, 1);
      return result.rows[0].history;
    };
    const insert = async (userId, timestamps) => db.query(
      `insert into public.app_sessions (user_id, session_started_at)
       select $1, value::timestamptz from jsonb_array_elements_text($2::jsonb)`,
      [userId, JSON.stringify(timestamps)],
    );

    await t.test("deduplicates dates, sorts them and isolates accounts", async () => {
      await insert("account-a", ["2026-09-08T12:00:00Z", "2026-09-07T23:00:00Z", "2026-09-08T13:00:00Z"]);
      await insert("account-b", ["2020-01-01T12:00:00Z"]);
      assert.deepEqual(await read("account-a"), { activeDays: ["2026-09-07", "2026-09-08"] });
      assert.deepEqual(await read("account-b"), { activeDays: ["2020-01-01"] });
      assert.deepEqual(await read("unknown"), { activeDays: [] });
      assert.deepEqual(await read("account-a' or true --"), { activeDays: [] });
    });

    await t.test("matches JavaScript timezone dates across midnight, DST and travel", async () => {
      const timestamps = [
        "2026-03-08T07:59:59.999Z", "2026-03-08T08:00:00Z",
        "2026-03-08T09:59:59.999Z", "2026-03-08T10:00:00Z",
        "2026-03-29T00:59:59.999Z", "2026-03-29T01:00:00Z",
        "2026-09-07T14:59:59.999Z", "2026-09-07T15:00:00Z",
        "2026-10-25T00:59:59.999Z", "2026-10-25T01:00:00Z",
        "2026-11-01T08:30:00Z", "2026-11-01T09:30:00Z",
      ];
      await insert("timezone-account", timestamps);
      await db.exec("set timezone = 'Pacific/Auckland'; set datestyle = 'German, DMY'");
      for (const timezone of ["UTC", "Asia/Tokyo", "Europe/Madrid", "America/Los_Angeles", "Asia/Kathmandu", "Pacific/Kiritimati"]) {
        assert.deepEqual(await read("timezone-account", timezone), {
          activeDays: datesForSessions(timestamps, timezone),
        }, timezone);
      }
      await db.exec("set timezone = 'UTC'; set datestyle = 'ISO, MDY'");
    });

    await t.test("keeps history beyond both the old 30,000-session cap and 1,000-date API row limit", async () => {
      await db.exec(`
        insert into public.app_sessions (user_id, session_started_at)
        select 'long-history', timestamptz '2020-01-01 12:00:00+00'
          + (ordinal / 24) * interval '1 day'
          + (ordinal % 24) * interval '1 minute'
        from generate_series(0, 31199) as ordinal;
      `);
      const { activeDays } = await read("long-history");
      assert.equal(activeDays.length, 1300);
      assert.equal(activeDays[0], "2020-01-01");
      assert.equal(activeDays.at(-1), "2023-07-23");
      assert.equal(new Set(activeDays).size, 1300);
    });

    await t.test("includes late/backdated sessions on the next read", async () => {
      await insert("account-a", ["2021-04-10T12:00:00Z", "2026-09-08T12:00:00Z"]);
      assert.deepEqual(await read("account-a"), {
        activeDays: ["2021-04-10", "2026-09-07", "2026-09-08"],
      });
    });

    await t.test("rejects invalid input even for an account without history", async () => {
      for (const [userId, timezone] of [
        ["unknown", "Not/A_Timezone"], ["unknown", null], ["unknown", ""],
        [null, "UTC"], ["", "UTC"], ["   ", "UTC"],
      ]) {
        await assert.rejects(read(userId, timezone), { code: "22023" });
      }
    });

    await t.test("works for the same existing caller roles", async () => {
      for (const role of ["anon", "authenticated", "service_role"]) {
        await db.exec(`set role ${role}`);
        try {
          assert.deepEqual(await read("account-b"), { activeDays: ["2020-01-01"] });
        } finally {
          await db.exec("reset role");
        }
      }
    });

    await t.test("does not bypass a more restrictive RLS policy or missing table privileges", async () => {
      await db.exec(`
        alter policy app_sessions_public_read on public.app_sessions
          using (user_id = current_setting('request.jwt.claim.sub', true));
        set request.jwt.claim.sub = 'account-b';
        set role anon;
      `);
      try {
        assert.deepEqual(await read("account-b"), { activeDays: ["2020-01-01"] });
        assert.deepEqual(await read("account-a"), { activeDays: [] });
      } finally {
        await db.exec("reset role");
      }
      await db.exec("revoke select on public.app_sessions from anon; set role anon");
      try {
        await assert.rejects(read("account-b"), { code: "42501" });
      } finally {
        await db.exec("reset role");
      }
    });

    await t.test("leaves all session rows unchanged after repeated reads", async () => {
      const checksum = async () => (await db.query(`
        select count(*)::integer as count,
          md5(string_agg(row_to_json(s)::text, '' order by id)) as checksum
        from public.app_sessions s
      `)).rows[0];
      const before = await checksum();
      for (const timezone of ["UTC", "Asia/Tokyo", "America/Los_Angeles"]) {
        await read("long-history", timezone);
      }
      assert.deepEqual(await checksum(), before);
      assert.equal(before.count, 31218);
    });
  } finally {
    await db.close();
  }
});
