import type { WKUser } from "@/types/wanikani";

export const DEMO_USERNAME = "demo-level-21";
export const DEMO_USER: WKUser = {
  id: 9_000_021,
  object: "user",
  url: "/api/wanikani/user",
  data_updated_at: "2026-09-01T00:00:00.000Z",
  data: {
    id: DEMO_USERNAME,
    username: DEMO_USERNAME,
    level: 21,
    profile_url: "",
    started_at: "2026-01-01T00:00:00.000Z",
    current_vacation_started_at: null,
    preferences: {
      default_voice_actor_id: 1,
      lessons_autoplay_audio: true,
      lessons_batch_size: 5,
      lessons_presentation_order: "ascending_level_then_subject",
      reviews_autoplay_audio: true,
      reviews_display_srs_indicator: true,
    },
    subscription: { active: true, type: "unknown", max_level_granted: 60, period_ends_at: null },
  },
};

let demoMode = false;
let demoModeEpoch = 0;

/** Set before exposing an authenticated demo session to data consumers. */
export function setDemoMode(enabled: boolean) {
  if (enabled !== demoMode) demoModeEpoch += 1;
  demoMode = enabled;
}
export function isDemoMode() { return demoMode; }
export function getDemoModeEpoch() { return demoModeEpoch; }
