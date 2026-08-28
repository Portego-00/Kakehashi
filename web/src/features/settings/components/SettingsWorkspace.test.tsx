import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DASHBOARD_SECTIONS, DEFAULT_WEB_SETTINGS, settingsStorageKey } from "../settings";
import { JapaneseVoiceDownloadSetting, SettingsWorkspace } from "./SettingsWorkspace";

const voiceMock = vi.hoisted(() => ({
  checked: true,
  supported: true,
  downloaded: true,
  activity: "idle" as "idle" | "downloading" | "synthesizing" | "playing",
  progress: null as number | null,
  message: null as string | null,
  error: null as string | null,
  download: vi.fn(),
  cancelDownload: vi.fn(),
}));
const sessionMock = vi.hoisted(() => ({
  user: { data: { username: "Tester" } },
  signOut: vi.fn<() => Promise<void>>(),
}));
const routerMock = vi.hoisted(() => ({
  replace: vi.fn<(href: string) => void>(),
}));

vi.mock("@/lib/session", () => ({
  useSession: () => sessionMock,
}));

vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));

vi.mock("@/lib/theme", () => ({
  useTheme: () => ({ theme: "light", resolvedTheme: "light", setTheme: vi.fn() }),
}));

vi.mock("@/features/anime/AnimePicker", () => ({ AnimePicker: () => null }));
vi.mock("@/features/dashboard/DashboardWidgetPreview", () => ({ DashboardWidgetPreview: ({ id }: { id: string }) => <div data-widget-preview={id} /> }));
vi.mock("@/features/speech/use-japanese-voice", () => ({ useJapaneseVoice: () => voiceMock }));

beforeEach(() => {
  Object.assign(voiceMock, {
    checked: true,
    supported: true,
    downloaded: true,
    activity: "idle",
    progress: null,
    message: null,
    error: null,
  });
  voiceMock.download.mockReset();
  voiceMock.cancelDownload.mockReset();
  sessionMock.signOut.mockReset().mockResolvedValue(undefined);
  routerMock.replace.mockReset();
});

function dataTransfer() {
  const values = new Map<string, string>();
  return {
    effectAllowed: "none",
    getData: (type: string) => values.get(type) ?? "",
    setData: (type: string, value: string) => { values.set(type, value); },
  } as unknown as DataTransfer;
}

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, right: left + width, bottom: top + height, width, height, x: left, y: top, toJSON: () => ({}) } as DOMRect;
}

function fireDrag(element: HTMLElement, type: "dragover" | "drop", clientX: number, clientY: number, transfer: DataTransfer) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, { clientX: { value: clientX }, clientY: { value: clientY }, dataTransfer: { value: transfer } });
  fireEvent(element, event);
}

describe("project support links", () => {
  beforeEach(() => window.localStorage.clear());

  it("links to the GitHub project and Patreon from settings", () => {
    render(<SettingsWorkspace />);

    expect(screen.getAllByRole("heading", { level: 2 }).slice(0, 2).map((heading) => heading.textContent)).toEqual(["Profile", "Support Kakehashi"]);

    const github = screen.getByRole("link", { name: /Star Kakehashi on GitHub/ });
    expect(github).toHaveAttribute("href", "https://github.com/Portego-00/Kakehashi");
    expect(github).toHaveAttribute("target", "_blank");
    expect(github).toHaveAttribute("rel", "noopener noreferrer");
    expect(github).toHaveTextContent("Free");
    expect(github.querySelector("svg")).toBeInTheDocument();

    const patreon = screen.getByRole("link", { name: /Support Kakehashi on Patreon/ });
    expect(patreon).toHaveAttribute("href", "https://www.patreon.com/15731284/join");
    expect(patreon).toHaveAttribute("target", "_blank");
    expect(patreon).toHaveAttribute("rel", "noopener noreferrer");
    expect(patreon).toHaveTextContent("Paid");
  });
});

describe("account sign out", () => {
  beforeEach(() => window.localStorage.clear());

  it("places sign out at the bottom of settings and returns to login", async () => {
    render(<SettingsWorkspace />);

    const accountHeading = screen.getByRole("heading", { level: 2, name: "Account" });
    const accountSection = accountHeading.closest("section");
    expect(accountSection).toBe(document.querySelector("main > section:last-child"));

    fireEvent.click(within(accountSection!).getByRole("button", { name: "Sign out" }));

    expect(sessionMock.signOut).toHaveBeenCalledOnce();
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith("/login"));
  });

  it("keeps the action available and explains when sign out fails", async () => {
    sessionMock.signOut.mockRejectedValueOnce(new Error("Sign out is temporarily unavailable."));
    render(<SettingsWorkspace />);

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Sign out is temporarily unavailable.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });
});

describe("listening preferences", () => {
  beforeEach(() => window.localStorage.clear());

  it("persists whether listening translations are shown", () => {
    render(<SettingsWorkspace />);

    const toggle = screen.getByRole("checkbox", { name: /Show listening translation control/ });
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);

    expect(toggle).not.toBeChecked();
    expect(JSON.parse(window.localStorage.getItem(settingsStorageKey("Tester")) ?? "{}").study.showListeningTranslation).toBe(false);
  });
});

describe("navbar tab preferences", () => {
  beforeEach(() => window.localStorage.clear());

  it("exposes all candidates and persists any number of selected tabs", () => {
    render(<SettingsWorkspace />);

    const heading = screen.getByRole("heading", { level: 3, name: "Desktop navbar tabs" });
    const card = heading.parentElement?.parentElement;
    expect(card).not.toBeNull();
    const navbar = within(card!);
    const moreHeading = navbar.getByRole("heading", { level: 3, name: "More menu" });
    const navbarCheckboxes: HTMLInputElement[] = [];
    let row = heading.parentElement?.nextElementSibling;
    while (row && row !== moreHeading.parentElement) {
      const checkbox = row.querySelector<HTMLInputElement>('input[type="checkbox"]');
      if (checkbox) navbarCheckboxes.push(checkbox);
      row = row.nextElementSibling;
    }
    expect(navbarCheckboxes).toHaveLength(9);
    const [home, level, items, analytics, news, books, video, manga, songs] = navbarCheckboxes;
    for (const [checkbox, name] of navbarCheckboxes.map((checkbox, index) => [checkbox, ["Home", "Level", "Items", "Analytics", "News", "Books", "Video", "Manga", "Songs"][index]] as const)) {
      expect(checkbox).toHaveAccessibleName(new RegExp(`^${name}`));
    }
    for (const required of [home, level]) {
      expect(required).toBeChecked();
      expect(required).toBeDisabled();
    }
    for (const selected of [news, video, manga, songs]) expect(selected).toBeChecked();
    for (const optional of [items, analytics, books]) {
      expect(optional).not.toBeChecked();
      expect(optional).toBeEnabled();
      fireEvent.click(optional);
      expect(optional).toBeChecked();
    }
    expect(JSON.parse(window.localStorage.getItem(settingsStorageKey("Tester")) ?? "{}").workspace.navbarTabs).toEqual([
      "home", "level", "items", "analytics", "news", "epubs", "video", "manga", "music",
    ]);
  });

  it("refreshes the controls when another browser tab changes the saved navbar", async () => {
    render(<SettingsWorkspace />);
    const key = settingsStorageKey("Tester");
    const items = screen.getByRole("checkbox", { name: /^Items.*Browse radicals/ });
    const news = screen.getByRole("checkbox", { name: /^News.*NHK Easier/ });

    window.localStorage.setItem(key, JSON.stringify({
      ...DEFAULT_WEB_SETTINGS,
      workspace: { ...DEFAULT_WEB_SETTINGS.workspace, navbarTabs: ["home", "level", "items"] },
    }));
    fireEvent(window, new StorageEvent("storage", { key }));

    await waitFor(() => expect(items).toBeChecked());
    expect(news).not.toBeChecked();
  });
});

describe("review question preferences", () => {
  beforeEach(() => window.localStorage.clear());

  it("organizes lesson and review settings like the mobile app", () => {
    render(<SettingsWorkspace />);

    const lessonsHeading = screen.getByRole("heading", { level: 2, name: "Lessons" });
    const reviewsHeading = screen.getByRole("heading", { level: 2, name: "Reviews" });
    const lessonsSection = lessonsHeading.closest("section");
    const reviewsSection = reviewsHeading.closest("section");

    expect(lessonsSection).not.toBeNull();
    expect(reviewsSection).not.toBeNull();
    expect(within(lessonsSection!).getByRole("combobox", { name: "Lesson batch size" })).toBeInTheDocument();
    expect(within(lessonsSection!).getByRole("combobox", { name: "Lesson question order" })).toBeInTheDocument();
    expect(within(reviewsSection!).getByRole("heading", { level: 3, name: "Review order" })).toBeInTheDocument();
    expect(within(reviewsSection!).getByRole("heading", { name: "Anki mode" })).toBeInTheDocument();
    expect(within(reviewsSection!).getByText("Used by custom reviews.")).toBeInTheDocument();
    expect(within(reviewsSection!).queryByText(/custom lesson quizzes/i)).not.toBeInTheDocument();

    const studyHeadings = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent)
      .filter((heading) => heading === "Lessons" || heading === "Reviews");
    expect(studyHeadings).toEqual(["Lessons", "Reviews"]);
  });

  it("distinguishes subject ordering from meaning and reading question ordering", () => {
    render(<SettingsWorkspace />);

    const reviewsSection = screen.getByRole("heading", { level: 2, name: "Reviews" }).closest("section");
    expect(reviewsSection).not.toBeNull();
    const reviews = within(reviewsSection!);

    const subjectOrder = reviews.getByRole("combobox", { name: "Review subject order" });
    expect(reviews.queryByRole("combobox", { name: "Review question order" })).not.toBeInTheDocument();
    fireEvent.click(reviews.getByRole("checkbox", { name: /Force meaning\/reading order/i }));
    const questionOrder = reviews.getByRole("combobox", { name: "Review question order" });
    expect(within(subjectOrder).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Random",
      "Lower SRS first",
      "Higher SRS first",
      "Current level first",
      "Lowest level first",
      "Newest available first",
      "Oldest available first",
      "Most overdue first",
    ]);
    const questionOptions = within(questionOrder).getAllByRole("option").map((option) => option.textContent);
    expect(questionOptions).toEqual(expect.arrayContaining(["Meaning first", "Reading first"]));
    expect(questionOptions).not.toEqual(expect.arrayContaining(["All meanings first", "All readings first"]));
    expect(screen.queryByRole("combobox", { name: "Review order" })).not.toBeInTheDocument();
  });

  it("uses the familiar Anki mode name everywhere", () => {
    render(<SettingsWorkspace />);

    expect(screen.getByRole("heading", { name: "Anki mode" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Anki mode" })).toBeInTheDocument();
    expect(screen.queryByText(/Self-assessment cards/i)).not.toBeInTheDocument();
  });

  it("groups the mobile-parity review controls and persists their choices", async () => {
    render(<SettingsWorkspace />);

    expect(await screen.findByRole("heading", { level: 2, name: "Reviews" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: /Show item level & SRS stage/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Show vocabulary frequency/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Vocabulary context sentence hints/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Answer feedback sounds/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Allow skipping reviews/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Accept user synonyms/i }));
    fireEvent.change(screen.getByRole("combobox", { name: /SRS progression/i }), { target: { value: "compact" } });
    fireEvent.change(screen.getByRole("combobox", { name: /Anki mode/i }), { target: { value: "both" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Group meaning and reading/i }));
    fireEvent.change(screen.getByRole("combobox", { name: /Review character size/i }), { target: { value: "1.2" } });
    fireEvent.change(screen.getByRole("combobox", { name: /Review answer size/i }), { target: { value: "0.9" } });

    const study = JSON.parse(window.localStorage.getItem(settingsStorageKey("Tester")) ?? "{}").study;
    expect(study).toMatchObject({
      showReviewItemLevelAndSrsStage: true,
      showVocabularyFrequency: true,
      showVocabContextSentencesInReviews: true,
      answerFeedbackSoundEnabled: false,
      allowSkippingReviews: true,
      acceptUserSynonymsAsAnswers: true,
      srsProgressionCardDisplayMode: "compact",
      ankiMode: "both",
      ankiGroupQuestions: true,
      reviewCharacterFontScale: 1.2,
      reviewInputFontScale: 0.9,
    });
  }, 10_000);

  it("clears grouped grading when Anki mode no longer applies to both question types", async () => {
    render(<SettingsWorkspace />);
    const mode = await screen.findByRole("combobox", { name: /Anki mode/i });

    fireEvent.change(mode, { target: { value: "both" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Group meaning and reading/i }));
    fireEvent.change(mode, { target: { value: "meaning" } });

    const study = JSON.parse(window.localStorage.getItem(settingsStorageKey("Tester")) ?? "{}").study;
    expect(study).toMatchObject({ ankiMode: "meaning", ankiGroupQuestions: false });
    expect(screen.getByText('Only available when “Meanings and readings” is selected.')).toBeInTheDocument();
  });
});

describe("Japanese context voice download", () => {
  it("keeps the missing voice in its own discoverable settings section", () => {
    Object.assign(voiceMock, { downloaded: false });
    render(<SettingsWorkspace />);

    const section = document.getElementById("japanese-voice");
    expect(section).toHaveAccessibleName("Japanese voice");
    expect(section).toContainElement(screen.getByRole("button", { name: "Download voice · about 400 MB" }));
  });

  it("downloads from settings when the voice is missing", () => {
    Object.assign(voiceMock, { downloaded: false });
    render(<SettingsWorkspace />);

    const download = screen.getByRole("button", { name: "Download voice · about 400 MB" });
    expect(document.getElementById("japanese-voice")).toContainElement(download);
    fireEvent.click(download);
    expect(voiceMock.download).toHaveBeenCalledOnce();
  });

  it("removes the entire download row once the voice is saved", () => {
    Object.assign(voiceMock, { downloaded: false });
    const { rerender } = render(<JapaneseVoiceDownloadSetting />);
    expect(screen.getByText("Japanese context voice")).toBeInTheDocument();

    Object.assign(voiceMock, { downloaded: true });
    rerender(<JapaneseVoiceDownloadSetting />);
    expect(screen.queryByText("Japanese context voice")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Download voice/u })).not.toBeInTheDocument();
  });

  it("keeps an in-progress download cancelable and failures retryable", () => {
    Object.assign(voiceMock, { downloaded: false, activity: "downloading", progress: 42, message: "Downloading voice model…" });
    const { rerender } = render(<JapaneseVoiceDownloadSetting />);
    const cancel = screen.getByRole("button", { name: "Cancel download" });
    expect(cancel).toBeEnabled();
    fireEvent.click(cancel);
    expect(voiceMock.cancelDownload).toHaveBeenCalledOnce();

    Object.assign(voiceMock, { activity: "idle", progress: null, message: null, error: "The download failed." });
    rerender(<JapaneseVoiceDownloadSetting />);
    expect(screen.getByRole("alert")).toHaveTextContent("The download failed.");
    fireEvent.click(screen.getByRole("button", { name: "Retry download" }));
    expect(voiceMock.download).toHaveBeenCalledOnce();
  });

  it("keeps a clear status visible while checking or when the browser is unsupported", () => {
    Object.assign(voiceMock, { downloaded: false, checked: false });
    const { rerender } = render(<JapaneseVoiceDownloadSetting />);
    expect(screen.getByRole("heading", { name: "Japanese voice" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Checking…" })).toBeDisabled();

    Object.assign(voiceMock, { checked: true, supported: false });
    rerender(<JapaneseVoiceDownloadSetting />);
    expect(screen.getByText(/This browser cannot save or run the optional voice/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unavailable" })).toBeDisabled();
  });
});

describe("reader integrations", () => {
  beforeEach(() => window.localStorage.clear());

  it("persists shared reader interaction and recognition preferences", () => {
    render(<SettingsWorkspace />);

    expect(screen.getByText("JPDB API key").closest("label")).toHaveAttribute("id", "jpdb-api-key");
    fireEvent.change(screen.getByRole("combobox", { name: /Word details/ }), { target: { value: "hover" } });
    fireEvent.change(screen.getByRole("combobox", { name: /Text recognition/ }), { target: { value: "wk" } });

    expect(JSON.parse(window.localStorage.getItem(settingsStorageKey("Tester")) ?? "{}").reader).toEqual({
      detailsInteraction: "hover",
      recognitionMode: "wk",
    });
  });

  it("requires a saved JPDB key before opting into English lyric translations", () => {
    render(<SettingsWorkspace />);

    const jpdbSetting = screen.getByText("JPDB API key").closest("label");
    const translationToggle = screen.getByRole("checkbox", { name: /English lyric translations/i });
    expect(jpdbSetting).toHaveTextContent(/song lyrics/i);
    expect(translationToggle).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Paste JPDB key"), { target: { value: "  jpdb-key  " } });
    expect(translationToggle).toBeEnabled();

    fireEvent.click(translationToggle);
    expect(translationToggle).toBeChecked();
    expect(JSON.parse(window.localStorage.getItem(settingsStorageKey("Tester")) ?? "{}").study.songsLyricsLineTranslationsEnabled).toBe(true);
  });
});

describe("dashboard layout drag targets", () => {
  beforeEach(() => {
    window.localStorage.clear();
    const visibleDashboard = ["daily-study", "srs", "level", "extra-study", "forecast", "study-pulse"];
    const hiddenDashboard = DASHBOARD_SECTIONS.filter((id) => !visibleDashboard.includes(id));
    window.localStorage.setItem(settingsStorageKey("Tester"), JSON.stringify({
      ...DEFAULT_WEB_SETTINGS,
      workspace: {
        ...DEFAULT_WEB_SETTINGS.workspace,
        dashboardOrder: [...visibleDashboard, ...hiddenDashboard],
        hiddenDashboard,
        dashboardWidths: { ...DEFAULT_WEB_SETTINGS.workspace.dashboardWidths, level: 8, forecast: 8, "study-pulse": 4 },
      },
    }));
  });

  async function renderLayout() {
    const { container } = render(<SettingsWorkspace />);
    const list = await screen.findByRole("list", { name: "Visible dashboard sections" });
    await waitFor(() => expect(list.querySelectorAll(":scope > li")).toHaveLength(6));

    vi.spyOn(list, "getBoundingClientRect").mockReturnValue(rect(0, 0, 1200, 600));
    const positions: Record<string, DOMRect> = {
      "daily-study": rect(0, 0, 1200, 90),
      srs: rect(0, 110, 790, 90),
      level: rect(0, 220, 790, 90),
      "extra-study": rect(0, 330, 1200, 90),
      forecast: rect(0, 440, 790, 90),
      "study-pulse": rect(810, 440, 390, 90),
    };
    Object.entries(positions).forEach(([id, bounds]) => {
      vi.spyOn(container.querySelector<HTMLElement>(`[data-editor-section="${id}"]`)!, "getBoundingClientRect").mockReturnValue(bounds);
    });
    return { container, list };
  }

  it("drops a widget into the open grid space beside another widget", async () => {
    const { container, list } = await renderLayout();
    const transfer = dataTransfer();
    const source = container.querySelector<HTMLElement>('[data-editor-section="study-pulse"]')!;
    fireEvent.dragStart(source, { dataTransfer: transfer });
    fireDrag(list, "dragover", 1000, 155, transfer);
    fireDrag(list, "drop", 1000, 155, transfer);

    expect([...list.querySelectorAll<HTMLElement>(":scope > li")].map((item) => item.dataset.editorSection)).toEqual([
      "daily-study",
      "srs",
      "study-pulse",
      "level",
      "extra-study",
      "forecast",
    ]);
    expect(container.querySelector('[data-editor-section="study-pulse"]')).not.toHaveAttribute("data-editor-row-start");
  });

  it("starts a new row when dropped in the gap between two rows", async () => {
    const { container, list } = await renderLayout();
    const transfer = dataTransfer();
    const source = container.querySelector<HTMLElement>('[data-editor-section="study-pulse"]')!;

    fireEvent.dragStart(source, { dataTransfer: transfer });
    fireDrag(list, "dragover", 600, 210, transfer);
    fireDrag(list, "drop", 600, 210, transfer);

    expect([...list.querySelectorAll<HTMLElement>(":scope > li")].map((item) => item.dataset.editorSection)).toEqual([
      "daily-study",
      "srs",
      "study-pulse",
      "level",
      "extra-study",
      "forecast",
    ]);
    expect(container.querySelector('[data-editor-section="study-pulse"]')).toHaveAttribute("data-editor-row-start", "true");
  });

  it("restores the full dashboard layout as the default", async () => {
    render(<SettingsWorkspace />);
    const list = await screen.findByRole("list", { name: "Visible dashboard sections" });
    await waitFor(() => expect(list.querySelectorAll(":scope > li")).toHaveLength(6));

    fireEvent.click(screen.getByRole("button", { name: "Restore dashboard" }));

    await waitFor(() => expect(list.querySelectorAll(":scope > li")).toHaveLength(17));
    const savedWorkspace = JSON.parse(window.localStorage.getItem(settingsStorageKey("Tester")) ?? "{}").workspace;
    expect(savedWorkspace).toMatchObject(DEFAULT_WEB_SETTINGS.workspace);
  });
});
