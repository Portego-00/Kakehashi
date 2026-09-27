import { buildCriticalWidgetSnapshot } from "../criticalWidgetData";

const subject = (id: number) => ({
  id,
  object: "kanji" as const,
  data: {
    characters: "橋",
    meanings: [{ meaning: "bridge", primary: true }],
    readings: [{ reading: "きょう", primary: false }, { reading: "はし", primary: true }],
  },
});
const statistic = (id: number, percentage: number) => ({
  data: { subject_id: id, percentage_correct: percentage },
});

describe("critical widget data", () => {
  it.each([
    { percentages: [74, 75, 79, 84, 89], expected: [74] },
    { percentages: [84, 79, 75, 80, 89], expected: [75, 79] },
    { percentages: [89, 84, 80, 85], expected: [80, 84] },
    { percentages: [90, 89, 85, 100], expected: [85, 89] },
    { percentages: [90, 95, 100], expected: [] },
    { percentages: [], expected: [] },
  ])("stops at the first populated threshold for $percentages", ({ percentages, expected }) => {
    const snapshot = buildCriticalWidgetSnapshot(
      percentages.map((percentage, index) => statistic(index, percentage)),
      percentages.map((_, index) => subject(index)),
    );
    expect(snapshot.criticalCount).toBe(expected.length);
    expect(snapshot.criticalItems.map((item) => item.percentage)).toEqual(expected);
    expect(snapshot.topCriticalItem?.percentage ?? null).toBe(expected[0] ?? null);
  });

  it("ignores hidden and missing subjects when choosing a fallback threshold", () => {
    const snapshot = buildCriticalWidgetSnapshot(
      [
        { data: { ...statistic(1, 10).data, hidden: true } },
        statistic(2, 20), statistic(3, 82), statistic(4, 88),
      ],
      [subject(1), subject(3), subject(4)],
    );
    expect(snapshot.criticalCount).toBe(1);
    expect(snapshot.topCriticalItem?.percentage).toBe(82);
  });

  it("uses the critical screen's strict threshold and ranks lowest accuracy first", () => {
    const snapshot = buildCriticalWidgetSnapshot(
      [statistic(1, 74), statistic(2, 75), statistic(3, 20), statistic(4, 100)],
      [1, 2, 3, 4].map(subject),
    );
    expect(snapshot.criticalCount).toBe(2);
    expect(snapshot.criticalItems.map((item) => item.percentage)).toEqual([20, 74]);
    expect(snapshot.topCriticalItem).toMatchObject({ reading: "はし", meaning: "bridge" });
  });

  it("counts the full list while limiting the native payload to three items", () => {
    const ids = Array.from({ length: 15 }, (_, index) => index + 1);
    const snapshot = buildCriticalWidgetSnapshot(ids.map((id) => statistic(id, id)), ids.map(subject));
    expect(snapshot.criticalCount).toBe(15);
    expect(snapshot.criticalItems.map((item) => item.percentage)).toEqual([1, 2, 3]);
  });

  it("excludes hidden, missing, and invalid statistics", () => {
    const hiddenSubject = subject(2);
    const snapshot = buildCriticalWidgetSnapshot(
      [
        { data: { ...statistic(1, 10).data, hidden: true } },
        statistic(2, 10), statistic(3, Number.NaN), statistic(4, -1), statistic(5, 10),
      ],
      [subject(1), { ...hiddenSubject, data: { ...hiddenSubject.data, hidden_at: "2026-01-01" } }, subject(3), subject(4)],
    );
    expect(snapshot).toEqual({ criticalCount: 0, criticalItems: [], topCriticalItem: null });
  });

  it("supports radicals without characters or readings and kana-only vocabulary", () => {
    const snapshot = buildCriticalWidgetSnapshot([statistic(1, 0), statistic(2, 10)], [
      { id: 1, object: "radical", data: { characters: null, meanings: [{ meaning: "gun", primary: true }] } },
      { id: 2, object: "kana_vocabulary", data: { characters: "こんにちは", meanings: [{ meaning: "hello", primary: true }] } },
    ]);
    expect(snapshot.criticalItems).toMatchObject([
      { characters: null, meaning: "gun", reading: "" },
      { characters: "こんにちは", meaning: "hello", reading: "" },
    ]);
  });
});
