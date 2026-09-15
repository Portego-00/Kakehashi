import { createStudyMaterial, getStudyMaterials, updateStudyMaterial } from "../api";
import { saveMeaningSynonyms } from "../studyMaterialSynonyms";

jest.mock("../api", () => ({
  getStudyMaterials: jest.fn(),
  createStudyMaterial: jest.fn(),
  updateStudyMaterial: jest.fn(),
}));
const material = (synonyms: string[]) => ({
  id: 77, data: { subject_id: 1001, meaning_synonyms: synonyms, meaning_note: "Untouched note" },
});
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getStudyMaterials).mockResolvedValue({ data: [material(["grown-up", "adult person"])] });
  jest.mocked(updateStudyMaterial).mockImplementation(async (_token, _id, updates) => ({
    ...material([]), data: { ...material([]).data, ...updates },
  }));
});

it("preserves all unseen synonyms when a card opened before personal data arrived", async () => {
  const result = await saveMeaningSynonyms("fixture-token", 1001, [], ["mature person"]);
  expect(getStudyMaterials).toHaveBeenCalledWith("fixture-token", { subject_ids: [1001] }, {
    skipCache: true, allowOfflineFallback: false,
  });
  expect(createStudyMaterial).not.toHaveBeenCalled();
  expect(updateStudyMaterial).toHaveBeenCalledWith("fixture-token", 77, {
    meaning_synonyms: ["grown-up", "adult person", "mature person"],
  });
  expect(result.data.meaning_note).toBe("Untouched note");
});

it("removes only synonyms explicitly removed in the editor, keeping concurrent additions", async () => {
  await saveMeaningSynonyms("fixture-token", 1001, ["grown-up"], ["mature person"]);
  expect(updateStudyMaterial).toHaveBeenCalledWith("fixture-token", 77, {
    meaning_synonyms: ["adult person", "mature person"],
  });
});

it("does not re-add synonyms removed elsewhere if the local editor left them unchanged", async () => {
  jest.mocked(getStudyMaterials).mockResolvedValue({ data: [material([])] });
  await saveMeaningSynonyms("fixture-token", 1001, ["grown-up"], ["grown-up", "mature person"]);
  expect(updateStudyMaterial).toHaveBeenCalledWith("fixture-token", 77, {
    meaning_synonyms: ["mature person"],
  });
});

it("does not write if the live read fails instead of treating a cache miss as an empty array", async () => {
  jest.mocked(getStudyMaterials).mockRejectedValue(new Error("Network unavailable"));
  await expect(saveMeaningSynonyms("fixture-token", 1001, [], ["mature person"]))
    .rejects.toThrow("Network unavailable");
  expect(updateStudyMaterial).not.toHaveBeenCalled();
  expect(createStudyMaterial).not.toHaveBeenCalled();
});

it("does not create from a malformed collection", async () => {
  jest.mocked(getStudyMaterials).mockResolvedValue({ error: "API error" });
  await expect(saveMeaningSynonyms("fixture-token", 1001, [], ["mature person"]))
    .rejects.toThrow("Could not verify");
  expect(updateStudyMaterial).not.toHaveBeenCalled();
  expect(createStudyMaterial).not.toHaveBeenCalled();
});

it("creates only after a live response confirms there is no material", async () => {
  jest.mocked(getStudyMaterials).mockResolvedValue({ data: [] });
  await saveMeaningSynonyms("fixture-token", 1001, [], ["mature person"]);
  expect(createStudyMaterial).toHaveBeenCalledWith("fixture-token", {
    subject_id: 1001, meaning_synonyms: ["mature person"],
  });
});

it("merges into a material created elsewhere between the live read and create", async () => {
  jest.mocked(getStudyMaterials)
    .mockResolvedValueOnce({ data: [] })
    .mockResolvedValueOnce({ data: [material(["grown-up"])] });
  jest.mocked(createStudyMaterial).mockRejectedValue(new Error("API error: 422"));
  await saveMeaningSynonyms("fixture-token", 1001, [], ["mature person"]);
  expect(updateStudyMaterial).toHaveBeenCalledWith("fixture-token", 77, {
    meaning_synonyms: ["grown-up", "mature person"],
  });
});

it("never sends custom SRS ids to WaniKani", async () => {
  await expect(saveMeaningSynonyms("fixture-token", -1, [], ["mature person"]))
    .rejects.toThrow("does not use WaniKani");
  expect(getStudyMaterials).not.toHaveBeenCalled();
});


it("preserves both additions when two editors save the same subject concurrently", async () => {
  let serverSynonyms = ["grown-up"];
  let finishFirstWrite!: () => void;
  let signalFirstWrite!: () => void;
  const firstWriteStarted = new Promise<void>(resolve => { signalFirstWrite = resolve; });
  jest.mocked(getStudyMaterials).mockImplementation(async () => ({
    data: [material([...serverSynonyms])],
  }));
  jest.mocked(updateStudyMaterial).mockImplementation(async (_token, _id, updates) => {
    if (updates.meaning_synonyms?.includes("first addition") &&
        !updates.meaning_synonyms.includes("second addition")) {
      signalFirstWrite();
      await new Promise<void>(resolve => { finishFirstWrite = resolve; });
    }
    serverSynonyms = updates.meaning_synonyms ?? [];
    return material(serverSynonyms);
  });

  const first = saveMeaningSynonyms("fixture-token", 1001, [], ["first addition"]);
  await firstWriteStarted;
  const second = saveMeaningSynonyms("fixture-token", 1001, [], ["second addition"]);
  finishFirstWrite();
  await Promise.all([first, second]);
  expect(serverSynonyms).toEqual(["grown-up", "first addition", "second addition"]);
});

it("continues queued saves after a failed write", async () => {
  jest.mocked(updateStudyMaterial)
    .mockRejectedValueOnce(new Error("Write failed"));
  const first = saveMeaningSynonyms("fixture-token", 1001, [], ["first addition"]);
  const second = saveMeaningSynonyms("fixture-token", 1001, [], ["second addition"]);
  const results = await Promise.allSettled([first, second]);
  expect(results[0]).toMatchObject({ status: "rejected", reason: new Error("Write failed") });
  expect(results[1]).toMatchObject({ status: "fulfilled", value: material([
    "grown-up", "adult person", "second addition",
  ]) });
  // A later save must remain independent of the settled failure too.
  await expect(saveMeaningSynonyms("fixture-token", 1001, [], ["third addition"]))
    .resolves.toMatchObject(material(["grown-up", "adult person", "third addition"]));
});

it.each(["other account", "other subject"])("does not block saves for an %s behind a pending subject save", async (scope) => {
  let releaseFirstRead!: () => void;
  jest.mocked(getStudyMaterials).mockImplementationOnce(async () => {
    await new Promise<void>(resolve => { releaseFirstRead = resolve; });
    return { data: [material(["grown-up"])] };
  }).mockImplementation(async (_token, params) => ({ data: [{
    ...material(["other existing"]),
    data: { ...material(["other existing"]).data, subject_id: params?.subject_ids?.[0] },
  }] }));
  const first = saveMeaningSynonyms("fixture-token", 1001, [], ["first addition"]);
  const second = saveMeaningSynonyms(
    scope === "other account" ? "other-fixture-token" : "fixture-token",
    scope === "other subject" ? 1002 : 1001,
    [], ["independent addition"],
  );
  try {
    await expect(second).resolves.toMatchObject({ data: {
      meaning_synonyms: ["other existing", "independent addition"],
    } });
  } finally {
    releaseFirstRead();
    await first;
  }
});
