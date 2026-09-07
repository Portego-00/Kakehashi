import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";

import SrsSubjectsScreen from "../(app)/srs-subjects";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ srsStage: "5", stageName: "Guru" }),
}));

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("react-native-svg", () => ({ SvgXml: () => null }));
jest.mock("../../src/utils/radicalSvg", () => ({
  pickBestImage: () => null,
  useRemoteSvg: () => null,
}));
jest.mock("../../src/utils/subjectColors", () => ({
  getSubjectTypeColor: () => "#9c38d9",
}));
jest.mock("../../src/utils/theme", () => ({
  useTheme: () => ({ theme: {} }),
}));
jest.mock("../../src/hooks/useDashboardData", () => {
  const subjects = [
    { id: 1, object: "kanji", data: { characters: "名", level: 1, meanings: [{ meaning: "Name", primary: true }] } },
    { id: 2, object: "vocabulary", data: { characters: "名前", level: 1, meanings: [{ meaning: "Name", primary: true }], parts_of_speech: ["noun"] } },
    { id: 3, object: "vocabulary", data: { characters: "東京", level: 2, meanings: [{ meaning: "Tokyo", primary: true }], parts_of_speech: ["proper noun"] } },
  ];
  const assignments = subjects.map((subject) => ({
    data: { subject_id: subject.id, srs_stage: 5 },
  }));
  return {
    useDashboardData: () => ({ dashboardData: { subjects, assignments }, isLoading: false }),
  };
});
jest.mock("../../src/components/CommonFilterModal", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Pressable, Text } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    CommonFilterModal: ({ visible, onApply, onClose }: {
      visible: boolean;
      onApply: (values: { vocabularyTypes: string[] }) => void;
      onClose: () => void;
    }) => visible ? React.createElement(
      Pressable,
      {
        accessibilityLabel: "Apply proper noun filter",
        onPress: () => {
          onApply({ vocabularyTypes: ["proper noun"] });
          onClose();
        },
      },
      React.createElement(Text, null, "Apply"),
    ) : null,
  };
});

it("preserves vocabulary types in SRS items and updates filtered counts", async () => {
  const screen = render(<SrsSubjectsScreen />);
  await waitFor(() => expect(screen.getByText("3 of 3 items")).toBeTruthy());

  fireEvent.press(screen.getByLabelText("Vocabulary type filters"));
  fireEvent.press(screen.getByLabelText("Apply proper noun filter"));

  await waitFor(() => expect(screen.getByText("1 of 3 items")).toBeTruthy());
  expect(screen.getByText("Tokyo")).toBeTruthy();
  expect(screen.queryByText("Name")).toBeNull();
  expect(screen.getByLabelText("Vocabulary type filters, 1 selected")).toBeTruthy();

  fireEvent.changeText(screen.getByPlaceholderText("Search by meaning or reading..."), "川");
  expect(screen.getByText("0 of 3 items")).toBeTruthy();
  expect(screen.getByText("No subjects match your search and filters.")).toBeTruthy();
});
