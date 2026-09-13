import { strToU8, zipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";

vi.mock("../manga-pdf", () => ({ getMangaPdfPageCount: vi.fn().mockResolvedValue(12), MAX_MANGA_PDF_BYTES: 300 * 1024 * 1024 }));

import { extractArchivePages, extractEpubMangaPages, mangaTitleFromFileName, naturalMangaPageCompare, prepareMangaImport } from "../manga-import";

function archiveFile(entries: Record<string, Uint8Array>) {
  return new File([zipSync(entries)], "よつばと！ 01.cbz", { type: "application/vnd.comicbook+zip" });
}

function epubFile(entries: Record<string, Uint8Array>, type = "application/epub+zip") {
  return new File([zipSync(entries)], "縁の漫画.epub", { type });
}

function imageEpub(extraEntries: Record<string, Uint8Array> = {}, type = "application/epub+zip") {
  return epubFile({
    "META-INF/container.xml": strToU8(`<?xml version="1.0"?>
      <container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
        <rootfiles><rootfile media-type="application/oebps-package+xml" full-path="OPS/package.opf" /></rootfiles>
      </container>`),
    "OPS/package.opf": strToU8(`<?xml version="1.0"?>
      <package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" version="3.0">
        <metadata><dc:title>縁の漫画</dc:title></metadata>
        <manifest>
          <item media-type="application/xhtml+xml" href="pages/page-10.xhtml" id="page-ten" />
          <item href="images/page%2010.png" media-type="image/png" id="image-ten" />
          <item id="page-two" media-type="image/svg+xml" href="pages/page-2.svg" />
          <item id="image-two" href="images/page-2.jpg" media-type="image/jpeg" />
          <item id="page-one" href="images/page-1.webp" media-type="image/webp" />
        </manifest>
        <spine page-progression-direction="rtl">
          <itemref idref="page-ten" properties="page-spread-right" />
          <itemref idref="page-two" properties="rendition:page-spread-left" />
          <itemref idref="page-one" properties="rendition:page-spread-center" />
        </spine>
      </package>`),
    "OPS/pages/page-10.xhtml": strToU8(`<html xmlns="http://www.w3.org/1999/xhtml"><body><img alt="" src="../images/page%2010.png" /></body></html>`),
    "OPS/pages/page-2.svg": strToU8(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image xlink:href="../images/page-2.jpg" /></svg>`),
    "OPS/images/page 10.png": pngBytes(),
    "OPS/images/page-2.jpg": jpegBytes(),
    "OPS/images/page-1.webp": webpBytes(),
    ...extraEntries,
  }, type);
}

function pngBytes(width = 2, height = 3) {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set(new TextEncoder().encode("IHDR"), 12);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

function jpegBytes(width = 2, height = 3) {
  const bytes = new Uint8Array(21);
  bytes.set([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08], 0);
  new DataView(bytes.buffer).setUint16(7, height);
  new DataView(bytes.buffer).setUint16(9, width);
  return bytes;
}

function webpBytes(width = 2, height = 3) {
  const bytes = new Uint8Array(30);
  bytes.set(new TextEncoder().encode("RIFF"), 0);
  bytes.set(new TextEncoder().encode("WEBPVP8X"), 8);
  bytes[24] = width - 1;
  bytes[27] = height - 1;
  return bytes;
}

function utf16LittleEndian(value: string) {
  const bytes = new Uint8Array(2 + value.length * 2);
  bytes.set([0xff, 0xfe]);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < value.length; index += 1) view.setUint16(2 + index * 2, value.charCodeAt(index), true);
  return bytes;
}

describe("manga import", () => {
  it("sorts nested CBZ image pages naturally and ignores archive metadata", async () => {
    const file = archiveFile({
      "chapter/page-10.jpg": jpegBytes(),
      "chapter/page-2.png": pngBytes(),
      "__MACOSX/._page-1.jpg": new Uint8Array([1]),
      "notes.txt": new Uint8Array([3]),
      "chapter/page-1.webp": webpBytes(),
    });

    const pages = await extractArchivePages(file);

    expect(pages.map((page) => page.name)).toEqual(["page-0001.webp", "page-0002.png", "page-0003.jpg"]);
    expect(pages.map((page) => page.type)).toEqual(["image/webp", "image/png", "image/jpeg"]);
  });

  it("rejects archives without readable page images", async () => {
    await expect(extractArchivePages(archiveFile({ "readme.txt": new Uint8Array([1]) }))).rejects.toThrow("No readable image pages");
  });

  it("prepares CBZ, PDF, and naturally ordered image-set records", async () => {
    const cbz = await prepareMangaImport([archiveFile({ "2.jpg": jpegBytes(), "1.jpg": jpegBytes() })]);
    expect(cbz).toMatchObject({ title: "よつばと！ 01", sourceType: "cbz", pageCount: 2 });
    expect(cbz.metadata).toEqual({ readingDirection: "rtl", pagePlacements: [null, null] });

    const pdf = await prepareMangaImport([new File(["pdf"], "book.pdf", { type: "application/pdf" })]);
    expect(pdf).toMatchObject({ title: "book", sourceType: "pdf", pageCount: 12 });
    expect(pdf.metadata).toEqual({ readingDirection: "rtl", pagePlacements: Array.from({ length: 12 }, () => null) });

    const images = await prepareMangaImport([
      new File([jpegBytes()], "manga-10.jpg", { type: "image/jpeg" }),
      new File([jpegBytes()], "manga-2.jpg", { type: "image/jpeg" }),
    ]);
    expect(images.assets.map((page) => page.name)).toEqual(["manga-2.jpg", "manga-10.jpg"]);
    expect(images).toMatchObject({ title: "manga", sourceType: "images", pageCount: 2 });
    expect(images.metadata).toEqual({ readingDirection: "rtl", pagePlacements: [null, null] });
  });

  it("imports image EPUB pages in spine order through XHTML, SVG, and direct-image entries", async () => {
    const extracted = await extractEpubMangaPages(imageEpub());

    expect(extracted.title).toBe("縁の漫画");
    expect(extracted.pages.map((page) => page.name)).toEqual(["page-0001.png", "page-0002.jpg", "page-0003.webp"]);
    expect(extracted.pages.map((page) => page.type)).toEqual(["image/png", "image/jpeg", "image/webp"]);
    expect(extracted.metadata).toEqual({
      readingDirection: "rtl",
      pagePlacements: ["right", "left", "center"],
    });

    const prepared = await prepareMangaImport([imageEpub({}, "application/zip")]);
    expect(prepared).toMatchObject({ title: "縁の漫画", fileName: "縁の漫画.epub", sourceType: "epub", pageCount: 3 });
    expect(prepared.metadata).toEqual(extracted.metadata);
  });

  it("reads valid UTF-16 EPUB container and package documents", async () => {
    const file = imageEpub({
      "META-INF/container.xml": utf16LittleEndian(`<?xml version="1.0" encoding="UTF-16"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OPS/package.opf" /></rootfiles></container>`),
      "OPS/package.opf": utf16LittleEndian(`<?xml version="1.0" encoding="UTF-16"?><package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/"><metadata><dc:title>十六ビット漫画</dc:title></metadata><manifest><item id="page" href="images/page-1.webp" media-type="image/webp" /></manifest><spine page-progression-direction="ltr"><itemref idref="page" /></spine></package>`),
    });

    await expect(extractEpubMangaPages(file)).resolves.toMatchObject({
      title: "十六ビット漫画",
      pages: [{ type: "image/webp" }],
      metadata: { readingDirection: "ltr", pagePlacements: [null] },
    });
  });

  it("counts repeated spine images toward the expanded storage limit", async () => {
    const repeatedImage = new Uint8Array(600 * 1024);
    repeatedImage.set(pngBytes());
    const repeatedSpine = Array.from({ length: 900 }, () => `<itemref idref="page" />`).join("");
    const file = epubFile({
      "META-INF/container.xml": strToU8(`<container><rootfiles><rootfile full-path="book.opf" /></rootfiles></container>`),
      "book.opf": strToU8(`<package><metadata><title>Repeated</title></metadata><manifest><item id="page" href="page.png" media-type="image/png" /></manifest><spine>${repeatedSpine}</spine></package>`),
      "page.png": repeatedImage,
    });

    await expect(extractEpubMangaPages(file)).rejects.toThrow("expanded EPUB is too large");
  });

  it("routes text EPUBs to Books instead of importing only incidental images", async () => {
    const file = epubFile({
      "META-INF/container.xml": strToU8(`<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="book.opf" /></rootfiles></container>`),
      "book.opf": strToU8(`<package xmlns="http://www.idpf.org/2007/opf"><metadata><title>Novel</title></metadata><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml" /></manifest><spine><itemref idref="chapter" /></spine></package>`),
      "chapter.xhtml": strToU8(`<html xmlns="http://www.w3.org/1999/xhtml"><body><p>これは画像ページではなく、文章として読むための日本語の章です。</p></body></html>`),
    });

    await expect(prepareMangaImport([file])).rejects.toThrow("Import it in Books instead");
  });

  it("allows obfuscated fonts but rejects encrypted page images", async () => {
    const fontOnly = imageEpub({
      "OPS/fonts/book.otf": new Uint8Array([1, 2, 3]),
      "META-INF/encryption.xml": strToU8(`<encryption xmlns:enc="http://www.w3.org/2001/04/xmlenc#"><enc:EncryptedData><enc:CipherData><enc:CipherReference URI="OPS/fonts/book.otf" /></enc:CipherData></enc:EncryptedData></encryption>`),
    });
    await expect(extractEpubMangaPages(fontOnly)).resolves.toMatchObject({ title: "縁の漫画" });

    const file = imageEpub({
      "META-INF/encryption.xml": strToU8(`<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:enc="http://www.w3.org/2001/04/xmlenc#"><enc:EncryptedData><enc:CipherData><enc:CipherReference URI="OPS/images/page%2010.png" /></enc:CipherData></enc:EncryptedData></encryption>`),
    });

    await expect(extractEpubMangaPages(file)).rejects.toThrow("DRM or encryption");
  });

  it("rejects composed multi-image EPUB pages rather than changing their layout", async () => {
    const file = epubFile({
      "META-INF/container.xml": strToU8(`<container><rootfiles><rootfile full-path="book.opf" /></rootfiles></container>`),
      "book.opf": strToU8(`<package><metadata><title>Composite</title></metadata><manifest><item id="page" href="page.xhtml" media-type="application/xhtml+xml" /><item id="a" href="a.png" media-type="image/png" /><item id="b" href="b.png" media-type="image/png" /></manifest><spine><itemref idref="page" /></spine></package>`),
      "page.xhtml": strToU8(`<html><body><img src="a.png" /><img src="b.png" /></body></html>`),
      "a.png": pngBytes(),
      "b.png": pngBytes(),
    });

    await expect(extractEpubMangaPages(file)).rejects.toThrow("composes a page from multiple images");
  });

  it("rejects mixed unsupported file selections", async () => {
    await expect(prepareMangaImport([
      new File(["page"], "1.jpg", { type: "image/jpeg" }),
      new File(["notes"], "notes.txt", { type: "text/plain" }),
    ])).rejects.toThrow("Select one EPUB/CBZ/ZIP/PDF file");
  });

  it("rejects unsupported and dangerously oversized image dimensions", async () => {
    await expect(prepareMangaImport([new File(["<svg/>"], "page.svg", { type: "image/svg+xml" })])).rejects.toThrow("Select one EPUB/CBZ/ZIP/PDF file");
    await expect(prepareMangaImport([new File([pngBytes(12_000, 12_000)], "huge.png", { type: "image/png" })])).rejects.toThrow("dimensions that are too large");
  });

  it("normalizes titles and compares page names numerically", () => {
    expect(mangaTitleFromFileName("folder/My_Manga-v2.cbz")).toBe("My Manga v2");
    expect(["10.jpg", "2.jpg", "1.jpg"].sort(naturalMangaPageCompare)).toEqual(["1.jpg", "2.jpg", "10.jpg"]);
  });
});
