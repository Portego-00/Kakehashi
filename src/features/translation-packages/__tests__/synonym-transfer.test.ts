import {AnswerCheckerResult, checkAnswerWithDetails} from "../../../utils/answerChecker";
import bundled from "../../../../translation-packages/example-tr-v3.json";
import {parseTranslationPackage} from "../resolver";
import {createTransferJournal, createTransferRunner, prepareTransferRows, studyState, synonymKey, type TransferJob, type TransferRow, type TransferTransport} from "../synonym-transfer";
import {mergeMeaningSynonymEdits} from "../../../utils/meaningSynonyms";
const catalog = parseTranslationPackage(bundled)!;
const filters = {levels: Array.from({length: 60}, (_,i) => i+1), types: ["radical", "kanji", "vocabulary"], states: ["learning" as const]};
const subject = (id: number) => {const source = catalog.subjects[String(id)].source; return {id, object: source.type, data: {characters: source.word, level: source.level, meanings: source.meaningsEn.map(meaning => ({meaning})), readings: source.readingsJa.map(reading => ({reading}))}};};
const assignment = (id: number, fields = {}) => ({data: {subject_id: id, started_at: "2026-01-01", unlocked_at: "2026-01-01", ...fields}});
const row = (id = 80): TransferRow => ({id, word: "Ghost", level: 1, type: "radical", studyState: "learning", candidates: ["Hayalet"], selected: ["Hayalet"], existing: [], status: "pending", added: [], uncertain: []});
function setup(rows = [row()]) {
 const values = new Map<string,string>();
 const storage = {getItem: jest.fn(async (k:string) => values.get(k) ?? null), setItem: jest.fn(async(k:string,v:string) => {values.set(k,v);}),
 multiGet: jest.fn(async(keys:string[]) => keys.map(k => [k, values.get(k) ?? null] as [string,string|null])),
 multiSet: jest.fn(async(pairs:[string,string][]) => {pairs.forEach(([k,v]) => values.set(k,v));})};
 const journal = createTransferJournal(storage);
 const runner = createTransferRunner(journal);
 const job: TransferJob = {id: "fixture", account: "account-A", createdAt: "2026-10-11", filters, rows, operation: "add"};
 const server = new Map<number,string[]>();
 const transport: TransferTransport = {validate: jest.fn(async() => true), current: jest.fn(async id => [...(server.get(id) ?? [])]),
 save: jest.fn(async(id,original,edited) => {const before=server.get(id) ?? []; const after=mergeMeaningSynonymEdits(before,original,edited);server.set(id,after);
 return {material: {data: {subject_id:id, meaning_synonyms:after}}, added: after.filter(v=>!before.includes(v)), removed:before.filter(v=>!after.includes(v))};})};
 return {values,storage,journal,runner,job,server,transport};
}
it("selects only matching level/type/state and complete reviewed sources", () => {
 const source=subject(80);
 const rows=prepareTransferRows(catalog,[source,subject(440),subject(2761)],[assignment(80),assignment(440,{burned_at:"now"}),assignment(2761,{started_at:null})],[],filters);
 expect(rows.map(r=>r.id)).toEqual([80]); expect(rows[0].selected).toContain("Hayalet");
 expect(prepareTransferRows(catalog,[source],[assignment(80)],[],{...filters,levels:[60]})).toEqual([]);
 expect(prepareTransferRows(catalog,[source],[assignment(80)],[],{...filters,types:["kanji"]})).toEqual([]);
 expect(prepareTransferRows(catalog,[{...source,data:{...source.data,meanings:[{meaning:"changed"}]}}],[assignment(80)],[],filters)).toEqual([]);
 expect(prepareTransferRows(catalog,[{...source,data:{...source.data,hidden_at:"now"}}],[assignment(80)],[],filters)).toEqual([]);
});
it.each([[{},"locked"],[{unlocked_at:"now"},"unstarted"],[{started_at:"now"},"learning"],[{started_at:"now",burned_at:"now"},"burned"],[{srs_stage:9},"burned"]])("classifies study state %j", (data,expected) => {expect(studyState({data})).toBe(expected);});
it("retains existing synonyms and detects Turkish case-equivalent duplicates",()=>{
 const rows=prepareTransferRows(catalog,[subject(80)],[assignment(80)],[{data:{subject_id:80,meaning_synonyms:["hayalet","other personal meaning"]}}],filters);
 expect(rows[0].selected).not.toContain("Hayalet"); expect(rows[0].existing).toContain("other personal meaning");
 expect(synonymKey(" İZİN  VERMEK ")).toBe("izin vermek"); expect(synonymKey("IŞIK")).toBe("ışık"); expect(synonymKey("sık")).not.toBe(synonymKey("sik"));
});
it("journal creation/loading never sends anything and is isolated by account",async()=>{
 const s=setup();await s.journal.create(s.job);
 expect(await s.journal.load("account-A")).toHaveLength(1);expect(await s.journal.load("account-B")).toEqual([]);expect(s.transport.save).not.toHaveBeenCalled();
});
it("saves only missing selected meanings, preserves concurrent additions and supports receipt-based undo",async()=>{
 const s=setup();s.server.set(80,["existing"]);await s.journal.create(s.job);
 await s.runner.run(s.job,s.transport,()=>true,()=>{});
 expect(s.server.get(80)).toEqual(["existing","Hayalet"]);expect(s.job.rows[0].added).toEqual(["Hayalet"]);
 s.server.get(80)!.push("later addition");
 await s.runner.run(s.job,s.transport,()=>true,()=>{},"undo");
 expect(s.server.get(80)).toEqual(["existing","later addition"]);expect(s.job.rows[0].status).toBe("undone");
});
it("does not rewrite meanings added elsewhere after preview",async()=>{
 const s=setup();s.server.set(80,["hayalet"]);await s.journal.create(s.job);await s.runner.run(s.job,s.transport,()=>true,()=>{});
 expect(s.transport.save).not.toHaveBeenCalled();expect(s.job.rows[0].added).toEqual([]);
});
it("pauses between items and resumes without repeating successful writes",async()=>{
 const s=setup([row(),row(81)]);await s.journal.create(s.job);
 await s.runner.run(s.job,s.transport,()=>true,()=>s.runner.pause());
 expect(s.transport.save).toHaveBeenCalledTimes(1);expect(s.job.rows[1].status).toBe("pending");
 const [restored]=await s.journal.load("account-A");await s.runner.run(restored,s.transport,()=>true,()=>{});
 expect(s.transport.save).toHaveBeenCalledTimes(2);
});
it("never resumes by loading history",async()=>{
 const s=setup();await s.journal.create(s.job);await s.journal.load("account-A");expect(s.transport.current).not.toHaveBeenCalled();expect(s.transport.save).not.toHaveBeenCalled();
});
it("recovers ambiguous network success without claiming ownership or undoing it",async()=>{
 const s=setup();await s.journal.create(s.job);
 jest.mocked(s.transport.save).mockImplementationOnce(async id=>{s.server.set(id,["Hayalet"]);throw new Error("Connection lost");});
 await expect(s.runner.run(s.job,s.transport,()=>true,()=>{})).rejects.toThrow("Connection lost");
 const [restored]=await s.journal.load("account-A");expect(restored.rows[0].status).toBe("writing");
 await s.runner.run(restored,s.transport,()=>true,()=>{});
 expect(restored.rows[0].added).toEqual([]);expect(restored.rows[0].uncertain).toEqual(["Hayalet"]);
 await s.runner.run(restored,s.transport,()=>true,()=>{},"undo");expect(s.server.get(80)).toEqual(["Hayalet"]);
});
it("does not send a write if durable intent cannot be stored",async()=>{
 const s=setup();await s.journal.create(s.job);s.storage.setItem.mockRejectedValue(new Error("Disk full"));
 await expect(s.runner.run(s.job,s.transport,()=>true,()=>{})).rejects.toThrow("Disk full");expect(s.transport.save).not.toHaveBeenCalled();
});
it("blocks changed sources and does not write",async()=>{
 const s=setup();await s.journal.create(s.job);jest.mocked(s.transport.validate).mockResolvedValue(false);
 await s.runner.run(s.job,s.transport,()=>true,()=>{});expect(s.job.rows[0].status).toBe("blocked");expect(s.transport.save).not.toHaveBeenCalled();
});
it("stops if the account changes while reading",async()=>{
 const s=setup();await s.journal.create(s.job);let same=true;
 jest.mocked(s.transport.current).mockImplementation(async()=>{same=false;return [];});
 await s.runner.run(s.job,s.transport,()=>same,()=>{});expect(s.transport.save).not.toHaveBeenCalled();
});
it("rejects simultaneous runs",async()=>{
 const s=setup();await s.journal.create(s.job);let release!:()=>void;
 jest.mocked(s.transport.current).mockImplementationOnce(async()=>{await new Promise<void>(resolve=>{release=resolve;});return [];});
 const first=s.runner.run(s.job,s.transport,()=>true,()=>{});await Promise.resolve();await Promise.resolve();
 await expect(s.runner.run(s.job,s.transport,()=>true,()=>{})).rejects.toThrow("already running");
 release();await first;
});
it("undo cancels unsent rows without adding them",async()=>{
 const s=setup([row(),row(81)]);await s.journal.create(s.job);s.job.rows[0].status="done";s.job.rows[0].added=["Hayalet"];s.server.set(80,["old","Hayalet"]);
 await s.runner.run(s.job,s.transport,()=>true,()=>{},"undo");expect(s.server.get(80)).toEqual(["old"]);expect(s.server.has(81)).toBe(false);expect(s.job.rows[1].status).toBe("undone");
});

it("persists undo mode and prevents resuming additions after an interrupted undo",async()=>{
 const s=setup();await s.journal.create(s.job);s.job.rows[0].status="done";s.job.rows[0].added=["Hayalet"];s.server.set(80,["old","Hayalet"]);
 jest.mocked(s.transport.save).mockRejectedValueOnce(new Error("Network lost"));
 await expect(s.runner.run(s.job,s.transport,()=>true,()=>{},"undo")).rejects.toThrow("Network lost");
 const [restored]=await s.journal.load("account-A");expect(restored.operation).toBe("undo");
 await expect(s.runner.run(restored,s.transport,()=>true,()=>{})).rejects.toThrow("Continue undoing");
 await s.runner.run(restored,s.transport,()=>true,()=>{},"undo");expect(s.server.get(80)).toEqual(["old"]);
});
it("does not claim undo success when the server retained the owned synonym",async()=>{
 const s=setup();await s.journal.create(s.job);s.job.rows[0].status="done";s.job.rows[0].added=["Hayalet"];s.server.set(80,["old","Hayalet"]);
 jest.mocked(s.transport.save).mockResolvedValueOnce({material:{data:{subject_id:80,meaning_synonyms:["old","Hayalet"]}},added:[],removed:[]});
 await expect(s.runner.run(s.job,s.transport,()=>true,()=>{},"undo")).rejects.toThrow("confirm removal");expect(s.job.rows[0].status).toBe("undoing");
});

it.each(["iş", "ırk", "il"])("preserves explicit answer spelling so lowercase %s still grades precisely", answer => {
 const packet = {...catalog, subjects: {...catalog.subjects, "80": {...catalog.subjects["80"], synonymAnswers: {values: [answer], reviewStatus: "editorial-reviewed" as const}}}};
 const source = subject(80);
 const [row] = prepareTransferRows(packet, [source], [assignment(80)], [], filters);
 expect(row.selected).toEqual([answer]);
 expect(checkAnswerWithDetails(answer, source as any, "meaning", {meaning_synonyms: row.selected})).toBe(AnswerCheckerResult.Precise);
});
