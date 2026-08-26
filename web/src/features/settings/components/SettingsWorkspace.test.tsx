import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { settingsStorageKey } from "../settings";
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
}));

vi.mock("@/lib/session", () => ({
  useSession: () => ({ user: { data: { username: "Tester" } } }),
}));

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

describe("Japanese context voice download", () => {
  it("downloads from settings when the voice is missing", () => {
    Object.assign(voiceMock, { downloaded: false });
    render(<SettingsWorkspace />);

    fireEvent.click(screen.getByRole("button", { name: "Download voice · about 65 MB" }));
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

  it("shows progress and keeps failures retryable", () => {
    Object.assign(voiceMock, { downloaded: false, activity: "downloading", progress: 42, message: "Downloading voice model…" });
    const { rerender } = render(<JapaneseVoiceDownloadSetting />);
    expect(screen.getByRole("button", { name: "Downloading 42%" })).toBeDisabled();

    Object.assign(voiceMock, { activity: "idle", progress: null, message: null, error: "The download failed." });
    rerender(<JapaneseVoiceDownloadSetting />);
    expect(screen.getByRole("alert")).toHaveTextContent("The download failed.");
    fireEvent.click(screen.getByRole("button", { name: "Retry download" }));
    expect(voiceMock.download).toHaveBeenCalledOnce();
  });

  it("stays hidden while checking or when the browser is unsupported", () => {
    Object.assign(voiceMock, { downloaded: false, checked: false });
    const { rerender } = render(<JapaneseVoiceDownloadSetting />);
    expect(screen.queryByText("Japanese context voice")).not.toBeInTheDocument();

    Object.assign(voiceMock, { checked: true, supported: false });
    rerender(<JapaneseVoiceDownloadSetting />);
    expect(screen.queryByText("Japanese context voice")).not.toBeInTheDocument();
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
});

describe("dashboard layout drag targets", () => {
  beforeEach(() => window.localStorage.clear());

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
});
