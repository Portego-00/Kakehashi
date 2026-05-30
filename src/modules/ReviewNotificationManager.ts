import { NativeModules, Platform } from "react-native";
import { isIOSOnMac } from "../utils/platformSupport";

interface ReviewData {
  currentReviews: number;
  upcomingReviews: number[];
  upcomingReviewTimes?: { [key: string]: number }; // Optional for backward compatibility
  isOnVacation?: boolean;
  vacationStartedAt?: string | null;
  settings: {
    badgeEnabled: boolean;
    alertsEnabled: boolean;
    soundsEnabled: boolean;
  };
}

interface NotificationPermissionResult {
  granted: boolean;
}

interface NotificationSettings {
  authorizationStatus:
    | "notDetermined"
    | "denied"
    | "authorized"
    | "provisional"
    | "ephemeral"
    | "unknown";
  alertSetting: "enabled" | "disabled" | "notSupported" | "unknown";
  badgeSetting: "enabled" | "disabled" | "notSupported" | "unknown";
  soundSetting: "enabled" | "disabled" | "notSupported" | "unknown";
}

interface UpdateResult {
  success: boolean;
  currentReviews: number;
  badgeSet: boolean;
  notificationsScheduled: boolean;
}

interface TestNotificationResult {
  success: boolean;
  badgeSet: number;
  notificationScheduledFor: string;
  notificationBadgeWillBe: number;
}

interface PendingNotification {
  identifier: string;
  title: string;
  body: string;
  badge: number;
  trigger: {
    type: string;
    timeInterval?: number;
    fireDate?: string;
    repeats: boolean;
  };
  userInfo: any;
}

interface PendingNotificationsResult {
  count: number;
  notifications: PendingNotification[];
}

interface ReviewNotificationManagerInterface {
  updateBadgeAndScheduleNotifications(
    reviewData: ReviewData
  ): Promise<UpdateResult>;
  requestPermissions(): Promise<NotificationPermissionResult>;
  getNotificationSettings(): Promise<NotificationSettings>;
  scheduleTestNotification(): Promise<TestNotificationResult>;
  getPendingNotifications(): Promise<PendingNotificationsResult>;
}

const { ReviewNotificationManager } = NativeModules;
const reviewNotificationManagerModule =
  Platform.OS !== "ios" || isIOSOnMac()
  ? null
  : ReviewNotificationManager;

export default reviewNotificationManagerModule as ReviewNotificationManagerInterface;
export type {
  NotificationPermissionResult,
  NotificationSettings,
  PendingNotification,
  PendingNotificationsResult,
  ReviewData,
  TestNotificationResult,
  UpdateResult,
};
