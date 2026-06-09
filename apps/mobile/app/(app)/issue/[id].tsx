import { Ionicons } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";
import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { VideoView, useVideoPlayer } from "expo-video";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Markdown, { RenderRules } from "react-native-markdown-display";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Issue,
  IssueComment,
  issueService,
} from "../../../src/services/issueService";
import {
  isPatreonSupporterUsername,
  usePatreonSupporterUsernames,
} from "../../../src/hooks/usePatreonSupporterUsernames";
import {
  imageUploadService,
  isIssueMediaBucketNotFoundError,
  isIssueMediaTooLargeError,
  ISSUE_MEDIA_MAX_BYTES,
} from "../../../src/services/imageUploadService";
import { PatreonSupporterBadge } from "../../../src/components/PatreonSupporterBadge";
import { useSession } from "../../../src/contexts/AuthContext";
import { useAuthStore, useSettingsStore } from "../../../src/utils/store";
import { useTheme } from "../../../src/utils/theme";
import { UserAvatar } from "../../../src/components/UserAvatar";

type AppTheme = ReturnType<typeof useTheme>["theme"];
const MAX_MEDIA_SIZE_MB = ISSUE_MEDIA_MAX_BYTES / (1024 * 1024);

export default function IssueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { apiToken, userData } = useAuthStore();
  const { isLoading: isAuthLoading } = useSession();
  const { gravatarEmail } = useSettingsStore();

  const [issue, setIssue] = useState<Issue | null>(null);
  const [comments, setComments] = useState<IssueComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<IssueComment | null>(null);
  const [isIssueLikePending, setIsIssueLikePending] = useState(false);
  const [pendingCommentLikeIds, setPendingCommentLikeIds] = useState<
    Set<string>
  >(new Set());
  const patreonSupporterUsernames = usePatreonSupporterUsernames();

  const isAdmin = userData?.username === "Portego";
  const isAuthor = issue?.user_username === userData?.username;

  const scrollViewRef = useRef<ScrollView>(null);
  const textInputRef = useRef<TextInput>(null);

  const fetchDetails = async () => {
    try {
      if (!id || isAuthLoading) return;
      if (!apiToken) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const [issueData, commentsData] = await Promise.all([
        issueService.getIssue(id, userData?.id ?? null),
        issueService.getComments(id, userData?.id ?? null),
      ]);
      setIssue(issueData);
      setComments(commentsData);
    } catch (error) {
      console.error("Failed to load issue", error);
      Alert.alert("Error", "Could not load issue details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [id, apiToken, isAuthLoading, userData?.id]);

  // Auto-scroll when keyboard shows
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      "keyboardDidShow",
      () => {
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
    };
  }, []);

  const handleSubmitComment = useCallback(
    async (content: string, replyToCommentId: string | null) => {
      if (!content.trim()) return false;
      if (!apiToken || !userData || !issue) return false;

      try {
        const newComment = await issueService.addComment(
          issue.id,
          userData.id ?? null,
          gravatarEmail ||
            `${userData.username || "unknown"}@users.noreply.local`,
          userData.username,
          userData.level || null,
          content,
          replyToCommentId
        );
        setComments((prev) => [...prev, newComment]);
        setReplyingTo(null);

        // Auto-scroll to show the new comment
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
        return true;
      } catch (error) {
        console.error("Failed to add comment", error);
        Alert.alert("Error", "Failed to post comment.");
        return false;
      }
    },
    [apiToken, gravatarEmail, issue, userData]
  );

  const handleToggleStatus = async () => {
    if (!issue || (!isAdmin && !isAuthor)) return;

    const newStatus = issue.status === "open" ? "closed" : "open";
    try {
      await issueService.updateIssueStatus(issue.id, newStatus);
      setIssue((prev) => (prev ? { ...prev, status: newStatus } : null));
    } catch (error) {
      console.error("Failed to update status", error);
      Alert.alert("Error", "Failed to update status.");
    }
  };

  const handleDelete = async () => {
    if (!issue || (!isAdmin && !isAuthor)) return;

    Alert.alert("Delete Issue", "Are you sure you want to delete this issue?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await issueService.deleteIssue(issue.id);
            router.back();
          } catch {
            Alert.alert("Error", "Failed to delete issue.");
          }
        },
      },
    ]);
  };

  const handleToggleLike = async () => {
    if (!issue || !apiToken || isIssueLikePending) return;

    const previousLikeState = {
      is_liked: issue.is_liked,
      likes_count: issue.likes_count,
    };

    // Optimistic update for immediate UI feedback.
    setIssue((prev) =>
      prev
        ? {
            ...prev,
            is_liked: !Boolean(prev.is_liked),
            likes_count: !Boolean(prev.is_liked)
              ? prev.likes_count + 1
              : Math.max(0, prev.likes_count - 1),
          }
        : null
    );
    setIsIssueLikePending(true);

    try {
      await issueService.toggleLike(issue.id, userData?.id ?? null);
    } catch (error) {
      console.error("Failed to toggle like:", error);
      setIssue((prev) =>
        prev
          ? {
              ...prev,
              is_liked: previousLikeState.is_liked,
              likes_count: previousLikeState.likes_count,
            }
          : null
      );
    } finally {
      setIsIssueLikePending(false);
    }
  };

  const handleToggleCommentLike = async (commentId: string) => {
    if (!apiToken || pendingCommentLikeIds.has(commentId)) return;

    let previousComment: IssueComment | null = null;

    // Optimistic update for immediate UI feedback.
    setComments((prevComments) =>
      prevComments.map((comment) => {
        if (comment.id !== commentId) return comment;
        previousComment = comment;
        const nextLiked = !Boolean(comment.is_liked);
        return {
          ...comment,
          is_liked: nextLiked,
          likes_count: nextLiked
            ? comment.likes_count + 1
            : Math.max(0, comment.likes_count - 1),
        };
      })
    );

    if (!previousComment) return;

    setPendingCommentLikeIds((prev) => {
      const next = new Set(prev);
      next.add(commentId);
      return next;
    });

    try {
      await issueService.toggleCommentLike(
        commentId,
        userData?.id ?? null
      );
    } catch (error) {
      console.error("Failed to toggle comment like:", error);
      setComments((prevComments) =>
        prevComments.map((comment) =>
          comment.id === commentId && previousComment
            ? {
                ...comment,
                is_liked: previousComment.is_liked,
                likes_count: previousComment.likes_count,
              }
            : comment
        )
      );
    } finally {
      setPendingCommentLikeIds((prev) => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
    }
  };

  const handleReplyToComment = (comment: IssueComment) => {
    setReplyingTo(comment);
    textInputRef.current?.focus();
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  if (loading || !issue) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.backgroundColor,
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar style={theme.statusBarStyle} />
        <ActivityIndicator color={theme.primary} size="large" />
      </View>
    );
  }

  const isOpen = issue.status === "open";
  const isIssueAuthorSupporter = isPatreonSupporterUsername(
    issue.user_username,
    patreonSupporterUsernames,
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style={theme.statusBarStyle} />

      {/* Custom Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.headerBackground,
            borderBottomColor: theme.border,
            paddingTop: 60,
          },
        ]}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerButton}
          >
            <Ionicons name="arrow-back" size={24} color={theme.headerText} />
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { color: theme.headerText }]}>
            Issue #{issue.id.substring(0, 5)}
          </Text>

          {(isAdmin || isAuthor) && (
            <TouchableOpacity
              onPress={handleDelete}
              style={styles.headerButton}
            >
              <Ionicons name="trash-outline" size={24} color="#FF4444" />
            </TouchableOpacity>
          )}
          {!isAdmin && !isAuthor && <View style={styles.headerButton} />}
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        {/* Issue Header */}
        <View
          style={[
            styles.section,
            {
              borderBottomColor: theme.border,
              borderBottomWidth: 1,
              paddingBottom: 16,
            },
          ]}
        >
          <Text style={[styles.title, { color: theme.textColor }]}>
            {issue.title}
          </Text>

          <View style={styles.metaRow}>
            <View
              style={[
                styles.badge,
                { backgroundColor: isOpen ? "#238636" : "#8957e5" },
              ]}
            >
              <Ionicons
                name={isOpen ? "radio-button-on" : "checkmark-circle-outline"}
                size={14}
                color="white"
              />
              <Text
                style={{ color: "white", fontWeight: "bold", marginLeft: 4 }}
              >
                {isOpen ? "Open" : "Closed"}
              </Text>
            </View>
            <Text style={{ color: theme.textSecondary, marginLeft: 8 }}>
              opened {formatDistanceToNow(new Date(issue.created_at))} ago
            </Text>
          </View>

          {/* Like button for issue */}
          <TouchableOpacity
            style={[styles.likeButton, isIssueLikePending && styles.likePending]}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            disabled={isIssueLikePending}
            onPress={handleToggleLike}
          >
            <Ionicons
              name={issue.is_liked ? "heart" : "heart-outline"}
              size={20}
              color={issue.is_liked ? "#FF6B6B" : theme.textSecondary}
            />
            <Text
              style={[
                styles.likeText,
                { color: issue.is_liked ? "#FF6B6B" : theme.textSecondary },
              ]}
            >
              {issue.likes_count}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Issue Body */}
        <View
          style={[
            styles.commentBlock,
            {
              borderWidth: 1,
              borderColor: theme.border,
              backgroundColor: theme.isDark ? theme.cardBackground : "#FFFFFF",
            },
          ]}
        >
          <View
            style={[
              styles.commentHeader,
              {
                backgroundColor: theme.isDark
                  ? theme.headerBackground ?? theme.backgroundColor
                  : "#F5F5F5",
                borderBottomWidth: 1,
                borderBottomColor: theme.border,
              },
            ]}
          >
            <View style={styles.commentHeaderLeft}>
              <UserAvatar
                size={42}
                email={issue.user_email}
                level={issue.user_level}
                fallback={
                  <View
                    style={[
                      styles.avatarFallback,
                      { backgroundColor: theme.isDark ? "#444" : "#E0E0E0" },
                    ]}
                  >
                    <Ionicons
                      name="person"
                      size={18}
                      color={theme.textSecondary}
                    />
                  </View>
                }
              />
                <View style={styles.commentUserInfo}>
                  <View style={styles.usernameRow}>
                    <Text style={{ fontWeight: "bold", color: theme.textColor }}>
                      {issue.user_username}
                    </Text>
                  {issue.user_username === "Portego" &&
                    issue.user_email === "portego2000@hotmail.es" && (
                      <View
                        style={[
                          styles.devBadge,
                          { backgroundColor: theme.primary },
                        ]}
                      >
                        <Text style={styles.devBadgeText}>DEV</Text>
                      </View>
                    )}
                  {isIssueAuthorSupporter && (
                    <View style={styles.inlineBadge}>
                      <PatreonSupporterBadge compact />
                    </View>
                  )}
                </View>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                  {formatDistanceToNow(new Date(issue.created_at))} ago
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.commentBody}>
            <Markdown style={markdownStyles(theme)} rules={markdownRules}>
              {issue.content}
            </Markdown>
          </View>
        </View>

        {/* Comments List */}
        {comments.map((comment) => {
          const isCommentAuthorSupporter = isPatreonSupporterUsername(
            comment.user_username,
            patreonSupporterUsernames,
          );
          const replyToComment = comment.reply_to_comment_id
            ? comments.find((c) => c.id === comment.reply_to_comment_id)
            : null;

          return (
            <View
              key={comment.id}
              style={[
                styles.commentBlock,
                {
                  borderWidth: 1,
                  borderColor: theme.border,
                  backgroundColor: theme.isDark
                    ? theme.cardBackground
                    : "#FFFFFF",
                },
              ]}
            >
              <View
                style={[
                  styles.commentHeader,
                  {
                    backgroundColor: theme.isDark
                      ? theme.headerBackground ?? theme.backgroundColor
                      : "#F5F5F5",
                    borderBottomWidth: 1,
                    borderBottomColor: theme.border,
                  },
                ]}
              >
                <View style={styles.commentHeaderLeft}>
                  <UserAvatar
                    size={32}
                    email={comment.user_email}
                    level={comment.user_level}
                    fallback={
                      <View
                        style={[
                          styles.avatarFallback,
                          {
                            backgroundColor: theme.isDark ? "#444" : "#E0E0E0",
                          },
                        ]}
                      >
                        <Ionicons
                          name="person"
                          size={16}
                          color={theme.textSecondary}
                        />
                      </View>
                    }
                  />
                  <View style={styles.commentUserInfo}>
                    <View style={styles.usernameRow}>
                      <Text
                        style={{ fontWeight: "bold", color: theme.textColor }}
                      >
                        {comment.user_username}
                      </Text>
                      {comment.user_username === "Portego" &&
                        comment.user_email === "portego2000@hotmail.es" && (
                          <View
                            style={[
                              styles.devBadge,
                              { backgroundColor: theme.primary },
                            ]}
                          >
                            <Text style={styles.devBadgeText}>DEV</Text>
                          </View>
                        )}
                      {isCommentAuthorSupporter && (
                        <View style={styles.inlineBadge}>
                          <PatreonSupporterBadge compact />
                        </View>
                      )}
                    </View>
                    <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                      {formatDistanceToNow(new Date(comment.created_at))} ago
                    </Text>
                  </View>
                </View>
                <View style={styles.commentActions}>
                  <TouchableOpacity
                    style={[
                      styles.commentLikeButton,
                      pendingCommentLikeIds.has(comment.id) &&
                        styles.likePending,
                    ]}
                    hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                    disabled={pendingCommentLikeIds.has(comment.id)}
                    onPress={() => handleToggleCommentLike(comment.id)}
                  >
                    <Ionicons
                      name={comment.is_liked ? "heart" : "heart-outline"}
                      size={16}
                      color={comment.is_liked ? "#FF6B6B" : theme.textSecondary}
                    />
                    <Text
                      style={[
                        styles.commentLikeText,
                        {
                          color: comment.is_liked
                            ? "#FF6B6B"
                            : theme.textSecondary,
                        },
                      ]}
                    >
                      {comment.likes_count}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.commentBody}>
                {/* Show reply context if this is a reply */}
                {replyToComment && (
                  <View
                    style={[
                      styles.replyContext,
                      {
                        backgroundColor: theme.isDark
                          ? "rgba(255, 255, 255, 0.05)"
                          : "rgba(0, 0, 0, 0.03)",
                        borderLeftColor: theme.primary,
                      },
                    ]}
                  >
                    <View style={styles.replyContextHeader}>
                      <Ionicons
                        name="return-down-forward"
                        size={14}
                        color={theme.textSecondary}
                      />
                      <Text
                        style={[
                          styles.replyContextUsername,
                          { color: theme.textSecondary },
                        ]}
                      >
                        Replying to {replyToComment.user_username}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.replyContextContent,
                        { color: theme.textSecondary },
                      ]}
                      numberOfLines={2}
                    >
                      {replyToComment.content}
                    </Text>
                  </View>
                )}

                <Markdown style={markdownStyles(theme)} rules={markdownRules}>
                  {comment.content}
                </Markdown>

                {/* Reply button */}
                <TouchableOpacity
                  style={styles.replyButton}
                  onPress={() => handleReplyToComment(comment)}
                >
                  <Ionicons
                    name="arrow-undo"
                    size={14}
                    color={theme.textSecondary}
                  />
                  <Text
                    style={[styles.replyButtonText, { color: theme.primary }]}
                  >
                    Reply
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {/* Action Buttons (Close/Reopen) */}
        {(isAdmin || isAuthor) && (
          <View style={{ marginTop: 20, alignItems: "flex-start" }}>
            <TouchableOpacity
              style={[
                styles.actionBtn,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.isDark
                    ? theme.cardBackground
                    : "#FFFFFF",
                },
              ]}
              onPress={handleToggleStatus}
            >
              <Text style={{ color: theme.textColor, fontWeight: "600" }}>
                {isOpen ? "Close Issue" : "Reopen Issue"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <CommentComposer
        insetsBottom={insets.bottom}
        theme={theme}
        replyingTo={replyingTo}
        textInputRef={textInputRef}
        onCancelReply={cancelReply}
        onSubmitComment={handleSubmitComment}
      />
    </KeyboardAvoidingView>
  );
}

type CommentComposerProps = {
  insetsBottom: number;
  theme: AppTheme;
  replyingTo: IssueComment | null;
  textInputRef: React.RefObject<TextInput | null>;
  onCancelReply: () => void;
  onSubmitComment: (
    content: string,
    replyToCommentId: string | null
  ) => Promise<boolean>;
};

function CommentComposer({
  insetsBottom,
  theme,
  replyingTo,
  textInputRef,
  onCancelReply,
  onSubmitComment,
}: CommentComposerProps) {
  const [replyContent, setReplyContent] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  const [isUploadingCommentImage, setIsUploadingCommentImage] = useState(false);

  const handleCommentMediaUpload = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        const pickedMedia = result.assets[0];
        const sizeBytes = await imageUploadService.getMediaSizeBytes({
          fileName: pickedMedia.fileName,
          fileSize: pickedMedia.fileSize,
          mimeType: pickedMedia.mimeType,
          type: pickedMedia.type,
          uri: pickedMedia.uri,
        });

        if (typeof sizeBytes === "number" && sizeBytes > ISSUE_MEDIA_MAX_BYTES) {
          Alert.alert(
            "File Too Large",
            `This file is too large. The maximum upload size is ${MAX_MEDIA_SIZE_MB}MB.`
          );
          return;
        }

        setIsUploadingCommentImage(true);
        const uploadedMedia = await imageUploadService.uploadMedia({
          fileName: pickedMedia.fileName,
          fileSize: sizeBytes ?? pickedMedia.fileSize ?? null,
          mimeType: pickedMedia.mimeType,
          type: pickedMedia.type,
          uri: pickedMedia.uri,
        });

        const mediaMarkdown =
          uploadedMedia.mediaType === "video"
            ? `\n![Video](${uploadedMedia.url})\n`
            : `\n![Image](${uploadedMedia.url})\n`;
        setReplyContent((prev) => prev + mediaMarkdown);
        textInputRef.current?.focus();
      }
    } catch (error) {
      if (isIssueMediaTooLargeError(error)) {
        Alert.alert(
          "File Too Large",
          `This file is too large. The maximum upload size is ${MAX_MEDIA_SIZE_MB}MB.`
        );
        return;
      }

      if (isIssueMediaBucketNotFoundError(error)) {
        Alert.alert(
          "Upload Not Configured",
          "Issue media storage is not configured in Supabase yet. Create the `issue-media` storage bucket or set EXPO_PUBLIC_SUPABASE_ISSUE_MEDIA_BUCKET to an existing bucket."
        );
        return;
      }

      console.error("Comment media upload failed", error);
      Alert.alert(
        "Upload Failed",
        "Could not upload this file. Please try again."
      );
    } finally {
      setIsUploadingCommentImage(false);
    }
  }, [textInputRef]);

  const handleSubmit = useCallback(async () => {
    if (!replyContent.trim() || submittingReply || isUploadingCommentImage) {
      return;
    }

    setSubmittingReply(true);
    try {
      const wasSubmitted = await onSubmitComment(
        replyContent,
        replyingTo?.id ?? null
      );

      if (wasSubmitted) {
        setReplyContent("");
      }
    } finally {
      setSubmittingReply(false);
    }
  }, [
    isUploadingCommentImage,
    onSubmitComment,
    replyContent,
    replyingTo?.id,
    submittingReply,
  ]);

  return (
    <View
      style={[
        styles.inputContainer,
        {
          backgroundColor: theme.isDark ? theme.cardBackground : "#F8F8F8",
          borderTopColor: theme.border,
          paddingBottom: Math.max(insetsBottom, 10),
        },
      ]}
    >
      {replyingTo && (
        <View
          style={[
            styles.replyingToBar,
            {
              backgroundColor: theme.isDark
                ? "rgba(255, 255, 255, 0.05)"
                : "rgba(0, 0, 0, 0.03)",
              borderLeftColor: theme.primary,
            },
          ]}
        >
          <View style={styles.replyingToContent}>
            <Ionicons name="return-down-forward" size={14} color={theme.primary} />
            <Text
              style={[styles.replyingToText, { color: theme.textColor }]}
              numberOfLines={1}
            >
              Replying to {replyingTo.user_username}
            </Text>
          </View>
          <TouchableOpacity onPress={onCancelReply}>
            <Ionicons name="close" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputRow}>
        <TextInput
          ref={textInputRef}
          style={[
            styles.input,
            {
              color: theme.textColor,
              backgroundColor: theme.isDark ? theme.backgroundColor : "#FFFFFF",
              borderColor: theme.border,
            },
          ]}
          placeholder="Add a comment..."
          placeholderTextColor={theme.textSecondary}
          value={replyContent}
          onChangeText={setReplyContent}
          multiline
        />
        <TouchableOpacity
          style={[
            styles.imageBtn,
            {
              borderColor: theme.border,
              backgroundColor: theme.isDark ? theme.backgroundColor : "#FFFFFF",
              opacity: isUploadingCommentImage ? 0.6 : 1,
            },
          ]}
          disabled={isUploadingCommentImage || submittingReply}
          onPress={handleCommentMediaUpload}
        >
          {isUploadingCommentImage ? (
            <ActivityIndicator color={theme.primary} size="small" />
          ) : (
            <Ionicons name="images-outline" size={18} color={theme.primary} />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.sendBtn,
            {
              backgroundColor: theme.primary,
              opacity: replyContent.trim() && !isUploadingCommentImage ? 1 : 0.5,
            },
          ]}
          disabled={
            !replyContent.trim() || submittingReply || isUploadingCommentImage
          }
          onPress={handleSubmit}
        >
          {submittingReply ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Ionicons name="arrow-up" size={20} color="white" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const MarkdownImage = ({ src, style }: { src: string; style: any }) => {
  const [aspectRatio, setAspectRatio] = useState(16 / 9);

  useEffect(() => {
    if (!src) return;
    Image.getSize(
      src,
      (width, height) => {
        if (width > 0 && height > 0) {
          setAspectRatio(width / height);
        }
      },
      () => {
        // Silently fail
      }
    );
  }, [src]);

  return (
    <Image
      source={{ uri: src }}
      style={[style, { width: "100%", aspectRatio, height: undefined }]}
      resizeMode="contain"
    />
  );
};

const VIDEO_FILE_PATTERN = /\.(mp4|mov|m4v|webm|avi|mkv|3gp)(\?.*)?$/i;

function isVideoMarkdownAsset(src: string, altText?: string): boolean {
  if (!src) return false;
  if (VIDEO_FILE_PATTERN.test(src)) return true;
  return (altText ?? "").toLowerCase().includes("video");
}

const MarkdownVideo = ({ src, style }: { src: string; style: any }) => {
  const player = useVideoPlayer(src, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.currentTime = 0;
    videoPlayer.pause();
  });

  return (
    <VideoView
      player={player}
      style={[style, { width: "100%", aspectRatio: 16 / 9, height: undefined }]}
      nativeControls
      contentFit="contain"
    />
  );
};

const markdownRules: RenderRules = {
  image: (node: any, _children: any, _parent: any, styles: any) => {
    const src = node.attributes.src;
    const altText = node.attributes.alt;
    if (isVideoMarkdownAsset(src, altText)) {
      return (
        <MarkdownVideo
          key={node.key}
          src={src}
          style={styles.video ?? styles.image}
        />
      );
    }

    return (
      <MarkdownImage
        key={node.key}
        src={src}
        style={styles.image}
      />
    );
  },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 10,
  },
  headerContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    flex: 1,
    textAlign: "center",
  },
  headerButton: {
    padding: 4,
    minWidth: 32,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 12,
    lineHeight: 32,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  commentBlock: {
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
  },
  commentHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  avatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  commentUserInfo: {
    flex: 1,
  },
  usernameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  devBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  devBadgeText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  inlineBadge: {
    marginLeft: 6,
  },
  commentActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  commentBody: {
    padding: 14,
  },
  likeButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 6,
  },
  likeText: {
    fontSize: 14,
    fontWeight: "600",
  },
  commentLikeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 6,
  },
  likePending: {
    opacity: 0.6,
  },
  commentLikeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  replyContext: {
    padding: 10,
    paddingLeft: 12,
    marginBottom: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
  },
  replyContextHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  replyContextUsername: {
    fontSize: 12,
    fontWeight: "600",
  },
  replyContextContent: {
    fontSize: 12,
    fontStyle: "italic",
    lineHeight: 16,
  },
  replyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingVertical: 4,
  },
  replyButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  inputContainer: {
    paddingTop: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  replyingToBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    marginBottom: 8,
  },
  replyingToContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  replyingToText: {
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingBottom: 10,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderWidth: 1,
    fontSize: 16,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
  imageBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
});

const markdownStyles = (theme: any) => ({
  body: { color: theme.textColor, fontSize: 15, lineHeight: 22 },
  heading1: { color: theme.textColor, fontWeight: "bold" as const },
  heading2: { color: theme.textColor, fontWeight: "bold" as const },
  paragraph: { color: theme.textColor, marginBottom: 8 },
  code_inline: {
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
    color: theme.textColor,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  blockquote: {
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
    borderLeftColor: theme.primary,
    borderLeftWidth: 4,
    paddingLeft: 12,
    paddingVertical: 8,
    marginVertical: 8,
  },
  image: { borderRadius: 8, marginTop: 8, marginBottom: 8 },
  video: { borderRadius: 8, marginTop: 8, marginBottom: 8 },
});
