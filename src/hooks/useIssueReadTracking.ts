import { useCallback, useEffect, useRef } from "react";
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, ScrollView } from "react-native";
import { markIssueRead } from "../utils/issueReadState";

export function useIssueReadTracking(userId: string | undefined, issueId: string, targetComment: string | undefined, scrollView: React.RefObject<ScrollView | null>) {
  const positions = useRef(new Map<string, { y: number; height: number; createdAt: string; readable: boolean }>());
  const viewport = useRef({ y: 0, height: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const targetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastTargetY = useRef<number | undefined>(undefined);
  const dragged = useRef(false);
  useEffect(() => { positions.current.clear(); lastTargetY.current = undefined; dragged.current = false; return () => { clearTimeout(timer.current); clearTimeout(targetTimer.current); }; }, [issueId, userId]);
  const scheduleRead = useCallback(() => {
    clearTimeout(timer.current);
    if (!userId || !viewport.current.height) return;
    timer.current = setTimeout(() => {
      const { y, height } = viewport.current;
      const visible = [...positions.current.values()].filter((position) => position.readable && position.y < y + height - 20 && position.y + position.height > y + 20);
      const latest = visible.map((position) => position.createdAt).sort().at(-1);
      if (latest) void markIssueRead(userId, issueId, latest).catch(() => undefined);
    }, 600);
  }, [userId, issueId]);
  const revealTarget = useCallback(() => {
    clearTimeout(targetTimer.current);
    if (!targetComment || dragged.current) return;
    targetTimer.current = setTimeout(() => {
      const position = positions.current.get(targetComment);
      if (!position || dragged.current || lastTargetY.current === position.y) return;
      lastTargetY.current = position.y;
      const y = Math.max(0, position.y - 8);
      scrollView.current?.scrollTo({ y, animated: false });
      viewport.current.y = y;
      scheduleRead();
    }, 250);
  }, [targetComment, scrollView, scheduleRead]);
  const onCommentLayout = useCallback((id: string, createdAt: string, event: LayoutChangeEvent, ownComment = false) => {
    const { y, height } = event.nativeEvent.layout;
    positions.current.set(id, { y, height, createdAt, readable: !ownComment });
    revealTarget();
    scheduleRead();
  }, [revealTarget, scheduleRead]);
  const onScrollBeginDrag = useCallback(() => { dragged.current = true; clearTimeout(targetTimer.current); }, []);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    viewport.current = { y: event.nativeEvent.contentOffset.y, height: event.nativeEvent.layoutMeasurement.height };
    scheduleRead();
  }, [scheduleRead]);
  const onLayout = useCallback((event: LayoutChangeEvent) => { viewport.current.height = event.nativeEvent.layout.height; scheduleRead(); }, [scheduleRead]);
  return { onScroll, onLayout, onCommentLayout, onScrollBeginDrag, onContentSizeChange: revealTarget };
}
