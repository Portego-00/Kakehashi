import { describe, expect, it } from "vitest";
import { normalizeNewsImageUrl, proxyNewsImageUrl } from "../news-images";

describe("NHK news image URLs", () => {
  it("normalizes absolute, protocol-relative, and article-relative image sources", () => {
    expect(normalizeNewsImageUrl("https://nhkeasier.com/media/jpg/a.jpg")).toBe("https://nhkeasier.com/media/jpg/a.jpg");
    expect(normalizeNewsImageUrl("//nhkeasier.com/media/jpg/a.jpg")).toBe("https://nhkeasier.com/media/jpg/a.jpg");
    expect(normalizeNewsImageUrl("../media/jpg/a.jpg", "https://nhkeasier.com/story/9876/")).toBe("https://nhkeasier.com/story/media/jpg/a.jpg");
    expect(normalizeNewsImageUrl("/media/jpg/a.jpg?x=1&amp;y=2")).toBe("https://nhkeasier.com/media/jpg/a.jpg?x=1&y=2");
  });

  it("unwraps a previously proxied browser-cache URL without double proxying", () => {
    const source = "https://nhkeasier.com/media/jpg/a.jpg";
    const proxied = proxyNewsImageUrl(source);
    expect(proxied).toBe(`/news/image?url=${encodeURIComponent(source)}`);
    expect(proxyNewsImageUrl(proxied)).toBe(proxied);
  });

  it("accepts the constrained Standard NHK image hosts", () => {
    expect(normalizeNewsImageUrl("https://img.web.nhk/news/a.jpg")).toBe("https://img.web.nhk/news/a.jpg");
    expect(normalizeNewsImageUrl("https://imgu.web.nhk/news/a.jpg")).toBe("https://imgu.web.nhk/news/a.jpg");
    expect(normalizeNewsImageUrl("https://img.embed.nhk/news/a.jpg")).toBe("https://img.embed.nhk/news/a.jpg");
  });

  it("rejects insecure, credentialed, and untrusted image origins", () => {
    expect(normalizeNewsImageUrl("http://nhkeasier.com/media/a.jpg")).toBeUndefined();
    expect(normalizeNewsImageUrl("https://user:pass@nhkeasier.com/media/a.jpg")).toBeUndefined();
    expect(normalizeNewsImageUrl("https://example.com/a.jpg")).toBeUndefined();
    expect(normalizeNewsImageUrl("https://imgu.web.nhk.attacker.example/a.jpg")).toBeUndefined();
    expect(normalizeNewsImageUrl("data:image/png;base64,abc")).toBeUndefined();
  });
});
