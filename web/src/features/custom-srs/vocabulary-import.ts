import { IMPORT_BYTE_LIMIT, IMPORT_WORD_LIMIT, personalWordSchema, wordIdentity, type PersonalWordInput } from "./personal-vocabulary";

export const IMPORT_FIELDS = ["characters", "reading", "meanings", "meaningMnemonic", "readingMnemonic", "partsOfSpeech", "sentenceJa", "sentenceEn"] as const;
export type ImportField = typeof IMPORT_FIELDS[number];
export type ImportColumns = Record<ImportField, number>;
export type ImportRow = { row: number; word?: PersonalWordInput; error?: string; duplicate: boolean };

/** RFC-style quoted fields, escaped quotes, CRLF, UTF-8 BOM, and multiline notes. */
export function parseVocabularyTable(source: string, delimiter: "," | "\t"): string[][] {
  if (new TextEncoder().encode(source).length > IMPORT_BYTE_LIMIT) throw new Error("Choose a CSV or TSV file smaller than 2 MB.");
  const input = source.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false, closed = false;
  const endField = () => { row.push(field); field = ""; closed = false; if (row.length > 50) throw new Error("The file has more than 50 columns."); };
  const endRow = () => { endField(); if (row.some((value) => value.trim())) rows.push(row); row = []; if (rows.length > IMPORT_WORD_LIMIT + 1) throw new Error("Import up to 1,000 words at a time."); };
  for (let index = 0; index < input.length; index++) {
    const character = input[index];
    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') { field += '"'; index++; } else { quoted = false; closed = true; }
      } else field += character;
    } else if (character === delimiter) endField();
    else if (character === "\n" || character === "\r") { if (character === "\r" && input[index + 1] === "\n") index++; endRow(); }
    else if (character === '"' && !field && !closed) quoted = true;
    else if (closed) { if (!/\s/.test(character)) throw new Error(`Unexpected text after a quoted field near row ${rows.length + 1}.`); }
    else field += character;
  }
  if (quoted) throw new Error("The file ends inside a quoted field. Check the CSV export.");
  if (field || row.length || closed) endRow();
  if (!rows.length) throw new Error("The file is empty.");
  return rows;
}

export function suggestImportColumns(headers: string[]): ImportColumns {
  const aliases: Record<ImportField, string[]> = {
    characters: ["characters", "word", "expression", "japanese", "spelling", "vocabulary"], reading: ["reading", "kana", "pronunciation"],
    meanings: ["meanings", "meaning", "definition", "translation", "english"], meaningMnemonic: ["notes", "note", "meaningmnemonic", "mnemonic"],
    readingMnemonic: ["readingmnemonic"], partsOfSpeech: ["partsofspeech", "partofspeech", "pos"], sentenceJa: ["sentenceja", "japanesesentence"], sentenceEn: ["sentenceen", "englishsentence"],
  };
  return Object.fromEntries(IMPORT_FIELDS.map((field) => [field, headers.findIndex((header) => aliases[field].includes(header.toLowerCase().replace(/[^a-z]/g, "")))])) as ImportColumns;
}

export function previewVocabularyImport(rows: string[][], columns: ImportColumns, hasHeader: boolean, existing: readonly PersonalWordInput[]): ImportRow[] {
  if (columns.characters < 0 || columns.meanings < 0) return [];
  const seen = new Set(existing.map(wordIdentity));
  return rows.slice(hasHeader ? 1 : 0).map((cells, index) => {
    const cell = (field: ImportField) => (cells[columns[field]] ?? "").trim();
    const characters = cell("characters");
    const reading = cell("reading") || (/\p{Script=Han}/u.test(characters) ? "" : characters);
    const ja = cell("sentenceJa"), en = cell("sentenceEn");
    const result = personalWordSchema.safeParse({ characters, reading, meanings: cell("meanings").split("|").map((value) => value.trim()).filter(Boolean), meaningMnemonic: cell("meaningMnemonic"), readingMnemonic: cell("readingMnemonic"), partsOfSpeech: cell("partsOfSpeech").split("|").map((value) => value.trim()).filter(Boolean), contextSentences: ja || en ? [{ ja, en }] : [] });
    const row = index + (hasHeader ? 2 : 1);
    if (!result.success) return { row, duplicate: false, error: result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ") };
    const key = wordIdentity(result.data), duplicate = seen.has(key);
    seen.add(key);
    return { row, word: result.data, duplicate };
  });
}
