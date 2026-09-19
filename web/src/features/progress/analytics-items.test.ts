import { describe, expect, it } from "vitest";
import { DEFAULT_SEARCH_FILTERS } from "@/features/subjects/search";
import { filterAnalyticsItems, type AnalyticsItemFilters } from "./analytics-items";
import { testAssignment, testSubject } from "./analytics-test-fixtures";

const now = new Date(2026, 8, 10, 12);
const filters: AnalyticsItemFilters = { ...DEFAULT_SEARCH_FILTERS, substage: null, due: "all", reading: "", sort: "level" };
describe("analytics item filters", () => {
  it("distinguishes overdue, later today, tomorrow and burned items", () => {
    const subjects = [1, 2, 3, 4].map((id) => testSubject(id));
    const assignments = [
      testAssignment(1, { available_at: new Date(2026, 8, 9).toISOString() }),
      testAssignment(2, { available_at: new Date(2026, 8, 10, 22).toISOString() }),
      testAssignment(3, { available_at: new Date(2026, 8, 11).toISOString() }),
      testAssignment(4, { srs_stage: 9, available_at: now.toISOString() }),
    ];
    expect(filterAnalyticsItems(subjects, assignments, { ...filters, due: "now" }, now).map((row) => row.subject.id)).toEqual([1]);
    expect(filterAnalyticsItems(subjects, assignments, { ...filters, due: "today" }, now).map((row) => row.subject.id)).toEqual([1, 2]);
  });
  it("combines exact substages with reading, type, and part of speech", () => {
    const subject = testSubject(1, "vocabulary", { characters: "日本", readings: [{ reading: "にほん", primary: true, accepted_answer: true }], parts_of_speech: ["proper noun"] });
    const assignment = testAssignment(1, { subject_type: "vocabulary", srs_stage: 6 });
    expect(filterAnalyticsItems([subject], [assignment], { ...filters, reading: "nihon", types: ["vocabulary"], substage: 6, vocabularyTypes: ["proper noun"] }, now)).toHaveLength(1);
    expect(filterAnalyticsItems([subject], [assignment], { ...filters, substage: 5 }, now)).toHaveLength(0);
  });
  it("never exposes hidden assignments as unstarted items", () => {
    expect(filterAnalyticsItems([testSubject(1)], [testAssignment(1, { hidden: true })], filters, now)).toHaveLength(0);
  });
});
