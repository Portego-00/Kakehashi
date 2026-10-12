import {renderHook, act} from "@testing-library/react-native";
import {useItemMeaning} from "../item-display";
import {learningDisplay} from "../display";
import {parseTranslationPackage} from "../resolver";
import fs from "fs";
import path from "path";
const mockPacket = parseTranslationPackage(JSON.parse(fs.readFileSync(path.resolve("translation-packages/example-tr-v3.json"), "utf8")))!;
const [id, entry] = Object.entries(mockPacket.subjects).find(([, s]) => s.source.type === "kanji")!;
const mockSubject = {id: Number(id), object: entry.source.type, data: {characters: entry.source.word, meanings: entry.source.meaningsEn.map((meaning: string) => ({meaning})), readings: entry.source.readingsJa.map((reading: string) => ({reading}))}};
let mockEnabled = true;
let mockSubjects: any[] = [];
jest.mock("../../../utils/cache", () => ({getAllSubjects: jest.fn(async () => mockSubjects)}));
jest.mock("../display", () => {
 const original = jest.requireActual("../display");
 return {...original, useLearningDisplay: () => original.learningDisplay(mockPacket, mockEnabled)};
});
beforeEach(() => {mockEnabled = true; mockSubjects = [mockSubject];});
it("resolves abbreviated Items against complete cached source and updates when disabled", async () => {
 const item = {id: Number(id), type: entry.source.type, meaning: "English summary"};
 const {result, rerender} = renderHook(() => useItemMeaning());
 await act(async () => {});
 expect(result.current(item)).toBe(learningDisplay(mockPacket, true).meaning(mockSubject));
 mockEnabled = false; rerender({});
 expect(result.current(item)).toBe(entry.source.meaningsEn[0]);
 expect(result.current({...item, id: -1})).toBe("English summary");
});
it("does not use translations when cached source changes or item type differs", async () => {
 mockSubjects = [{...mockSubject, data: {...mockSubject.data, readings: [{reading: "changed"}]}}];
 const {result} = renderHook(() => useItemMeaning());
 await act(async () => {});
 expect(result.current({id: Number(id), type: entry.source.type, meaning: "summary"})).toBe(entry.source.meaningsEn[0]);
 expect(result.current({id: Number(id), type: "radical", meaning: "summary"})).toBe("summary");
});
