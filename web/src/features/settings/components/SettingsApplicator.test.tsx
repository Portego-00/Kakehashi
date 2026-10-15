import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DEFAULT_WEB_SETTINGS, loadWebSettings, saveWebSettings } from "@/features/settings/settings";
import { SettingsApplicator } from "@/features/settings/components/SettingsApplicator";
const mocks = vi.hoisted(() => ({ migrate:vi.fn() }));
vi.mock("@/lib/session", () => ({useSession: () => ({user:{data:{username:"Tester"}}})}));
vi.mock("@/features/settings/jitai", () => ({migrateLegacyJitaiFonts:(...args:unknown[])=>mocks.migrate(...args)}));
beforeEach(()=>{localStorage.clear();mocks.migrate.mockReset();});
const legacyFont={id:"custom-legacy",name:"Legacy font",dataUrl:"data:font/ttf;base64,AA=="};
function seedLegacy(){localStorage.setItem("kakehashi-web:settings:tester:v1",JSON.stringify({...DEFAULT_WEB_SETTINGS,study:{...DEFAULT_WEB_SETTINGS.study,jitaiCustomFonts:[legacyFont]}}));}
afterEach(()=>{cleanup();vi.restoreAllMocks();});

it("finishing an older font migration must not revert a newer settings save",async()=>{
  let complete!:(migrated:boolean)=>void;
  const pending=new Promise<boolean>(resolve=>{complete=resolve;});
  mocks.migrate.mockReturnValueOnce(pending).mockResolvedValue(false);
  seedLegacy();
  render(<SettingsApplicator/>);
  expect(mocks.migrate).toHaveBeenCalledWith([legacyFont]);
  act(()=>saveWebSettings(localStorage,"Tester",{
    ...DEFAULT_WEB_SETTINGS,
    textScale:1.2,
    study:{...DEFAULT_WEB_SETTINGS.study,dailyLessonLimit:23,autoplayAudio:false},
  }));
  await act(async()=>{complete(true);await pending;});
  expect(loadWebSettings(localStorage,"Tester")).toMatchObject({textScale:1.2,study:{dailyLessonLimit:23,autoplayAudio:false}});
});

it("a font migration finishing after unmount must not overwrite the new page's settings",async()=>{
  let complete!:(migrated:boolean)=>void;
  const pending=new Promise<boolean>(resolve=>{complete=resolve;});
  mocks.migrate.mockReturnValueOnce(pending).mockResolvedValue(false);
  seedLegacy();
  const view=render(<SettingsApplicator/>);
  view.unmount();
  saveWebSettings(localStorage,"Tester",{...DEFAULT_WEB_SETTINGS,textScale:1.2});
  await act(async()=>{complete(true);await pending;});
  expect(loadWebSettings(localStorage,"Tester").textScale).toBe(1.2);
});

it("does not overwrite a newer raw snapshot when no change event was received", async () => {
  let complete!: (migrated: boolean) => void;
  const pending = new Promise<boolean>((resolve) => { complete = resolve; });
  mocks.migrate.mockReturnValueOnce(pending).mockResolvedValue(false);
  seedLegacy();
  render(<SettingsApplicator />);
  const key = "kakehashi-web:settings:tester:v1";
  const newer = JSON.stringify({ ...DEFAULT_WEB_SETTINGS, textScale: 1.2 });
  localStorage.setItem(key, newer);
  await act(async () => { complete(true); await pending; });
  expect(localStorage.getItem(key)).toBe(newer);
});

it("removes inline font data only after a successful migration of that snapshot", async () => {
  mocks.migrate.mockResolvedValueOnce(true).mockResolvedValue(false);
  seedLegacy();
  render(<SettingsApplicator />);
  await act(async () => {});
  expect(loadWebSettings(localStorage, "Tester").study.jitaiCustomFonts).toEqual([{ id: legacyFont.id, name: legacyFont.name }]);
});

it("leaves the saved snapshot intact when migration fails", async () => {
  mocks.migrate.mockRejectedValue(new Error("Font database unavailable"));
  seedLegacy();
  const raw = localStorage.getItem("kakehashi-web:settings:tester:v1");
  render(<SettingsApplicator />);
  await act(async () => {});
  expect(localStorage.getItem("kakehashi-web:settings:tester:v1")).toBe(raw);
});
