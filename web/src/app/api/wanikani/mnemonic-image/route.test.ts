import { afterEach, describe, expect, it, vi } from "vitest";
import { extractMnemonicImageUrl, GET } from "./route";

describe("WaniKani mnemonic image proxy", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("extracts the current web component and legacy image markup", () => {
    expect(extractMnemonicImageUrl('<wk-mnemonic-image aria-label="Ground" src="https://files.wanikani.com/current">')).toBe("https://files.wanikani.com/current");
    expect(extractMnemonicImageUrl('<img src="@https://files.wanikani.com/legacy" class="other subject-mnemonic-image__image">')).toBe("https://files.wanikani.com/legacy");
  });

  it("returns a bounded mnemonic image with safe response headers", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('<wk-mnemonic-image src="https://files.wanikani.com/ground">', { status: 200, headers: { "Content-Type": "text/html" } }))
      .mockResolvedValueOnce(new Response('<svg xmlns="http://www.w3.org/2000/svg"/>', { status: 200, headers: { "Content-Type": "image/svg+xml" } }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new Request(`http://localhost/api/wanikani/mnemonic-image?documentUrl=${encodeURIComponent("https://www.wanikani.com/radicals/ground")}`));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/svg+xml");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.text()).toContain("<svg");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects untrusted subject and image origins", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const untrustedSubject = await GET(new Request(`http://localhost/api/wanikani/mnemonic-image?documentUrl=${encodeURIComponent("https://example.com/radicals/ground")}`));
    expect(untrustedSubject.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValueOnce(new Response('<wk-mnemonic-image src="https://example.com/image.svg">', { status: 200 }));
    const untrustedImage = await GET(new Request(`http://localhost/api/wanikani/mnemonic-image?documentUrl=${encodeURIComponent("https://www.wanikani.com/radicals/ground")}`));
    expect(untrustedImage.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
