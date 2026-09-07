#!/usr/bin/env node

// Builds local import artifacts only. Never connects to ElevenLabs or generates audio.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(root, "research/data/custom-vocabulary-audio-manifest.json");
const outputDirectory = join(root, "output/custom-vocabulary-audio/imports");
const manifestBytes = await readFile(manifestPath);
const manifest = JSON.parse(manifestBytes);
const sourceHash = createHash("sha256").update(manifestBytes).digest("hex");
const xml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]);
const hash = (value) => createHash("sha256").update(value).digest("hex");

assert.equal(manifest.schemaVersion, 1, "Unsupported source manifest version.");
assert.ok(Array.isArray(manifest.entries) && manifest.entries.length >= 5);
assert.ok(Array.isArray(manifest.packs) && manifest.packs.length >= 2);
assert.equal(new Set(manifest.entries.map((entry) => entry.id)).size, manifest.entries.length, "Word IDs must be unique.");
assert.equal(new Set(manifest.packs.map((pack) => pack.id)).size, manifest.packs.length, "Pack IDs must be unique.");

const entriesByPack = new Map(manifest.packs.map((pack) => [pack.id, []]));
for (const entry of manifest.entries) {
  assert.match(entry.id, /^[a-z0-9][a-z0-9-]*$/, "Unsafe word ID for an EPUB filename.");
  assert.ok(typeof entry.ttsInput === "string" && entry.ttsInput.trim(), `Missing TTS input: ${entry.id}`);
  assert.ok(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(entry.ttsInput), `Invalid XML character: ${entry.id}`);
  assert.ok(entriesByPack.has(entry.packId), `Unknown pack: ${entry.packId}`);
  entriesByPack.get(entry.packId).push(entry);
}
for (const pack of manifest.packs) {
  assert.equal(entriesByPack.get(pack.id).length, pack.wordCount, `Pack count changed: ${pack.id}`);
}

// Choose the most evenly sized contiguous split; no pack is split or reordered.
let bestSplit;
for (let index = 1; index < manifest.packs.length; index += 1) {
  const firstCount = manifest.packs.slice(0, index).reduce((sum, pack) => sum + pack.wordCount, 0);
  const secondCount = manifest.entries.length - firstCount;
  if (firstCount > 500 || secondCount > 500) continue;
  const score = Math.abs(firstCount - secondCount);
  if (!bestSplit || score < bestSplit.score) bestSplit = { index, score };
}
assert.ok(bestSplit, "The catalog cannot fit in two projects with intact packs and at most 500 chapters each.");
const firstPacks = manifest.packs.slice(0, bestSplit.index);
const secondPacks = manifest.packs.slice(bestSplit.index);
const groups = [
  { name: "custom-vocabulary-pilot-5", purpose: "pilot", entries: manifest.entries.slice(0, 5) },
  { name: "custom-vocabulary-bulk-1", purpose: "bulk", entries: firstPacks.flatMap((pack) => entriesByPack.get(pack.id)) },
  { name: "custom-vocabulary-bulk-2", purpose: "bulk", entries: secondPacks.flatMap((pack) => entriesByPack.get(pack.id)) },
];
const bulkIds = groups.slice(1).flatMap((group) => group.entries.map((entry) => entry.id));
assert.equal(bulkIds.length, manifest.entries.length);
assert.equal(new Set(bulkIds).size, manifest.entries.length);
assert.deepEqual(new Set(bulkIds), new Set(manifest.entries.map((entry) => entry.id)));

const modified = `${manifest.preparedAt}T00:00:00Z`;
const fileDate = new Date(modified);
assert.ok(Number.isFinite(fileDate.getTime()), "Invalid manifest preparation date.");

function contentDocuments(group) {
  const documents = new Map();
  documents.set("mimetype", "application/epub+zip");
  documents.set("META-INF/container.xml", `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>
`);
  const identifier = `urn:sha256:${hash(`${sourceHash}:${group.name}`)}`;
  const chapters = group.entries.map((entry, index) => ({ ...entry, itemId: `word-${index + 1}`, href: `words/${entry.id}.xhtml` }));
  documents.set("EPUB/package.opf", `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="ja">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">${identifier}</dc:identifier>
    <dc:title>${xml(group.name)}</dc:title>
    <dc:language>ja</dc:language>
    <meta property="dcterms:modified">${modified}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
${chapters.map((entry) => `    <item id="${entry.itemId}" href="${entry.href}" media-type="application/xhtml+xml"/>`).join("\n")}
  </manifest>
  <spine toc="ncx">
${chapters.map((entry) => `    <itemref idref="${entry.itemId}"/>`).join("\n")}
  </spine>
</package>
`);
  // Navigation is manifest-only, not a narrated spine item. IDs are never in a word's body.
  documents.set("EPUB/nav.xhtml", `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="ja" lang="ja">
  <head><title>${xml(group.name)}</title></head>
  <body><nav epub:type="toc" id="toc"><ol>
${chapters.map((entry) => `    <li><a href="${entry.href}">${xml(entry.id)}</a></li>`).join("\n")}
  </ol></nav></body>
</html>
`);
  documents.set("EPUB/toc.ncx", `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="ja">
  <head><meta name="dtb:uid" content="${identifier}"/><meta name="dtb:depth" content="1"/><meta name="dtb:totalPageCount" content="0"/><meta name="dtb:maxPageNumber" content="0"/></head>
  <docTitle><text>${xml(group.name)}</text></docTitle>
  <navMap>
${chapters.map((entry, index) => `    <navPoint id="${entry.itemId}" playOrder="${index + 1}"><navLabel><text>${xml(entry.id)}</text></navLabel><content src="${entry.href}"/></navPoint>`).join("\n")}
  </navMap>
</ncx>
`);
  for (const entry of chapters) {
    documents.set(`EPUB/${entry.href}`, `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="ja" lang="ja">
  <head><title>${xml(entry.id)}</title></head>
  <body><h1>${xml(entry.ttsInput)}</h1></body>
</html>
`);
  }
  return { documents, chapters };
}

async function writeGenerated(path, value) {
  try {
    await writeFile(path, value, { flag: "wx" });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const current = await readFile(path);
    const wanted = Buffer.isBuffer(value) ? value : Buffer.from(value);
    assert.ok(current.equals(wanted), `Refusing to overwrite a different existing artifact: ${path}`);
  }
}

await mkdir(outputDirectory, { recursive: true });
const results = [];
for (const group of groups) {
  const stagingDirectory = await mkdtemp(join(tmpdir(), "custom-vocabulary-epub-"));
  try {
    const { documents, chapters } = contentDocuments(group);
    for (const [name, value] of documents) {
      const path = join(stagingDirectory, name);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, value);
      await utimes(path, fileDate, fileDate);
    }
    const xmlFiles = [...documents.keys()].filter((name) => name !== "mimetype");
    await run("xmllint", ["--nonet", "--noout", ...xmlFiles], { cwd: stagingDirectory });
    const archivePath = join(stagingDirectory, `${group.name}.epub`);
    // EPUB's first ZIP entry must be the uncompressed mimetype, with no extra field.
    await run("zip", ["-q", "-X", "-0", archivePath, "mimetype"], { cwd: stagingDirectory });
    await run("zip", ["-q", "-X", "-9", archivePath, ...xmlFiles], { cwd: stagingDirectory });
    await run("unzip", ["-t", archivePath]);
    const archive = await readFile(archivePath);
    assert.equal(archive.readUInt32LE(0), 0x04034b50);
    assert.equal(archive.readUInt16LE(8), 0, "mimetype must be stored, not compressed.");
    assert.equal(archive.readUInt16LE(28), 0, "mimetype must have no ZIP extra field.");
    assert.equal(archive.subarray(30, 38).toString(), "mimetype");
    assert.equal(archive.subarray(38, 58).toString(), "application/epub+zip");
    const epubFilename = `${group.name}.epub`;
    await writeGenerated(join(outputDirectory, epubFilename), archive);
    const index = {
      schemaVersion: 1,
      preparedAt: manifest.preparedAt,
      generationStatus: "not-generated",
      purpose: group.purpose,
      epubFilename,
      epubSha256: hash(archive),
      sourceManifest: "research/data/custom-vocabulary-audio-manifest.json",
      sourceManifestSha256: sourceHash,
      chapterCount: chapters.length,
      packIds: [...new Set(chapters.map((entry) => entry.packId))],
      narrationPolicy: "Each spine XHTML body contains only an h1 with the exact manifest ttsInput. Word IDs exist only in XHTML titles, filenames, and EPUB navigation metadata. Studio import behavior must be inspected before generating audio.",
      chapters: chapters.map((entry, index) => ({
        ordinal: index + 1,
        chapterLabel: entry.id,
        xhtmlPath: `EPUB/${entry.href}`,
        id: entry.id,
        packId: entry.packId,
        characters: entry.characters,
        reading: entry.reading,
        ttsInput: entry.ttsInput,
        destinationFilename: entry.filename,
      })),
    };
    await writeGenerated(join(outputDirectory, `${group.name}.index.json`), `${JSON.stringify(index, null, 2)}\n`);
    results.push({ epubFilename, chapterCount: chapters.length, packCount: index.packIds.length, sha256: index.epubSha256 });
  } finally {
    // This exact directory was created by this invocation and contains only generated staging files.
    await rm(stagingDirectory, { recursive: true, force: true });
  }
}
console.log(JSON.stringify({ outputDirectory, sourceManifestSha256: sourceHash, imports: results, checks: ["Unique bulk word coverage", "Intact pack groups", "At most 500 chapters per project", "Well-formed XML", "ZIP integrity", "EPUB mimetype placement"], note: "No audio generated. Validate actual Studio chapter splitting, spoken text, and ZIP filenames with the pilot before importing bulk." }, null, 2));
