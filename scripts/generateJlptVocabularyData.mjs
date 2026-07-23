import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const SOURCE_REPOSITORY = "https://github.com/elzup/jlpt-word-list";
const SOURCE_COMMIT = "13aa3c54b27115be72d8a62cd4071077c68d2171";
const SOURCE_BASE_URL =
  `https://raw.githubusercontent.com/elzup/jlpt-word-list/${SOURCE_COMMIT}/src`;
const OUTPUT_URL = new URL("../src/data/jlptVocabularyData.json", import.meta.url);
const LEVELS = ["N5", "N4", "N3", "N2", "N1"];

function parseCsv(input) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  return rows;
}

async function loadLevel(level) {
  const sourceUrl = `${SOURCE_BASE_URL}/${level.toLowerCase()}.csv`;
  const response = await fetch(sourceUrl);

  if (!response.ok) {
    throw new Error(`Failed to download ${level}: HTTP ${response.status}`);
  }

  const rows = parseCsv(await response.text());
  const header = rows.shift();
  if (header?.[0] !== "expression" || header?.[1] !== "reading") {
    throw new Error(`Unexpected ${level} source format`);
  }

  return rows
    .map(([expression, reading]) => [expression?.trim(), reading?.trim()])
    .filter(([expression, reading]) => Boolean(expression && reading));
}

const levels = {};
for (const level of LEVELS) {
  levels[level] = await loadLevel(level);
}

const output = {
  metadata: {
    source: SOURCE_REPOSITORY,
    sourceCommit: SOURCE_COMMIT,
    license: "MIT",
    note: "Community-estimated JLPT vocabulary levels; not an official JLPT specification.",
  },
  levels,
};

await writeFile(fileURLToPath(OUTPUT_URL), `${JSON.stringify(output)}\n`, "utf8");

const totalRows = Object.values(levels).reduce(
  (total, rows) => total + rows.length,
  0,
);
console.log(`Generated ${fileURLToPath(OUTPUT_URL)} with ${totalRows} entries.`);
