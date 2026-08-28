import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { extractBookEpub } from "./epub-import";

function epubFile(entries: Record<string, Uint8Array>, name = "物語.epub") {
  return new File([zipSync({ mimetype: strToU8("application/epub+zip"), ...entries }, { level: 0 })], name, {
    type: "application/epub+zip",
  });
}

function patchDeclaredExpandedSizes(archive: Uint8Array, sizes: Record<string, number>) {
  const patched = archive.slice();
  const view = new DataView(patched.buffer, patched.byteOffset, patched.byteLength);
  const decoder = new TextDecoder();
  let offset = 0;

  while (offset + 4 <= patched.byteLength) {
    const signature = view.getUint32(offset, true);
    if (signature === 0x04034b50) {
      const compressedSize = view.getUint32(offset + 18, true);
      const nameLength = view.getUint16(offset + 26, true);
      const extraLength = view.getUint16(offset + 28, true);
      const name = decoder.decode(patched.subarray(offset + 30, offset + 30 + nameLength));
      if (sizes[name] !== undefined) view.setUint32(offset + 22, sizes[name], true);
      offset += 30 + nameLength + extraLength + compressedSize;
      continue;
    }
    if (signature === 0x02014b50) {
      const nameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const name = decoder.decode(patched.subarray(offset + 46, offset + 46 + nameLength));
      if (sizes[name] !== undefined) view.setUint32(offset + 24, sizes[name], true);
      offset += 46 + nameLength + extraLength + commentLength;
      continue;
    }
    if (signature === 0x06054b50) break;
    throw new Error("Unexpected ZIP record while preparing the test fixture.");
  }

  return patched;
}

function patchLocalDeclaredExpandedSize(archive: Uint8Array, target: string, size: number) {
  const patched = archive.slice();
  const view = new DataView(patched.buffer, patched.byteOffset, patched.byteLength);
  const decoder = new TextDecoder();
  let offset = 0;

  while (offset + 30 <= patched.byteLength && view.getUint32(offset, true) === 0x04034b50) {
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const name = decoder.decode(patched.subarray(offset + 30, offset + 30 + nameLength));
    if (name === target) {
      view.setUint32(offset + 22, size, true);
      return patched;
    }
    offset += 30 + nameLength + extraLength + compressedSize;
  }

  throw new Error(`ZIP fixture entry not found: ${target}`);
}

function container(packagePath = "OPS/package.opf") {
  return strToU8(`<?xml version="1.0"?>
    <container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
      <rootfiles><rootfile media-type="application/oebps-package+xml" full-path="${packagePath}" /></rootfiles>
    </container>`);
}

describe("book EPUB import", () => {
  it("keeps spine order, Japanese layout metadata, in-flow images, and an EPUB 3 cover", async () => {
    const scene = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const cover = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const file = epubFile({
      "META-INF/container.xml": container(),
      "OPS/package.opf": strToU8(`<?xml version="1.0"?>
        <package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" version="3.0">
          <metadata><dc:title>縦書きの本</dc:title><dc:language>ja</dc:language></metadata>
          <manifest>
            <item id="chapter-two" href="text/chapter-2.xhtml" media-type="application/xhtml+xml" />
            <item id="chapter-one" href="text/chapter-1.xhtml" media-type="application/xhtml+xml" />
            <item id="styles" href="styles/book.css" media-type="text/css" />
            <item id="scene" href="images/scene.jpg" media-type="image/jpeg" />
            <item id="cover" href="images/cover.png" media-type="image/png" properties="cover-image" />
          </manifest>
          <spine page-progression-direction="rtl">
            <itemref idref="chapter-one" />
            <itemref idref="chapter-two" />
          </spine>
        </package>`),
      "OPS/styles/book.css": strToU8("html, body { writing-mode: vertical-rl; }"),
      "OPS/text/chapter-1.xhtml": strToU8(`<?xml version="1.0"?><!DOCTYPE html>
        <html xmlns="http://www.w3.org/1999/xhtml" xml:lang="ja">
          <head><title>第一章</title><link rel="stylesheet" href="../styles/book.css" /></head>
          <body><p>昔々、あるところに。</p><img src="../images/scene.jpg" alt="山の挿絵" /><p>物語がありました。</p></body>
        </html>`),
      "OPS/text/chapter-2.xhtml": strToU8(`<?xml version="1.0"?><!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
        <html xmlns="http://www.w3.org/1999/xhtml"><head><title>第二章</title></head><body><p>おしまい。</p></body></html>`),
      "OPS/images/scene.jpg": scene,
      "OPS/images/cover.png": cover,
    });

    const extracted = await extractBookEpub(file);

    expect(extracted).toMatchObject({
      title: "縦書きの本",
      language: "ja",
      pageProgressionDirection: "rtl",
      coverPath: "OPS/images/cover.png",
    });
    expect(extracted.chapters.map((chapter) => chapter.path)).toEqual([
      "OPS/text/chapter-1.xhtml",
      "OPS/text/chapter-2.xhtml",
    ]);
    expect(extracted.chapters[0]).toMatchObject({ title: "第一章", writingMode: "vertical-rl" });
    expect(extracted.chapters[0].blocks).toEqual([
      { type: "text", text: "昔々、あるところに。" },
      { type: "image", path: "OPS/images/scene.jpg", alt: "山の挿絵", mediaType: "image/jpeg" },
      { type: "text", text: "物語がありました。" },
    ]);
    expect(extracted.text).toBe("昔々、あるところに。\n\n物語がありました。\n\nおしまい。");
    expect(extracted).not.toHaveProperty("imageBlobs");
    expect(extracted.cover).toMatchObject({ size: cover.byteLength, type: "image/png" });
  });

  it("finds an EPUB 2 cover through OPF metadata", async () => {
    const file = epubFile({
      "META-INF/container.xml": container(),
      "OPS/package.opf": strToU8(`<package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" version="2.0">
        <metadata><dc:title>古い本</dc:title><meta name="cover" content="jacket" /></metadata>
        <manifest>
          <item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml" />
          <item id="jacket" href="cover.xhtml" media-type="application/xhtml+xml" />
          <item id="jacket-image" href="images/jacket.webp" media-type="image/webp" />
        </manifest>
        <spine><itemref idref="chapter" /></spine>
      </package>`),
      "OPS/chapter.xhtml": strToU8(`<html xmlns="http://www.w3.org/1999/xhtml"><body><p>本文</p></body></html>`),
      "OPS/cover.xhtml": strToU8(`<html xmlns="http://www.w3.org/1999/xhtml"><body><img src="images/jacket.webp" alt="表紙" /></body></html>`),
      "OPS/images/jacket.webp": new Uint8Array([1, 2, 3]),
    });

    const extracted = await extractBookEpub(file);

    expect(extracted.coverPath).toBe("OPS/images/jacket.webp");
    expect(extracted.cover).toMatchObject({ size: 3, type: "image/webp" });
  });

  it("keeps safe SVG spine documents used by fixed-layout EPUBs", async () => {
    const file = epubFile({
      "META-INF/container.xml": container(),
      "OPS/package.opf": strToU8(`<package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" version="3.0">
        <metadata><dc:title>図版の本</dc:title><dc:language>ja</dc:language></metadata>
        <manifest>
          <item id="page" href="page.svg" media-type="image/svg+xml" properties="svg" />
          <item id="scene" href="images/scene.jpg" media-type="image/jpeg" />
        </manifest>
        <spine page-progression-direction="rtl"><itemref idref="page" properties="rendition:layout-pre-paginated" /></spine>
      </package>`),
      "OPS/page.svg": strToU8(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 800 1200" style="writing-mode: vertical-rl">
        <title>第一図</title><text x="700" y="100">山の景色</text><image xlink:href="images/scene.jpg" aria-label="山の挿絵" />
      </svg>`),
      "OPS/images/scene.jpg": new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
    });

    const extracted = await extractBookEpub(file);

    expect(extracted.chapters).toEqual([{
      blocks: [
        { type: "text", text: "山の景色" },
        { type: "image", path: "OPS/images/scene.jpg", alt: "山の挿絵", mediaType: "image/jpeg" },
      ],
      path: "OPS/page.svg",
      text: "山の景色",
      title: "第一図",
      writingMode: "vertical-rl",
    }]);
  });

  it("rejects suspicious compression in an unrendered archive resource", async () => {
    const oversizedFont = new Uint8Array(17 * 1024 * 1024);
    const archive = zipSync({
      mimetype: strToU8("application/epub+zip"),
      "META-INF/container.xml": container(),
      "OPS/package.opf": strToU8(`<package><metadata><title>Unsafe font</title></metadata><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml" /><item id="font" href="font.bin" media-type="application/octet-stream" /></manifest><spine><itemref idref="chapter" /></spine></package>`),
      "OPS/chapter.xhtml": strToU8(`<html xmlns="http://www.w3.org/1999/xhtml"><body><p>本文</p></body></html>`),
      "OPS/font.bin": oversizedFont,
    }, { level: 9 });
    const file = new File([archive], "compressed.epub", { type: "application/epub+zip" });

    await expect(extractBookEpub(file)).rejects.toThrow("suspicious compression ratio");
  });

  it("validates central-directory sizes when a local ZIP header is misleading", async () => {
    const oversizedFont = new Uint8Array(17 * 1024 * 1024);
    const archive = zipSync({
      mimetype: strToU8("application/epub+zip"),
      "META-INF/container.xml": container(),
      "OPS/package.opf": strToU8(`<package><metadata><title>Unsafe font</title></metadata><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml" /></manifest><spine><itemref idref="chapter" /></spine></package>`),
      "OPS/chapter.xhtml": strToU8(`<html xmlns="http://www.w3.org/1999/xhtml"><body><p>本文</p></body></html>`),
      "OPS/font.bin": oversizedFont,
    }, { level: 9 });
    const misleadingArchive = patchLocalDeclaredExpandedSize(archive, "OPS/font.bin", 0);
    const file = new File([misleadingArchive], "misleading.epub", { type: "application/epub+zip" });

    await expect(extractBookEpub(file)).rejects.toThrow("suspicious compression ratio");
  });

  it("rejects excessive archive-wide declared expansion before filtering resources", async () => {
    const unusedResources = Object.fromEntries(
      Array.from({ length: 5 }, (_, index) => [`OPS/unused-${index}.bin`, new Uint8Array(260 * 1024)]),
    );
    const archive = zipSync({
      mimetype: strToU8("application/epub+zip"),
      "META-INF/container.xml": container(),
      "OPS/package.opf": strToU8(`<package><metadata><title>Oversized archive</title></metadata><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml" /></manifest><spine><itemref idref="chapter" /></spine></package>`),
      "OPS/chapter.xhtml": strToU8(`<html xmlns="http://www.w3.org/1999/xhtml"><body><p>本文</p></body></html>`),
      ...unusedResources,
    }, { level: 0 });
    const declaredSizes = Object.fromEntries(
      Object.keys(unusedResources).map((path) => [path, 61 * 1024 * 1024]),
    );
    const file = new File([patchDeclaredExpandedSizes(archive, declaredSizes)], "expanded.epub", {
      type: "application/epub+zip",
    });

    await expect(extractBookEpub(file)).rejects.toThrow("expanded EPUB is too large to open safely");
  });

  it.each([
    {
      label: "entity declarations",
      packagePath: "OPS/package.opf",
      packageSource: `<!DOCTYPE package [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><package><metadata><title>&xxe;</title></metadata><manifest /><spine /></package>`,
      chapterSource: "",
      error: "entity declaration",
    },
    {
      label: "chapter scripts",
      packagePath: "OPS/package.opf",
      packageSource: `<package><metadata><title>Unsafe</title></metadata><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml" /></manifest><spine><itemref idref="chapter" /></spine></package>`,
      chapterSource: `<html xmlns="http://www.w3.org/1999/xhtml"><body><script>alert(1)</script><p>本文</p></body></html>`,
      error: "contains scripts",
    },
    {
      label: "paths escaping the archive",
      packagePath: "../../../package.opf",
      packageSource: "",
      chapterSource: "",
      error: "escapes the archive root",
    },
  ])("rejects $label", async ({ packagePath, packageSource, chapterSource, error }) => {
    const entries: Record<string, Uint8Array> = {
      "META-INF/container.xml": container(packagePath),
    };
    if (packageSource) entries["OPS/package.opf"] = strToU8(packageSource);
    if (chapterSource) entries["OPS/chapter.xhtml"] = strToU8(chapterSource);

    await expect(extractBookEpub(epubFile(entries))).rejects.toThrow(error);
  });

  it("never exposes external images as renderable chapter resources", async () => {
    const file = epubFile({
      "META-INF/container.xml": container(),
      "OPS/package.opf": strToU8(`<package><metadata><title>Linked</title></metadata><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml" /></manifest><spine><itemref idref="chapter" /></spine></package>`),
      "OPS/chapter.xhtml": strToU8(`<html xmlns="http://www.w3.org/1999/xhtml"><body><p>安全な本文</p><img src="https://example.invalid/tracker.png" alt="remote" /></body></html>`),
    });

    const extracted = await extractBookEpub(file);

    expect(extracted.chapters[0].blocks).toEqual([{ type: "text", text: "安全な本文" }]);
    expect(extracted).not.toHaveProperty("imageBlobs");
  });
});
