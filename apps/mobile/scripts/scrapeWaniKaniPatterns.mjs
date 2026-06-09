#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { JSDOM } from "jsdom";

const BASE_URL = "https://www.wanikani.com";
const USER_AGENT = "Mozilla/5.0";

const START_LEVEL = Number(process.env.START_LEVEL ?? 1);
const END_LEVEL = Number(process.env.END_LEVEL ?? 60);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 8);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS ?? 20_000);
const RETRIES = Number(process.env.RETRIES ?? 4);
const RETRY_FOREVER_ON_429 = process.env.RETRY_FOREVER_ON_429 !== "0";
const ONLY_RETRY_PREVIOUS_FAILURES =
  process.env.ONLY_RETRY_PREVIOUS_FAILURES === "1";
const MERGE_WITH_EXISTING = process.env.MERGE_WITH_EXISTING !== "0";
const MAX_REQUESTS_PER_MINUTE = Number(process.env.MAX_REQUESTS_PER_MINUTE ?? 55);
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_COOLDOWN_MS = Number(process.env.RATE_LIMIT_COOLDOWN_MS ?? 65_000);
const CURL_TIMEOUT_SECONDS = Math.max(5, Math.ceil(REQUEST_TIMEOUT_MS / 1000));
const execFileAsync = promisify(execFile);
const requestTimestamps = [];
let rateLimitLock = Promise.resolve();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_PATH = process.env.OUTPUT_PATH
  ? path.resolve(process.cwd(), process.env.OUTPUT_PATH)
  : path.resolve(__dirname, "../assets/patterns/wanikani_vocabulary_patterns.json");

class NonRetryableFetchError extends Error {}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRateLimitLock(fn) {
  const previousLock = rateLimitLock;
  let releaseLock;

  rateLimitLock = new Promise((resolve) => {
    releaseLock = resolve;
  });

  await previousLock;

  try {
    return await fn();
  } finally {
    releaseLock();
  }
}

async function acquireRequestSlot() {
  while (true) {
    const waitMs = await withRateLimitLock(() => {
      const now = Date.now();

      while (
        requestTimestamps.length > 0 &&
        now - requestTimestamps[0] >= RATE_LIMIT_WINDOW_MS
      ) {
        requestTimestamps.shift();
      }

      if (requestTimestamps.length < MAX_REQUESTS_PER_MINUTE) {
        requestTimestamps.push(now);
        return 0;
      }

      return Math.max(250, RATE_LIMIT_WINDOW_MS - (now - requestTimestamps[0]) + 100);
    });

    if (waitMs <= 0) {
      return;
    }

    await sleep(waitMs);
  }
}

function normalizeText(value) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function buildLevelUrl(level) {
  return `${BASE_URL}/level/${level}`;
}

function getVocabFromUrl(url) {
  const parsed = new URL(url);
  const lastPathSegment = parsed.pathname.split("/").filter(Boolean).pop() ?? "";
  return decodeURIComponent(lastPathSegment).trim();
}

function isRetryableStatusCode(statusCode) {
  return (
    statusCode === 0 ||
    statusCode === 408 ||
    statusCode === 429 ||
    statusCode >= 500
  );
}

function getBackoffMs(attempt) {
  return 500 * 2 ** attempt + Math.floor(Math.random() * 250);
}

async function fetchWithCurl(url) {
  const { stdout } = await execFileAsync(
    "curl",
    [
      "-sS",
      "-L",
      "--max-time",
      String(CURL_TIMEOUT_SECONDS),
      "-A",
      USER_AGENT,
      "-w",
      "\\n%{http_code}",
      url,
    ],
    {
      maxBuffer: 20 * 1024 * 1024,
    }
  );

  const statusLineBreak = stdout.lastIndexOf("\n");
  if (statusLineBreak === -1) {
    throw new Error(`Malformed curl response for ${url}`);
  }

  const body = stdout.slice(0, statusLineBreak);
  const statusCode = Number(stdout.slice(statusLineBreak + 1).trim());

  if (!Number.isFinite(statusCode)) {
    throw new Error(`Unable to parse HTTP status code for ${url}`);
  }

  return { body, statusCode };
}

async function fetchText(url) {
  let attempt = 0;
  let rateLimitedRetries = 0;

  while (true) {
    try {
      await acquireRequestSlot();
      const { body, statusCode } = await fetchWithCurl(url);

      if (statusCode >= 200 && statusCode < 300) {
        return body;
      }

      if (!isRetryableStatusCode(statusCode)) {
        throw new NonRetryableFetchError(
          `Failed to fetch ${url} (HTTP ${statusCode})`
        );
      }

      if (statusCode === 429 && RETRY_FOREVER_ON_429) {
        rateLimitedRetries += 1;
        if (rateLimitedRetries === 1 || rateLimitedRetries % 5 === 0) {
          console.warn(
            `[Patterns] HTTP 429 for ${url}. Waiting ${Math.round(
              RATE_LIMIT_COOLDOWN_MS / 1000
            )}s before retry ${rateLimitedRetries + 1}.`
          );
        }
        await sleep(RATE_LIMIT_COOLDOWN_MS);
        continue;
      }

      if (attempt >= RETRIES) {
        throw new Error(
          `Failed to fetch ${url} after retries (HTTP ${statusCode})`
        );
      }

      const backoffMs =
        statusCode === 429
          ? Math.max(RATE_LIMIT_COOLDOWN_MS, getBackoffMs(attempt))
          : getBackoffMs(attempt);

      attempt += 1;
      await sleep(backoffMs);
      continue;
    } catch (error) {
      if (error instanceof NonRetryableFetchError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);

      if (
        RETRY_FOREVER_ON_429 &&
        errorMessage.includes("HTTP 429")
      ) {
        rateLimitedRetries += 1;
        if (rateLimitedRetries === 1 || rateLimitedRetries % 5 === 0) {
          console.warn(
            `[Patterns] HTTP 429 for ${url}. Waiting ${Math.round(
              RATE_LIMIT_COOLDOWN_MS / 1000
            )}s before retry ${rateLimitedRetries + 1}.`
          );
        }
        await sleep(RATE_LIMIT_COOLDOWN_MS);
        continue;
      }

      if (attempt >= RETRIES) {
        throw error;
      }

      const backoffMs = getBackoffMs(attempt);
      attempt += 1;
      await sleep(backoffMs);
      continue;
    }
  }
}

function parseLevelVocabularyUrls(levelHtml) {
  const dom = new JSDOM(levelHtml);
  const links = Array.from(
    dom.window.document.querySelectorAll("a.subject-character--vocabulary[href]")
  );

  const urls = links
    .map((link) => link.getAttribute("href"))
    .filter((href) => typeof href === "string" && href.length > 0)
    .map((href) => new URL(href, BASE_URL).toString());

  return Array.from(new Set(urls));
}

function parsePatternGroups(pageHtml, level, url) {
  const dom = new JSDOM(pageHtml);
  const document = dom.window.document;
  const characters = getVocabFromUrl(url);

  if (!characters) {
    return null;
  }

  const patternLinks = Array.from(
    document.querySelectorAll(".subject-collocations__pattern-names > a[href^='#']")
  );

  if (patternLinks.length === 0) {
    return null;
  }

  const patterns = [];

  for (const link of patternLinks) {
    const patternName = normalizeText(link.textContent);
    const selector = link.getAttribute("href");

    if (!patternName || !selector) {
      continue;
    }

    const group = document.querySelector(selector);
    if (!group) {
      continue;
    }

    const seenExamples = new Set();
    const examples = [];

    for (const row of Array.from(group.children)) {
      const cells = Array.from(row.children);
      if (cells.length < 2) {
        continue;
      }

      const japanese = normalizeText(cells[0].textContent);
      const english = normalizeText(cells[1].textContent);

      if (!english || !japanese) {
        continue;
      }

      const dedupeKey = `${japanese}\u0000${english}`;
      if (seenExamples.has(dedupeKey)) {
        continue;
      }

      seenExamples.add(dedupeKey);
      examples.push({ ja: japanese, en: english });
    }

    if (examples.length > 0) {
      patterns.push({ name: patternName, examples });
    }
  }

  if (patterns.length === 0) {
    return null;
  }

  return {
    level,
    characters,
    patterns,
    sourceUrl: url,
  };
}

function mergePatternEntries(targetEntry, incomingEntry) {
  const byPattern = new Map(
    targetEntry.patterns.map((pattern) => [pattern.name, pattern])
  );

  for (const incomingPattern of incomingEntry.patterns) {
    const existingPattern = byPattern.get(incomingPattern.name);

    if (!existingPattern) {
      byPattern.set(incomingPattern.name, {
        name: incomingPattern.name,
        examples: [...incomingPattern.examples],
      });
      continue;
    }

    const seen = new Set(
      existingPattern.examples.map((example) => `${example.ja}\u0000${example.en}`)
    );

    for (const example of incomingPattern.examples) {
      const dedupeKey = `${example.ja}\u0000${example.en}`;
      if (seen.has(dedupeKey)) {
        continue;
      }
      seen.add(dedupeKey);
      existingPattern.examples.push(example);
    }
  }

  targetEntry.patterns = Array.from(byPattern.values());
}

function buildEntryKey(level, characters) {
  return `${level}|${characters}`;
}

function cloneEntry(entry) {
  return {
    level: Number(entry.level),
    characters: String(entry.characters ?? ""),
    patterns: Array.isArray(entry.patterns)
      ? entry.patterns.map((pattern) => ({
          name: String(pattern.name ?? ""),
          examples: Array.isArray(pattern.examples)
            ? pattern.examples.map((example) => ({
                ja: String(example.ja ?? ""),
                en: String(example.en ?? ""),
              }))
            : [],
        }))
      : [],
  };
}

async function loadExistingDataset() {
  try {
    const raw = await fs.readFile(OUTPUT_PATH, "utf8");
    const parsed = JSON.parse(raw);
    const entries =
      parsed && typeof parsed.entries === "object" && parsed.entries
        ? parsed.entries
        : {};
    const failures = Array.isArray(parsed?._meta?.failures)
      ? parsed._meta.failures
      : [];

    return {
      entries,
      failures,
      meta: parsed?._meta ?? null,
    };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {
        entries: {},
        failures: [],
        meta: null,
      };
    }

    throw error;
  }
}

function buildJobsFromFailures(previousFailures) {
  const jobs = [];
  const seen = new Set();

  for (const failure of previousFailures) {
    const level = Number(failure?.level);
    const url = typeof failure?.url === "string" ? failure.url.trim() : "";
    if (!Number.isInteger(level) || level < 1 || !url) {
      continue;
    }

    const key = `${level}|${url}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    jobs.push({ level, url });
  }

  return jobs;
}

async function scrapeAllLevels() {
  if (!Number.isInteger(START_LEVEL) || !Number.isInteger(END_LEVEL)) {
    throw new Error("START_LEVEL and END_LEVEL must be integers.");
  }

  if (START_LEVEL < 1 || END_LEVEL < START_LEVEL) {
    throw new Error("Invalid level range.");
  }

  const existingDataset = await loadExistingDataset();
  const shouldMergeWithExisting =
    MERGE_WITH_EXISTING || ONLY_RETRY_PREVIOUS_FAILURES;
  const jobs = [];

  if (ONLY_RETRY_PREVIOUS_FAILURES) {
    jobs.push(...buildJobsFromFailures(existingDataset.failures));
    console.log(
      `[Patterns] Retrying ${jobs.length} previously failed vocabulary pages from ${OUTPUT_PATH}...`
    );

    if (jobs.length === 0) {
      console.log("[Patterns] No previously failed pages found. Nothing to do.");
      return;
    }
  } else {
    const levels = [];
    for (let level = START_LEVEL; level <= END_LEVEL; level += 1) {
      levels.push(level);
    }

    console.log(
      `[Patterns] Discovering vocabulary URLs for levels ${START_LEVEL}-${END_LEVEL}...`
    );

    for (const level of levels) {
      const levelUrl = buildLevelUrl(level);
      const levelHtml = await fetchText(levelUrl);
      const urls = parseLevelVocabularyUrls(levelHtml);

      urls.forEach((url) => jobs.push({ level, url }));
      console.log(
        `[Patterns] Level ${level}: discovered ${urls.length} vocabulary pages.`
      );
    }
  }

  console.log(
    `[Patterns] Scraping ${jobs.length} vocabulary pages (concurrency ${CONCURRENCY})...`
  );

  let nextIndex = 0;
  let completed = 0;
  const failures = [];
  const results = [];

  async function worker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= jobs.length) {
        return;
      }

      const job = jobs[currentIndex];

      try {
        const html = await fetchText(job.url);
        const parsed = parsePatternGroups(html, job.level, job.url);
        if (parsed) {
          results.push(parsed);
        }
      } catch (error) {
        failures.push({
          level: job.level,
          url: job.url,
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        completed += 1;
        if (completed % 50 === 0 || completed === jobs.length) {
          console.log(`[Patterns] Progress ${completed}/${jobs.length}`);
        }
      }
    }
  }

  const workerCount = Math.max(1, Math.min(CONCURRENCY, jobs.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  const entries = {};

  if (shouldMergeWithExisting) {
    for (const [key, entry] of Object.entries(existingDataset.entries ?? {})) {
      if (!entry || typeof entry !== "object") {
        continue;
      }

      const clonedEntry = cloneEntry(entry);
      if (!Number.isInteger(clonedEntry.level) || !clonedEntry.characters) {
        continue;
      }

      entries[buildEntryKey(clonedEntry.level, clonedEntry.characters)] =
        clonedEntry;
    }

    console.log(
      `[Patterns] Seeded ${Object.keys(entries).length} existing entries before merge.`
    );
  }

  for (const result of results) {
    const key = buildEntryKey(result.level, result.characters);
    const existing = entries[key];

    if (!existing) {
      entries[key] = {
        level: result.level,
        characters: result.characters,
        patterns: result.patterns,
      };
      continue;
    }

    mergePatternEntries(existing, result);
  }

  const sortedEntryKeys = Object.keys(entries).sort((a, b) => {
    const [levelA, charactersA] = a.split("|");
    const [levelB, charactersB] = b.split("|");

    const levelDiff = Number(levelA) - Number(levelB);
    if (levelDiff !== 0) {
      return levelDiff;
    }

    return charactersA.localeCompare(charactersB, "ja");
  });

  const sortedEntries = {};
  for (const key of sortedEntryKeys) {
    const entry = entries[key];

    entry.patterns.sort((a, b) => a.name.localeCompare(b.name, "ja"));
    for (const pattern of entry.patterns) {
      pattern.examples.sort((a, b) => a.ja.localeCompare(b.ja, "ja"));
    }

    sortedEntries[key] = entry;
  }

  const totalPatterns = Object.values(sortedEntries).reduce(
    (sum, entry) => sum + entry.patterns.length,
    0
  );

  const totalExamples = Object.values(sortedEntries).reduce(
    (sum, entry) =>
      sum + entry.patterns.reduce((patternSum, pattern) => patternSum + pattern.examples.length, 0),
    0
  );

  const payload = {
    _meta: {
      description: "WaniKani vocabulary patterns of use scraped from public level and vocabulary pages.",
      source: BASE_URL,
      generated_at: new Date().toISOString(),
      levels: ONLY_RETRY_PREVIOUS_FAILURES
        ? existingDataset.meta?.levels ?? {
            start: START_LEVEL,
            end: END_LEVEL,
          }
        : {
            start: START_LEVEL,
            end: END_LEVEL,
          },
      totals: {
        vocabulary_pages_discovered: ONLY_RETRY_PREVIOUS_FAILURES
          ? Number(
              existingDataset.meta?.totals?.vocabulary_pages_discovered ?? jobs.length
            )
          : jobs.length,
        vocabulary_with_patterns: Object.keys(sortedEntries).length,
        patterns: totalPatterns,
        examples: totalExamples,
      },
      failures,
      config: {
        retry_forever_on_429: RETRY_FOREVER_ON_429,
        only_retry_previous_failures: ONLY_RETRY_PREVIOUS_FAILURES,
        merge_with_existing: shouldMergeWithExisting,
      },
    },
    entries: sortedEntries,
  };

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(payload), "utf8");

  console.log(`[Patterns] Wrote ${OUTPUT_PATH}`);
  console.log(
    `[Patterns] Entries: ${Object.keys(sortedEntries).length}, patterns: ${totalPatterns}, examples: ${totalExamples}`
  );

  if (failures.length > 0) {
    console.warn(`[Patterns] Failed pages: ${failures.length}`);
  }

  if (ONLY_RETRY_PREVIOUS_FAILURES) {
    const resolvedFailures = jobs.length - failures.length;
    console.log(
      `[Patterns] Resolved ${resolvedFailures}/${jobs.length} previously failed pages.`
    );
  }
}

scrapeAllLevels().catch((error) => {
  console.error("[Patterns] Scrape failed:", error);
  process.exitCode = 1;
});
