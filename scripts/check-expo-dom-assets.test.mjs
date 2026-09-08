import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { checkDomAssets } from "./check-expo-dom-assets.mjs";

function fixture(scriptContents) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "expo-dom-assets-test-"));
  mkdirSync(path.join(directory, "www.bundle"));
  const asset = (contents, ext) => {
    const name = `${createHash("md5").update(contents).digest("hex")}.${ext}`;
    const relative = `www.bundle/${name}`;
    writeFileSync(path.join(directory, relative), contents);
    return { path: relative, ext };
  };
  const shared = asset("export const loaded = true;", "js");
  const script = asset(scriptContents ?? `import './${path.basename(shared.path)}';`, "js");
  const css = asset("body { color: black; }", "css");
  const editor = asset(`<link href="./${path.basename(css.path)}"><script src="./${path.basename(script.path)}"></script>`, "html");
  const other = asset("<p>Another DOM component</p>", "html");
  const assets = [shared, script, css, editor, other];
  const bundle = "entry.hbc";
  writeFileSync(path.join(directory, bundle), Buffer.from(`\0${path.basename(editor.path)}\0${path.basename(other.path)}\0`));
  const metadata = { version: 0, bundler: "metro", fileMetadata: {
    android: { bundle, assets },
    ios: { bundle, assets: [other] },
  } };
  writeFileSync(path.join(directory, "metadata.json"), JSON.stringify(metadata));
  return { directory, bundle, editor, metadata };
}

test("detects and repairs lost per-platform DOM metadata while retaining the exact native bundle", () => {
  const f = fixture();
  try {
    const nativeBefore = readFileSync(path.join(f.directory, f.bundle));
    const before = checkDomAssets(f.directory);
    assert.equal(before[0].missing.length, 0);
    assert.equal(before[1].missing.length, 4);
    assert.ok(before[1].missing.includes(f.editor.path));
    assert.ok(checkDomAssets(f.directory, true).every((result) => result.missing.length === 0));
    assert.deepEqual(readFileSync(path.join(f.directory, f.bundle)), nativeBefore);
    const after = JSON.parse(readFileSync(path.join(f.directory, "metadata.json"), "utf8"));
    assert.deepEqual(after.fileMetadata.android, f.metadata.fileMetadata.android);
    const fixedMetadata = readFileSync(path.join(f.directory, "metadata.json"));
    checkDomAssets(f.directory, true);
    assert.deepEqual(readFileSync(path.join(f.directory, "metadata.json")), fixedMetadata);
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test("refuses to repair metadata when the actual editor page is absent", () => {
  const f = fixture();
  try {
    rmSync(path.join(f.directory, f.editor.path));
    assert.throws(() => checkDomAssets(f.directory, true), /required DOM file is missing/);
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test("rejects assets whose contents do not match their exported names", () => {
  const f = fixture();
  try {
    writeFileSync(path.join(f.directory, f.editor.path), "changed contents");
    assert.throws(() => checkDomAssets(f.directory, true), /content hash does not match/);
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test("rejects lazy imports that still use Metro paths after the MD5 export", () => {
  const f = fixture('import("./_expo/static/js/web/emoji-123456.js");');
  try {
    const metadataBefore = readFileSync(path.join(f.directory, "metadata.json"));
    assert.throws(() => checkDomAssets(f.directory, true), /unresolved chunk path/);
    assert.deepEqual(readFileSync(path.join(f.directory, "metadata.json")), metadataBefore);
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});
