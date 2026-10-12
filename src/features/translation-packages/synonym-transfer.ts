import {displaySubject} from "./display";
import {resolveSynonymAnswers, type TranslationPackage} from "./resolver";
import {formatTurkishMeaning} from "./format";
import type {SynonymSaveReceipt} from "../../utils/studyMaterialSynonyms";

export type StudyState = "learning" | "unstarted" | "burned" | "locked";
export interface TransferFilters {levels: number[]; types: string[]; states: StudyState[]}
export interface TransferRow {
  id: number; word: string; level: number; type: string; studyState: StudyState;
  candidates: string[]; existing: string[]; selected: string[];
  status: "pending" | "writing" | "done" | "undoing" | "undone" | "blocked";
  added: string[]; uncertain: string[]; error?: string;
}
export interface TransferJob {
  id: string; account: string; createdAt: string; filters: TransferFilters;
  rows: TransferRow[]; operation: "add" | "undo";
}
export const synonymKey = (value: string) => value.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
export const uniqueSynonyms = (values: string[]) => [...new Map(values.map(value => [synonymKey(value), value])).values()];
export function studyState(assignment: any): StudyState {
  const data = assignment?.data ?? assignment;
  if (data?.burned_at || data?.srs_stage === 9) return "burned";
  if (data?.started_at) return "learning";
  return data?.unlocked_at ? "unstarted" : "locked";
}
export function prepareTransferRows(packet: TranslationPackage, subjects: any[], assignments: any[], materials: any[], filters: TransferFilters) {
  const assignmentMap = new Map(assignments.map(value => [value.data.subject_id, value]));
  const materialMap = new Map(materials.map(value => [value.data.subject_id, value]));
  const rows: TransferRow[] = [];
  for (const subject of subjects) {
    if (subject.data?.hidden_at || assignmentMap.get(subject.id)?.data?.hidden) continue;
    const state = studyState(assignmentMap.get(subject.id));
    const type = subject.object === "kana_vocabulary" ? "vocabulary" : subject.object;
    if (!filters.levels.includes(subject.data.level) || !filters.types.includes(type) || !filters.states.includes(state)) continue;
    const normalized = displaySubject(subject);
    const answers = normalized && resolveSynonymAnswers(packet, normalized);
    if (!answers?.length) continue;
    const candidates = uniqueSynonyms(answers.map(formatTurkishMeaning));
    const existing = materialMap.get(subject.id)?.data?.meaning_synonyms ?? [];
    const existingKeys = new Set(existing.map(synonymKey));
    const sourceKeys = new Set(subject.data.meanings.filter((m: any) => m.accepted_answer !== false).map((m: any) => synonymKey(m.meaning)));
    rows.push({id: subject.id, word: subject.data.characters || subject.data.meanings[0].meaning,
      level: subject.data.level, type: subject.object, studyState: state, candidates: candidates.filter(value => !sourceKeys.has(synonymKey(value))), existing,
      selected: candidates.filter(value => !existingKeys.has(synonymKey(value)) && !sourceKeys.has(synonymKey(value))),
      status: "pending", added: [], uncertain: []});
  }
  return rows.sort((a, b) => a.level - b.level || a.id - b.id);
}
export function transferCounts(rows: TransferRow[]) {
  return {subjects: rows.filter(row => row.selected.length).length,
    synonyms: rows.reduce((sum, row) => sum + row.selected.length, 0),
    completed: rows.filter(row => ["done", "undone", "blocked"].includes(row.status)).length,
    added: rows.reduce((sum, row) => sum + row.added.length, 0),
    uncertain: rows.reduce((sum, row) => sum + row.uncertain.length, 0)};
}
export interface JournalStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  multiGet(keys: string[]): Promise<readonly (readonly [string, string | null])[]>;
  multiSet(values: [string, string][]): Promise<void>;
}
// Each subject has a small durable record, avoiding Android's large-row read limit.
export function createTransferJournal(storage: JournalStorage) {
  const key = (account: string) => `kakehashi-tr-synonym-history-v1-${encodeURIComponent(account)}`;
  const rowKey = (account: string, id: string, subjectId: number) => `${key(account)}-${id}-${subjectId}`;
  const load = async (account: string): Promise<TransferJob[]> => {
    const manifests = JSON.parse(await storage.getItem(key(account)) ?? "[]");
    const jobs: TransferJob[] = [];
    for (const manifest of manifests) {
      if (manifest.account !== account) throw new Error("History account mismatch");
      const rows: TransferRow[] = [];
      for (let i = 0; i < manifest.ids.length; i += 100) {
        const records = await storage.multiGet(manifest.ids.slice(i, i + 100).map((id: number) => rowKey(account, manifest.id, id)));
        for (const [, value] of records) {
          if (!value) throw new Error("Incomplete transfer history. No writes have started.");
          rows.push(JSON.parse(value));
        }
      }
      jobs.push({...manifest, rows});
    }
    return jobs;
  };
  return {load,
    create: async (job: TransferJob) => {
      // Publish the manifest only after all subject intents are saved.
      for (let i = 0; i < job.rows.length; i += 100)
        await storage.multiSet(job.rows.slice(i, i + 100).map(row => [rowKey(job.account, job.id, row.id), JSON.stringify(row)]));
      const manifests = JSON.parse(await storage.getItem(key(job.account)) ?? "[]");
      const {rows, ...metadata} = job;
      await storage.setItem(key(job.account), JSON.stringify([{...metadata, ids: rows.map(row => row.id)}, ...manifests]));
    },
    saveOperation: async (job: TransferJob, operation: "add" | "undo") => {
      const manifests = JSON.parse(await storage.getItem(key(job.account)) ?? "[]");
      if (!manifests.some((value: any) => value.id === job.id)) throw new Error("Transfer history could not be verified");
      await storage.setItem(key(job.account), JSON.stringify(manifests.map((value: any) => value.id === job.id ? {...value, operation} : value)));
      job.operation = operation;
    },
    saveRow: (job: TransferJob, row: TransferRow) => storage.setItem(rowKey(job.account, job.id, row.id), JSON.stringify(row)),
  };
}
export interface TransferTransport {
  validate(row: TransferRow): Promise<boolean>;
  current(id: number): Promise<string[]>;
  save(id: number, original: string[], edited: string[]): Promise<SynonymSaveReceipt>;
}
export function createTransferRunner(journal: ReturnType<typeof createTransferJournal>) {
  let running = false;
  let pauseRequested = false;
  const run = async (job: TransferJob, transport: TransferTransport, isSameAccount: () => boolean,
    onProgress: () => void, operation: "add" | "undo" = "add", minIntervalMs = 0, create = false) => {
    if (running) throw new Error("A synonym transfer is already running");
    running = true; pauseRequested = false;
    try {
      if (create) await journal.create(job);
      if (operation === "add" && job.operation === "undo") throw new Error("Continue undoing this transfer instead of resuming additions");
      if (operation === "undo" && job.operation !== "undo") await journal.saveOperation(job, "undo");
      for (const row of job.rows) {
        if (pauseRequested || !isSameAccount()) break;
        if (operation === "add" && ["done", "undone", "blocked"].includes(row.status)) continue;
        if (operation === "undo" && row.status === "undone") continue;
        try {
          if (operation === "undo" && !row.added.length && !["writing", "undoing"].includes(row.status)) {
            row.status = "undone"; row.error = undefined;
            await journal.saveRow(job, row); onProgress(); continue;
          }
          if (operation === "add" && !await transport.validate(row)) {
            row.status = "blocked"; row.error = "Source or study state changed. Prepare a new preview.";
            await journal.saveRow(job, row); onProgress(); continue;
          }
          if (pauseRequested || !isSameAccount()) break;
          const current = await transport.current(row.id);
          if (pauseRequested || !isSameAccount()) break;
          if (operation === "undo") {
            if (row.status === "writing") {
              const before = new Set(row.existing.map(synonymKey));
              row.uncertain = uniqueSynonyms([...row.uncertain, ...row.selected.filter(value => current.some(saved => synonymKey(saved) === synonymKey(value)) && !before.has(synonymKey(value)))]);
            }
            row.status = "undoing"; await journal.saveRow(job, row);
            if (pauseRequested || !isSameAccount()) break;
            const owned = row.added.filter(value => current.includes(value));
            if (owned.length) {
              const receipt = await transport.save(row.id, owned, []);
              if (owned.some(value => receipt.material.data.meaning_synonyms.includes(value)))
                throw new Error("The server did not confirm removal of the recorded synonyms");
            }
            row.status = "undone"; row.error = undefined;
          } else {
            const keys = new Set(current.map(synonymKey));
            if (row.status === "writing") {
              // An interrupted request may have reached the server. Do not claim
              // those values as ours or remove them automatically on undo.
              const before = new Set(row.existing.map(synonymKey));
              row.uncertain = uniqueSynonyms([...row.uncertain, ...row.selected.filter(value => keys.has(synonymKey(value)) && !before.has(synonymKey(value)))]);
            }
            const missing = row.selected.filter(value => !keys.has(synonymKey(value)));
            row.existing = current; row.status = "writing"; row.error = undefined;
            await journal.saveRow(job, row);
            if (pauseRequested || !isSameAccount()) break;
            if (missing.length) {
              const receipt = await transport.save(row.id, [], missing);
              if (missing.some(value => !receipt.material.data.meaning_synonyms.some((saved: string) => synonymKey(saved) === synonymKey(value))))
                throw new Error("The server did not confirm all selected synonyms");
              row.added = uniqueSynonyms([...row.added, ...receipt.added]);
            }
            row.status = "done";
          }
          await journal.saveRow(job, row); onProgress();
          if (minIntervalMs && !pauseRequested) await new Promise(resolve => setTimeout(resolve, minIntervalMs));
        } catch (error) {
          // Keep writing/undoing durable intent on ambiguous network failures.
          row.error = error instanceof Error ? error.message : "Transfer stopped";
          try { await journal.saveRow(job, row); } catch { /* Previous intent remains durable. */ }
          onProgress(); throw error;
        }
      }
    } finally { running = false; onProgress(); }
  };
  return {run, pause: () => {pauseRequested = true;}, isRunning: () => running};
}
