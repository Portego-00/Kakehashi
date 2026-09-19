import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Assignment, Subject } from "@/types/wanikani";
import { calculateAnalyticsInsights, type AnalyticsInsights, type DifficultItem } from "../analytics-insights";
import { difficultItemsCsv, LeechesWidget, scoreDifficultItem } from "../components/AnalyticsLeeches";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function subject(id: number, meaning: string, characters: string, reading: string, object: Subject["object"] = "kanji"): Subject {
  return {
    id, object, url: "", data_updated_at: "2026-09-01T00:00:00Z",
    data: { level: 1, slug: characters, characters, created_at: "2026-09-01T00:00:00Z", document_url: "", hidden_at: null, meanings: [{ meaning, primary: true, accepted_answer: true }], auxiliary_meanings: [], readings: reading ? [{ reading, type: "kunyomi", primary: true, accepted_answer: true }] : [] },
  };
}

function difficultItem(subject: Subject, score: number, stage = 1): DifficultItem {
  const assignment: Assignment = { id: subject.id, object: "assignment", url: "", data_updated_at: "2026-09-01T00:00:00Z", data: { subject_id: subject.id, subject_type: subject.object, srs_stage: stage, available_at: null, started_at: "2026-09-01T00:00:00Z", unlocked_at: "2026-09-01T00:00:00Z", passed_at: null, burned_at: null, resurrected_at: null, hidden: false, created_at: "2026-09-01T00:00:00Z" } };
  return { subject, assignment, score, errors: score * 2, accuracy: 90 - score, meaningAccuracy: 90 - score, readingAccuracy: 90, weakest: "meaning", meaningStreak: 1, readingStreak: 2 };
}

function insights(items: DifficultItem[]): AnalyticsInsights {
  return { ...calculateAnalyticsInsights({ assignments: [], subjects: [], statistics: [], progressions: [], now: new Date("2026-09-10T12:00:00Z") }), difficultItems: items };
}

const river = subject(1, "River", "川", "かわ");
const mountain = subject(2, "Mountain", "山", "やま");
const ground = subject(3, "Ground", "一", "", "radical");

function chooseTypedPractice() {
  fireEvent.click(screen.getByText("Practice options"));
  fireEvent.click(screen.getByRole("button", { name: "Type answers" }));
}

describe("difficult item analytics", () => {
  it("shows five compact rows, retains full paging and keeps practice visible while settings are closed", () => {
    const items = Array.from({ length: 8 }, (_, index) => difficultItem(subject(index + 10, `Item ${index + 1}`, "川", "かわ"), 10 - index));
    render(<LeechesWidget insights={insights(items)} />);
    expect(screen.getAllByRole("row")).toHaveLength(6);
    expect(screen.getByText("1-5 of 8 items")).toBeVisible();
    expect(screen.getByRole("button", { name: "Practice 8" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Type answers" })).not.toBeVisible();
    expect(screen.getByRole("combobox", { name: "SRS stage" })).not.toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next difficult items" }));
    expect(screen.getAllByRole("row")).toHaveLength(4);
    expect(screen.getByText("6-8 of 8 items")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Previous difficult items" }));
    expect(screen.getByText("1-5 of 8 items")).toBeVisible();
    chooseTypedPractice();
    expect(screen.getByRole("button", { name: "Type answers" })).toBeVisible();
    fireEvent.click(screen.getByText("Practice options"));
    fireEvent.click(screen.getByRole("button", { name: "Practice 8" }));
    expect(within(screen.getByRole("dialog")).getByRole("textbox", { name: "Meaning" })).toBeVisible();
  });

  it("filters by search, subject type and SRS stage and practices the matching selection", () => {
    render(<LeechesWidget insights={insights([difficultItem(river, 5), difficultItem(mountain, 10, 5), difficultItem(ground, 2)])} />);
    fireEvent.click(screen.getByText("Filters"));
    fireEvent.change(screen.getByRole("combobox", { name: "SRS stage" }), { target: { value: "Guru" } });
    expect(screen.getByRole("button", { name: "Practice 1" })).toBeEnabled();
    expect(screen.queryByRole("link", { name: /River/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Subject type" }), { target: { value: "radical" } });
    expect(screen.getByRole("button", { name: "Practice 0" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search difficult items" }), { target: { value: "かわ" } });
    fireEvent.click(screen.getByRole("button", { name: "Practice 1" }));
    const dialog = screen.getByRole("dialog", { name: "Difficult item practice" });
    expect(within(dialog).getByText("川")).toBeInTheDocument();
    expect(within(dialog).queryByText("River")).not.toBeInTheDocument();
  });

  it("reveals flashcards, requeues Again items and completes without network writes", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<LeechesWidget insights={insights([difficultItem(river, 5)])} />);
    fireEvent.click(screen.getByRole("button", { name: "Practice 1" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Reveal answer" }));
    expect(within(dialog).getByText("River")).toBeInTheDocument();
    expect(within(dialog).getByText("かわ")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Again" }));
    expect(within(dialog).queryByText("River")).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Reveal answer" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Know" }));
    expect(within(dialog).getByRole("heading", { name: "Practice complete" })).toBeInTheDocument();
    expect(within(dialog).getByText("50%")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Practice missed items" }));
    expect(within(dialog).getByRole("progressbar")).toHaveAttribute("value", "0");
  });

  it("uses the shared checker for meaning and reading with live kana composition", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<LeechesWidget insights={insights([difficultItem(river, 5)])} />);
    chooseTypedPractice();
    fireEvent.click(screen.getByRole("button", { name: "Practice 1" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Meaning" }), { target: { value: "river" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Check" }));
    expect(within(dialog).getByRole("status")).toHaveTextContent("Correct");
    fireEvent.click(within(dialog).getByRole("button", { name: "Next" }));
    const input = within(dialog).getByRole("textbox", { name: "Reading" });
    fireEvent.change(input, { target: { value: "kawa" } });
    expect(input).toHaveValue("かわ");
    fireEvent.click(within(dialog).getByRole("button", { name: "Check" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Next" }));
    expect(within(dialog).getByRole("heading", { name: "Practice complete" })).toBeInTheDocument();
    expect(within(dialog).getByText("100%")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps wrong-kind answers editable and repeats an incorrect meaning after the reading", () => {
    render(<LeechesWidget insights={insights([difficultItem(river, 5)])} />);
    chooseTypedPractice();
    fireEvent.click(screen.getByRole("button", { name: "Practice 1" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Meaning" }), { target: { value: "かわ" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Check" }));
    expect(within(dialog).getByRole("status")).toHaveTextContent("Try another answer");
    expect(within(dialog).getByRole("textbox", { name: "Meaning" })).not.toHaveAttribute("readonly");
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Meaning" }), { target: { value: "mountain" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Check" }));
    expect(within(dialog).getByRole("status")).toHaveTextContent("Incorrect");
    fireEvent.click(within(dialog).getByRole("button", { name: "Next" }));
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Reading" }), { target: { value: "kawa" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Check" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Next" }));
    expect(within(dialog).getByRole("textbox", { name: "Meaning" })).toHaveValue("");
    expect(within(dialog).getByRole("progressbar")).toHaveAttribute("value", "1");
  });

  it("keeps radical practice meaning-only and restores focus after closing", () => {
    render(<LeechesWidget insights={insights([difficultItem(ground, 5)])} />);
    chooseTypedPractice();
    const start = screen.getByRole("button", { name: "Practice 1" });
    start.focus();
    fireEvent.click(start);
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Meaning" }), { target: { value: "ground" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Check" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Next" }));
    expect(within(dialog).getByRole("heading", { name: "Practice complete" })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(start).toHaveFocus();
  });

  it("supports meaning-only practice and clears a partially entered answer when the question mode changes", () => {
    render(<LeechesWidget insights={insights([difficultItem(river, 5)])} />);
    chooseTypedPractice();
    fireEvent.click(screen.getByRole("button", { name: "Practice 1" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Meaning" }), { target: { value: "unfinished answer" } });
    fireEvent.click(within(within(dialog).getByRole("group", { name: "Practice questions" })).getByRole("button", { name: "Meaning" }));
    expect(within(dialog).getByRole("textbox", { name: "Meaning" })).toHaveValue("");
    expect(within(dialog).getByRole("progressbar")).toHaveAttribute("max", "1");
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Meaning" }), { target: { value: "river" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Check" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Next" }));
    expect(within(dialog).getByRole("heading", { name: "Practice complete" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("textbox", { name: "Reading" })).not.toBeInTheDocument();
  });

  it("skips radicals, kana vocabulary and items without readings in reading-only practice", () => {
    const kana = subject(4, "Yes", "はい", "", "kana_vocabulary");
    const noReading = subject(5, "Unknown reading", "語", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<LeechesWidget insights={insights([difficultItem(ground, 10), difficultItem(kana, 9), difficultItem(noReading, 8), difficultItem(river, 5)])} />);
    chooseTypedPractice();
    fireEvent.click(screen.getByRole("button", { name: "Practice 4" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(within(dialog).getByRole("group", { name: "Practice questions" })).getByRole("button", { name: "Reading" }));
    expect(within(dialog).getByText("Reading only · 1 item · Practice only")).toBeInTheDocument();
    expect(within(dialog).getByRole("progressbar")).toHaveAttribute("max", "1");
    expect(within(dialog).getByText("川")).toBeInTheDocument();
    const answer = within(dialog).getByRole("textbox", { name: "Reading" });
    fireEvent.change(answer, { target: { value: "kawa" } });
    expect(answer).toHaveValue("かわ");
    fireEvent.click(within(dialog).getByRole("button", { name: "Check" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Next" }));
    expect(within(dialog).getByRole("heading", { name: "Practice complete" })).toBeInTheDocument();
    expect(within(dialog).getByText("100%")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("clears previous mistakes and progress when changing the question mode", () => {
    render(<LeechesWidget insights={insights([difficultItem(river, 5)])} />);
    chooseTypedPractice();
    fireEvent.click(screen.getByRole("button", { name: "Practice 1" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Meaning" }), { target: { value: "mountain" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Check" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Next" }));
    fireEvent.click(within(within(dialog).getByRole("group", { name: "Practice questions" })).getByRole("button", { name: "Reading" }));
    expect(within(dialog).getByRole("progressbar")).toHaveAttribute("value", "0");
    expect(within(dialog).getByRole("progressbar")).toHaveAttribute("max", "1");
    expect(within(dialog).getByRole("textbox", { name: "Reading" })).toHaveValue("");
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Reading" }), { target: { value: "kawa" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Check" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Next" }));
    expect(within(dialog).getByText("100%")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Practice missed items" })).not.toBeInTheDocument();
  });

  it("shows an empty reading selection without claiming a completed practice session", () => {
    render(<LeechesWidget insights={insights([difficultItem(ground, 5)])} />);
    chooseTypedPractice();
    fireEvent.click(screen.getByRole("button", { name: "Practice 1" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(within(dialog).getByRole("group", { name: "Practice questions" })).getByRole("button", { name: "Reading" }));
    expect(within(dialog).getByRole("heading", { name: "No reading prompts" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("heading", { name: "Practice complete" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Practice meanings" }));
    expect(within(dialog).getByRole("textbox", { name: "Meaning" })).toHaveValue("");
    expect(within(dialog).getByRole("textbox", { name: "Meaning" })).toHaveFocus();
  });

  it("combines minimum mistakes, weakest answer and burned visibility", () => {
    const readingItem = { ...difficultItem(mountain, 12, 9), weakest: "reading" as const };
    render(<LeechesWidget expanded insights={insights([difficultItem(river, 5), readingItem, difficultItem(ground, 1)])} />);
    expect(screen.queryByRole("link", { name: /Mountain/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Hide burned items" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Minimum mistakes" }), { target: { value: "15" } });
    expect(screen.getByRole("button", { name: "Practice 1" })).toBeEnabled();
    expect(screen.getByRole("link", { name: /Mountain/ })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Weakest answer" }), { target: { value: "meaning" } });
    expect(screen.getByRole("button", { name: "Practice 0" })).toBeDisabled();
  });

  it("separates weighted mistakes from current-streak struggle and keeps the weakest answer accurate", () => {
    const recovered = { ...difficultItem(river, 20), meaningStreak: 30, readingStreak: 30 };
    const struggling = { ...difficultItem(mountain, 5), meaningStreak: 0, readingStreak: 10 };
    expect(scoreDifficultItem(recovered, "weighted")).toBe(recovered);
    expect(scoreDifficultItem(struggling, "recent")).toMatchObject({ score: 15, weakest: "meaning" });
    const radical = { ...difficultItem(ground, 10), readingAccuracy: null, readingStreak: null, meaningStreak: 4 };
    expect(scoreDifficultItem(radical, "recent")).toMatchObject({ score: 4, weakest: "meaning" });
    render(<LeechesWidget expanded insights={insights([recovered, struggling])} />);
    expect(within(screen.getAllByRole("row")[1]).getByRole("link")).toHaveTextContent("River");
    fireEvent.change(screen.getByRole("combobox", { name: "Scoring method" }), { target: { value: "recent" } });
    expect(within(screen.getAllByRole("row")[1]).getByRole("link")).toHaveTextContent("Mountain");
    expect(screen.getByText("Recent struggle uses current answer streaks, not dated review history.")).toBeInTheDocument();
    expect(screen.getByTitle(/lifetime error percentage/)).toBeInTheDocument();
  });

  it("filters never-passed Apprentice items and ranks the oldest lesson before higher-scored recent items", () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-09-10T00:00:00Z"));
    const oldest = difficultItem(river, 1, 4);
    oldest.assignment!.data.started_at = "2026-08-01T00:00:00Z";
    const newer = difficultItem(mountain, 20, 1);
    const demoted = difficultItem(ground, 50, 2);
    demoted.assignment!.data.passed_at = "2026-09-02T00:00:00Z";
    const notStarted = difficultItem(subject(4, "Not started", "火", "ひ"), 30, 0);
    notStarted.assignment!.data.started_at = null;
    const guru = difficultItem(subject(5, "Guru item", "木", "き"), 30, 5);
    render(<LeechesWidget expanded insights={insights([newer, demoted, oldest, notStarted, guru])} />);
    fireEvent.click(screen.getByRole("button", { name: "Stuck in Apprentice" }));
    expect(screen.getByRole("checkbox", { name: "Never passed Guru" })).toBeChecked();
    expect(screen.getByRole("combobox", { name: "Sort difficult items" })).toHaveValue("stuck");
    expect(screen.getByRole("spinbutton", { name: "Minimum mistakes" })).toHaveValue(1);
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByRole("link")).toHaveTextContent("River");
    expect(within(rows[0]).getByText("40 days since lesson")).toBeInTheDocument();
    expect(within(rows[1]).getByRole("link")).toHaveTextContent("Mountain");
    expect(screen.queryByRole("link", { name: /Ground|Not started|Guru item/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByRole("checkbox", { name: "Never passed Guru" })).not.toBeChecked();
    expect(screen.getByRole("combobox", { name: "Scoring method" })).toHaveValue("weighted");
  });

  it("practices a similar pair even when the other subject is not a difficult item", () => {
    const related = { ...river, data: { ...river.data, visually_similar_subject_ids: [mountain.id] } };
    render(<LeechesWidget insights={insights([difficultItem(related, 5)])} subjects={[related, mountain]} />);
    fireEvent.click(screen.getByText("Similar-looking kanji"));
    fireEvent.click(screen.getByRole("button", { name: "Practice River and Mountain" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/2 items/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Reveal answer" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Know" }));
    expect(within(dialog).getByText("山")).toBeInTheDocument();
  });

  it("exports quoted Japanese data and neutralizes spreadsheet formulas", () => {
    const item = difficultItem(subject(1, '=HYPERLINK("example")', "川", "かわ"), 5);
    const csv = difficultItemsCsv([item]);
    expect(csv).toContain('"川"');
    expect(csv).toContain('"かわ"');
    expect(csv).toContain('"\'=HYPERLINK(""example"")"');
    expect(csv.split("\r\n")).toHaveLength(2);
    const recent = difficultItemsCsv([scoreDifficultItem(item, "recent")], "recent", Date.parse("2026-09-10T00:00:00Z"));
    expect(recent).toContain('"Scoring method","Lesson date","First passed Guru","Days since lesson"');
    expect(recent).toContain('"recent","2026-09-01T00:00:00Z","","9"');
  });
});
