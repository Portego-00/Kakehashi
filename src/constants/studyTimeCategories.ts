import type { Ionicons } from "@expo/vector-icons";
import type { ActivityCategory } from "../services/timeTrackingCore";

type IoniconName = keyof typeof Ionicons.glyphMap;

export type StudyTimeCategoryMeta = {
  label: string;
  icon: IoniconName;
  color: string;
};

export const STUDY_TIME_CATEGORY_META: Record<ActivityCategory, StudyTimeCategoryMeta> = {
  reviews: { label: "Reviews", icon: "albums-outline", color: "#00AAFF" },
  lessons: { label: "Lessons", icon: "school-outline", color: "#FF00AA" },
  extra_study: { label: "Extra Study", icon: "barbell-outline", color: "#AA00FF" },
  news: { label: "NHK News", icon: "newspaper-outline", color: "#FF7043" },
  songs: { label: "Songs", icon: "musical-notes-outline", color: "#1DB954" },
  epub: { label: "Reading", icon: "book-outline", color: "#FFB300" },
  video: { label: "Video", icon: "play-circle-outline", color: "#E53935" },
};
