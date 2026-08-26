import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(
    __dirname,
    "../../migrations/20260826000000_verified_study_time_sync.sql",
  ),
  "utf8",
);

describe("verified study-time storage migration", () => {
  it("quarantines legacy anonymous rows and defaults direct rows to unverified", () => {
    expect(migration).toContain(
      "add column if not exists verified boolean not null default false",
    );
    expect(migration).toContain(
      "add column if not exists verified_at timestamptz",
    );
    expect(migration).toMatch(
      /update public\.study_time_days\s+set verified = false\s+where verified_at is null/,
    );
    expect(migration).not.toMatch(
      /set verified = true\s+where not verified/,
    );
    expect(migration).toContain("where not study_time_days.verified");
    expect(migration).toMatch(/updated_at, verified\)\s+select[\s\S]*?false/);
  });

  it("keeps verified writes behind a service-role-only function", () => {
    expect(migration).toContain(
      "create or replace function public.upsert_verified_study_time_days(rows jsonb)",
    );
    expect(migration).toContain(
      "revoke all on function public.upsert_verified_study_time_days(jsonb) from public",
    );
    expect(migration).toContain(
      "revoke all on function public.upsert_verified_study_time_days(jsonb) from anon, authenticated",
    );
    expect(migration).toContain(
      "grant execute on function public.upsert_verified_study_time_days(jsonb) to service_role",
    );
    expect(migration).not.toMatch(
      /grant execute on function public\.upsert_verified_study_time_days\(jsonb\) to (?:anon|authenticated)/,
    );
  });

  it("marks server-authenticated rows verified and merges absolute activity totals monotonically", () => {
    expect(migration).toContain("public.merge_study_time_activity_ms(");
    expect(migration).toContain("greatest(");
    expect(migration).toMatch(/updated_at, verified\)\s+select[\s\S]*?true/);
    expect(migration).toContain("verified = true");
    expect(migration).toContain(
      "study_time_days.verified and study_time_days.verified_at is not null",
    );
    expect(migration).toContain(
      "verified_at = coalesce(study_time_days.verified_at, excluded.verified_at)",
    );
  });

  it("indexes the verified account-history read path", () => {
    expect(migration).toContain(
      "drop index if exists public.study_time_days_verified_user_day_idx",
    );
    expect(migration).toContain("study_time_days_verified_user_day_idx");
    expect(migration).toMatch(
      /on public\.study_time_days \(user_id, day\)\s+where verified and verified_at is not null/,
    );
  });
});
