import { render } from "@testing-library/react-native";
import React from "react";
import { StyleSheet, View } from "react-native";
import type { WrappedLevelSubject } from "../../../hooks/useWrappedData";
import { SubjectDropSlide } from "../slides/SubjectDropSlide";

let mockDimensions = { width: 412, height: 915, scale: 1, fontScale: 1 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true, default: () => mockDimensions,
}));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
jest.mock("react-native-svg", () => ({ SvgXml: "SvgXml" }));
jest.mock("../../../utils/radicalSvg", () => ({
  pickBestImage: jest.fn(() => null), useRemoteSvg: jest.fn(() => null),
}));
jest.mock("../../../utils/haptics", () => ({
  impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: "light" },
}));
jest.mock("../../../utils/subjectColors", () => ({ getSubjectTypeColor: () => "#9933cc" }));
jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    __esModule: true, default: { View },
    Easing: { in: () => {}, out: () => {}, inOut: () => {}, quad: 0, cubic: 0 },
    runOnJS: (callback: () => void) => callback,
    useSharedValue: (value: unknown) => React.useRef({ value }).current,
    // Read the actual worklet after its effects finish, like a completed native animation.
    useAnimatedStyle: (factory: () => { transform: unknown; opacity: number }) => ({
      get transform() { return factory().transform; },
      get opacity() { return factory().opacity; },
    }),
    withDelay: (_delay: number, value: unknown) => value,
    withSequence: (...values: unknown[]) => values.at(-1),
    withTiming: (value: unknown) => value,
  };
});

const subjects: WrappedLevelSubject[] = Array.from({ length: 58 }, (_, index) => ({
  id: index + 1, characters: String.fromCodePoint(0x4e00 + index),
  type: index < 27 ? "radical" : "kanji",
}));

function readItems(screen: ReturnType<typeof render>) {
  return screen.UNSAFE_getAllByType(View).flatMap(view => {
    const style = StyleSheet.flatten(view.props.style);
    if (!style?.width || !style?.height || style.position !== "absolute") return [];
    const transform = style.transform as { translateY?: number }[];
    return [{ x: style.left as number, y: (Number(style.top) || 0) + transform.find(item => item.translateY !== undefined)!.translateY!,
      size: style.width as number }];
  });
}

function overlappingPairs(items: ReturnType<typeof readItems>) {
  return items.flatMap((a, index) => items.slice(index + 1).filter(b =>
    Math.abs(a.x - b.x) < a.size * 0.8 && Math.abs(a.y - b.y) < a.size * 0.8));
}

beforeEach(() => {
  mockDimensions = { width: 412, height: 915, scale: 1, fontScale: 1 };
  let seed = 17;
  jest.spyOn(Math, "random").mockImplementation(() => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  });
});
afterEach(() => jest.restoreAllMocks());

it.each([7, 58])("keeps %i subjects in their own grid cells when cached subjects refresh", (count) => {
  const items = subjects.slice(0, count);
  const screen = render(<SubjectDropSlide level={3} levelUpSubjects={items} />);
  const before = readItems(screen);
  expect(before).toHaveLength(count);
  expect(overlappingPairs(before)).toHaveLength(0);
  screen.rerender(<SubjectDropSlide level={3} levelUpSubjects={items.map(subject => ({ ...subject }))} />);
  const after = readItems(screen);
  expect(after).toHaveLength(count);
  expect(overlappingPairs(after)).toHaveLength(0);
});

it("keeps resized columns paired with their current landing rows", () => {
  const screen = render(<SubjectDropSlide level={3} levelUpSubjects={subjects} />);
  mockDimensions = { ...mockDimensions, width: 650, height: 1100 };
  screen.rerender(<SubjectDropSlide level={3} levelUpSubjects={subjects} />);
  expect(overlappingPairs(readItems(screen))).toHaveLength(0);
});
