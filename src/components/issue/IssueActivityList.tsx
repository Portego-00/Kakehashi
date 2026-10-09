import React, { memo, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import type { IssueActivity } from "../../services/issueActivityService";
import { useTheme } from "../../utils/theme";
import { isUnreadIssueActivity } from "../../utils/issueReadState";
import type { useIssueActivity } from "../../hooks/useIssueActivity";

const ActivityRow = memo(function ActivityRow({ item, unread, onOpen }: { item: IssueActivity; unread: boolean; onOpen: (id: string, comment?: string) => void }) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const comments = expanded ? item.comments : item.comments.slice(0, 1);
  return <View style={[styles.row, { borderColor: theme.border, backgroundColor: theme.cardBackground }]}>
    <TouchableOpacity onPress={() => onOpen(item.issue.id, unread ? item.latestReply?.id : undefined)} accessibilityLabel={`${item.issue.title}${unread ? ", new reply" : ""}`}>
      <View style={styles.titleRow}><Text style={[styles.title, { color: theme.textColor }]}>{item.issue.title}</Text>{unread ? <Text style={[styles.badge, { backgroundColor: theme.primary }]}>New reply</Text> : null}</View>
      <Text style={[styles.meta, { color: theme.textSecondary }]}>{item.issue.status === "closed" ? "Closed · " : ""}{item.posted ? "You created this issue" : item.comments.length ? "You joined this conversation" : "You liked this issue"}</Text>
      {item.latestReply ? <Text style={[styles.meta, { color: theme.textSecondary }]}>Latest reply by {item.latestReply.username}</Text> : null}
      {item.posted ? <Text numberOfLines={3} style={[styles.body, { color: theme.textColor }]}>{item.issue.content}</Text> : null}
    </TouchableOpacity>
    {comments.map((comment) => <TouchableOpacity key={comment.id} onPress={() => onOpen(item.issue.id, comment.id)} style={[styles.comment, { borderColor: theme.border }]}>
      <Text style={[styles.meta, { color: theme.textSecondary }]}>Your comment · {new Date(comment.createdAt).toLocaleDateString()}</Text><Text numberOfLines={4} style={[styles.body, { color: theme.textColor }]}>{comment.content}</Text>
    </TouchableOpacity>)}
    {item.comments.length > 1 ? <TouchableOpacity onPress={() => setExpanded(!expanded)}><Text style={[styles.more, { color: theme.primary }]}>{expanded ? "Show less" : `Show all ${item.comments.length} comments`}</Text></TouchableOpacity> : null}
  </View>;
});
export function IssueActivityList({ activity, query, onOpen }: { activity: ReturnType<typeof useIssueActivity>; query: string; onOpen: (id: string, comment?: string) => void }) {
  const { theme } = useTheme();
  const [onlyUnread, setOnlyUnread] = useState(false);
  const items = useMemo(() => activity.items.filter((item) => (!onlyUnread || isUnreadIssueActivity(item, activity.visits)) && `${item.issue.title} ${item.issue.content} ${item.comments.map((comment) => comment.content).join(" ")}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [activity.items, activity.visits, onlyUnread, query]);
  return <FlatList data={items} keyExtractor={(item) => item.issue.id} contentContainerStyle={styles.list} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled"
    refreshControl={<RefreshControl refreshing={activity.loading && activity.items.length > 0} onRefresh={activity.reload} tintColor={theme.primary} />}
    ListHeaderComponent={<View style={styles.filters}><Text style={{ color: theme.textSecondary }}>Your posts, comments, and liked threads.</Text><View style={styles.filterRow}><Text style={{ color: theme.textColor }}>New replies only</Text><Switch accessibilityLabel="New replies only" value={onlyUnread} onValueChange={setOnlyUnread} /></View>{activity.error ? <TouchableOpacity onPress={activity.reload}><Text style={{ color: theme.error }}>{activity.error} Tap to retry.</Text></TouchableOpacity> : null}</View>}
    ListEmptyComponent={activity.loading ? <ActivityIndicator color={theme.primary} /> : <Text style={[styles.empty, { color: theme.textSecondary }]}>{onlyUnread ? "You’re caught up. No new replies." : query ? "No activity matches your search." : "Your posts and comments will appear here when you join a conversation."}</Text>}
    renderItem={({ item }) => <ActivityRow item={item} unread={isUnreadIssueActivity(item, activity.visits)} onOpen={onOpen} />} />;
}
const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 100, gap: 12 }, filters: { gap: 12, marginBottom: 12 }, filterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  row: { padding: 16, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8 }, titleRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  title: { flexShrink: 1, fontSize: 16, fontWeight: "600" }, badge: { color: "#FFFFFF", fontSize: 11, fontWeight: "600", borderRadius: 4, paddingVertical: 3, paddingHorizontal: 6 },
  meta: { fontSize: 12, marginTop: 4 }, body: { fontSize: 14, lineHeight: 21, marginTop: 8 }, comment: { marginTop: 12, borderLeftWidth: 2, paddingLeft: 12 }, more: { fontSize: 13, marginTop: 12 }, empty: { textAlign: "center", paddingVertical: 40 },
});
