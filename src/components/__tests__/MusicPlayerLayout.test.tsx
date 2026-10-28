import { render } from "@testing-library/react-native";
import React, { useEffect } from "react";
import { Text, View } from "react-native";
import { MusicPlayerLayout } from "../MusicPlayerLayout.ios";

// Inspect the native layout contract without pretending to simulate a physical fold.
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
    RNHostView: pass,
    ZStack: pass,
  };
});
jest.mock("@expo/ui/swift-ui/modifiers", () => ({
  arrangementViewStyle: (style: string) => ({ $type: "arrangementViewStyle", style }),
  onGeometryChange: (handler: unknown) => ({ $type: "onGeometryChange", handler }),
  frame: (dimensions: object) => ({ $type: "frame", ...dimensions }),
  splitArrangementLayoutRatio: (ratios: object) => ({ $type: "splitArrangementLayoutRatio", ...ratios }),
}));

it("keeps the video mounted as lyrics expand, collapse and the pane ratio changes", () => {
  const mount = jest.fn();
  const unmount = jest.fn();
  function Video() {
    useEffect(() => {
      mount();
      return unmount;
    }, []);
    return <View testID="video" />;
  }
  const onVideoLayout = jest.fn();
  const screen = render(
    <MusicPlayerLayout useArrangement preferredVideoRatio={0.35}
      video={<Video />} lyrics={null} onVideoLayout={onVideoLayout} />,
  );

  screen.rerender(
    <MusicPlayerLayout useArrangement preferredVideoRatio={0.5}
      video={<Video />} lyrics={<Text>Synced lyrics</Text>} onVideoLayout={onVideoLayout} />,
  );
  expect(screen.getByText("Synced lyrics")).toBeTruthy();
  expect(screen.getByTestId("player-arrangement").props.modifiers).toEqual(
    expect.arrayContaining([{ $type: "arrangementViewStyle", style: "split" }]),
  );
  screen.rerender(
    <MusicPlayerLayout useArrangement preferredVideoRatio={0.35}
      video={<Video />} lyrics={null} onVideoLayout={onVideoLayout} />,
  );

  expect(screen.queryByText("Synced lyrics")).toBeNull();
  expect(mount).toHaveBeenCalledTimes(1);
  expect(unmount).not.toHaveBeenCalled();
});

it("keeps the existing React Native flow on platforms without native arrangements", () => {
  const screen = render(
    <MusicPlayerLayout useArrangement={false} preferredVideoRatio={0.35}
      video={<Text>Video</Text>} lyrics={<Text>Lyrics</Text>} onVideoLayout={jest.fn()} />,
  );
  expect(screen.queryByTestId("native-player-host")).toBeNull();
  expect(screen.getByText("Video")).toBeTruthy();
  expect(screen.getByText("Lyrics")).toBeTruthy();
});
