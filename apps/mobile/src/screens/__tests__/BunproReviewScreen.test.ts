jest.mock("../../utils/expoAvCompat", () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn(),
    },
  },
}));

jest.mock("../../utils/store", () => ({
  useAuthStore: () => ({
    userData: null,
  }),
}));

import { parseFuriganaRuns } from "../BunproReviewScreen";

describe("parseFuriganaRuns", () => {
  it("keeps particles and punctuation out of ruby bases", () => {
    expect(parseFuriganaRuns("灰皿（はいざら）を使う（つか）、誰（だれ）ですか。")).toEqual([
      { kind: "ruby", base: "灰皿", reading: "はいざら" },
      { kind: "text", text: "を" },
      { kind: "ruby", base: "使", reading: "つか" },
      { kind: "text", text: "う、" },
      { kind: "ruby", base: "誰", reading: "だれ" },
      { kind: "text", text: "ですか。" },
    ]);
  });

  it("keeps kana prefixes and suffixes when the reading includes them", () => {
    expect(parseFuriganaRuns("お金（おかね）を使う（つかう）")).toEqual([
      { kind: "ruby", base: "お金", reading: "おかね" },
      { kind: "text", text: "を" },
      { kind: "ruby", base: "使う", reading: "つかう" },
    ]);
  });
});
