import AsyncStorage from "@react-native-async-storage/async-storage";
import {useLearningContentStore} from "./store";
import {packageManager} from "./package-store";
import {getAssignments, getFreshSynonymSubjects, getStudyMaterials, fetchAllPages} from "../../utils/api";
import {saveMeaningSynonymsWithReceipt} from "../../utils/studyMaterialSynonyms";
import {displaySubject} from "./display";
import {resolveSynonymAnswers, type TranslationPackage} from "./resolver";
import {createTransferJournal, createTransferRunner, prepareTransferRows, type TransferFilters, type TransferTransport, synonymKey, studyState} from "./synonym-transfer";

function activeSynonymPackage(): TranslationPackage {
  if (!useLearningContentStore.getState().enabled) throw new Error("Enable your translation package before preparing additions.");
  const packet = packageManager.state.getState().packet;
  if (packet && packet.language !== "tr")
    throw new Error("Synonym transfer currently supports Turkish packages only. Other languages still work for display.");
  if (!packet || packet.schemaVersion !== 3 || packet.scope !== "display-and-synonyms")
    throw new Error("Import a translation package with explicit synonym answers (format v3) before preparing or resuming additions. Older packages still work for display.");
  return packet;
}
export const transferJournal = createTransferJournal(AsyncStorage);
export const transferRunner = createTransferRunner(transferJournal);
async function currentMaterials(token: string, ids: number[]) {
  if (!ids.length) return [];
  const materials: any[] = [];
  // Keep broad level selections below URL length limits.
  for (let offset = 0; offset < ids.length; offset += 100) {
    const page = await getStudyMaterials(token, {subject_ids: ids.slice(offset, offset + 100)}, {skipCache: true, allowOfflineFallback: false});
    if (!Array.isArray(page?.data)) throw new Error("Could not verify current synonyms");
    const result = page.pages?.next_url ? await fetchAllPages(page, token) : page;
    materials.push(...result.data);
  }
  return materials;
}
export async function prepareSynonymPreview(token: string, filters: TransferFilters) {
  const packet = activeSynonymPackage();
  if (!filters.levels.length || !filters.types.length || !filters.states.length) throw new Error("Select at least one level, subject type and study state.");
  const [subjects, firstAssignments] = await Promise.all([
    getFreshSynonymSubjects(token, {levels: filters.levels}),
    getAssignments(token, {levels: filters.levels}),
  ]);
  const assignments = firstAssignments.pages?.next_url ? await fetchAllPages(firstAssignments, token) : firstAssignments;
  const eligible = prepareTransferRows(packet, subjects.data, assignments.data, [], filters);
  const materials = await currentMaterials(token, eligible.map(row => row.id));
  return prepareTransferRows(packet, subjects.data, assignments.data, materials, filters);
}
export function synonymTransport(token: string, canWrite: () => boolean, filters: TransferFilters, undo = false): TransferTransport {
  const packet = packageManager.state.getState().packet;
  const guardedWrite = () => canWrite() && (undo || (useLearningContentStore.getState().enabled && packet === packageManager.state.getState().packet));
  return {
    validate: async row => {
      const [page, assignments] = await Promise.all([getFreshSynonymSubjects(token, {ids: [row.id]}), getAssignments(token, {subject_ids: [row.id]})]);
      const source = page.data.find((subject: any) => subject.id === row.id);
      const normalized = displaySubject(source);
      const answers = normalized && resolveSynonymAnswers(packet, normalized);
      const allowed = answers ? new Set(answers) : new Set<string>();
      return Boolean(packet === packageManager.state.getState().packet && answers?.length && row.type === source.object && row.selected.every(value => allowed.has(value)) && !source.data.hidden_at && source.data.level === row.level && filters.levels.includes(source.data.level) && !assignments.data[0]?.data.hidden && filters.states.includes(studyState(assignments.data[0])));
    },
    current: async id => (await currentMaterials(token, [id])).find(material => material.data.subject_id === id)?.data?.meaning_synonyms ?? [],
    save: (id, original, edited) => saveMeaningSynonymsWithReceipt(token, id, original, edited, {canWrite: guardedWrite, normalizeKey: synonymKey}),
  };
}
