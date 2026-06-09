import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type {
  RealtimeChannel,
  RealtimePostgresInsertPayload,
} from "@supabase/supabase-js";

import { supabase } from "../lib/supabase";
import type { Issue, IssueComment } from "../services/issueService";
import { supportsBadgeAndReviewNotifications } from "./platformSupport";
import { isPortegoUsername } from "./portegoAccess";

const ISSUE_ACTIVITY_CHANNEL_NAME = "issue-activity-notifications";
const ISSUE_ACTIVITY_NOTIFICATION_KIND = "issueActivity";
const ISSUE_ACTIVITY_ANDROID_CHANNEL_ID = "issue-activity";

type IssueLikeRow = {
  id: string;
  issue_id: string;
  user_id?: string | null;
  created_at: string;
};

type CommentLikeRow = {
  id: string;
  comment_id: string;
  user_id?: string | null;
  created_at: string;
};

type IssueActivityIdentity = {
  currentUserId?: string | null;
  currentUsername?: string | null;
};

type IssueActivityNotification = {
  activityType:
    | "issue_created"
    | "issue_comment_created"
    | "issue_liked"
    | "issue_comment_liked";
  issueId: string;
  sourceId: string;
  title: string;
  body: string;
};

let activeChannel: RealtimeChannel | null = null;
let activeIdentityKey: string | null = null;
let setupPromise: Promise<boolean> | null = null;

export function shouldReceiveIssueActivityNotifications(
  username?: string | null
): boolean {
  return isPortegoUsername(username);
}

export function getIssueActivityNotificationIssueId(
  data: Record<string, unknown> | undefined
): string | null {
  if (!data || data.kind !== ISSUE_ACTIVITY_NOTIFICATION_KIND) {
    return null;
  }

  return typeof data.issueId === "string" && data.issueId.length > 0
    ? data.issueId
    : null;
}

export function startIssueActivityNotifications(
  identity: IssueActivityIdentity
): () => void {
  if (
    !supportsBadgeAndReviewNotifications() ||
    !shouldReceiveIssueActivityNotifications(identity.currentUsername) ||
    !identity.currentUserId
  ) {
    stopIssueActivityNotifications();
    return () => {};
  }

  const identityKey = [
    identity.currentUsername ?? "",
    identity.currentUserId ?? "",
  ].join(":");

  if (activeChannel && activeIdentityKey === identityKey) {
    return () => {};
  }

  stopIssueActivityNotifications();

  void ensureIssueActivityNotificationSetup();

  const channel = supabase
    .channel(`${ISSUE_ACTIVITY_CHANNEL_NAME}:${identityKey}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "issues" },
      (payload: RealtimePostgresInsertPayload<Issue>) => {
        void handleIssueCreated(payload, identity);
      }
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "issue_comments" },
      (payload: RealtimePostgresInsertPayload<IssueComment>) => {
        void handleIssueCommentCreated(payload, identity);
      }
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "issue_likes" },
      (payload: RealtimePostgresInsertPayload<IssueLikeRow>) => {
        void handleIssueLiked(payload, identity);
      }
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "comment_likes" },
      (payload: RealtimePostgresInsertPayload<CommentLikeRow>) => {
        void handleIssueCommentLiked(payload, identity);
      }
    )
    .subscribe((status, error) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error("Issue activity realtime subscription failed:", {
          status,
          error,
        });
      }
    });

  activeChannel = channel;
  activeIdentityKey = identityKey;

  return () => {
    if (activeChannel !== channel) {
      return;
    }
    stopIssueActivityNotifications();
  };
}

export function stopIssueActivityNotifications(): void {
  if (!activeChannel) {
    activeIdentityKey = null;
    return;
  }

  const channel = activeChannel;
  activeChannel = null;
  activeIdentityKey = null;

  void supabase.removeChannel(channel);
}

async function ensureIssueActivityNotificationSetup(): Promise<boolean> {
  if (setupPromise) {
    return setupPromise;
  }

  setupPromise = (async () => {
    try {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync(
          ISSUE_ACTIVITY_ANDROID_CHANNEL_ID,
          {
            name: "Issue activity",
            importance: Notifications.AndroidImportance.DEFAULT,
            sound: "default",
            vibrationPattern: [0, 250, 250, 250],
          }
        );
      }

      const permissions = await Notifications.getPermissionsAsync();
      if (permissions.status === "granted") {
        return true;
      }

      const requested = await Notifications.requestPermissionsAsync();
      return requested.status === "granted";
    } catch (error) {
      console.error("Failed to set up issue activity notifications:", error);
      return false;
    } finally {
      setupPromise = null;
    }
  })();

  return setupPromise;
}

async function handleIssueCreated(
  payload: RealtimePostgresInsertPayload<Issue>,
  identity: IssueActivityIdentity
) {
  const issue = payload.new;
  if (isFromCurrentUser(issue, identity)) {
    return;
  }

  const actor = issue.user_username || "Someone";
  await scheduleIssueActivityNotification({
    activityType: "issue_created",
    issueId: issue.id,
    sourceId: issue.id,
    title: "New issue",
    body: `${actor}: ${formatNotificationText(issue.title, 110)}`,
  });
}

async function handleIssueCommentCreated(
  payload: RealtimePostgresInsertPayload<IssueComment>,
  identity: IssueActivityIdentity
) {
  const comment = payload.new;
  if (isFromCurrentUser(comment, identity)) {
    return;
  }

  const issue = await fetchIssueSummary(comment.issue_id);
  const issueTitle = issue?.title ?? "an issue";
  const actor = comment.user_username || "Someone";
  await scheduleIssueActivityNotification({
    activityType: "issue_comment_created",
    issueId: comment.issue_id,
    sourceId: comment.id,
    title: "New issue comment",
    body: `${actor} on ${formatNotificationText(
      issueTitle,
      54
    )}: ${formatNotificationText(comment.content, 90)}`,
  });
}

async function handleIssueLiked(
  payload: RealtimePostgresInsertPayload<IssueLikeRow>,
  identity: IssueActivityIdentity
) {
  const like = payload.new;
  if (isFromCurrentUser(like, identity)) {
    return;
  }

  const issue = await fetchIssueSummary(like.issue_id);
  await scheduleIssueActivityNotification({
    activityType: "issue_liked",
    issueId: like.issue_id,
    sourceId: like.id,
    title: "Issue liked",
    body: `Someone liked ${formatNotificationText(
      issue?.title ?? "an issue",
      100
    )}`,
  });
}

async function handleIssueCommentLiked(
  payload: RealtimePostgresInsertPayload<CommentLikeRow>,
  identity: IssueActivityIdentity
) {
  const like = payload.new;
  if (isFromCurrentUser(like, identity)) {
    return;
  }

  const comment = await fetchCommentSummary(like.comment_id);
  if (!comment) {
    return;
  }

  const issue = await fetchIssueSummary(comment.issue_id);
  await scheduleIssueActivityNotification({
    activityType: "issue_comment_liked",
    issueId: comment.issue_id,
    sourceId: like.id,
    title: "Comment liked",
    body: `Someone liked a comment on ${formatNotificationText(
      issue?.title ?? "an issue",
      86
    )}`,
  });
}

async function scheduleIssueActivityNotification(
  notification: IssueActivityNotification
) {
  const canNotify = await ensureIssueActivityNotificationSetup();
  if (!canNotify) {
    return;
  }

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: notification.title,
        body: notification.body,
        sound: "default",
        data: {
          kind: ISSUE_ACTIVITY_NOTIFICATION_KIND,
          activityType: notification.activityType,
          issueId: notification.issueId,
          sourceId: notification.sourceId,
        },
      },
      trigger: null,
    });
  } catch (error) {
    console.error("Failed to schedule issue activity notification:", error);
  }
}

async function fetchIssueSummary(
  issueId: string
): Promise<Pick<Issue, "id" | "title"> | null> {
  const { data, error } = await supabase
    .from("issues")
    .select("id,title")
    .eq("id", issueId)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch issue notification context:", error);
    return null;
  }

  return data as Pick<Issue, "id" | "title"> | null;
}

async function fetchCommentSummary(
  commentId: string
): Promise<Pick<IssueComment, "id" | "issue_id"> | null> {
  const { data, error } = await supabase
    .from("issue_comments")
    .select("id,issue_id")
    .eq("id", commentId)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch comment notification context:", error);
    return null;
  }

  return data as Pick<IssueComment, "id" | "issue_id"> | null;
}

function isFromCurrentUser(
  row: {
    user_id?: string | null;
    user_username?: string | null;
  },
  identity: IssueActivityIdentity
): boolean {
  return Boolean(
    (identity.currentUserId && row.user_id === identity.currentUserId) ||
      (identity.currentUsername && row.user_username === identity.currentUsername)
  );
}

function formatNotificationText(value: string | null | undefined, maxLength: number) {
  const compact = (value ?? "").replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) {
    return compact || "Untitled";
  }

  return `${compact.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}
