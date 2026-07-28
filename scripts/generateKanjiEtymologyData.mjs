#!/usr/bin/env node

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG_PATH = join(
  ROOT,
  "scripts",
  "data",
  "wanikani-kanji-catalog.json"
);
const CATALOG_OUTPUT_PATH = join(
  ROOT,
  "src",
  "data",
  "wanikaniKanjiCatalog.generated.ts"
);
const ETYMOLOGY_OUTPUT_PATH = join(
  ROOT,
  "src",
  "data",
  "kanjiEtymology.generated.ts"
);
const WIKTIONARY_REVISIONS_PATH = join(
  ROOT,
  "scripts",
  "data",
  "wiktionary-kanji-fallback-revisions.json"
);

const WANI_KANI_DIFFICULTIES = [
  "pleasant",
  "painful",
  "death",
  "hell",
  "paradise",
  "reality",
];
const WANI_KANI_URL = (difficulty) =>
  `https://www.wanikani.com/kanji?difficulty=${difficulty}`;

const MAKE_ME_A_HANZI_COMMIT =
  "bddc96d41bef78427ed0e034e9f7e31d71fd1b92";
const MAKE_ME_A_HANZI_URL =
  `https://raw.githubusercontent.com/skishore/makemeahanzi/${MAKE_ME_A_HANZI_COMMIT}/dictionary.txt`;
const MAKE_ME_A_HANZI_SOURCE_URL =
  `https://github.com/skishore/makemeahanzi/blob/${MAKE_ME_A_HANZI_COMMIT}/dictionary.txt`;

const KYUJIPY_COMMIT = "11b9c6f2a9ec1e303cc6ca52cb0a417735e300c4";
const KYUJIPY_URL =
  `https://raw.githubusercontent.com/cjkvsoft/kyujipy/${KYUJIPY_COMMIT}/kyujipy/data/kyujitai_simplified.cson`;

const CHINESE_LEXICON_COMMIT =
  "de64ca4c5d3fef6694a1270f943726c5f622bb03";
const CHINESE_LEXICON_INDEX_URL =
  `https://raw.githubusercontent.com/peterolson/chinese-lexicon/${CHINESE_LEXICON_COMMIT}/etymology/index.js`;
const CHINESE_LEXICON_COMMANDS_URL =
  `https://raw.githubusercontent.com/peterolson/chinese-lexicon/${CHINESE_LEXICON_COMMIT}/etymology/etymologyCommands.js`;
const CHINESE_LEXICON_SOURCE_URL =
  `https://github.com/peterolson/chinese-lexicon/tree/${CHINESE_LEXICON_COMMIT}/etymology`;

const WIKTIONARY_API_URL = "https://en.wiktionary.org/w/api.php";
const WIKTIONARY_LICENSE_URL =
  "https://creativecommons.org/licenses/by-sa/4.0/";
const SOURCE_CORRECTIONS = {
  弁: {
    kind: "documented",
    explanation:
      "In modern Japanese, 弁 is a simplified merger of 辨 (“distinguish”), 瓣 (“petal” or “valve”), and 辯 (“speech”); it also commonly replaces 辮 and 辦. The older character 弁 itself depicts two hands 廾 placing a cap 厶 on someone’s head.",
    source: {
      title: "Wiktionary contributors",
      url: "https://en.wiktionary.org/w/index.php?title=%E5%BC%81&oldid=89672714",
    },
    sourceId: "wiktionary",
  },
  気: {
    kind: "pictophonetic",
    explanation:
      "Traditional 氣 is phono-semantic: 米 (“rice”) supplies the meaning element, while 气 supplies the original sound element. The character was later borrowed for “air” and related meanings.",
    note: "氣 is the traditional form; 気 is the modern Japanese form.",
    source: {
      title: "Wiktionary contributors",
      url: "https://en.wiktionary.org/w/index.php?title=%E6%B0%A3&oldid=90956178",
    },
    sourceId: "wiktionary",
  },
};

const EXPECTED_KANJI_COUNT = 2102;
const refreshCatalog = process.argv.includes("--refresh-catalog");

async function fetchText(url, init) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Kakehashi kanji data generator (https://github.com/pedroortego/Kakehashi)",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

function assertSingleScalar(character, label) {
  if (Array.from(character).length !== 1) {
    throw new Error(`${label} is not one Unicode scalar: ${character}`);
  }
}

function parseWaniKaniPage(html, difficulty) {
  const tokenPattern =
    /<span class='character-grid__header-title'>Level (\d+)<\/span>|<span class="subject-character__characters-text" lang="ja">\s*([^<\s]+)\s*<\/span>/g;
  const items = [];
  let currentLevel = null;

  for (const match of html.matchAll(tokenPattern)) {
    if (match[1]) {
      currentLevel = Number(match[1]);
      continue;
    }

    if (!currentLevel || !match[2]) {
      throw new Error(`Could not associate ${match[2]} with a WaniKani level`);
    }

    assertSingleScalar(match[2], "WaniKani subject");
    items.push({ character: match[2], level: currentLevel });
  }

  if (items.length < 300) {
    throw new Error(
      `Parsed only ${items.length} kanji from WaniKani ${difficulty}`
    );
  }

  return items;
}

function validateCatalog(catalog) {
  const characters = catalog.items.map(({ character }) => character);
  characters.forEach((character) =>
    assertSingleScalar(character, "Catalog subject")
  );

  if (characters.length !== EXPECTED_KANJI_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_KANJI_COUNT} WaniKani kanji, found ${characters.length}`
    );
  }

  if (new Set(characters).size !== characters.length) {
    throw new Error("WaniKani catalog contains duplicate kanji");
  }
}

async function buildCatalog() {
  const pages = await Promise.all(
    WANI_KANI_DIFFICULTIES.map(async (difficulty) => ({
      difficulty,
      html: await fetchText(WANI_KANI_URL(difficulty)),
    }))
  );
  const items = pages.flatMap(({ html, difficulty }) =>
    parseWaniKaniPage(html, difficulty)
  );
  const catalog = {
    generatedAt: new Date().toISOString(),
    source: "Official public WaniKani kanji level pages",
    sourceUrls: WANI_KANI_DIFFICULTIES.map(WANI_KANI_URL),
    items,
  };
  validateCatalog(catalog);
  await mkdir(dirname(CATALOG_PATH), { recursive: true });
  await writeFile(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`);
  return catalog;
}

async function loadCatalog() {
  if (refreshCatalog) {
    return buildCatalog();
  }

  try {
    const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
    validateCatalog(catalog);
    return catalog;
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
    return buildCatalog();
  }
}

function parseMakeMeAHanzi(text) {
  return new Map(
    text
      .trim()
      .split("\n")
      .map((line) => {
        const entry = JSON.parse(line);
        return [entry.character, entry];
      })
  );
}

function parseKyujipy(text) {
  return new Map(
    Array.from(text.matchAll(/\["(.+?)",\s*"(.+?)"\]/g), (match) => [
      match[1],
      match[2].normalize("NFKC"),
    ])
  );
}

async function loadChineseLexicon() {
  const [indexSource, commandsSource] = await Promise.all([
    fetchText(CHINESE_LEXICON_INDEX_URL),
    fetchText(CHINESE_LEXICON_COMMANDS_URL),
  ]);
  const tempDirectory = await mkdir(
    join(tmpdir(), `kakehashi-kanji-etymology-${process.pid}`),
    { recursive: true }
  ).then(() => join(tmpdir(), `kakehashi-kanji-etymology-${process.pid}`));
  const commandsPath = join(tempDirectory, "etymologyCommands.mjs");
  const indexPath = join(tempDirectory, "index.mjs");
  const imageStub =
    "const etymologyImages = { oracle: {}, bronze: {}, seal: {}, cursive: {}, traditional: {} };";

  await Promise.all([
    writeFile(
      commandsPath,
      commandsSource.replace(
        /^import etymologyImages from ".\/etymologyImages\.js";/m,
        imageStub
      )
    ),
    writeFile(
      indexPath,
      indexSource.replace(
        '"./etymologyCommands.js"',
        '"./etymologyCommands.mjs"'
      )
    ),
  ]);

  const { etymologies } = await import(
    `${pathToFileURL(indexPath).href}?v=${Date.now()}`
  );
  await rm(tempDirectory, { recursive: true, force: true });
  return etymologies;
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\bAnalagous\b/g, "Analogous")
    .replace(/\bnoist bustle\b/g, "noisy bustle")
    .replace(/\btheories about theories about\b/g, "theories about")
    .trim();
}

function finishSentence(value) {
  const text = normalizeText(value);
  if (!text) return "";
  const capitalized = /^[a-z]/.test(text)
    ? `${text[0].toUpperCase()}${text.slice(1)}`
    : text;
  return /[.!?…”]$/.test(capitalized) ? capitalized : `${capitalized}.`;
}

function makeMeAHanziExplanation(etymology) {
  const hint = normalizeText(etymology.hint);
  const semantic = normalizeText(etymology.semantic);
  const phonetic = normalizeText(etymology.phonetic);

  if (etymology.type === "ideographic") {
    return `An ideographic formation: ${finishSentence(hint)}`;
  }
  if (etymology.type === "pictographic") {
    return `A pictograph: ${finishSentence(hint)}`;
  }

  if (semantic && phonetic) {
    const meaning = hint ? `${semantic} (${hint})` : semantic;
    return (
      `A phono-semantic character: ${meaning} supplies the meaning element, ` +
      `while ${phonetic} supplies the original sound element.`
    );
  }
  if (semantic) {
    const meaning = hint ? `${semantic} (${hint})` : semantic;
    return (
      `A phono-semantic character: ${meaning} supplies the meaning element. ` +
      "The source does not identify the original sound element."
    );
  }
  if (phonetic) {
    return (
      `A phono-semantic character: ${phonetic} supplies the original sound ` +
      "element. The source does not identify the meaning element."
    );
  }
  return "The source classifies this as phono-semantic but does not identify its component roles.";
}

function chooseMakeMeAHanzi(character, entries, oldForms) {
  const oldForm = oldForms.get(character);
  const traditional = oldForm ? entries.get(oldForm) : null;
  if (traditional?.etymology) {
    return { entry: traditional, sourceCharacter: oldForm };
  }

  const direct = entries.get(character);
  if (direct?.etymology) {
    return { entry: direct, sourceCharacter: character };
  }

  return null;
}

function chooseChineseLexicon(character, entries, oldForms) {
  const oldForm = oldForms.get(character);
  if (
    oldForm &&
    entries[oldForm] &&
    !/^Origin unclear\.?$/i.test(normalizeText(entries[oldForm].notes))
  ) {
    return { entry: entries[oldForm], sourceCharacter: oldForm };
  }

  if (
    entries[character] &&
    !/^Origin unclear\.?$/i.test(normalizeText(entries[character].notes))
  ) {
    return { entry: entries[character], sourceCharacter: character };
  }
  return null;
}

function classifyChineseLexicon(entry) {
  const notes = normalizeText(entry.notes);
  const componentTypes = new Set(
    (entry.components ?? []).map(({ type }) => type)
  );
  if (/phonosemantic compound/i.test(notes)) return "pictophonetic";
  if (/pictograph/i.test(notes)) return "pictographic";
  if (
    componentTypes.has("meaning") &&
    !componentTypes.has("sound") &&
    !componentTypes.has("unknown")
  ) {
    return "ideographic";
  }
  return /origin unclear|unclear why|unknown/i.test(notes)
    ? "uncertain"
    : "documented";
}

function chineseLexiconExplanation(entry) {
  const notes = finishSentence(entry.notes);
  if (notes) return notes;

  const meaning = (entry.components ?? [])
    .filter(({ type }) => type === "meaning")
    .map(({ char }) => char);
  const sound = (entry.components ?? [])
    .filter(({ type }) => type === "sound")
    .map(({ char }) => char);

  if (meaning.length && sound.length) {
    return (
      `A phono-semantic character: ${meaning.join(" and ")} supplies the ` +
      `meaning element, while ${sound.join(" and ")} supplies the original sound element.`
    );
  }
  return "The source records the character’s formation but does not provide a concise explanatory note.";
}

const IDS_ARITY = new Map([
  ["⿰", 2],
  ["⿱", 2],
  ["⿲", 3],
  ["⿳", 3],
  ["⿴", 2],
  ["⿵", 2],
  ["⿶", 2],
  ["⿷", 2],
  ["⿸", 2],
  ["⿹", 2],
  ["⿺", 2],
  ["⿻", 2],
]);
const IDS_RELATION = new Map([
  ["⿰", "a left–right arrangement"],
  ["⿱", "a top–bottom arrangement"],
  ["⿲", "a left–middle–right arrangement"],
  ["⿳", "a top–middle–bottom arrangement"],
  ["⿴", "a full enclosure"],
  ["⿵", "an enclosure from above"],
  ["⿶", "an enclosure from below"],
  ["⿷", "an enclosure from the left"],
  ["⿸", "an enclosure from the upper left"],
  ["⿹", "an enclosure from the upper right"],
  ["⿺", "an enclosure from the lower left"],
  ["⿻", "an overlapping arrangement"],
]);

function parseIds(decomposition) {
  const scalars = Array.from(decomposition.replace(/[\s,].*$/, ""));
  let index = 0;

  function parseNode() {
    const value = scalars[index++];
    const arity = IDS_ARITY.get(value) ?? 0;
    return {
      value,
      children: Array.from({ length: arity }, parseNode),
    };
  }

  return parseNode();
}

function idsComponents(node) {
  if (!node.children.length) return node.value;
  return `(${node.children.map(idsComponents).join(" + ")})`;
}

function structuralExplanation(decomposition) {
  const root = parseIds(decomposition);
  const components = root.children.length
    ? root.children.map(idsComponents).join(" + ")
    : root.value;
  const relation = IDS_RELATION.get(root.value);
  return (
    `The documented modern glyph structure is ${components}` +
    (relation ? ` in ${relation}` : "") +
    ". Structural decomposition alone does not establish historical origin."
  );
}

function validDecomposition(entry) {
  return Boolean(
    entry?.decomposition &&
      !entry.decomposition.includes("？") &&
      IDS_ARITY.has(Array.from(entry.decomposition)[0])
  );
}

function languageSection(wikitext, language) {
  const pattern = new RegExp(
    `^==${language}==\\n([\\s\\S]*?)(?=^==[^=]|(?![\\s\\S]))`,
    "m"
  );
  return pattern.exec(wikitext)?.[1] ?? "";
}

function glyphOrigin(section) {
  return (
    /^===Glyph origin===\n([\s\S]*?)(?=^===[^=]|^==[^=]|(?![\s\S]))/m.exec(section)?.[1] ??
    ""
  );
}

function findTemplate(text, name) {
  const start = text.indexOf(`{{${name}|`);
  if (start < 0) return null;

  let depth = 0;
  for (let index = start; index < text.length - 1; index += 1) {
    const pair = text.slice(index, index + 2);
    if (pair === "{{") {
      depth += 1;
      index += 1;
    } else if (pair === "}}") {
      depth -= 1;
      index += 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
}

function splitTemplateFields(content) {
  const parts = [];
  let current = "";
  let depth = 0;
  for (let index = 0; index < content.length; index += 1) {
    const pair = content.slice(index, index + 2);
    if (pair === "{{" || pair === "[[") {
      depth += 1;
      current += pair;
      index += 1;
    } else if (pair === "}}" || pair === "]]") {
      depth -= 1;
      current += pair;
      index += 1;
    } else if (content[index] === "|" && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += content[index];
    }
  }
  parts.push(current);
  return parts;
}

function parseTemplate(template) {
  const content = template.slice(2, -2);
  const parts = splitTemplateFields(content);
  const name = parts.shift();
  const positional = [];
  const named = {};
  for (const part of parts) {
    const separator = part.indexOf("=");
    if (separator > 0) {
      named[part.slice(0, separator)] = part.slice(separator + 1);
    } else {
      positional.push(part);
    }
  }
  return { name, positional, named };
}

function cleanWikitext(value) {
  return normalizeText(value)
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/'''?/g, "");
}

function annotatedComponent(component, meaning) {
  const cleanedMeaning = cleanWikitext(meaning);
  return cleanedMeaning ? `${component} (“${cleanedMeaning}”)` : component;
}

function parseWiktionaryFormation(character, wikitext, revisionId) {
  const japaneseOrigin = glyphOrigin(languageSection(wikitext, "Japanese"));
  const translingualOrigin = glyphOrigin(
    languageSection(wikitext, "Translingual")
  );
  const chineseOrigin = glyphOrigin(languageSection(wikitext, "Chinese"));
  const origin = japaneseOrigin || translingualOrigin || chineseOrigin;
  const compoundTemplate = findTemplate(origin, "Han compound");
  const compound = compoundTemplate ? parseTemplate(compoundTemplate) : null;

  let kind = "structural";
  let explanation = "";
  if (compound) {
    const components = compound.positional.filter(
      (value) => value && !value.includes("#")
    );
    const semantic = components.filter(
      (_, index) => compound.named[`c${index + 1}`] === "s"
    );
    const phonetic = components.filter(
      (_, index) => compound.named[`c${index + 1}`] === "p"
    );
    const describedComponents = components.map((component, index) =>
      annotatedComponent(component, compound.named[`t${index + 1}`])
    );
    const describedSemantic = semantic.map((component) => {
      const index = components.indexOf(component);
      return annotatedComponent(component, compound.named[`t${index + 1}`]);
    });
    const describedPhonetic = phonetic.map((component) => {
      const index = components.indexOf(component);
      return annotatedComponent(component, compound.named[`t${index + 1}`]);
    });

    if (semantic.length && phonetic.length) {
      kind = "pictophonetic";
      explanation =
        `A phono-semantic character: ${describedSemantic.join(" and ")} supplies the ` +
        `meaning element, while ${describedPhonetic.join(" and ")} supplies the original sound element.`;
    } else if (components.length >= 2) {
      kind = "ideographic";
      explanation =
        `An ideographic formation combining ${describedComponents.join(" and ")}.`;
    }
  }

  if (!explanation && character === "々") {
    kind = "documented";
    explanation =
      "One documented theory derives this iteration mark from a cursive form of 仝, a variant of 同 (“same”).";
  }

  if (!explanation) {
    const hanCharacter = /\{\{Han char\|([^\n}]+)\}\}/.exec(wikitext)?.[1] ?? "";
    const ids =
      /(?:^|\|)ids=([^|}]+)/.exec(hanCharacter)?.[1]?.split(",")[0].trim() ??
      "";
    if (!ids) {
      throw new Error(`No usable Wiktionary formation data for ${character}`);
    }
    explanation = structuralExplanation(ids);
  }

  const isKokuji = /\{\{ja-etym-kokuji\}\}/.test(japaneseOrigin);
  return {
    kind,
    explanation,
    note: isKokuji
      ? "This is a Japanese-coined character (kokuji)."
      : undefined,
    source: {
      title: "Wiktionary contributors",
      url:
        `https://en.wiktionary.org/w/index.php?title=${encodeURIComponent(character)}` +
        `&oldid=${revisionId}`,
    },
    sourceId: "wiktionary",
  };
}

async function loadWiktionaryFallbacks(characters) {
  if (!characters.length) return new Map();

  let revisionSnapshot = null;
  try {
    revisionSnapshot = JSON.parse(
      await readFile(WIKTIONARY_REVISIONS_PATH, "utf8")
    );
    const snapshotCharacters = Object.keys(revisionSnapshot.revisions).sort();
    if (
      JSON.stringify(snapshotCharacters) !==
      JSON.stringify([...characters].sort())
    ) {
      revisionSnapshot = null;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const requestedValues = revisionSnapshot
    ? Object.values(revisionSnapshot.revisions).map(String)
    : characters;
  const queryKey = revisionSnapshot ? "revids" : "titles";
  const pages = [];
  for (let offset = 0; offset < requestedValues.length; offset += 50) {
    const url = new URL(WIKTIONARY_API_URL);
    for (const [key, value] of Object.entries({
      action: "query",
      prop: "revisions",
      rvprop: "content|ids",
      rvslots: "main",
      [queryKey]: requestedValues.slice(offset, offset + 50).join("|"),
      format: "json",
      formatversion: "2",
    })) {
      url.searchParams.set(key, value);
    }
    const response = JSON.parse(await fetchText(url));
    pages.push(...(response.query?.pages ?? []));
  }
  const records = new Map();
  const revisions = {};

  for (const page of pages) {
    const revision = page.revisions?.[0];
    const wikitext = revision?.slots?.main?.content;
    if (!revision || !wikitext) {
      throw new Error(`Missing Wiktionary revision for ${page.title}`);
    }
    records.set(
      page.title,
      parseWiktionaryFormation(page.title, wikitext, revision.revid)
    );
    revisions[page.title] = revision.revid;
  }

  if (!revisionSnapshot) {
    await writeFile(
      WIKTIONARY_REVISIONS_PATH,
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          source: WIKTIONARY_API_URL,
          license: WIKTIONARY_LICENSE_URL,
          revisions,
        },
        null,
        2
      )}\n`
    );
  }
  return records;
}

function sourceNote(sourceCharacter, character) {
  return sourceCharacter === character
    ? undefined
    : `Formation data is recorded for the traditional form ${sourceCharacter}; ${character} is the modern Japanese form.`;
}

function dataForCharacter(
  character,
  makeMeAHanzi,
  oldForms,
  chineseLexicon,
  wiktionary
) {
  if (SOURCE_CORRECTIONS[character]) {
    return SOURCE_CORRECTIONS[character];
  }

  const makeMeAHanziChoice = chooseMakeMeAHanzi(
    character,
    makeMeAHanzi,
    oldForms
  );
  if (makeMeAHanziChoice) {
    return {
      kind: makeMeAHanziChoice.entry.etymology.type,
      explanation: makeMeAHanziExplanation(
        makeMeAHanziChoice.entry.etymology
      ),
      note: sourceNote(makeMeAHanziChoice.sourceCharacter, character),
      source: {
        title: "Make Me a Hanzi",
        url: MAKE_ME_A_HANZI_SOURCE_URL,
      },
      sourceId: "make-me-a-hanzi",
    };
  }

  const chineseLexiconChoice = chooseChineseLexicon(
    character,
    chineseLexicon,
    oldForms
  );
  if (chineseLexiconChoice) {
    return {
      kind: classifyChineseLexicon(chineseLexiconChoice.entry),
      explanation: chineseLexiconExplanation(chineseLexiconChoice.entry),
      note: sourceNote(chineseLexiconChoice.sourceCharacter, character),
      source: {
        title: "Chinese Lexicon",
        url: CHINESE_LEXICON_SOURCE_URL,
      },
      sourceId: "chinese-lexicon",
    };
  }

  const direct = makeMeAHanzi.get(character);
  const oldForm = oldForms.get(character);
  const traditional = oldForm ? makeMeAHanzi.get(oldForm) : null;
  const structural = validDecomposition(traditional)
      ? { entry: traditional, sourceCharacter: oldForm }
      : validDecomposition(direct)
        ? { entry: direct, sourceCharacter: character }
      : null;
  if (structural) {
    return {
      kind: "structural",
      explanation: structuralExplanation(structural.entry.decomposition),
      note: sourceNote(structural.sourceCharacter, character),
      source: {
        title: "Make Me a Hanzi",
        url: MAKE_ME_A_HANZI_SOURCE_URL,
      },
      sourceId: "make-me-a-hanzi-structure",
    };
  }

  const wiktionaryEntry = wiktionary.get(character);
  if (!wiktionaryEntry) {
    throw new Error(`No substantive formation entry for ${character}`);
  }
  return wiktionaryEntry;
}

function serializeEntry(entry) {
  const lines = [
    `kind: ${JSON.stringify(entry.kind)}`,
    `explanation: ${JSON.stringify(entry.explanation)}`,
  ];
  if (entry.note) lines.push(`note: ${JSON.stringify(entry.note)}`);
  lines.push(
    `source: { title: ${JSON.stringify(entry.source.title)}, url: ${JSON.stringify(entry.source.url)} }`
  );
  return `{ ${lines.join(", ")} }`;
}

async function writeCatalogModule(catalog) {
  const characters = catalog.items.map(({ character }) => character);
  const content = `// Generated by scripts/generateKanjiEtymologyData.mjs. Do not edit by hand.
// Source snapshot: ${catalog.generatedAt}
// ${catalog.sourceUrls.join("\n// ")}

export const WANI_KANI_KANJI = ${JSON.stringify(characters, null, 2)} as const;
`;
  await writeFile(CATALOG_OUTPUT_PATH, content);
}

async function writeEtymologyModule(records) {
  const entries = Array.from(records, ([character, entry]) =>
    `  ${JSON.stringify(character)}: ${serializeEntry(entry)},`
  ).join("\n");
  const content = `// Generated by scripts/generateKanjiEtymologyData.mjs. Do not edit by hand.
// See THIRD_PARTY_NOTICES.md for source versions, licenses, and limitations.
import type { KanjiEtymologyDataEntry } from "./kanjiEtymology";

export const KANJI_ETYMOLOGIES: Readonly<
  Record<string, KanjiEtymologyDataEntry>
> = {
${entries}
};
`;
  await writeFile(ETYMOLOGY_OUTPUT_PATH, content);
}

const catalog = await loadCatalog();
const characters = catalog.items.map(({ character }) => character);
const [makeMeAHanziText, kyujipyText, chineseLexicon] = await Promise.all([
  fetchText(MAKE_ME_A_HANZI_URL),
  fetchText(KYUJIPY_URL),
  loadChineseLexicon(),
]);
const makeMeAHanzi = parseMakeMeAHanzi(makeMeAHanziText);
const oldForms = parseKyujipy(kyujipyText);

const needsWiktionary = characters.filter((character) => {
  if (SOURCE_CORRECTIONS[character]) return false;
  if (chooseMakeMeAHanzi(character, makeMeAHanzi, oldForms)) return false;
  if (chooseChineseLexicon(character, chineseLexicon, oldForms)) return false;
  const direct = makeMeAHanzi.get(character);
  const oldForm = oldForms.get(character);
  const traditional = oldForm ? makeMeAHanzi.get(oldForm) : null;
  return !validDecomposition(direct) && !validDecomposition(traditional);
});
const wiktionary = await loadWiktionaryFallbacks(needsWiktionary);
const records = new Map(
  characters.map((character) => [
    character,
    dataForCharacter(
      character,
      makeMeAHanzi,
      oldForms,
      chineseLexicon,
      wiktionary
    ),
  ])
);

if (records.size !== EXPECTED_KANJI_COUNT) {
  throw new Error(`Generated ${records.size} entries, expected ${EXPECTED_KANJI_COUNT}`);
}

await Promise.all([
  writeCatalogModule(catalog),
  writeEtymologyModule(records),
]);

const counts = {};
for (const entry of records.values()) {
  const key = `${entry.sourceId}/${entry.kind}`;
  counts[key] = (counts[key] ?? 0) + 1;
}
console.log(
  JSON.stringify(
    {
      catalog: characters.length,
      entries: records.size,
      wiktionaryLicense: WIKTIONARY_LICENSE_URL,
      counts,
    },
    null,
    2
  )
);
