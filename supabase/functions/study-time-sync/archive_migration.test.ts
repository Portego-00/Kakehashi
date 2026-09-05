import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(
    __dirname,
    "../../migrations/20260831000000_archive_unverified_study_time_days.sql",
  ),
  "utf8",
);

describe("unverified study-time archive migration", () => {
  it("locks writers and snapshots every existing unverified row exactly once", () => {
    const writerLock = migration.indexOf(
      "lock table public.study_time_days in share row exclusive mode",
    );
    const archiveTable = migration.indexOf(
      "create table if not exists public.study_time_days_unverified_archive",
    );
    const initialSnapshot = migration.indexOf(
      "insert into public.study_time_days_unverified_archive",
    );
    const archiveTrigger = migration.indexOf(
      "create trigger archive_study_time_day_before_verification",
    );

    expect(writerLock).toBeGreaterThan(-1);
    expect(archiveTable).toBeGreaterThan(writerLock);
    expect(initialSnapshot).toBeGreaterThan(archiveTable);
    expect(archiveTrigger).toBeGreaterThan(initialSnapshot);
    expect(migration).toMatch(
      /from public\.study_time_days as source\s+where not source\.verified or source\.verified_at is null/,
    );
    expect(migration).toMatch(
      /select\s+source\.user_id,\s+source\.device_id,\s+source\.day,\s+to_jsonb\(source\)/,
    );
    expect(migration).toMatch(
      /on conflict \(user_id, device_id, day, snapshot_fingerprint\)\s+do nothing/,
    );
  });

  it("archives the exact conflicting row before an unverified row becomes verified", () => {
    expect(migration).toContain(
      "create or replace function public.archive_study_time_day_before_verification()",
    );
    expect(migration).toMatch(/snapshot := to_jsonb\(old\)/);
    expect(migration).toMatch(
      /if \(not old\.verified or old\.verified_at is null\)\s+and new\.verified and new\.verified_at is not null/,
    );
    expect(migration).toMatch(
      /create trigger archive_study_time_day_before_verification\s+before update on public\.study_time_days\s+for each row/,
    );
  });

  it("locks the archive to append-only use and never deletes live timing rows", () => {
    expect(migration).toContain(
      "alter table public.study_time_days_unverified_archive enable row level security",
    );
    expect(migration).toMatch(
      /revoke all on public\.study_time_days_unverified_archive\s+from public, anon, authenticated/,
    );
    expect(migration).toContain(
      "create or replace function public.reject_study_time_archive_mutation()",
    );
    expect(migration).toMatch(
      /create trigger reject_study_time_archive_update_or_delete\s+before update or delete on public\.study_time_days_unverified_archive/,
    );
    expect(migration).toMatch(
      /create trigger reject_study_time_archive_truncate\s+before truncate on public\.study_time_days_unverified_archive/,
    );
    expect(migration).not.toMatch(
      /\bdelete\s+from\s+public\.study_time_days\b/i,
    );
    expect(migration).not.toMatch(
      /\btruncate\s+(?:table\s+)?public\.study_time_days\b/i,
    );
  });

  it("does not redefine either existing study-time write function", () => {
    expect(migration).not.toContain(
      "create or replace function public.upsert_study_time_days(rows jsonb)",
    );
    expect(migration).not.toContain(
      "create or replace function public.upsert_verified_study_time_days(rows jsonb)",
    );
  });
});
