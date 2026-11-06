import { renderHook, waitFor } from "@testing-library/react-native";
import { getSubjectById } from "../../../utils/cache";
import { usePracticeSubjects } from "../use-practice-subjects";

jest.mock("../../../utils/cache", () => ({ getSubjectById: jest.fn() }));
beforeEach(() => jest.clearAllMocks());

it("loads source records for restored puzzle IDs without reloading for reordered or duplicate IDs", async () => {
  jest.mocked(getSubjectById).mockImplementation(async id => ({ id, object: "vocabulary", data: {} }));
  const screen = renderHook(({ ids }) => usePracticeSubjects(ids), { initialProps: { ids: [2, 1, 2] } });
  await waitFor(() => expect(screen.result.current.size).toBe(2));
  screen.rerender({ ids: [1, 2] });
  expect(getSubjectById).toHaveBeenCalledTimes(2);
  screen.unmount();
});

it("does not use old records for a different puzzle and tolerates missing local sources", async () => {
  jest.mocked(getSubjectById).mockImplementation(async id => {
    if (id === 2) throw new Error("missing cache");
    return { id, object: "vocabulary", data: {} };
  });
  const screen = renderHook(({ ids }) => usePracticeSubjects(ids), { initialProps: { ids: [1] } });
  await waitFor(() => expect(screen.result.current.has(1)).toBe(true));
  screen.rerender({ ids: [2] });
  expect(screen.result.current.has(1)).toBe(false);
  await waitFor(() => expect(getSubjectById).toHaveBeenCalledWith(2));
  expect(screen.result.current.has(2)).toBe(false);
  screen.unmount();
});
