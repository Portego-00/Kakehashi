import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { extractBookEpub } from "../epub-import";

function japaneseBookEpub() {
  const entries = {
    mimetype: strToU8("application/epub+zip"),
    "META-INF/container.xml": strToU8(`<?xml version="1.0"?>
      <container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
        <rootfiles><rootfile media-type="application/oebps-package+xml" full-path="OPS/package.opf" /></rootfiles>
      </container>`),
    "OPS/package.opf": strToU8(`<?xml version="1.0"?>
      <package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" version="3.0">
        <metadata><dc:title>縦書きの本</dc:title><dc:language>ja</dc:language></metadata>
        <manifest>
          <item id="chapter-one" href="text/chapter-1.xhtml" media-type="application/xhtml+xml" />
          <item id="scene" href="images/scene.jpg" media-type="image/jpeg" />
        </manifest>
        <spine page-progression-direction="rtl"><itemref idref="chapter-one" /></spine>
      </package>`),
    "OPS/text/chapter-1.xhtml": strToU8(`<?xml version="1.0"?>
      <html xmlns="http://www.w3.org/1999/xhtml" xml:lang="ja">
        <head><style>html { writing-mode: vertical-rl; }</style></head>
        <body><p>昔々、あるところに。</p><img src="../images/scene.jpg" alt="山の挿絵" /><p>物語がありました。</p></body>
      </html>`),
    "OPS/images/scene.jpg": new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
  };

  const bytes = zipSync(entries, { level: 0 });
  return new File([bytes], "vertical.epub", { type: "application/epub+zip" });
}

describe("EPUB book rendering regression", () => {
  it("retains vertical writing metadata and an in-flow image for the book reader", async () => {
    const extracted = await extractBookEpub(japaneseBookEpub());
    expect(extracted.title).toBe("縦書きの本");
    expect(extracted.text).toContain("昔々、あるところに。");
    expect(extracted.text).toContain("物語がありました。");
    const chapter = extracted.chapters[0] as unknown as {
      writingMode?: string;
      blocks?: Array<{ type: string; text?: string; path?: string; alt?: string }>;
    };

    expect.soft(chapter?.writingMode).toBe("vertical-rl");
    expect.soft(chapter?.blocks?.map((block) => block.type)).toEqual(["text", "image", "text"]);
    expect.soft(chapter?.blocks?.[1]).toMatchObject({
      type: "image",
      path: "OPS/images/scene.jpg",
      alt: "山の挿絵",
    });
  });
});
