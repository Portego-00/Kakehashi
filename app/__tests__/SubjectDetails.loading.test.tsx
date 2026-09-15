import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";

import SubjectDetailsScreen from "../(app)/subject/[id]";
import {
  createStudyMaterial,
  getAssignmentsForSubjectsCached,
  getReviewStatistics,
  getSpacedRepetitionSystems,
  getStudyMaterials,
  getSubject,
  updateStudyMaterial,
} from "../../src/utils/api";

const mockSubject = {
  id: 1001,
  object: "vocabulary",
  data: {
    characters: "大人",
    meanings: [{ meaning: "adult", primary: true }],
    readings: [],
  },
};
const mockMaterial = {
  id: 77,
  data: {
    subject_id: 1001,
    meaning_synonyms: ["grown-up"],
    meaning_note: "My existing note",
  },
};
let mockVocabularyProps: any;
const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack }),
  useLocalSearchParams: () => ({ id: "1001" }),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock("../../src/utils/store", () => ({
  useAuthStore: () => ({ apiToken: "fixture-token", userData: { level: 1 } }),
  useSettingsStore: () => ({ visuallySimilarKanjiSource: "wanikani" }),
}));
jest.mock("../../src/utils/theme", () => ({ useTheme: () => ({ theme: {} }) }));
jest.mock("../../src/hooks/useSubjectLists", () => ({
  useSubjectLists: () => ({ lists: [], toggleSubjectInList: jest.fn() }),
}));
jest.mock("../../src/utils/cache", () => ({
  getSubjectById: jest.fn(async () => mockSubject),
  getStudyMaterialsFromPermanentCache: jest.fn(async () => null),
  clearStudyMaterialsCache: jest.fn(async () => {}),
}));
jest.mock("../../src/utils/api", () => ({
  getSubject: jest.fn(),
  getAssignmentsForSubjectsCached: jest.fn(),
  getStudyMaterials: jest.fn(),
  getReviewStatistics: jest.fn(),
  getSpacedRepetitionSystems: jest.fn(),
  createStudyMaterial: jest.fn(),
  updateStudyMaterial: jest.fn(),
}));
jest.mock("../../src/utils/niaiSimilarKanji", () => ({
  getNiaiSimilarKanjiSubjects: jest.fn(async () => []),
}));
jest.mock("../../src/components/AddToSubjectListsModal", () => () => null);
jest.mock("../../src/components/KanjiDetails", () => () => null);
jest.mock("../../src/components/RadicalDetails", () => () => null);
jest.mock("../../src/components/VocabularyDetails", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Text, TouchableOpacity } = jest.requireActual<typeof import("react-native")>("react-native");
  return function VocabularyDetails(props: any) {
    mockVocabularyProps = props;
    return <TouchableOpacity onPress={() => props.vocabulary.onEditNote("meaning")}>
      <Text>Edit meaning note</Text>
    </TouchableOpacity>;
  };
});
jest.mock("../../src/components/formatted-note", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { TextInput } = jest.requireActual<typeof import("react-native")>("react-native");
  const Editor = React.forwardRef((_props: any, _ref) => <TextInput {..._props} />);
  Editor.displayName = "Editor";
  return { FormattedNoteEditor: Editor };
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

async function openCard() {
  const screen = render(<SubjectDetailsScreen />);
  await act(async () => {});
  await act(async () => { jest.advanceTimersByTime(350); });
  return screen;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockVocabularyProps = undefined;
  jest.mocked(getStudyMaterials).mockReset();
  jest.mocked(createStudyMaterial).mockReset();
  jest.mocked(getSubject).mockResolvedValue(mockSubject as never);
  jest.mocked(getAssignmentsForSubjectsCached).mockResolvedValue({ data: [] } as never);
  jest.mocked(getStudyMaterials).mockResolvedValue({ data: [mockMaterial] });
  jest.mocked(getReviewStatistics).mockResolvedValue({ data: [] });
  jest.mocked(getSpacedRepetitionSystems).mockResolvedValue({ data: [] });
  jest.mocked(updateStudyMaterial).mockImplementation(async (_token, _id, updates) => ({
    ...mockMaterial, data: { ...mockMaterial.data, ...updates },
  }));
});
afterEach(() => { jest.useRealTimers(); });

it("shows synonyms and opens the existing note while review statistics are still pending (#83/#84)", async () => {
  jest.mocked(getReviewStatistics).mockReturnValue(deferred<any>().promise);
  const screen = await openCard();

  expect(mockVocabularyProps.vocabulary.userSynonyms).toEqual(["grown-up"]);
  fireEvent.press(screen.getByText("Edit meaning note"));
  expect(screen.getByLabelText("Meaning note text").props.value).toBe("My existing note");
  expect(mockVocabularyProps.progressionStatus).toBe("success");
});

it("does not make notes/synonyms wait for a slow SRS request (#84)", async () => {
  jest.mocked(getAssignmentsForSubjectsCached).mockResolvedValue({ data: [{ data: {
    subject_id: 1001, srs_stage: 5, spaced_repetition_system_id: 1,
  } }] } as never);
  jest.mocked(getSpacedRepetitionSystems).mockReturnValue(deferred<any>().promise);
  await openCard();

  expect(mockVocabularyProps.vocabulary.userSynonyms).toEqual(["grown-up"]);
  expect(mockVocabularyProps.vocabulary.srsStage).toBe(5);
  expect(mockVocabularyProps.progressionStatus).toBe("success");
});

it("loads account details from a cached card even if subject revalidation hangs (#83/#84)", async () => {
  jest.mocked(getSubject).mockReturnValue(deferred<any>().promise);
  await openCard();

  expect(getStudyMaterials).toHaveBeenCalled();
  expect(mockVocabularyProps.vocabulary.userSynonyms).toEqual(["grown-up"]);
});

it("preserves unseen server synonyms when saving before card loading finishes (#83)", async () => {
  const pendingStats = deferred<any>();
  jest.mocked(getReviewStatistics).mockReturnValue(pendingStats.promise);
  jest.mocked(createStudyMaterial).mockRejectedValue(new Error("API error: 422"));
  await openCard();

  await act(async () => { await mockVocabularyProps.onSynonymsChange(["mature person"], []); });

  expect(updateStudyMaterial).toHaveBeenCalledWith("fixture-token", 77, {
    meaning_synonyms: ["grown-up", "mature person"],
  });
});


it("keeps personal data editable while the progression request itself is pending (#84)", async () => {
  jest.mocked(getAssignmentsForSubjectsCached).mockReturnValue(deferred<any>().promise);
  const screen = await openCard();
  expect(mockVocabularyProps.progressionStatus).toBe("loading");
  fireEvent.press(screen.getByText("Edit meaning note"));
  expect(screen.getByLabelText("Meaning note text").props.value).toBe("My existing note");
  expect(mockVocabularyProps.vocabulary.userSynonyms).toEqual(["grown-up"]);
});

it("does not let a delayed card read overwrite synonyms just saved (#83)", async () => {
  const oldRead = deferred<any>();
  jest.mocked(getStudyMaterials)
    .mockReturnValueOnce(oldRead.promise)
    .mockResolvedValue({ data: [mockMaterial] });
  await openCard();
  await act(async () => { await mockVocabularyProps.onSynonymsChange(["mature person"], []); });
  expect(mockVocabularyProps.vocabulary.userSynonyms).toEqual(["grown-up", "mature person"]);
  await act(async () => { oldRead.resolve({ data: [mockMaterial] }); });
  expect(mockVocabularyProps.vocabulary.userSynonyms).toEqual(["grown-up", "mature person"]);
});

it.each(["synonym", "note"])("still applies a pending personal-data read when a %s save fails", async (action) => {
  const pendingRead = deferred<any>();
  jest.mocked(getStudyMaterials)
    .mockReturnValueOnce(pendingRead.promise)
    .mockRejectedValueOnce(new Error("Network unavailable"));
  jest.mocked(createStudyMaterial).mockRejectedValueOnce(new Error("Network unavailable"));
  const screen = await openCard();
  expect(mockVocabularyProps.vocabulary.userSynonyms).toEqual([]);
  if (action === "synonym") {
    await act(async () => {
      await expect(mockVocabularyProps.onSynonymsChange(["mature person"], []))
        .rejects.toThrow("Network unavailable");
    });
  } else {
    fireEvent.press(screen.getByText("Edit meaning note"));
    fireEvent.changeText(screen.getByLabelText("Meaning note text"), "New note");
    await act(async () => { fireEvent.press(screen.getByText("Save")); });
    expect(createStudyMaterial).toHaveBeenCalled();
  }
  await act(async () => { pendingRead.resolve({ data: [mockMaterial] }); });
  expect(mockVocabularyProps.vocabulary.userSynonyms).toEqual(["grown-up"]);
});

it("still shows personal data when its response arrives after the old progression deadline (#83)", async () => {
  const materialRead = deferred<any>();
  jest.mocked(getStudyMaterials).mockReturnValue(materialRead.promise);
  await openCard();
  await act(async () => { jest.advanceTimersByTime(10_000); });
  await act(async () => { materialRead.resolve({ data: [mockMaterial] }); });
  expect(mockVocabularyProps.vocabulary.userSynonyms).toEqual(["grown-up"]);
});


it("keeps a newer note when an earlier synonym save response arrives last", async () => {
  let serverMaterial = { ...mockMaterial, data: { ...mockMaterial.data } };
  let finishSynonymSave!: () => void;
  jest.mocked(getStudyMaterials).mockImplementation(async () => ({ data: [serverMaterial] }));
  jest.mocked(updateStudyMaterial).mockImplementation(async (_token, _id, updates) => {
    serverMaterial = { ...serverMaterial, data: { ...serverMaterial.data, ...updates } };
    const savedSnapshot = serverMaterial;
    if (updates.meaning_synonyms) {
      await new Promise<void>(resolve => { finishSynonymSave = resolve; });
    }
    return savedSnapshot;
  });
  const screen = await openCard();
  let saveSynonyms!: Promise<void>;
  await act(async () => {
    saveSynonyms = mockVocabularyProps.onSynonymsChange(["grown-up", "mature person"], ["grown-up"]);
  });
  fireEvent.press(screen.getByText("Edit meaning note"));
  fireEvent.changeText(screen.getByLabelText("Meaning note text"), "My newer saved note");
  await act(async () => { fireEvent.press(screen.getByText("Save")); });
  expect(mockVocabularyProps.vocabulary.meaningNote).toBe("My newer saved note");
  await act(async () => { finishSynonymSave(); await saveSynonyms; });
  expect(mockVocabularyProps.vocabulary.meaningNote).toBe("My newer saved note");
  expect(mockVocabularyProps.vocabulary.userSynonyms).toEqual(["grown-up", "mature person"]);
  expect(serverMaterial.data.meaning_note).toBe("My newer saved note");
});


it("keeps newer synonyms when an earlier note save response arrives last", async () => {
  let serverMaterial = { ...mockMaterial, data: { ...mockMaterial.data } };
  let finishNoteSave!: () => void;
  jest.mocked(getStudyMaterials).mockImplementation(async () => ({ data: [serverMaterial] }));
  jest.mocked(updateStudyMaterial).mockImplementation(async (_token, _id, updates) => {
    serverMaterial = { ...serverMaterial, data: { ...serverMaterial.data, ...updates } };
    const savedSnapshot = serverMaterial;
    if (updates.meaning_note) {
      await new Promise<void>(resolve => { finishNoteSave = resolve; });
    }
    return savedSnapshot;
  });
  const screen = await openCard();
  fireEvent.press(screen.getByText("Edit meaning note"));
  fireEvent.changeText(screen.getByLabelText("Meaning note text"), "My newer saved note");
  await act(async () => { fireEvent.press(screen.getByText("Save")); });
  await act(async () => {
    await mockVocabularyProps.onSynonymsChange(["grown-up", "mature person"], ["grown-up"]);
  });
  expect(mockVocabularyProps.vocabulary.userSynonyms).toEqual(["grown-up", "mature person"]);
  await act(async () => { finishNoteSave(); });
  expect(mockVocabularyProps.vocabulary.userSynonyms).toEqual(["grown-up", "mature person"]);
  expect(mockVocabularyProps.vocabulary.meaningNote).toBe("My newer saved note");
});
