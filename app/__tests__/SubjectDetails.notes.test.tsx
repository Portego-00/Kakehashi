import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert, Modal } from "react-native";
import * as Linking from "expo-linking";

import SubjectDetailsScreen from "../(app)/subject/[id]";
import { createStudyMaterial, updateStudyMaterial } from "../../src/utils/api";

let mockFlushedNoteText: string | undefined;
let mockInitialNoteText = "";
let mockHasStudyMaterial = true;
const mockOpenURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
const mockEditorFlush = jest.fn((value?: string) =>
  Promise.resolve(mockFlushedNoteText ?? value ?? ""),
);
const mockAlert = jest.spyOn(Alert, "alert");

jest.mock("expo-linking", () => ({ openURL: jest.fn(async () => true) }));
// Note-save tests exercise the write flow independently of idle scheduling.
jest.mock("../../src/utils/scheduleIdleTask", () => ({
  scheduleIdleTask: (work: () => void) => { work(); return { cancel: jest.fn() }; },
}));

function respondToDiscardAlert(action: "Keep editing" | "Discard") {
  const buttons = mockAlert.mock.calls.at(-1)?.[2];
  act(() => buttons?.find((button) => button.text === action)?.onPress?.());
}

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
  getStudyMaterialsFromPermanentCache: jest.fn(async () => null),
  clearStudyMaterialsCache: jest.fn(async () => {}),
}));

jest.mock("../../src/utils/api", () => ({
  getSubject: jest.fn(async () => mockSubject),
  getAssignmentsForSubjectsCached: jest.fn(async () => ({ data: [] })),
  getStudyMaterials: jest.fn(async () => ({
    data: mockHasStudyMaterial ? [{ id: 1, data: { subject_id: 1, meaning_note: mockInitialNoteText } }] : [],
  })),
  getReviewStatistics: jest.fn(async () => ({ data: [] })),
  updateStudyMaterial: jest.fn(async (_token: string, id: number, updates: object) => ({ id, data: { subject_id: 1, ...updates } })),
  createStudyMaterial: jest.fn(async (_token: string, updates: object) => ({ id: 2, data: updates })),
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
  return function MockRadicalDetails({ radical }: { radical: { onEditNote: () => void; onRemoveNoteImage?: (index: number) => Promise<void> } }) {
    return (
      <>
      <TouchableOpacity onPress={radical.onEditNote}>
        <Text>Edit meaning note</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => radical.onRemoveNoteImage?.(0)}><Text>Remove image</Text></TouchableOpacity>
      </>
    );
  };
});

jest.mock("../../src/components/formatted-note", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { TextInput, TouchableOpacity, Text } =
    jest.requireActual<typeof import("react-native")>("react-native");
  const Editor = React.forwardRef<
    { closeLinkPicker: () => boolean; flush: () => Promise<string> },
    React.ComponentProps<typeof TextInput> & { onImageComposerOpenChange?: (open: boolean) => void }
  >((props, ref) => {
    const [pickerOpen, setPickerOpen] = React.useState(false);
    React.useImperativeHandle(ref, () => ({
      flush: () => mockEditorFlush(props.value),
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
        <TouchableOpacity onPress={() => props.onImageComposerOpenChange?.(true)}><Text>Add image</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => props.onImageComposerOpenChange?.(false)}><Text>Cancel image</Text></TouchableOpacity>
      </>
    );
  });
  Editor.displayName = "MockNoteEditor";
  return { FormattedNoteEditor: Editor };
});

beforeEach(() => {
  mockAlert.mockClear();
  mockEditorFlush.mockClear();
  jest.mocked(updateStudyMaterial).mockClear();
  jest.mocked(createStudyMaterial).mockClear();
  mockOpenURL.mockClear();
  mockHasStudyMaterial = true;
  mockFlushedNoteText = undefined;
  mockInitialNoteText = "";
});

afterAll(() => { mockAlert.mockRestore(); mockOpenURL.mockRestore(); });

it.each([
  ["create", 401], ["create", 403], ["update", 401], ["update", 403],
] as const)("explains missing permissions on %s (%s) and keeps the image note draft", async (operation, status) => {
  mockHasStudyMaterial = operation === "update";
  const save = operation === "create" ? jest.mocked(createStudyMaterial) : jest.mocked(updateStudyMaterial);
  save.mockRejectedValueOnce(Object.assign(new Error("Unauthorized. Nice try."), { statusCode: status }));
  const screen = await renderSubjectNote();
  const draft = 'Bridge\n<img src="https://example.com/bridge.png">';
  fireEvent.changeText(screen.getByLabelText("Meaning note text"), draft);
  fireEvent.press(screen.getByRole("button", { name: "Save note" }));
  await waitFor(() => expect(mockAlert).toHaveBeenCalledWith(
    "Enable saving notes",
    expect.stringContaining("study_materials:create"),
    expect.arrayContaining([expect.objectContaining({ text: "Open API token settings" })]),
  ));
  expect(mockAlert.mock.calls.at(-1)?.[1]).toContain("study_materials:update");
  expect(screen.getByLabelText("Meaning note text").props.value).toBe(draft);
  act(() => mockAlert.mock.calls.at(-1)?.[2]?.find((button) => button.text === "Open API token settings")?.onPress?.());
  expect(mockOpenURL).toHaveBeenCalledWith("https://www.wanikani.com/settings/personal_access_tokens");
});

it("disables Save note until the image form is finished", async () => {
  const screen = await renderSubjectNote();
  expect(screen.getByRole("button", { name: "Save note" }).props.accessibilityState.disabled).toBe(false);
  fireEvent.press(screen.getByText("Add image"));
  expect(screen.getByRole("button", { name: "Save note" }).props.accessibilityState.disabled).toBe(true);
  fireEvent.press(screen.getByText("Cancel image"));
  expect(screen.getByRole("button", { name: "Save note" }).props.accessibilityState.disabled).toBe(false);
});

it("saves image removal from the details viewer while keeping the formatted note", async () => {
  mockInitialNoteText = '<b>Bridge</b>\n<img src="https://example.com/a.png">\n<img src="https://example.com/b.png">';
  const screen = render(<SubjectDetailsScreen />);
  await waitFor(() => expect(screen.getByText("Edit meaning note")).toBeTruthy());
  fireEvent.press(screen.getByText("Remove image"));
  await waitFor(() => expect(updateStudyMaterial).toHaveBeenCalledWith("test-token", 1, { meaning_note: '<b>Bridge</b>\n<img src="https://example.com/b.png">' }));
  fireEvent.press(screen.getByText("Edit meaning note"));
  expect(screen.getByLabelText("Meaning note text").props.value).toBe('<b>Bridge</b>\n<img src="https://example.com/b.png">');
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

    expect(mockAlert).not.toHaveBeenCalled();
    expect(mockEditorFlush).not.toHaveBeenCalled();
    dismiss();
    await waitFor(() => expect(mockAlert).toHaveBeenCalledWith(
      "Discard note changes?",
      "Your changes will not be saved.",
      expect.arrayContaining([
        expect.objectContaining({ text: "Keep editing", style: "cancel" }),
        expect.objectContaining({ text: "Discard", style: "destructive" }),
      ]),
    ));
    respondToDiscardAlert("Keep editing");
    expect(screen.getByLabelText("Meaning note text").props.value).toBe("My unsaved note");
    dismiss();
    await waitFor(() => expect(mockAlert).toHaveBeenCalledTimes(2));
    respondToDiscardAlert("Discard");
    expect(screen.queryByLabelText("Meaning note text")).toBeNull();
  },
);

async function renderSubjectNote() {
  const screen = render(<SubjectDetailsScreen />);
  await waitFor(() => expect(screen.getByText("Edit meaning note")).toBeTruthy(), { timeout: 5000 });
  fireEvent.press(screen.getByText("Edit meaning note"));
  return screen;
}

it.each([
  ["", ""],
  ["<u><b>bridge</b></u>", "<b><u>bridge</u></b>"],
  ["<b>bridge</b><b> notes</b>", "<b>bridge notes</b>"],
])("closes unchanged subject note %j without asking to discard", async (original, flushed) => {
  mockInitialNoteText = original;
  const screen = await renderSubjectNote();
  expect(screen.getByLabelText("Meaning note text").props.value).toBe(original);
  mockFlushedNoteText = flushed;
  await act(async () => { fireEvent.press(screen.getByLabelText("Close note editor")); });
  expect(mockEditorFlush).toHaveBeenCalledTimes(1);
  expect(mockAlert).not.toHaveBeenCalled();
  expect(screen.queryByLabelText("Meaning note text")).toBeNull();
});

it.each([
  ["", "Last native keystroke"],
  ["bridge", "<b>bridge</b>"],
  ['<a href="wk://subject/440">bridge</a>', '<a href="wk://subject/441">bridge</a>'],
  ["bridge", 'bridge\n<img src="https://example.com/a.png">'],
  ['bridge\n<img src="https://example.com/a.png">', "bridge"],
])("checks the freshly flushed subject draft %j before closing", async (original, flushed) => {
  mockInitialNoteText = original;
  const screen = await renderSubjectNote();
  mockFlushedNoteText = flushed;
  fireEvent.press(screen.getByLabelText("Close note editor"));
  await waitFor(() => expect(mockAlert).toHaveBeenCalledTimes(1));
  respondToDiscardAlert("Keep editing");
  expect(screen.getByLabelText("Meaning note text").props.value).toBe(flushed);
});
