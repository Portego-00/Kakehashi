import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const hashedFile = /^[a-f0-9]{32}\.(?:html|js|css)$/;

/** Follow the DOM files actually referenced by each exported native bundle. */
export function inspectDomAssets(directory, metadata) {
  const results = [];
  for (const [platform, info] of Object.entries(metadata.fileMetadata)) {
    if (platform !== "ios" && platform !== "android") continue;
    const native = readFileSync(path.join(directory, info.bundle)).toString("latin1");
    const html = [...new Set(native.match(/[a-f0-9]{32}\.html/g) ?? [])];
    const pending = html.map((name) => `www.bundle/${name}`);
    const required = new Set();
    while (pending.length) {
      const relative = pending.pop();
      if (required.has(relative)) continue;
      required.add(relative);
      const absolute = path.join(directory, relative);
      if (!existsSync(absolute)) throw new Error(`${platform}: required DOM file is missing: ${relative}`);
      const contents = readFileSync(absolute);
      const name = path.basename(relative);
      const expected = name.split(".")[0];
      if (createHash("md5").update(contents).digest("hex") !== expected) {
        throw new Error(`${platform}: DOM content hash does not match its filename: ${relative}`);
      }
      const text = contents.toString("utf8");
      // Expo's MD5 export must also rewrite lazy imports. Their original Metro
      // paths cannot resolve from the flat downloaded update asset directory.
      const unresolvedChunk = relative.endsWith(".js")
        ? text.match(/["'`]((?:\.\/)?_expo\/static\/js\/[^"'`]+\.js)["'`]/)?.[1]
        : undefined;
      if (unresolvedChunk) {
        throw new Error(`${platform}: DOM script contains an unresolved chunk path: ${unresolvedChunk}`);
      }
      const references = relative.endsWith(".html")
        ? [...text.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map((match) => match[1])
        : [...text.matchAll(/["'`]((?:\.\/)?[a-f0-9]{32}\.(?:html|js|css))["'`]/g)].map((match) => match[1]);
      for (const reference of references) {
        const filename = reference.replace(/^\.\//, "");
        if (hashedFile.test(filename)) pending.push(`www.bundle/${filename}`);
      }
    }
    const listed = new Set(info.assets.map((asset) => asset.path));
    const missing = [...required].filter((relative) => !listed.has(relative)).sort();
    results.push({ platform, htmlCount: html.length, requiredCount: required.size, missing });
  }
  return results;
}

export function checkDomAssets(directory, repair = false) {
  const metadataPath = path.join(directory, "metadata.json");
  const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
  const results = inspectDomAssets(directory, metadata);
  if (repair) {
    for (const result of results) {
      metadata.fileMetadata[result.platform].assets.push(...result.missing.map((relative) => ({
        path: relative,
        ext: path.extname(relative).slice(1),
      })));
    }
    writeFileSync(metadataPath, JSON.stringify(metadata));
    return inspectDomAssets(directory, metadata);
  }
  return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const repair = args.includes("--repair-metadata");
  const directory = path.resolve(args.find((arg) => !arg.startsWith("--")) ?? "dist");
  try {
    const results = checkDomAssets(directory, repair);
    for (const result of results) {
      console.log(`${result.platform}: ${result.htmlCount} DOM pages, ${result.requiredCount} required files, ${result.missing.length} omitted from update metadata`);
      for (const missing of result.missing) console.error(`  Missing: ${missing}`);
    }
    if (results.some((result) => result.missing.length)) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
