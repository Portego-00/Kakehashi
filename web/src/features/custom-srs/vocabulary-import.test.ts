import { describe, expect, it } from "vitest";
import { parseVocabularyTable, previewVocabularyImport, suggestImportColumns } from "./vocabulary-import";
import { personalMutationSchema, personalWordSchema, wordIdentity } from "./personal-vocabulary";

const sample = 'characters,reading,meanings,notes\r\n木漏れ日,こもれび,sunlight | dappled sunlight,"A note, with a comma\nand ""quotes""."\r\nなるほど,,I see,\r\n';
describe("private vocabulary import", () => {
  it("reads BOM, CRLF, quoted commas, escaped quotes, and multiline notes", () => {
    const rows = parseVocabularyTable(`\ufeff${sample}`, ",");
    expect(rows).toHaveLength(3);
    const preview = previewVocabularyImport(rows, suggestImportColumns(rows[0]), true, []);
    expect(preview[0].word).toMatchObject({ characters: "木漏れ日", reading: "こもれび", meanings: ["sunlight", "dappled sunlight"], meaningMnemonic: 'A note, with a comma\nand "quotes".' });
    expect(preview[1].word?.reading).toBe("なるほど");
  });
  it("supports TSV, custom column mapping, and headerless data", () => {
    const rows = parseVocabularyTable("book\tほん\t本\nwater\tみず\t水", "\t");
    const columns = { ...suggestImportColumns([]), characters: 2, reading: 1, meanings: 0 };
    expect(previewVocabularyImport(rows, columns, false, []).map((row) => row.word?.characters)).toEqual(["本", "水"]);
  });
  it("flags missing readings and translations and skips normalized duplicates", () => {
    const rows = parseVocabularyTable("word,reading,meaning\nカメラ,カメラ,camera\nカメラ,かめら,camera\n本,,book\n水,みず,", ",");
    const result = previewVocabularyImport(rows, suggestImportColumns(rows[0]), true, []);
    expect(result[0].duplicate).toBe(false); expect(result[1].duplicate).toBe(true);
    expect(result[2].error).toContain("reading"); expect(result[3].error).toContain("meanings");
    expect(previewVocabularyImport(rows, suggestImportColumns(rows[0]), true, [result[0].word!])[0].duplicate).toBe(true);
    expect(wordIdentity({ characters: "ｶﾒﾗ", reading: "カメラ" })).toBe(wordIdentity({ characters: "カメラ", reading: "かめら" }));
  });
  it("rejects malformed quoting, excessive rows, and oversized fields", () => {
    expect(() => parseVocabularyTable('word,meaning\n"unfinished', ",")).toThrow("quoted field");
    expect(() => parseVocabularyTable('"word"oops,meaning', ",")).toThrow("Unexpected text");
    expect(() => parseVocabularyTable(Array.from({ length: 1002 }, () => "a,b").join("\n"), ",")).toThrow("1,000");
    expect(personalWordSchema.safeParse({ characters: "本", reading: "ほん", meanings: ["x".repeat(201)], partsOfSpeech: [], meaningMnemonic: "", contextSentences: [] }).success).toBe(false);
    expect(personalMutationSchema.safeParse({ accountId: "a", expectedRevision: 0, eventId: crypto.randomUUID(), operations: [{ action: "create_word", id: "built-in-word", deckId: "a", word: {} }] }).success).toBe(false);
  });
});
