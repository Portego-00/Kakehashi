import {renderHook} from "@testing-library/react-native";
import {useItemMeaning} from "../item-display";
import {learningDisplay} from "../display";
import {parseTranslationPackage} from "../resolver";
import {getAllSubjects} from "../../../utils/cache";
import packet from "../../../../translation-packages/example-tr-v3.json";
const mockPacket = parseTranslationPackage(packet)!;
const [id, entry] = Object.entries(mockPacket.subjects).find(([, s]) => s.source.type === "kanji")!;
const source = {id: Number(id), object: entry.source.type, data: {characters: entry.source.word, meanings: entry.source.meaningsEn.map(meaning => ({meaning})), readings: entry.source.readingsJa.map(reading => ({reading}))}};
const item = {id: Number(id), type: entry.source.type, meaning: "Exact English summary", source};
let mockEnabled = true;
jest.mock("../../../utils/cache", () => ({getAllSubjects: jest.fn()}));
jest.mock("../display", () => {
 const original = jest.requireActual("../display");
 return {...original, useLearningDisplay: () => original.learningDisplay(mockPacket, mockEnabled)};
});
beforeEach(() => {mockEnabled = true; jest.clearAllMocks();});
it("uses the current item source and rejects changed readings after a background refresh", () => {
 const {result, rerender} = renderHook(() => useItemMeaning());
 expect(result.current(item)).toBe(learningDisplay(mockPacket, true).meaning(source));
 const refreshed = {...item, source: {...source, data: {...source.data, readings: [{reading: "changed"}]}}};
 rerender({});
 expect(result.current(refreshed)).toBe("Exact English summary");
 expect(result.current({...item, source: {...source, data: {...source.data, meanings: [{meaning: "Changed English"}]}}})).toBe(item.meaning);
 expect(getAllSubjects).not.toHaveBeenCalled();
});
it("preserves exact English summaries without reading the catalog for opt-out users", () => {
 mockEnabled = false;
 const {result} = renderHook(() => useItemMeaning());
 expect(result.current(item)).toBe(item.meaning);
 expect(result.current({...item, meaning: ""})).toBe("");
 expect(getAllSubjects).not.toHaveBeenCalled();
});
it("falls back safely for old cached summaries and mismatched IDs or types", () => {
 const {result} = renderHook(() => useItemMeaning());
 expect(result.current({...item, source: undefined})).toBe(item.meaning);
 expect(result.current({...item, id: -1})).toBe(item.meaning);
 expect(result.current({...item, type: "radical"})).toBe(item.meaning);
});
