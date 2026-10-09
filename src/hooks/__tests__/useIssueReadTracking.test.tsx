import React, { useRef } from "react";
import { View, type ScrollView } from "react-native";
import { act, fireEvent, render } from "@testing-library/react-native";
import { useIssueReadTracking } from "../useIssueReadTracking";
import { markIssueRead } from "../../utils/issueReadState";

jest.mock("../../utils/issueReadState", () => ({ markIssueRead: jest.fn(async () => undefined) }));
const createdAt = "2026-10-08T12:00:00Z";
function Harness() {
  const scroll = useRef<ScrollView | null>(null);
  const tracking = useIssueReadTracking("viewer", "thread", undefined, scroll);
  return <View testID="viewport" onLayout={tracking.onLayout} onScroll={tracking.onScroll}><View testID="reply" onLayout={(event) => tracking.onCommentLayout("reply", createdAt, event)} /></View>;
}
beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); });
afterEach(() => jest.useRealTimers());
it("marks only replies that stay in the visible viewport and cancels pending reads on unmount", () => {
  const screen = render(<Harness />);
  fireEvent(screen.getByTestId("viewport"), "layout", { nativeEvent: { layout: { height: 600, y: 0, x: 0, width: 390 } } });
  fireEvent(screen.getByTestId("reply"), "layout", { nativeEvent: { layout: { height: 100, y: 900, x: 0, width: 390 } } });
  act(() => jest.advanceTimersByTime(700));
  expect(markIssueRead).not.toHaveBeenCalled();
  fireEvent.scroll(screen.getByTestId("viewport"), { nativeEvent: { contentOffset: { y: 850 }, layoutMeasurement: { height: 600 } } });
  act(() => jest.advanceTimersByTime(200));
  fireEvent.scroll(screen.getByTestId("viewport"), { nativeEvent: { contentOffset: { y: 0 }, layoutMeasurement: { height: 600 } } });
  act(() => jest.advanceTimersByTime(700));
  expect(markIssueRead).not.toHaveBeenCalled();
  fireEvent.scroll(screen.getByTestId("viewport"), { nativeEvent: { contentOffset: { y: 850 }, layoutMeasurement: { height: 600 } } });
  act(() => jest.advanceTimersByTime(700));
  expect(markIssueRead).toHaveBeenCalledWith("viewer", "thread", createdAt);
  jest.clearAllMocks();
  fireEvent.scroll(screen.getByTestId("viewport"), { nativeEvent: { contentOffset: { y: 850 }, layoutMeasurement: { height: 600 } } });
  screen.unmount();
  act(() => jest.advanceTimersByTime(700));
  expect(markIssueRead).not.toHaveBeenCalled();
});
