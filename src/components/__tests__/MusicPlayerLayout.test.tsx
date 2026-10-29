import { act, render } from "@testing-library/react-native";
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { MusicPlayerLayout } from "../MusicPlayerLayout.ios";

// Inspect the native event contract; simulator checks verify the physical fold.
jest.mock("@expo/ui/swift-ui", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  const pass = ({ children, ...props }: React.PropsWithChildren<object>) =>
    React.createElement(View, props, children);
  return {
    Host: ({ children, ...props }: React.PropsWithChildren<object>) =>
      React.createElement(View, { ...props, testID: "native-player-host" }, children),
    ArrangementView: Object.assign(
      ({ children, ...props }: React.PropsWithChildren<object>) =>
        React.createElement(View, { ...props, testID: "player-arrangement" }, children),
      { Primary: pass, Secondary: pass },
    ),
    ZStack: ({ children, modifiers, ...props }: any) => {
      const testID = modifiers.some((m: any) => m.$type === "onHingeChange")
        ? "hinge-probe"
        : modifiers.some((m: any) => m.$type === "splitArrangementLayoutRatio")
          ? "primary-probe" : "secondary-probe";
      return React.createElement(View, { ...props, modifiers, testID }, children);
    },
  };
});
jest.mock("@expo/ui/swift-ui/modifiers", () => ({
  arrangementViewStyle: (style: string) => ({ $type: "arrangementViewStyle", style }),
  onGeometryChange: (handler: unknown) => ({ $type: "onGeometryChange", handler }),
  onHingeChange: (handler: unknown) => ({ $type: "onHingeChange", handler }),
  frame: (dimensions: object) => ({ $type: "frame", ...dimensions }),
  splitArrangementLayoutRatio: (ratios: object) => ({ $type: "splitArrangementLayoutRatio", ...ratios }),
}));

type Screen = ReturnType<typeof render>;
const hidden = { includeHiddenElements: true };
function event(screen: Screen, probe: string, type: string, ...args: unknown[]) {
  const handler = screen.getByTestId(probe, hidden).props.modifiers
    .find((m: { $type: string }) => m.$type === type).handler;
  act(() => handler(...args));
}
function hinge(screen: Screen, status: string | null) {
  event(screen, "hinge-probe", "onHingeChange", { hinge: null },
    { hinge: status ? { status, angle: 90 } : null });
}
function measure(screen: Screen) {
  event(screen, "hinge-probe", "onGeometryChange", { x: 10, y: 30, width: 669, height: 951 });
  event(screen, "primary-probe", "onGeometryChange", { x: 10, y: 30, width: 669, height: 455.5 });
  event(screen, "secondary-probe", "onGeometryChange", { x: 10, y: 525.5, width: 669, height: 455.5 });
}

it("keeps the video in the ordinary phone flow until a partial fold is reported", () => {
  const onArrangementChange = jest.fn();
  const screen = render(
    <MusicPlayerLayout useArrangement preferredVideoRatio={0.5}
      video={<View testID="video" />} lyrics={<Text>Lyrics</Text>}
      onVideoLayout={jest.fn()} onArrangementChange={onArrangementChange} />,
  );
  expect(screen.getByTestId("native-player-host", hidden).findAllByProps({ testID: "video" }).length).toBe(0);
  expect(screen.queryByTestId("player-arrangement", hidden)).toBeNull();
  expect(StyleSheet.flatten(screen.getByTestId("music-video-pane").props.style)).toBeUndefined();
  expect(onArrangementChange).toHaveBeenLastCalledWith(false);
});

it.each([null, "closed", "fullyOpen", "unknown"])("retains the old player for hinge status %s", (status) => {
  const onArrangementChange = jest.fn();
  const screen = render(
    <MusicPlayerLayout useArrangement preferredVideoRatio={0.5}
      video={<Text>Video</Text>} lyrics={<Text>Lyrics</Text>}
      onVideoLayout={jest.fn()} onArrangementChange={onArrangementChange} />,
  );
  hinge(screen, status);
  expect(screen.queryByTestId("player-arrangement", hidden)).toBeNull();
  expect(onArrangementChange).toHaveBeenLastCalledWith(false);
});

it("uses fresh fold-aware frames and keeps playback mounted through fold, unfold, collapse and reopen", () => {
  const mount = jest.fn();
  const unmount = jest.fn();
  const onArrangementChange = jest.fn();
  const onNativeGeometryChange = jest.fn();
  function Video() {
    useEffect(() => { mount(); return unmount; }, []);
    return <View testID="video" />;
  }
  const props = {
    useArrangement: true, preferredVideoRatio: 0.5,
    video: <Video />, lyrics: <Text>Synced lyrics</Text>, onVideoLayout: jest.fn(),
    onArrangementChange, onNativeGeometryChange,
  };
  const screen = render(<MusicPlayerLayout {...props} />);
  hinge(screen, "partiallyOpen");
  expect(onArrangementChange).toHaveBeenLastCalledWith(false);
  measure(screen);
  expect(onArrangementChange).toHaveBeenLastCalledWith(true);
  expect(StyleSheet.flatten(screen.getByTestId("music-video-pane").props.style)).toEqual({
    position: "absolute", left: 0, top: 0, width: 669, height: 455.5,
  });
  expect(StyleSheet.flatten(screen.getByTestId("music-lyrics-pane").props.style)).toEqual({
    position: "absolute", left: 0, top: 495.5, width: 669, height: 455.5,
  });
  expect(onNativeGeometryChange).toHaveBeenCalledWith("primary", {
    x: 10, y: 30, width: 669, height: 455.5,
  });
  // Angle updates within the same posture do not reset the measured panes.
  hinge(screen, "partiallyOpen");
  expect(onArrangementChange).toHaveBeenLastCalledWith(true);

  hinge(screen, "fullyOpen");
  expect(onArrangementChange).toHaveBeenLastCalledWith(false);
  expect(screen.queryByTestId("player-arrangement", hidden)).toBeNull();
  expect(StyleSheet.flatten(screen.getByTestId("music-video-pane").props.style)).toBeUndefined();
  screen.rerender(<MusicPlayerLayout {...props} lyrics={null} preferredVideoRatio={0.35} />);
  screen.rerender(<MusicPlayerLayout {...props} />);
  hinge(screen, "partiallyOpen");
  expect(onArrangementChange).toHaveBeenLastCalledWith(false);
  measure(screen);
  expect(onArrangementChange).toHaveBeenLastCalledWith(true);
  expect(mount).toHaveBeenCalledTimes(1);
  expect(unmount).not.toHaveBeenCalled();
});

it("keeps the old flow when a partially open view does not span the hinge", () => {
  const onArrangementChange = jest.fn();
  const screen = render(
    <MusicPlayerLayout useArrangement preferredVideoRatio={0.5}
      video={<Text>Video</Text>} lyrics={<Text>Lyrics</Text>}
      onVideoLayout={jest.fn()} onArrangementChange={onArrangementChange} />,
  );
  hinge(screen, "partiallyOpen");
  event(screen, "hinge-probe", "onGeometryChange", { x: 0, y: 0, width: 669, height: 951 });
  event(screen, "primary-probe", "onGeometryChange", { x: 0, y: 0, width: 669, height: 475.5 });
  event(screen, "secondary-probe", "onGeometryChange", { x: 0, y: 475.5, width: 669, height: 475.5 });
  expect(onArrangementChange).toHaveBeenLastCalledWith(false);
});

it("keeps the existing React Native flow on platforms without native arrangements", () => {
  const screen = render(
    <MusicPlayerLayout useArrangement={false} preferredVideoRatio={0.35}
      video={<Text>Video</Text>} lyrics={<Text>Lyrics</Text>} onVideoLayout={jest.fn()} />,
  );
  expect(screen.queryByTestId("native-player-host", hidden)).toBeNull();
  expect(screen.getByText("Video")).toBeTruthy();
  expect(screen.getByText("Lyrics")).toBeTruthy();
});
