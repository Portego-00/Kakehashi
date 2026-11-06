import React from "react";
import { render } from "@testing-library/react-native";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import Svg, { Circle } from "react-native-svg";
import PitchAccentVisualization from "../PitchAccentVisualization";

jest.mock("../../utils/theme", () => ({
  useTheme: () => ({
    theme: {
      primary: "#326ac0",
      textColor: "black",
      textSecondary: "gray",
      border: "gray",
      isDark: false,
    },
  }),
}));

describe("pitch accent kana alignment", () => {
  it.each([
    { reading: "にほん", moras: ["に", "ほ", "ん"], compact: false },
    { reading: "にほん", moras: ["に", "ほ", "ん"], compact: true },
    { reading: "きゃく", moras: ["きゃ", "く"], compact: false },
    { reading: "き", moras: ["き"], compact: true },
    {
      reading: "インターネットサービス",
      moras: ["イ", "ン", "タ", "ー", "ネ", "ッ", "ト", "サ", "ー", "ビ", "ス"],
      compact: true,
    },
  ])("centers $reading under its markers (compact=$compact)", ({ reading, moras, compact }) => {
    const accents = [...new Set([0, 1, Math.min(2, moras.length), moras.length])];
    const view = render(
      <PitchAccentVisualization reading={reading} accents={accents} compact={compact} />,
    );
    const charts = view.UNSAFE_getAllByType(Svg);
    const rows = view.UNSAFE_getAllByType(View).filter((node) => {
      const style = StyleSheet.flatten(node.props.style);
      return style?.flexDirection === "row" && node.findAllByType(Text).some(
        (child) => child.props.children === moras[0],
      );
    });

    expect(rows).toHaveLength(accents.length);
    rows.forEach((row, patternIndex) => {
      const chart = charts[patternIndex];
      const markers = chart.findAllByType(Circle);
      const cells = React.Children.toArray(row.props.children).filter(
        React.isValidElement<{ style: StyleProp<ViewStyle>; children?: React.ReactNode }>,
      );
      const rowStyle = StyleSheet.flatten(row.props.style);
      const padding = rowStyle.paddingHorizontal ?? 0;
      const widths = cells.map((cell) => {
        const width = StyleSheet.flatten(cell.props.style).width;
        if (typeof width !== "number") {
          throw new Error("Each mora cell must have a numeric width");
        }
        return width;
      });
      const rowWidth = rowStyle.width ?? padding * 2 + widths.reduce((sum, width) => sum + width, 0);
      let cellLeft = (Number(chart.props.width) - rowWidth) / 2 + padding;

      moras.forEach((mora, index) => {
        expect(cells[index].props.children).toBe(mora);
        expect(cellLeft + widths[index] / 2).toBeCloseTo(markers[index].props.cx);
        cellLeft += widths[index];
      });

      // The hollow particle marker needs an empty cell of the same width.
      expect(cells).toHaveLength(markers.length);
      expect(cells[moras.length].props.children).toBeUndefined();
      expect(widths[moras.length]).toBe(widths[0]);
      expect(cellLeft + widths[moras.length] / 2).toBeCloseTo(markers[moras.length].props.cx);
    });
  });
});
