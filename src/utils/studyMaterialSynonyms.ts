import { createStudyMaterial, getStudyMaterials, updateStudyMaterial } from "./api";
import { mergeMeaningSynonymEdits } from "./meaningSynonyms";

const pendingSavesByAccount = new Map<string, Map<number, Promise<void>>>();


/** Apply the fields this save edited without reverting other completed edits. */
export function mergeStudyMaterialUpdate(
  currentMaterial: any,
  savedMaterial: any,
  updates: Record<string, unknown>,
  subjectId: number
) {
  return {
    ...(currentMaterial || {}),
    ...(savedMaterial || {}),
    data: {
      ...(savedMaterial?.data || {}),
      ...(currentMaterial?.data || {}),
      subject_id: savedMaterial?.data?.subject_id || subjectId,
      ...updates,
    },
  };
}

/** Apply only the edits made in this editor, preserving unseen WaniKani synonyms. */
export async function saveMeaningSynonyms(
  apiToken: string,
  subjectId: number,
  originalSynonyms: readonly string[],
  editedSynonyms: readonly string[]
): Promise<any> {
  if (!Number.isInteger(subjectId) || subjectId <= 0) {
    throw new Error("This subject does not use WaniKani synonyms");
  }

  let subjectSaves = pendingSavesByAccount.get(apiToken);
  if (!subjectSaves) {
    subjectSaves = new Map();
    pendingSavesByAccount.set(apiToken, subjectSaves);
  }
  const previousSave = subjectSaves.get(subjectId) ?? Promise.resolve();
  // Preserve this editor's intent while it waits for an earlier save.
  const original = [...originalSynonyms];
  const edited = [...editedSynonyms];
  const save = previousSave.then(() => applyMeaningSynonymEdits(
    apiToken, subjectId, original, edited
  ));
  // Failed requests release the next save, which performs its own fresh read.
  const completion = save.then(() => {}, () => {});
  subjectSaves.set(subjectId, completion);

  try {
    return await save;
  } finally {
    if (subjectSaves.get(subjectId) === completion) {
      subjectSaves.delete(subjectId);
      if (subjectSaves.size === 0) pendingSavesByAccount.delete(apiToken);
    }
  }
}

async function applyMeaningSynonymEdits(
  apiToken: string,
  subjectId: number,
  originalSynonyms: readonly string[],
  editedSynonyms: readonly string[]
): Promise<any> {
  const readCurrent = async () => {
    // An offline fallback is useful for display, but cannot authorize replacing
    // an array on the server: it may omit synonyms added on WaniKani.
    const collection = await getStudyMaterials(
      apiToken,
      { subject_ids: [subjectId] },
      { skipCache: true, allowOfflineFallback: false }
    );
    if (!Array.isArray(collection?.data)) {
      throw new Error("Could not verify your existing WaniKani synonyms");
    }
    return collection.data.find((material: any) => material?.data?.subject_id === subjectId);
  };
  const writeExisting = (material: any) => updateStudyMaterial(apiToken, material.id, {
    meaning_synonyms: mergeMeaningSynonymEdits(
      material.data.meaning_synonyms ?? [], originalSynonyms, editedSynonyms
    ),
  });

  const material = await readCurrent();
  if (material?.id) return writeExisting(material);

  try {
    return await createStudyMaterial(apiToken, {
      subject_id: subjectId,
      meaning_synonyms: mergeMeaningSynonymEdits([], originalSynonyms, editedSynonyms),
    });
  } catch (error) {
    // A material may have been created elsewhere between the GET and POST.
    if (!(error instanceof Error) || !error.message.includes("422")) throw error;
    const createdMeanwhile = await readCurrent();
    if (!createdMeanwhile?.id) throw error;
    return writeExisting(createdMeanwhile);
  }
}
