import { supabase } from "../lib/supabase";

// Types derived from the schema
export interface Issue {
  id: string;
  user_id?: string | null;
  user_email: string;
  user_username: string;
  user_level?: number | null;
  title: string;
  content: string;
  status: "open" | "closed";
  labels: string[] | null;
  created_at: string;
  updated_at: string;
  likes_count: number;
  reply_count: number;
  // Join fields or virtual
  is_liked?: boolean;
}

export interface IssueComment {
  id: string;
  issue_id: string;
  user_id?: string | null;
  user_email: string;
  user_username: string | null;
  user_level?: number | null;
  content: string;
  created_at: string;
  updated_at: string;
  likes_count: number;
  reply_to_comment_id?: string | null;
  is_liked?: boolean;
}

type LikeRow = {
  id: string;
};

function ensureIdentity(userId?: string | null): asserts userId is string {
  if (!userId) {
    throw new Error("Missing user identity");
  }
}

function withIdentity<T extends Record<string, unknown>>(
  payload: T,
  userId?: string | null
): T & { user_id: string } {
  if (userId) {
    return {
      ...payload,
      user_id: userId,
    };
  }

  throw new Error("Missing user identity");
}

async function fetchIssueLikeRows(
  issueId: string,
  userId: string
): Promise<LikeRow[]> {
  const { data, error } = await supabase
    .from("issue_likes")
    .select("id")
    .eq("issue_id", issueId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return (data ?? []) as LikeRow[];
}

async function fetchCommentLikeRows(
  commentId: string,
  userId: string
): Promise<LikeRow[]> {
  const { data, error } = await supabase
    .from("comment_likes")
    .select("id")
    .eq("comment_id", commentId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return (data ?? []) as LikeRow[];
}

async function insertIssueLike(
  issueId: string,
  userId: string
) {
  ensureIdentity(userId);

  const { error } = await supabase
    .from("issue_likes")
    .insert(withIdentity({ issue_id: issueId }, userId));

  if (error) {
    throw error;
  }
}

async function insertCommentLike(
  commentId: string,
  userId: string
) {
  ensureIdentity(userId);

  const { error } = await supabase
    .from("comment_likes")
    .insert(withIdentity({ comment_id: commentId }, userId));

  if (error) {
    throw error;
  }
}

function escapeIlikePattern(value: string): string {
  return value.replace(/[\\%_,()]/g, (match) => `\\${match}`);
}

export const issueService = {
  /**
   * Fetch issues with pagination and filters
   */
  async getIssues(
    page = 0,
    limit = 20,
    status: "open" | "closed" | "all" = "open",
    sortBy: "latest" | "top" = "latest",
    currentUserId?: string | null,
    searchQuery?: string | null
  ) {
    let query = supabase.from("issues").select("*", { count: "exact" });

    // Filter by status
    if (status !== "all") {
      query = query.eq("status", status);
    }

    // Optional text search across title/content/username (server-side broad match).
    const trimmedSearch = (searchQuery ?? "").trim();
    if (trimmedSearch) {
      const escaped = escapeIlikePattern(trimmedSearch);
      const pattern = `%${escaped}%`;
      query = query.or(
        `title.ilike.${pattern},content.ilike.${pattern},user_username.ilike.${pattern}`
      );
    }

    // Sorting
    if (sortBy === "latest") {
      query = query.order("created_at", { ascending: false });
    } else if (sortBy === "top") {
      query = query.order("likes_count", { ascending: false });
    }

    // Pagination
    const from = page * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: issues, error, count } = await query;

    if (error) throw error;

    const safeIssues = (issues ?? []) as Issue[];

    // Check like status for current user
    let issuesWithLikeState: Issue[] = safeIssues;

    if (currentUserId && safeIssues.length > 0) {
      const issueIds = safeIssues.map((i) => i.id);
      const likedIssueIds = new Set<string>();

      const { data: likesByUserId, error: likesByUserIdError } = await supabase
        .from("issue_likes")
        .select("issue_id")
        .eq("user_id", currentUserId)
        .in("issue_id", issueIds);

      if (likesByUserIdError) {
        throw likesByUserIdError;
      }

      (likesByUserId ?? []).forEach((like) => {
        likedIssueIds.add(like.issue_id);
      });

      issuesWithLikeState = safeIssues.map((issue) => ({
        ...issue,
        is_liked: likedIssueIds.has(issue.id),
      }));
    }

    return { issues: issuesWithLikeState, count };
  },

  /**
   * Get total counts of open and closed issues. Used to display badges in the
   * status filter without paginating through every page.
   */
  async getIssueCounts(): Promise<{ open: number; closed: number }> {
    const [openResult, closedResult] = await Promise.all([
      supabase
        .from("issues")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),
      supabase
        .from("issues")
        .select("id", { count: "exact", head: true })
        .eq("status", "closed"),
    ]);

    if (openResult.error) throw openResult.error;
    if (closedResult.error) throw closedResult.error;

    return {
      open: openResult.count ?? 0,
      closed: closedResult.count ?? 0,
    };
  },

  /**
   * Get a single issue details
   */
  async getIssue(
    issueId: string,
    currentUserId?: string | null
  ) {
    const { data, error } = await supabase
      .from("issues")
      .select("*")
      .eq("id", issueId)
      .single();

    if (error) throw error;

    let issueWithLikeState = data as Issue;

    // Check like status for current user
    if (currentUserId) {
      const { data: likeByUserId, error: likeByUserIdError } = await supabase
        .from("issue_likes")
        .select("id")
        .eq("issue_id", issueId)
        .eq("user_id", currentUserId)
        .limit(1)
        .maybeSingle();

      if (likeByUserIdError) {
        throw likeByUserIdError;
      }

      issueWithLikeState = {
        ...data,
        is_liked: Boolean(likeByUserId),
      };
    }

    return issueWithLikeState;
  },

  /**
   * Create a new issue
   */
  async createIssue(
    userId: string | null,
    userEmail: string,
    userUsername: string,
    userLevel: number | null,
    title: string,
    content: string
  ) {
    ensureIdentity(userId);

    const { data, error } = await supabase
      .from("issues")
      .insert(
        withIdentity(
          {
            user_email: userEmail,
            user_username: userUsername,
            user_level: userLevel,
            title,
            content,
            labels: [],
            status: "open",
          },
          userId
        )
      )
      .select()
      .single();

    if (error) throw error;
    return data as Issue;
  },

  /**
   * Close an issue (Admin only or Creator - enforcing generic update for now)
   */
  async updateIssueStatus(issueId: string, status: "open" | "closed") {
    const { data, error } = await supabase
      .from("issues")
      .update({ status })
      .eq("id", issueId)
      .select()
      .single();

    if (error) throw error;
    return data as Issue;
  },

  /**
   * Delete an issue
   */
  async deleteIssue(issueId: string) {
    const { error } = await supabase.from("issues").delete().eq("id", issueId);

    if (error) throw error;
  },

  /**
   * Toggle like on an issue
   */
  async toggleLike(
    issueId: string,
    userId: string | null
  ) {
    ensureIdentity(userId);

    const existingLikes = await fetchIssueLikeRows(issueId, userId);

    if (existingLikes.length > 0) {
      // Unlike
      const { error: deleteError } = await supabase
        .from("issue_likes")
        .delete()
        .in(
          "id",
          existingLikes.map((like) => like.id)
        );

      if (deleteError) throw deleteError;

      // Decrement count
      const { data: issue } = await supabase
        .from("issues")
        .select("likes_count")
        .eq("id", issueId)
        .single();

      if (issue) {
        await supabase
          .from("issues")
          .update({
            likes_count: Math.max(0, (issue.likes_count || 0) - existingLikes.length),
          })
          .eq("id", issueId);
      }
      return false;
    }

    // Like
    await insertIssueLike(issueId, userId);

    // Increment count
    const { data: issue } = await supabase
      .from("issues")
      .select("likes_count")
      .eq("id", issueId)
      .single();

    if (issue) {
      await supabase
        .from("issues")
        .update({ likes_count: (issue.likes_count || 0) + 1 })
        .eq("id", issueId);
    }

    return true;
  },

  /**
   * Get comments for an issue
   */
  async getComments(
    issueId: string,
    currentUserId?: string | null
  ) {
    const { data, error } = await supabase
      .from("issue_comments")
      .select("*")
      .eq("issue_id", issueId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const safeComments = (data ?? []) as IssueComment[];

    // Check like status for current user
    let commentsWithLikeState: IssueComment[] = safeComments;

    if (currentUserId && safeComments.length > 0) {
      const commentIds = safeComments.map((comment) => comment.id);
      const likedCommentIds = new Set<string>();

      const { data: likesByUserId, error: likesByUserIdError } = await supabase
        .from("comment_likes")
        .select("comment_id")
        .eq("user_id", currentUserId)
        .in("comment_id", commentIds);

      if (likesByUserIdError) {
        throw likesByUserIdError;
      }

      (likesByUserId ?? []).forEach((like) => {
        likedCommentIds.add(like.comment_id);
      });

      commentsWithLikeState = safeComments.map((comment) => ({
        ...comment,
        is_liked: likedCommentIds.has(comment.id),
      }));
    }

    return commentsWithLikeState;
  },

  /**
   * Add a comment
   */
  async addComment(
    issueId: string,
    userId: string | null,
    userEmail: string,
    userUsername: string,
    userLevel: number | null,
    content: string,
    replyToCommentId?: string | null
  ) {
    ensureIdentity(userId);

    const { data, error } = await supabase
      .from("issue_comments")
      .insert(
        withIdentity(
          {
            issue_id: issueId,
            user_email: userEmail,
            user_username: userUsername,
            user_level: userLevel,
            content,
            reply_to_comment_id: replyToCommentId || null,
          },
          userId
        )
      )
      .select()
      .single();

    if (error) throw error;

    // Increment reply count
    const { data: issue } = await supabase
      .from("issues")
      .select("reply_count")
      .eq("id", issueId)
      .single();

    if (issue) {
      await supabase
        .from("issues")
        .update({ reply_count: (issue.reply_count || 0) + 1 })
        .eq("id", issueId);
    }

    return data as IssueComment;
  },

  /**
   * Toggle like on a comment
   */
  async toggleCommentLike(
    commentId: string,
    userId: string | null
  ) {
    ensureIdentity(userId);

    const existingLikes = await fetchCommentLikeRows(
      commentId,
      userId
    );

    if (existingLikes.length > 0) {
      // Unlike
      const { error: deleteError } = await supabase
        .from("comment_likes")
        .delete()
        .in(
          "id",
          existingLikes.map((like) => like.id)
        );

      if (deleteError) throw deleteError;

      // Decrement count
      const { data: comment } = await supabase
        .from("issue_comments")
        .select("likes_count")
        .eq("id", commentId)
        .single();

      if (comment) {
        await supabase
          .from("issue_comments")
          .update({
            likes_count: Math.max(
              0,
              (comment.likes_count || 0) - existingLikes.length
            ),
          })
          .eq("id", commentId);
      }
      return false;
    }

    // Like
    await insertCommentLike(commentId, userId);

    // Increment count
    const { data: comment } = await supabase
      .from("issue_comments")
      .select("likes_count")
      .eq("id", commentId)
      .single();

    if (comment) {
      await supabase
        .from("issue_comments")
        .update({ likes_count: (comment.likes_count || 0) + 1 })
        .eq("id", commentId);
    }

    return true;
  },
};
