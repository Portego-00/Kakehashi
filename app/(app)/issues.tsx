import { Ionicons } from "@expo/vector-icons";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useSession } from "../../src/contexts/AuthContext";
import { usePatreonSupporterUsernames } from "../../src/hooks/usePatreonSupporterUsernames";
import { Issue, issueService } from "../../src/services/issueService";
import { rankByFuzzyQuery } from "../../src/utils/fuzzyText";
import { useAuthStore } from "../../src/utils/store";
import { useTheme } from "../../src/utils/theme";

import { useIssueActivity } from "../../src/hooks/useIssueActivity";
import { IssueActivityList } from "../../src/components/issue/IssueActivityList";
import { IssueViewMenu } from "../../src/components/issue/issue-view-menu";
import IssueList from "../../src/components/issue/IssueList";

const SEARCH_FETCH_LIMIT = 200;

type StatusFilter = "open" | "closed";

export default function CommunityTab() {
  const PAGE_SIZE = 20;

  const router = useRouter();
  const { theme } = useTheme();
  const { apiToken, userData } = useAuthStore();
  const { isLoading: isAuthLoading } = useSession();

  const [view, setView] = useState<"board" | "activity">("board");
  const activity = useIssueActivity(userData?.id == null ? userData?.username : String(userData.id), userData?.username);
  const openActivity = useCallback((id: string, comment?: string) => router.push({ pathname: "/issue/[id]", params: { id, ...(comment ? { comment } : {}) } }), [router]);

  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"open" | "closed">("open");
  const [sortBy] = useState<"latest" | "top">("latest");
  const [hasError, setHasError] = useState(false);

  // Pagination state
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [pendingLikeIssueIds, setPendingLikeIssueIds] = useState<Set<string>>(
    new Set()
  );
  const patreonSupporterUsernames = usePatreonSupporterUsernames();

  // Search state
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [totalCounts, setTotalCounts] = useState<{
    open: number;
    closed: number;
  } | null>(null);
  // Pool of recent issues across both statuses, used only when searching so we
  // can do typo-tolerant fuzzy matching client-side and produce search-aware
  // counts for both tabs.
  const [searchPool, setSearchPool] = useState<Issue[]>([]);

  // Track the latest search query to avoid stale fetches racing.
  const searchRequestId = useRef(0);
  const fetchingMoreRef = useRef(false);
  const searchPoolRequestId = useRef(0);

  // Debounce search input → query.
  useEffect(() => {
    const handle = setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 250);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const isSearching = searchQuery.length > 0;

  const fetchCounts = useCallback(async () => {
    if (isAuthLoading || !apiToken) return;
    try {
      const result = await issueService.getIssueCounts();
      setTotalCounts(result);
    } catch (error) {
      console.error("Error fetching issue counts:", error);
    }
  }, [apiToken, isAuthLoading]);

  // When the user is searching, pull a wider, status-agnostic window of
  // recent issues so fuzzy ranking has enough candidates to work with.
  useEffect(() => {
    if (!isSearching || isAuthLoading || !apiToken) {
      return;
    }

    const requestId = ++searchPoolRequestId.current;
    issueService
      .getIssues(
        0,
        SEARCH_FETCH_LIMIT,
        "all",
        "latest",
        userData?.id ?? null
      )
      .then(({ issues: pool }) => {
        if (requestId !== searchPoolRequestId.current) return;
        setSearchPool(pool);
      })
      .catch((error) => {
        if (requestId !== searchPoolRequestId.current) return;
        console.error("Error fetching search pool:", error);
      });
  }, [isSearching, apiToken, isAuthLoading, userData?.id]);

  const fetchIssues = useCallback(async (
    isRefresh = false,
    newFilter = filter,
    newSortBy = sortBy,
    showRefreshIndicator = true,
    viewerId = userData?.id ?? null
  ) => {
    if (isAuthLoading || !apiToken) {
      return;
    }

    if (isRefresh && fetchingMoreRef.current) {
      return;
    }

    if (!isRefresh && (fetchingMoreRef.current || loading || refreshing || !hasMore)) {
      return;
    }

    const requestId = ++searchRequestId.current;
    if (!isRefresh) fetchingMoreRef.current = true;
    const keepLoadedPages = isRefresh && !showRefreshIndicator && issues.length > 0;

    try {
      const pageToFetch = isRefresh ? 0 : page;
      if (isRefresh) {
        if (showRefreshIndicator) {
          setRefreshing(true);
        } else if (issues.length === 0) {
          setLoading(true);
        }
      } else {
        setIsFetchingMore(true);
      }

      const { issues: newIssues, count } = await issueService.getIssues(
        pageToFetch,
        PAGE_SIZE,
        newFilter,
        newSortBy,
        viewerId
      );

      // Drop the result if a newer request already started.
      if (requestId !== searchRequestId.current) {
        return;
      }

      if (isRefresh) {
        if (keepLoadedPages) {
          // A focus refresh updates existing rows without shrinking or reordering
          // the list underneath the reader. Pull-to-refresh loads the latest page.
          const updates = new Map(newIssues.map((issue) => [issue.id, issue]));
          setIssues((previous) => previous.map((issue) => updates.get(issue.id) ?? issue));
          setPage((previous) => Math.max(1, previous));
        } else {
          setIssues(newIssues);
          setPage(1);
        }
      } else {
        setIssues((prev) => {
          const existingIds = new Set(prev.map((issue) => issue.id));
          const appended = newIssues.filter(
            (issue) => !existingIds.has(issue.id)
          );
          return [...prev, ...appended];
        });
        setPage((prev) => prev + 1);
      }

      if (typeof count === "number") {
        const loadedCount = keepLoadedPages ? issues.length : pageToFetch * PAGE_SIZE + newIssues.length;
        setHasMore(loadedCount < count);
      } else {
        setHasMore(newIssues.length === PAGE_SIZE);
      }
      setHasError(false);
    } catch (error) {
      console.error("Error fetching issues:", error);
      if (requestId !== searchRequestId.current) {
        return;
      }
      if (isRefresh || issues.length === 0) {
        setHasError(true);
      }
    } finally {
      if (requestId !== searchRequestId.current) {
        return;
      }
      if (isRefresh) {
        setLoading(false);
        if (showRefreshIndicator) {
          setRefreshing(false);
        }
      } else {
        fetchingMoreRef.current = false;
        setIsFetchingMore(false);
      }
    }
  }, [apiToken, isAuthLoading, filter, sortBy, loading, refreshing, hasMore, page, issues.length, userData?.id]);

  const fetchIssuesRef = useRef(fetchIssues);
  useEffect(() => { fetchIssuesRef.current = fetchIssues; }, [fetchIssues]);

  // Refresh paginated issues when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (isAuthLoading || !apiToken) {
        return;
      }
      fetchIssuesRef.current(true, filter, sortBy, false, userData?.id ?? null);
      fetchCounts();
    }, [apiToken, isAuthLoading, filter, sortBy, userData?.id, fetchCounts])
  );

  const handleFilterChange = (newFilter: StatusFilter) => {
    setView("board");
    if (newFilter === filter) return;
    searchRequestId.current += 1;
    fetchingMoreRef.current = false;
    setIsFetchingMore(false);
    setFilter(newFilter);
    setIssues([]);
    setPage(0);
    setHasMore(true);
    setLoading(true);
  };

  const handleToggleLike = async (issueId: string) => {
    if (!apiToken || pendingLikeIssueIds.has(issueId)) return;

    let previousIssue: Issue | null = null;

    // Optimistic update for instant feedback.
    setIssues((prevIssues) =>
      prevIssues.map((issue) => {
        if (issue.id !== issueId) return issue;
        previousIssue = issue;
        const nextLiked = !Boolean(issue.is_liked);
        return {
          ...issue,
          is_liked: nextLiked,
          likes_count: nextLiked
            ? issue.likes_count + 1
            : Math.max(0, issue.likes_count - 1),
        };
      })
    );

    if (!previousIssue) return;

    setPendingLikeIssueIds((prev) => {
      const next = new Set(prev);
      next.add(issueId);
      return next;
    });

    try {
      await issueService.toggleLike(issueId, userData?.id ?? null);
    } catch (error) {
      console.error("Failed to toggle like:", error);
      setIssues((prevIssues) =>
        prevIssues.map((issue) =>
          issue.id === issueId && previousIssue
            ? {
                ...issue,
                is_liked: previousIssue.is_liked,
                likes_count: previousIssue.likes_count,
              }
            : issue
        )
      );
    } finally {
      setPendingLikeIssueIds((prev) => {
        const next = new Set(prev);
        next.delete(issueId);
        return next;
      });
    }
  };

  const handleIssuePress = (issue: Issue) => {
    router.push({
      pathname: "/issue/[id]",
      params: {
        id: issue.id,
      },
    });
  };

  // Apply fuzzy ranking client-side when a search query is active. The pool
  // contains issues from both statuses so we can produce search-aware counts
  // for each tab; the visible list is then filtered to the active status.
  const fuzzyMatches = useMemo(() => {
    if (!isSearching) return null;
    return rankByFuzzyQuery(
      searchPool,
      searchQuery,
      (issue) => [
        { text: issue.title, weight: 200 },
        { text: issue.user_username ?? "", weight: 80 },
        { text: issue.content ?? "", weight: 0 },
      ]
    );
  }, [isSearching, searchPool, searchQuery]);

  const visibleIssues = useMemo(() => {
    if (!fuzzyMatches) return issues;
    return fuzzyMatches
      .map((entry) => entry.item)
      .filter((issue) => issue.status === filter);
  }, [fuzzyMatches, issues, filter]);

  const displayCounts = useMemo<{ open: number; closed: number } | null>(() => {
    if (fuzzyMatches) {
      let open = 0;
      let closed = 0;
      for (const { item } of fuzzyMatches) {
        if (item.status === "open") open += 1;
        else if (item.status === "closed") closed += 1;
      }
      return { open, closed };
    }
    return totalCounts;
  }, [fuzzyMatches, totalCounts]);

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style={theme.statusBarStyle} />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.headerBackground,
            paddingTop: 60,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginRight: 12 }}
          >
            <Ionicons name="arrow-back" size={24} color={theme.headerText} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.headerText }]}>
            {view === "activity" ? "My activity" : filter === "closed" ? "Closed issues" : "Issues"}
          </Text>

        </View>

        {/* Search and community views */}
        <View style={styles.searchRow}>
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: theme.headerSurface,
              borderColor: "transparent",
            },
          ]}
        >
          <Ionicons
            name="search"
            size={18}
            color={theme.headerText}
            style={{ opacity: 0.85 }}
          />
          <TextInput
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder={view === "activity" ? "Search your posts and comments..." : "Search issues..."}
            placeholderTextColor={`${theme.headerText}99`}
            style={[styles.searchInput, { color: theme.headerText }]}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            returnKeyType="search"
            clearButtonMode="never"
          />
          {searchInput.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchInput("")}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <Ionicons
                name="close-circle"
                size={18}
                color={theme.headerText}
                style={{ opacity: 0.85 }}
              />
            </TouchableOpacity>
          )}
        </View>
        <IssueViewMenu selected={view === "activity" ? "activity" : filter} counts={{ open: displayCounts?.open ?? null, closed: displayCounts?.closed ?? null, activity: activity.unreadCount }} onSelect={(next) => next === "activity" ? setView("activity") : handleFilterChange(next)} />
        </View>
      </View>

      {/* Main List */}
      <View style={styles.content}>
        {view === "activity" ? <IssueActivityList activity={activity} query={searchQuery} onOpen={openActivity} /> : hasError && issues.length === 0 ? (
          <View style={styles.offlineContainer}>
            <Ionicons
              name="cloud-offline-outline"
              size={64}
              color={theme.textLight}
            />
            <Text style={[styles.offlineTitle, { color: theme.textColor }]}>
              Unable to Load Issues
            </Text>
            <Text style={[styles.offlineText, { color: theme.textSecondary }]}>
              Connect to WiFi to view community issues
            </Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: theme.primary }]}
              onPress={() => fetchIssues(true, filter, sortBy, false)}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <IssueList
            issues={visibleIssues}
            isLoading={loading}
            isRefreshing={refreshing}
            patreonSupporterUsernames={patreonSupporterUsernames}
            pendingLikeIssueIds={pendingLikeIssueIds}
            onRefresh={() => {
              fetchIssues(true);
              fetchCounts();
            }}
            onLoadMore={() => {
              if (
                !isSearching &&
                !loading &&
                !refreshing &&
                !isFetchingMore &&
                hasMore
              ) {
                fetchIssues(false);
              }
            }}
            onPressIssue={handleIssuePress}
            onToggleLike={handleToggleLike}
          />
        )}
      </View>

      {/* FAB to create issue */}
      <TouchableOpacity
        style={[
          styles.fab,
          { backgroundColor: theme.primary, bottom: 30 },
        ]}
        onPress={() => router.push("/issue/new")}
      >
        <Ionicons name="add" size={30} color="white" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 10,
  },
  headerContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    rowGap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    flex: 1,
    minWidth: 0,
  },
  searchRow: { marginTop: 12, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minHeight: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 4,
  },
  content: {
    flex: 1,
  },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  offlineContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  offlineTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 8,
  },
  offlineText: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});
