import { render } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";

// Jest's native resolver prefers .ios; load the universal artifact explicitly.
const { MusicPlayerLayout, supportsPlayerArrangement } =
  jest.requireActual<typeof import("../MusicPlayerLayout")>("../MusicPlayerLayout.tsx");

jest.mock("@expo/ui/swift-ui", () => {
  throw new Error("The universal player layout must not load SwiftUI");
});

it("loads the cross-platform player without importing SwiftUI", () => {
  const screen = render(
    <MusicPlayerLayout
      useArrangement={false}
      preferredVideoRatio={0.5}
      video={<Text>Video</Text>}
      lyrics={<Text>Lyrics</Text>}
      onVideoLayout={jest.fn()}
    />,
  );
  expect(supportsPlayerArrangement).toBe(false);
  expect(screen.getByText("Video")).toBeTruthy();
  expect(screen.getByText("Lyrics")).toBeTruthy();
});
