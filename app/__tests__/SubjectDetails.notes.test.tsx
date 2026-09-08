import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { Modal } from "react-native";

import SubjectDetailsScreen from "../(app)/subject/[id]";

const mockSubject = {
  id: 1,
  object: "radical",
  data: {
    characters: "一",
    meanings: [{ meaning: "ground", primary: true }],
  },
};

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ id: "1" }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 59, right: 0, bottom: 34, left: 0 }),
}));

jest.mock("../../src/utils/store", () => ({
  useAuthStore: () => ({ apiToken: "test-token", userData: { level: 1 } }),
  useSettingsStore: () => ({ visuallySimilarKanjiSource: "wanikani" }),
}));

jest.mock("../../src/utils/theme", () => ({
  useTheme: () => ({ theme: {} }),
}));

jest.mock("../../src/hooks/useSubjectLists", () => ({
  useSubjectLists: () => ({ lists: [], toggleSubjectInList: jest.fn() }),
}));

jest.mock("../../src/utils/cache", () => ({
  getSubjectById: jest.fn(async () => mockSubject),
  clearStudyMaterialsCache: jest.fn(async () => {}),
}));

jest.mock("../../src/utils/api", () => ({
  getSubject: jest.fn(async () => mockSubject),
  getAssignmentsForSubjectsCached: jest.fn(async () => ({ data: [] })),
  getStudyMaterials: jest.fn(async () => ({ data: [] })),
  getReviewStatistics: jest.fn(async () => ({ data: [] })),
}));

jest.mock("../../src/utils/niaiSimilarKanji", () => ({
  getNiaiSimilarKanjiSubjects: jest.fn(async () => []),
}));

jest.mock("../../src/components/AddToSubjectListsModal", () => () => null);
jest.mock("../../src/components/KanjiDetails", () => () => null);
jest.mock("../../src/components/VocabularyDetails", () => () => null);

jest.mock("../../src/components/RadicalDetails", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Text, TouchableOpacity } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return function MockRadicalDetails({ radical }: { radical: { onEditNote: () => void } }) {
    return (
      <TouchableOpacity onPress={radical.onEditNote}>
        <Text>Edit meaning note</Text>
      </TouchableOpacity>
    );
  };
});

jest.mock("../../src/components/formatted-note", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { TextInput, TouchableOpacity, Text } =
    jest.requireActual<typeof import("react-native")>("react-native");
  const Editor = React.forwardRef<
    { closeLinkPicker: () => boolean },
    React.ComponentProps<typeof TextInput>
  >((props, ref) => {
    const [pickerOpen, setPickerOpen] = React.useState(false);
    React.useImperativeHandle(ref, () => ({
      closeLinkPicker: () => {
        if (!pickerOpen) return false;
        setPickerOpen(false);
        return true;
      },
    }));
    return (
      <>
        <TextInput {...props} />
        <TouchableOpacity onPress={() => setPickerOpen(true)}>
          <Text>Insert subject link</Text>
        </TouchableOpacity>
        {pickerOpen && <Text>Subject link picker</Text>}
      </>
    );
  });
  Editor.displayName = "MockNoteEditor";
  return { FormattedNoteEditor: Editor };
});

it.each(["Cancel", "close button", "request close"])(
  "dismisses the subject picker before the subject note editor through %s",
  async (dismissAction) => {
    const screen = render(<SubjectDetailsScreen />);
    await waitFor(() => expect(screen.getByText("Edit meaning note")).toBeTruthy());
    fireEvent.press(screen.getByText("Edit meaning note"));
    fireEvent.changeText(screen.getByLabelText("Meaning note text"), "My unsaved note");
    fireEvent.press(screen.getByText("Insert subject link"));
    expect(screen.getByText("Subject link picker")).toBeTruthy();

    const dismiss = () => {
      if (dismissAction === "Cancel") {
        fireEvent.press(screen.getByText("Cancel"));
      } else if (dismissAction === "close button") {
        fireEvent.press(screen.getByLabelText("Close note editor"));
      } else {
        fireEvent(screen.UNSAFE_getByType(Modal), "requestClose");
      }
    };
    dismiss();

    expect(screen.queryByText("Subject link picker")).toBeNull();
    expect(screen.getByLabelText("Meaning note text").props.value).toBe("My unsaved note");

    dismiss();
    expect(screen.queryByLabelText("Meaning note text")).toBeNull();
  },
);
