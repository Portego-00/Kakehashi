import { parseSelectedListIds } from "../extraStudySubjectLists";

describe("extraStudySubjectLists", () => {
  it("parses a comma-separated route parameter", () => {
    expect(parseSelectedListIds("list-a, list-b,list-a")).toEqual([
      "list-a",
      "list-b",
    ]);
  });

  it("continues to accept stored arrays", () => {
    expect(parseSelectedListIds(["list-a", "", "list-b"])).toEqual([
      "list-a",
      "list-b",
    ]);
  });
});
