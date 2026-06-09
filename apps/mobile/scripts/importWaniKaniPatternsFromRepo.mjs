#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_OWNER = "davidhin";
const REPO_NAME = "wanikanipatterns";
const BRANCH = "main";
const GITHUB_API_BASE = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;
const RAW_BASE = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}`;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_PATH = process.env.OUTPUT_PATH
  ? path.resolve(process.cwd(), process.env.OUTPUT_PATH)
  : path.resolve(__dirname, "../assets/patterns/wanikani_vocabulary_patterns.json");

function normalizeText(value) {
  return (value ?? "").trim();
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const character = line[i];

    if (character === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  cells.push(current);
  return cells;
}

function parsePatternsCsv(csvText, level) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length <= 1) {
    return [];
  }

  const rows = [];
  for (const line of lines.slice(1)) {
    // The source CSV header says english,japanese, but rows are actually japanese,english.
    const [vocab, patternName, japanese, english] = parseCsvLine(line);
    if (!vocab || !patternName || !english || !japanese) {
      continue;
    }

    rows.push({
      level,
      vocab: normalizeText(vocab),
      patternName: normalizeText(patternName),
      english: normalizeText(english),
      japanese: normalizeText(japanese),
    });
  }

  return rows;
}

function buildDataset(rows, levelsIncluded) {
  const entries = {};

  for (const row of rows) {
    const entryKey = `${row.level}|${row.vocab}`;
    const patternMap = entries[entryKey]?.__patternMap ?? new Map();

    const existingPattern = patternMap.get(row.patternName) ?? {
      name: row.patternName,
      examples: [],
      __seenExamples: new Set(),
    };

    const exampleKey = `${row.japanese}\u0000${row.english}`;
    if (!existingPattern.__seenExamples.has(exampleKey)) {
      existingPattern.__seenExamples.add(exampleKey);
      existingPattern.examples.push({
        ja: row.japanese,
        en: row.english,
      });
    }

    patternMap.set(row.patternName, existingPattern);

    entries[entryKey] = {
      level: row.level,
      characters: row.vocab,
      __patternMap: patternMap,
    };
  }

  const serializedEntries = {};

  for (const key of Object.keys(entries).sort((a, b) => {
    const [levelA, vocabA] = a.split("|");
    const [levelB, vocabB] = b.split("|");
    const levelDiff = Number(levelA) - Number(levelB);
    if (levelDiff !== 0) {
      return levelDiff;
    }
    return vocabA.localeCompare(vocabB, "ja");
  })) {
    const entry = entries[key];

    const patterns = Array.from(entry.__patternMap.values())
      .map((pattern) => ({
        name: pattern.name,
        examples: pattern.examples.sort((a, b) => a.ja.localeCompare(b.ja, "ja")),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "ja"));

    serializedEntries[key] = {
      level: entry.level,
      characters: entry.characters,
      patterns,
    };
  }

  const totalPatterns = Object.values(serializedEntries).reduce(
    (sum, entry) => sum + entry.patterns.length,
    0
  );
  const totalExamples = Object.values(serializedEntries).reduce(
    (sum, entry) =>
      sum + entry.patterns.reduce((patternSum, pattern) => patternSum + pattern.examples.length, 0),
    0
  );

  return {
    _meta: {
      description: "WaniKani vocabulary patterns imported from davidhin/wanikanipatterns CSV files.",
      source: `https://github.com/${REPO_OWNER}/${REPO_NAME}`,
      generated_at: new Date().toISOString(),
      levels: {
        start: Math.min(...levelsIncluded),
        end: Math.max(...levelsIncluded),
        available: levelsIncluded,
      },
      totals: {
        vocabulary_pages_discovered: Object.keys(serializedEntries).length,
        vocabulary_with_patterns: Object.keys(serializedEntries).length,
        patterns: totalPatterns,
        examples: totalExamples,
      },
      failures: [],
    },
    entries: serializedEntries,
  };
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "Mozilla/5.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url} (HTTP ${response.status})`);
  }

  return response.text();
}

async function main() {
  console.log("[Patterns Repo Import] Discovering CSV files...");

  const contentsResponse = await fetch(`${GITHUB_API_BASE}/contents`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "Mozilla/5.0",
    },
  });

  if (!contentsResponse.ok) {
    throw new Error(
      `Failed to list repository contents (HTTP ${contentsResponse.status})`
    );
  }

  const contents = await contentsResponse.json();

  const csvFiles = contents
    .map((entry) => entry?.name)
    .filter((name) => /^patterns_level_\d+\.csv$/.test(name))
    .sort((a, b) => {
      const levelA = Number(a.match(/\d+/)?.[0] ?? 0);
      const levelB = Number(b.match(/\d+/)?.[0] ?? 0);
      return levelA - levelB;
    });

  if (csvFiles.length === 0) {
    throw new Error("No patterns_level_*.csv files found in source repository.");
  }

  console.log(
    `[Patterns Repo Import] Found ${csvFiles.length} CSV files: ${csvFiles.join(", ")}`
  );

  const allRows = [];
  const levelsIncluded = [];

  for (const fileName of csvFiles) {
    const level = Number(fileName.match(/\d+/)?.[0] ?? 0);
    if (!level) {
      continue;
    }

    const url = `${RAW_BASE}/${fileName}`;
    const csvText = await fetchText(url);
    const rows = parsePatternsCsv(csvText, level);
    allRows.push(...rows);
    levelsIncluded.push(level);

    console.log(
      `[Patterns Repo Import] Level ${level}: imported ${rows.length} example rows.`
    );
  }

  const dataset = buildDataset(allRows, levelsIncluded);

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(dataset), "utf8");

  console.log(`[Patterns Repo Import] Wrote ${OUTPUT_PATH}`);
  console.log(
    `[Patterns Repo Import] Entries: ${Object.keys(dataset.entries).length}, patterns: ${dataset._meta.totals.patterns}, examples: ${dataset._meta.totals.examples}`
  );
}

main().catch((error) => {
  console.error("[Patterns Repo Import] Failed:", error);
  process.exitCode = 1;
});
