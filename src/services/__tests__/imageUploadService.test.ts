import {
  imageUploadService,
  ISSUE_MEDIA_BUCKET_NOT_FOUND_ERROR,
  ISSUE_MEDIA_MAX_BYTES,
  ISSUE_MEDIA_TOO_LARGE_ERROR,
} from "../imageUploadService";

const mockFiles = new Map<string, { bytes: Uint8Array; size: number | null }>();
const mockUpload = jest.fn();
const mockGetPublicUrl = jest.fn();
const mockStorageFrom = jest.fn((_bucket: string) => ({
  upload: mockUpload,
  getPublicUrl: mockGetPublicUrl,
}));
const mockReadFile = jest.fn(async (uri: string) => {
  const file = mockFiles.get(uri);
  if (!file) throw new Error("Selected file is no longer available");
  return file.bytes.slice().buffer;
});

jest.mock("../../lib/supabase", () => ({
  supabase: { storage: { from: (bucket: string) => mockStorageFrom(bucket) } },
}));
jest.mock("expo-file-system", () => ({
  File: class {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    get size() {
      return mockFiles.get(this.uri)?.size ?? null;
    }
    arrayBuffer() {
      return mockReadFile(this.uri);
    }
  },
  getInfoAsync: jest.fn(async () => {
    throw new Error("getInfoAsync imported from expo-file-system is deprecated");
  }),
}));

const ANDROID_PICKER_URI =
  "file:///data/user/0/com.portego.kakehashi/cache/ImagePicker/screenshot.png";
const IMAGE_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 255, 128, 42]);
const PUBLIC_URL = "https://media.example.invalid/issues/image/screenshot.png";
const mockFetch = global.fetch as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockFiles.clear();
  mockFiles.set(ANDROID_PICKER_URI, { bytes: IMAGE_BYTES, size: IMAGE_BYTES.byteLength });
  mockFetch.mockRejectedValue(new TypeError("Network request failed"));
  mockUpload.mockResolvedValue({ data: { path: "issues/image/screenshot.png" }, error: null });
  mockGetPublicUrl.mockReturnValue({ data: { publicUrl: PUBLIC_URL } });
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

it("uploads the exact Android picker bytes when HTTP fetch cannot read its local URI", async () => {
  await expect(imageUploadService.uploadMedia({
    uri: ANDROID_PICKER_URI,
    fileName: "screenshot.png",
    fileSize: IMAGE_BYTES.byteLength,
    mimeType: "image/png",
    type: "image",
  })).resolves.toEqual({
    url: PUBLIC_URL,
    mediaType: "image",
    sizeBytes: IMAGE_BYTES.byteLength,
  });

  expect(mockUpload).toHaveBeenCalledWith(
    expect.stringMatching(/^issues\/image\/.+\.png$/),
    IMAGE_BYTES.buffer,
    { cacheControl: "3600", contentType: "image/png", upsert: false },
  );
  expect(mockFetch).not.toHaveBeenCalled();
});

it("reads the native file size when the picker omits fileSize", async () => {
  await expect(imageUploadService.getMediaSizeBytes({ uri: ANDROID_PICKER_URI }))
    .resolves.toBe(IMAGE_BYTES.byteLength);
});

it.each([
  ["iOS", "file:///var/mobile/Containers/Data/Application/fixture/Library/Caches/picker.png"],
  ["Android document provider", "content://com.android.providers.media.documents/document/image%3A42"],
])("uploads %s picker bytes through the native file API", async (_platform, uri) => {
  mockFiles.set(uri, { bytes: IMAGE_BYTES, size: IMAGE_BYTES.byteLength });

  await expect(imageUploadService.uploadMedia({ uri, mimeType: "image/png" }))
    .resolves.toMatchObject({ url: PUBLIC_URL, sizeBytes: IMAGE_BYTES.byteLength });

  expect(mockReadFile).toHaveBeenCalledWith(uri);
  expect(new Uint8Array(mockUpload.mock.calls[0][1])).toEqual(IMAGE_BYTES);
  expect(mockFetch).not.toHaveBeenCalled();
});

it.each(["blob:https://app.example.invalid/selected-image", "data:image/png;base64,fixture"])(
  "keeps browser picker URLs readable: %s",
  async (uri) => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      arrayBuffer: async () => IMAGE_BYTES.buffer,
    });

    await expect(imageUploadService.uploadMedia({ uri, mimeType: "image/png" }))
      .resolves.toEqual({ url: PUBLIC_URL, sizeBytes: IMAGE_BYTES.byteLength, mediaType: "image" });

    expect(mockReadFile).not.toHaveBeenCalled();
    expect(new Uint8Array(mockUpload.mock.calls[0][1])).toEqual(IMAGE_BYTES);
  },
);

it("rejects a failed media response instead of uploading its error page", async () => {
  const arrayBuffer = jest.fn(async () => new Uint8Array([60, 104, 49, 62]).buffer);
  mockFetch.mockResolvedValueOnce({ ok: false, status: 404, arrayBuffer });

  await expect(imageUploadService.uploadMedia({ uri: "https://media.example.invalid/missing.png" }))
    .rejects.toThrow("HTTP 404");

  expect(arrayBuffer).not.toHaveBeenCalled();
  expect(mockUpload).not.toHaveBeenCalled();
});

it("rejects picker-reported oversized media before reading or uploading it", async () => {
  await expect(imageUploadService.uploadMedia({
    uri: ANDROID_PICKER_URI,
    fileSize: ISSUE_MEDIA_MAX_BYTES + 1,
  })).rejects.toMatchObject({ code: ISSUE_MEDIA_TOO_LARGE_ERROR });

  expect(mockReadFile).not.toHaveBeenCalled();
  expect(mockFetch).not.toHaveBeenCalled();
  expect(mockUpload).not.toHaveBeenCalled();
});

it("rejects oversized native files even when picker size is missing", async () => {
  mockFiles.set(ANDROID_PICKER_URI, { bytes: IMAGE_BYTES, size: ISSUE_MEDIA_MAX_BYTES + 1 });

  await expect(imageUploadService.uploadMedia({ uri: ANDROID_PICKER_URI }))
    .rejects.toMatchObject({ code: ISSUE_MEDIA_TOO_LARGE_ERROR });

  expect(mockReadFile).not.toHaveBeenCalled();
  expect(mockUpload).not.toHaveBeenCalled();
});

it("checks actual byte length when picker metadata underreports the size", async () => {
  const bytes = new Uint8Array(ISSUE_MEDIA_MAX_BYTES + 1);
  mockFiles.set(ANDROID_PICKER_URI, { bytes, size: bytes.byteLength });

  await expect(imageUploadService.uploadMedia({ uri: ANDROID_PICKER_URI, fileSize: 1 }))
    .rejects.toMatchObject({ code: ISSUE_MEDIA_TOO_LARGE_ERROR });

  expect(mockReadFile).toHaveBeenCalledWith(ANDROID_PICKER_URI);
  expect(mockUpload).not.toHaveBeenCalled();
});

it("preserves native permission errors without attempting an HTTP or empty upload", async () => {
  const error = new Error("Selected file permission expired");
  mockReadFile.mockRejectedValueOnce(error);

  await expect(imageUploadService.uploadMedia({ uri: ANDROID_PICKER_URI, fileSize: 12 }))
    .rejects.toBe(error);

  expect(mockFetch).not.toHaveBeenCalled();
  expect(mockUpload).not.toHaveBeenCalled();
});

it("uploads a selected video with its original bytes and video metadata", async () => {
  const uri = "file:///data/user/0/com.portego.kakehashi/cache/ImagePicker/clip.mp4";
  const bytes = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 109, 112, 52, 50]);
  mockFiles.set(uri, { bytes, size: bytes.byteLength });

  await expect(imageUploadService.uploadMedia({ uri, type: "video", mimeType: "video/mp4" }))
    .resolves.toEqual({ url: PUBLIC_URL, mediaType: "video", sizeBytes: bytes.byteLength });

  expect(mockUpload).toHaveBeenCalledWith(
    expect.stringMatching(/^issues\/video\/.+\.mp4$/),
    bytes.buffer,
    { cacheControl: "3600", contentType: "video/mp4", upsert: false },
  );
});

it("reuses the exact bytes when falling back from an absent storage bucket", async () => {
  mockUpload.mockResolvedValueOnce({ data: null, error: { message: "Bucket not found", statusCode: "404" } });

  await expect(imageUploadService.uploadMedia({ uri: ANDROID_PICKER_URI, mimeType: "image/png" }))
    .resolves.toMatchObject({ url: PUBLIC_URL });

  expect(mockUpload).toHaveBeenCalledTimes(2);
  expect(mockReadFile).toHaveBeenCalledTimes(1);
  expect(mockUpload.mock.calls[1][0]).toBe(mockUpload.mock.calls[0][0]);
  expect(mockUpload.mock.calls[1][1]).toBe(mockUpload.mock.calls[0][1]);
});

it("reports missing storage configuration after all candidate buckets reject the upload", async () => {
  mockUpload.mockResolvedValue({ data: null, error: { message: "Bucket not found", statusCode: "404" } });

  await expect(imageUploadService.uploadMedia({ uri: ANDROID_PICKER_URI }))
    .rejects.toMatchObject({ code: ISSUE_MEDIA_BUCKET_NOT_FOUND_ERROR });

  expect(mockReadFile).toHaveBeenCalledTimes(1);
  expect(mockGetPublicUrl).not.toHaveBeenCalled();
});

it("preserves storage permission failures instead of trying other buckets", async () => {
  const error = { message: "new row violates row-level security policy", statusCode: "403" };
  mockUpload.mockResolvedValueOnce({ data: null, error });

  await expect(imageUploadService.uploadMedia({ uri: ANDROID_PICKER_URI }))
    .rejects.toEqual(error);

  expect(mockUpload).toHaveBeenCalledTimes(1);
  expect(mockGetPublicUrl).not.toHaveBeenCalled();
});
