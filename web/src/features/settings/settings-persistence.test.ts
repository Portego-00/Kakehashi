import { afterEach, expect, it, vi } from "vitest";
import { DEFAULT_WEB_SETTINGS, readWebSettings, settingsStorageKey, updateWebSettings, WEB_SETTINGS_EVENT, type WebSettings } from "./settings";

afterEach(() => vi.restoreAllMocks());

const key = settingsStorageKey("Tester");
const configured = { ...DEFAULT_WEB_SETTINGS, textScale: 1.2 as const, study: { ...DEFAULT_WEB_SETTINGS.study, dailyLessonLimit: 23 } };

it("uses defaults only when a settings entry is absent", () => {
  expect(readWebSettings({ getItem: () => null }, "Tester")).toEqual(DEFAULT_WEB_SETTINGS);
});

it.each(["", "{broken-json", "null", "[]", "42", '"invalid"'])("does not overwrite unreadable saved data: %s", (raw) => {
  const target = { getItem: () => raw, setItem: vi.fn() };
  const change = vi.fn(() => DEFAULT_WEB_SETTINGS);
  expect(() => updateWebSettings(target, "Tester", change)).toThrow();
  expect(change).not.toHaveBeenCalled();
  expect(target.setItem).not.toHaveBeenCalled();
});

it("does not write defaults after a storage read is denied", () => {
  const target = { getItem: () => { throw new DOMException("Denied", "SecurityError"); }, setItem: vi.fn() };
  expect(() => updateWebSettings(target, "Tester", () => DEFAULT_WEB_SETTINGS)).toThrow();
  expect(target.setItem).not.toHaveBeenCalled();
});

it("applies an edit to the latest stored preferences even without a change event", () => {
  let raw = JSON.stringify(configured);
  const target = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } };
  readWebSettings(target, "Tester");
  raw = JSON.stringify({ ...configured, study: { ...configured.study, dailyLessonLimit: 47 } });
  updateWebSettings(target, "Tester", (current) => ({ ...current, study: { ...current.study, autoplayAudio: false } }));
  expect(JSON.parse(raw)).toMatchObject({ textScale: 1.2, study: { dailyLessonLimit: 47, autoplayAudio: false } });
});

it("publishes a settings change only after storage accepts the write", () => {
  let raw = JSON.stringify(configured);
  let full = true;
  const observed: string[] = [];
  const onChange = () => { observed.push(raw); };
  window.addEventListener(WEB_SETTINGS_EVENT, onChange);
  try {
    const target = {
      getItem: () => raw,
      setItem: (requested: string, value: string) => {
        expect(requested).toBe(key);
        if (full) throw new DOMException("Full", "QuotaExceededError");
        raw = value;
      },
    };
    const change = (current: WebSettings) => ({ ...current, study: { ...current.study, autoplayAudio: false } });
    expect(() => updateWebSettings(target, "Tester", change)).toThrow();
    expect(observed).toEqual([]);
    expect(JSON.parse(raw)).toEqual(configured);
    full = false;
    updateWebSettings(target, "Tester", (current) => ({ ...current, study: { ...current.study, autoplayAudio: false } }));
    expect(observed).toEqual([raw]);
    expect(JSON.parse(raw)).toMatchObject({ textScale: 1.2, study: { dailyLessonLimit: 23, autoplayAudio: false } });
  } finally { window.removeEventListener(WEB_SETTINGS_EVENT, onChange); }
});
