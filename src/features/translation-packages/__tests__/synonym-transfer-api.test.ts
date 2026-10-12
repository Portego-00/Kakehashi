import {packageManager} from "../package-store";
import {parseTranslationPackage} from "../resolver";
import catalog from "../../../../translation-packages/example-tr-v3.json";
const synonymCatalog = parseTranslationPackage(catalog)!;
import {prepareSynonymPreview, synonymTransport} from "../synonym-transfer-api";
import {getAssignments, getFreshSynonymSubjects, getStudyMaterials} from "../../../utils/api";
import {saveMeaningSynonymsWithReceipt} from "../../../utils/studyMaterialSynonyms";
jest.mock("../../../utils/api",()=>({getAssignments:jest.fn(),getFreshSynonymSubjects:jest.fn(),getStudyMaterials:jest.fn(),fetchAllPages:jest.fn(async value=>value)}));
jest.mock("../../../utils/studyMaterialSynonyms",()=>({saveMeaningSynonymsWithReceipt:jest.fn()}));
const source=synonymCatalog.subjects["80"].source;
const subject={id:80,object:source.type,data:{characters:source.word,level:source.level,meanings:source.meaningsEn.map(meaning=>({meaning})),readings:[]}};
const assignment={data:{subject_id:80,started_at:"now",unlocked_at:"now"}};
const filters={levels:[source.level],types:["radical"],states:["learning" as const]};
const row={id:80,type:"radical",level:source.level,selected:["Hayalet"]} as any;
beforeEach(()=>{packageManager.state.setState({packet:synonymCatalog,hydrated:true});jest.resetAllMocks();jest.mocked(getFreshSynonymSubjects).mockResolvedValue({data:[subject]} as any);jest.mocked(getAssignments).mockResolvedValue({data:[assignment]} as any);jest.mocked(getStudyMaterials).mockResolvedValue({data:[]});});
it("reads fresh source and complete online materials without writing during preview",async()=>{
 const rows=await prepareSynonymPreview("fixture-token",filters);expect(rows[0].selected).toContain("Hayalet");
 expect(getStudyMaterials).toHaveBeenCalledWith("fixture-token",{subject_ids:[80]},{skipCache:true,allowOfflineFallback:false});expect(saveMeaningSynonymsWithReceipt).not.toHaveBeenCalled();
});
it("rejects arbitrary answers in stored transfer intents",async()=>{
 const transport=synonymTransport("fixture-token",()=>true,filters);
 expect(await transport.validate(row)).toBe(true);expect(await transport.validate({...row,selected:["whatever"]})).toBe(false);
});
it("rejects subjects whose state or level changed since confirmation",async()=>{
 const transport=synonymTransport("fixture-token",()=>true,filters);
 jest.mocked(getAssignments).mockResolvedValue({data:[{data:{...assignment.data,burned_at:"now"}}]} as any);expect(await transport.validate(row)).toBe(false);
 jest.mocked(getAssignments).mockResolvedValue({data:[assignment]} as any);jest.mocked(getFreshSynonymSubjects).mockResolvedValue({data:[{...subject,data:{...subject.data,level:60}}]} as any);expect(await transport.validate(row)).toBe(false);
});
it("fails closed on malformed material responses",async()=>{
 jest.mocked(getStudyMaterials).mockResolvedValue({error:"unavailable"});await expect(prepareSynonymPreview("fixture-token",filters)).rejects.toThrow("verify");expect(saveMeaningSynonymsWithReceipt).not.toHaveBeenCalled();
});
it("passes account guards and Turkish deduplication to the final serialized write",async()=>{
 const guard=()=>true;await synonymTransport("fixture-token",guard,filters).save(80,[],["Hayalet"]);
 expect(saveMeaningSynonymsWithReceipt).toHaveBeenCalledWith("fixture-token",80,[],["Hayalet"],expect.objectContaining({canWrite:expect.any(Function),normalizeKey:expect.any(Function)}));
});

it("splits broad previews into bounded subject requests", async () => {
 const entries=Object.fromEntries(Array.from({length:205},(_,i)=>[String(10000+i),synonymCatalog.subjects["80"]]));
 packageManager.state.setState({packet:{...synonymCatalog,subjects:entries}});
 const subjects=Object.entries(entries).map(([id,entry])=>({id:Number(id),object:"radical",data:{characters:entry.source.word,level:entry.source.level,meanings:entry.source.meaningsEn.map(meaning=>({meaning})),readings:[]}}));
 jest.mocked(getFreshSynonymSubjects).mockResolvedValue({data:subjects} as any);
 jest.mocked(getAssignments).mockResolvedValue({data:subjects.map(item=>({data:{subject_id:item.id,started_at:"now"}}))} as any);
 await prepareSynonymPreview("fixture-token",{levels:[...new Set(subjects.map(item=>item.data.level))],types:["radical"],states:["learning"]});
 expect(jest.mocked(getStudyMaterials).mock.calls.length).toBeGreaterThan(1);
 expect(jest.mocked(getStudyMaterials).mock.calls.every(call => call[1]!.subject_ids!.length <= 100)).toBe(true);
 expect(saveMeaningSynonymsWithReceipt).not.toHaveBeenCalled();
});

it("rejects legacy display-only packages before any network request", async () => {
 packageManager.state.setState({packet:{...synonymCatalog,schemaVersion:2,scope:"display-only"}});
 await expect(prepareSynonymPreview("fixture-token",filters)).rejects.toThrow("format v3");
 expect(getFreshSynonymSubjects).not.toHaveBeenCalled();expect(saveMeaningSynonymsWithReceipt).not.toHaveBeenCalled();
});
it("uses explicit answers rather than display alternatives", async () => {
 const modified={...synonymCatalog,subjects:{...synonymCatalog.subjects,"80":{...synonymCatalog.subjects["80"],synonymAnswers:{values:["Başka Karşılık"],reviewStatus:"editorial-reviewed" as const}}}};
 packageManager.state.setState({packet:modified});
 const rows=await prepareSynonymPreview("fixture-token",filters);expect(rows[0].selected).toEqual(["Başka Karşılık"]);
});

it("blocks queued additions after package replacement but permits receipt-based undo", async () => {
 const add = synonymTransport("fixture-token",()=>true,filters);
 const undo = synonymTransport("fixture-token",()=>true,filters,true);
 packageManager.state.setState({packet:null});
 await add.save(80,[],["Hayalet"]);
 expect(jest.mocked(saveMeaningSynonymsWithReceipt).mock.calls.at(-1)![4]!.canWrite!()).toBe(false);
 await undo.save(80,["Hayalet"],[]);
 expect(jest.mocked(saveMeaningSynonymsWithReceipt).mock.calls.at(-1)![4]!.canWrite!()).toBe(true);
});
