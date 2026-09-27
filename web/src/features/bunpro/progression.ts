const stages = ["Beginner 1", "Beginner 2", "Beginner 3", "Adept 1", "Adept 2", "Adept 3", "Seasoned 1", "Seasoned 2", "Seasoned 3", "Expert 1", "Expert 2", "Master"];
type RecordValue = Record<string, unknown>;
function record(value: unknown): RecordValue { return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {}; }
function sources(value: unknown) {
  const root = record(value);
  const data = record(root.data);
  const updated = record(root.updated_review);
  const review = record(root.review);
  return [updated, record(updated.attributes), record(record(updated.data).attributes), root, data, record(data.attributes), review, record(review.attributes), record(record(review.data).attributes)];
}
export function bunproStage(value: unknown) {
  const labels = ["new_srs_stage_name", "srs_stage_name", "next_srs_stage_name", "new_stage_name", "stage_name", "new_level_name", "level_name"];
  const numbers = ["new_srs_stage", "srs_stage", "next_srs_stage", "new_stage", "stage", "new_level", "level", "streak"];
  const rows = sources(value);
  let label: string | undefined;
  let number: number | undefined;
  for (const row of rows) {
    label = labels.map((key) => row[key]).find((candidate): candidate is string => typeof candidate === "string" && Boolean(candidate.trim()));
    number = numbers.map((key) => row[key]).find((candidate): candidate is number => typeof candidate === "number" && Number.isFinite(candidate));
    if (label || number !== undefined) break;
  }
  return { number, label: label || (number === undefined ? "" : number === 0 ? "Beginner 0" : stages[number - 1] ?? `Stage ${number}`) };
}
export type BunproProgression = { id: string; title: string; from: string; to: string; direction: "up" | "down" | "same" | "unknown"; nextReview: string };
export function bunproProgression(id: string, title: string, previous: unknown, response: unknown, now = Date.now()): BunproProgression {
  const from = bunproStage(previous);
  const to = bunproStage(response);
  const next = sources(response).flatMap((row) => [row.next_review, row.next_review_at]).find((value): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)));
  const minutes = next ? Math.max(0, Math.ceil((Date.parse(next) - now) / 60_000)) : null;
  const interval = minutes === null ? "" : minutes === 0 ? "now" : minutes < 60 ? `in ${minutes}m` : minutes < 1440 ? `in ${Math.ceil(minutes / 60)}h` : `in ${Math.ceil(minutes / 1440)}d`;
  return { id, title, from: from.label, to: to.label, direction: from.number === undefined || to.number === undefined ? "unknown" : to.number > from.number ? "up" : to.number < from.number ? "down" : "same", nextReview: interval };
}
