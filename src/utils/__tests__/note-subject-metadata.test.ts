import { getSubjectById } from "../cache";
import {
  peekNoteSubjectType,
  rememberNoteSubjectType,
  resolveNoteSubjectType,
} from "../note-subject-metadata";

jest.mock("../cache", () => ({
  getSubjectById: jest.fn(),
}));

describe("note subject metadata", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("remembers the type supplied by the subject picker", () => {
    expect(rememberNoteSubjectType(901, "kanji")).toBe("kanji");
    expect(peekNoteSubjectType(901)).toBe("kanji");
  });

  it("resolves existing links from the subject cache", async () => {
    (getSubjectById as jest.Mock).mockResolvedValue({
      id: 902,
      object: "kana_vocabulary",
    });

    await expect(resolveNoteSubjectType(902)).resolves.toBe(
      "kana_vocabulary",
    );
    expect(peekNoteSubjectType(902)).toBe("kana_vocabulary");
    expect(getSubjectById).toHaveBeenCalledWith(902);
  });

  it("ignores invalid or unavailable subject metadata", async () => {
    expect(rememberNoteSubjectType(903, "imaginary_subject")).toBeNull();
    (getSubjectById as jest.Mock).mockResolvedValue(null);

    await expect(resolveNoteSubjectType(903)).resolves.toBeNull();
    expect(peekNoteSubjectType(903)).toBeNull();
  });
});
