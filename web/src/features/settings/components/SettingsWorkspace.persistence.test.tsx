import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DEFAULT_WEB_SETTINGS, loadWebSettings, saveWebSettings, settingsStorageKey } from "@/features/settings/settings";
import { SettingsWorkspace } from "@/features/settings/components/SettingsWorkspace";

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
  status: "authenticated",
  user: { data: { username: "Tester" } },
  isDemo: false,
  signOut: vi.fn<() => Promise<void>>(),
}));
const routerMock = vi.hoisted(() => ({
  replace: vi.fn<(href: string) => void>(),
}));

// Persistence tests isolate the navigation/disclosure layer; its accessible flows are tested separately.
vi.mock("@/features/settings/components/SettingsSearch", () => ({ SettingsSearch: ({children,actions}: {children:React.ReactNode;actions:React.ReactNode}) => <>{actions}{children}</> }));
vi.mock("@/features/settings/components/settings-disclosure", () => ({ SettingsDisclosure: ({children,title}: {children:React.ReactNode;title:string}) => <div><h3>{title}</h3>{children}</div> }));

vi.mock("@/lib/session", () => ({
  useSession: () => sessionMock,
}));

vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));

vi.mock("@/lib/theme", () => ({
  useTheme: () => ({ theme: "light", resolvedTheme: "light", setTheme: vi.fn() }),
}));

vi.mock("@/features/bunpro/BunproSettings", () => ({ BunproSettings: () => null }));
vi.mock("@/features/anime/AnimePicker", () => ({ AnimePicker: () => null }));
vi.mock("@/features/dashboard/DashboardWidgetPreview", () => ({ DashboardWidgetPreview: ({ id }: { id: string }) => <div data-widget-preview={id} /> }));
vi.mock("@/features/speech/use-japanese-voice", () => ({ useJapaneseVoice: () => voiceMock }));


// Exercise the production settings screen under adverse timing and storage failures.
const key = settingsStorageKey("Tester");
function configured() {
  return {
    ...structuredClone(DEFAULT_WEB_SETTINGS),
    textScale: 1.2 as const,
    colors: { radical: "#123456", kanji: "#345678", vocabulary: "#567890" },
    study: { ...structuredClone(DEFAULT_WEB_SETTINGS.study), dailyLessonLimit: 23, lessonsBatchSize: 9, autoplayAudio: false, ankiMode: "reading" as const },
  };
}
beforeEach(() => {
  localStorage.clear();
  sessionMock.user.data.username = "Tester";
  sessionMock.status = "authenticated";
  sessionMock.isDemo = false;
  vi.useFakeTimers();
  saveWebSettings(localStorage, "Tester", configured());
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

it("passive opening and reopening preserve all saved settings", () => {
  const raw = localStorage.getItem(key);
  const view = render(<SettingsWorkspace />);
  act(() => vi.runOnlyPendingTimers());
  expect(screen.getByRole("combobox", {name:"Lesson batch size"})).toHaveValue("9");
  expect(localStorage.getItem(key)).toBe(raw);
  view.unmount();
  render(<SettingsWorkspace />);
  act(() => vi.runOnlyPendingTimers());
  expect(screen.getByRole("checkbox", {name:"Autoplay vocabulary audio"})).not.toBeChecked();
  expect(localStorage.getItem(key)).toBe(raw);
});

it("the first edit uses saved settings without a deferred-load window", () => {
  render(<SettingsWorkspace />);
  fireEvent.click(within(screen.getByRole("radiogroup", {name:"Answer mode"})).getByRole("radio", {name:"Multiple choice"}));
  act(() => vi.runOnlyPendingTimers());
  expect(loadWebSettings(localStorage, "Tester")).toMatchObject({
    textScale:1.2, colors:configured().colors, study:{dailyLessonLimit:23,lessonsBatchSize:9,autoplayAudio:false},
  });
});

it("edits after a same-tab preference update preserve the newer settings", () => {
  render(<SettingsWorkspace />);
  act(() => vi.runOnlyPendingTimers());
  act(() => saveWebSettings(localStorage, "Tester", {...configured(),study:{...configured().study,dailyLessonLimit:47}}));
  fireEvent.click(screen.getByRole("checkbox", {name:"Autoplay vocabulary audio"}));
  expect(loadWebSettings(localStorage,"Tester").study.dailyLessonLimit).toBe(47);
});

it("storage events from another tab refresh the entire form before a later edit", () => {
  render(<SettingsWorkspace />);
  act(() => vi.runOnlyPendingTimers());
  localStorage.setItem(key, JSON.stringify({...configured(),schemaVersion:1,study:{...configured().study,dailyLessonLimit:47}}));
  fireEvent(window, new StorageEvent("storage", {key}));
  fireEvent.click(screen.getByRole("checkbox", {name:"Autoplay vocabulary audio"}));
  expect(loadWebSettings(localStorage,"Tester").study.dailyLessonLimit).toBe(47);
});

it("a rejected storage write does not present an unsaved preference as applied", () => {
  render(<SettingsWorkspace />);
  act(() => vi.runOnlyPendingTimers());
  const raw = localStorage.getItem(key);
  vi.spyOn(Storage.prototype,"setItem").mockImplementation(() => { throw new DOMException("Full storage", "QuotaExceededError"); });
  fireEvent.click(screen.getByRole("checkbox", {name:"Autoplay vocabulary audio"}));
  expect(localStorage.getItem(key)).toBe(raw);
  expect(screen.getByRole("checkbox",{name:"Autoplay vocabulary audio"})).not.toBeChecked();
  expect(screen.getByRole("alert")).toHaveTextContent("could not be saved");
  expect(screen.queryByText("Saved", {exact:true})).not.toBeInTheDocument();
});

it("a transient read failure cannot turn the next edit into a global reset", () => {
  const getItem = Storage.prototype.getItem;
  let first = true;
  vi.spyOn(Storage.prototype,"getItem").mockImplementation(function(this:Storage,requested:string) {
    if (requested===key && first) { first=false; throw new DOMException("Transient storage denial","SecurityError"); }
    return getItem.call(this,requested);
  });
  render(<SettingsWorkspace />);
  act(() => vi.runOnlyPendingTimers());
  fireEvent.click(screen.getByRole("checkbox", {name:"Answer feedback sounds"}));
  expect(loadWebSettings(localStorage,"Tester")).toMatchObject({textScale:1.2,study:{dailyLessonLimit:23,lessonsBatchSize:9,autoplayAudio:false}});
});

it("blocks edits after denied reads and recovers without replacing saved preferences", () => {
  const original = Storage.prototype.getItem;
  const raw = localStorage.getItem(key);
  let denied = true;
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(function(this:Storage, requested:string) {
    if (requested === key && denied) throw new DOMException("Denied", "SecurityError");
    return original.call(this, requested);
  });
  render(<SettingsWorkspace />);
  expect(screen.getByRole("alert")).toHaveTextContent("could not be read");
  expect(screen.queryByRole("checkbox", {name:"Autoplay vocabulary audio"})).not.toBeInTheDocument();
  expect(original.call(localStorage,key)).toBe(raw);
  denied = false;
  fireEvent.click(screen.getByRole("button", {name:"Try again"}));
  expect(screen.getByRole("checkbox", {name:"Autoplay vocabulary audio"})).not.toBeChecked();
  fireEvent.click(screen.getByRole("checkbox", {name:"Answer feedback sounds"}));
  expect(loadWebSettings(localStorage,"Tester")).toMatchObject({textScale:1.2,study:{dailyLessonLimit:23,lessonsBatchSize:9,autoplayAudio:false,answerFeedbackSoundEnabled:false}});
});

it("keeps corrupted saved data intact and presents a retry action", () => {
  localStorage.setItem(key,"{broken-json");
  render(<SettingsWorkspace />);
  expect(screen.getByRole("alert")).toHaveTextContent("could not be read");
  fireEvent.click(screen.getByRole("button", {name:"Try again"}));
  expect(localStorage.getItem(key)).toBe("{broken-json");
  expect(screen.queryByRole("button",{name:"Reset"})).not.toBeInTheDocument();
});
