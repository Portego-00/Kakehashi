import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(
    __dirname,
    "../../migrations/20260908230000_study_time_direct_rpc.sql",
  ),
  "utf8",
);

describe("short-lived study-time RPC sessions migration", () => {
  it("stores only hashes of random short-lived capabilities", () => {
    const sessionTable = migration.match(
      /create unlogged table if not exists private\.study_time_sessions\s*\(([\s\S]*?)\n\);/i,
    )?.[1];

    expect(sessionTable).toBeDefined();
    expect(migration).toContain(
      "create extension if not exists http with schema extensions",
    );
    expect(migration).toContain(
      "create unlogged table if not exists private.study_time_sessions",
    );
    expect(migration).toContain("session_token_hash bytea primary key");
    expect(migration).toContain("extensions.gen_random_bytes(32)");
    expect(migration).toContain("extensions.digest(");
    expect(migration).toContain("interval '5 minutes'");
    expect(migration).toContain("'user', pg_catalog.jsonb_build_object(");
    expect(sessionTable).not.toMatch(
      /^\s*wani_?kani_token(?:_hash)?\s+[^,)]+/im,
    );
    expect(sessionTable).not.toMatch(
      /^\s*session_token\s+(?:text|varchar|character)/im,
    );
  });

  it("derives identity from WaniKani at a fixed HTTPS endpoint", () => {
    expect(migration).toContain(
      "create or replace function public.create_study_time_session(",
    );
    expect(migration).toContain("'https://api.wanikani.com/v2/user'");
    expect(migration).toContain("'Authorization', 'Bearer ' || wani_kani_token");
    expect(migration).toContain("'Wanikani-Revision', '20170710'");
    expect(migration).toContain("http.curlopt_connecttimeout_ms");
    expect(migration).toContain("http.curlopt_timeout_ms");
    expect(migration).toMatch(/identity_payload\s*#>>\s*'\{data,id\}'/);
    expect(migration).toMatch(/identity_payload\s*#>>\s*'\{data,username\}'/);
    expect(migration).toMatch(/identity_payload\s*#>>\s*'\{data,level\}'/);
    expect(migration).toContain("verified_user_level is null");
  });

  it("bounds anonymous verification work before making the HTTP request", () => {
    const quota = migration.indexOf(
      "private.take_study_time_session_issue_quota()",
    );
    const concurrency = migration.indexOf(
      "private.acquire_study_time_verification_slot()",
    );
    const httpRequest = migration.indexOf("response := extensions.http(");

    expect(quota).toBeGreaterThan(-1);
    expect(concurrency).toBeGreaterThan(quota);
    expect(httpRequest).toBeGreaterThan(concurrency);
    expect(migration).toContain("'cf-connecting-ip'");
    expect(migration).toContain("'x-forwarded-for'");
    expect(migration).toContain("pg_try_advisory_xact_lock");
    expect(migration).toContain("pg_catalog.get_byte(source_key, 0) % 16");
    expect(migration).toContain("private.study_time_session_issue_limits");
    expect(migration).toContain("interval '10 minutes'");
    expect(migration).toContain("return private.study_time_rpc_error('rate_limited')");
  });

  it("binds the verified identity and device to sync without trusting either from the caller", () => {
    expect(migration).toContain(
      "create or replace function public.sync_study_time_days(\n  session_token text,\n  days jsonb\n)",
    );
    expect(migration).not.toMatch(
      /public\.sync_study_time_days\([^)]*(?:user_id|device_id)/,
    );
    expect(migration).toContain(
      "session := private.consume_study_time_session(session_token)",
    );
    expect(migration).toContain("public.upsert_verified_study_time_days(rows)");
    expect(migration).toContain("'user_id', session.user_id");
    expect(migration).toContain("'device_id', session.device_id");
    expect(migration).toContain("jsonb_array_length(days) > 14");
    expect(migration).toContain("86400000");
    expect(migration).toContain("pg_catalog.octet_length(value::text) > 8");
    expect(migration).toContain("seen_days date[]");
    expect(migration).toContain("parsed_day = any(seen_days)");
    expect(migration).toContain("study_total_ms <> computed_study_total_ms");
  });

  it("returns only verified other-device history for the capability account", () => {
    expect(migration).toContain(
      "create or replace function public.get_study_time_history(session_token text)",
    );
    expect(migration).toContain("row.user_id = session.user_id");
    expect(migration).toContain("row.device_id <> session.device_id");
    expect(migration).toContain("row.verified");
    expect(migration).toContain("row.verified_at is not null");
    expect(migration).toContain("interval '430 days'");
    expect(migration).toContain("limit 30001");
    expect(migration).toContain("'byCategoryMs'");
    expect(migration).toContain("order by aggregated.day");
  });

  it("keeps session tables private and exposes only capability-checked RPCs", () => {
    expect(migration).toMatch(
      /alter table private\.study_time_sessions enable row level security/,
    );
    expect(migration).toMatch(
      /revoke all on private\.study_time_sessions from public, anon, authenticated/,
    );
    expect(migration).toMatch(
      /revoke all on function public\.create_study_time_session\(text, text\)\s+from public, anon, authenticated/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.create_study_time_session\(text, text\)\s+to anon, authenticated/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.sync_study_time_days\(text, jsonb\)\s+to anon, authenticated/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.get_study_time_history\(text\)\s+to anon, authenticated/,
    );
  });

  it("is additive and leaves existing timing rows, archive, and writers intact", () => {
    expect(migration).not.toMatch(/\bdrop\s+table\b/i);
    expect(migration).not.toMatch(/\btruncate\b/i);
    expect(migration).not.toMatch(/\bdelete\s+from\s+public\.study_time_days\b/i);
    expect(migration).not.toContain(
      "create or replace function public.upsert_study_time_days(rows jsonb)",
    );
    expect(migration).not.toContain(
      "create or replace function public.upsert_verified_study_time_days(rows jsonb)",
    );
    expect(migration).not.toContain("study_time_days_unverified_archive");
  });
});
