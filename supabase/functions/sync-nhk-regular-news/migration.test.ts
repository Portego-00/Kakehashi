import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(
    __dirname,
    "../../migrations/20260822182000_harden_nhk_regular_news_sync.sql",
  ),
  "utf8",
);

describe("NHK ingestion corrective migration", () => {
  it("relaxes required non-contract legacy columns without naming one prototype", () => {
    expect(migration).toContain("column_name <> all (contract_columns)");
    expect(migration).toContain("is_nullable = 'NO'");
    expect(migration).toContain("column_default is null");
    expect(migration).toContain("alter column %I drop not null");
    expect(migration).toContain("Legacy primary-key column");
  });

  it("queues cron HTTP calls with an explicit sub-idle-limit timeout", () => {
    expect(migration).toContain("timeout_milliseconds := $4");
    expect(migration).toMatch(/'\{\}'::jsonb,\s+140000;/);
  });
});
