import { parseNotebookMutation, type NotebookPage } from "../model";
import { duplicateNotebookBlocks, duplicateNotebookTitle, nativeTemplateContent, notebookDescendantIds, notebookPageTree } from "../native-page-helpers";

const page = (id: string, parentId: string | null = null, patch: Partial<NotebookPage> = {}): NotebookPage => ({ id, parentId, title: id, icon: "", favorite: false, trashedAt: null, sortOrder: 0, content: [], createdAt: "2026-09-07T10:00:00Z", updatedAt: "2026-09-07T10:00:00Z", revision: 0, ...patch });

describe("native notebook navigation", () => {
  it("shows ordered roots and only expanded children, excluding trash", () => {
    const pages = [page("child", "root"), page("second", null, { sortOrder: 2 }), page("root"), page("trash", null, { trashedAt: "2026-09-07T11:00:00Z" })];
    expect(notebookPageTree(pages, new Set()).map(({ page: item }) => item.id)).toEqual(["root", "second"]);
    expect(notebookPageTree(pages, new Set(["root"])).map(({ page: item, depth }) => [item.id, depth])).toEqual([["root", 0], ["child", 1], ["second", 0]]);
  });

  it("keeps an orphaned page reachable and excludes all descendants as move targets", () => {
    const pages = [page("root"), page("child", "root"), page("grandchild", "child"), page("orphan", "missing")];
    expect(notebookDescendantIds(pages, "root")).toEqual(new Set(["root", "child", "grandchild"]));
    expect(notebookPageTree(pages, new Set()).map(({ page: item }) => item.id)).toEqual(["root", "orphan"]);
  });

  it("duplicates block identities while preserving shared study references", () => {
    const source = [{ id: "one", type: "sentence", props: { sentenceId: "shared-sentence" }, children: [{ id: "two", type: "vocabulary", props: { subjectId: 123, label: "日本" } }] }];
    const [copy] = duplicateNotebookBlocks(source);
    expect(copy.id).not.toBe("one");
    expect(copy.children?.[0].id).not.toBe("two");
    expect(copy.props).toEqual({ sentenceId: "shared-sentence" });
    expect(copy.children?.[0].props).toEqual({ subjectId: 123, label: "日本" });
    expect(source[0].id).toBe("one");
  });

  it("instantiates the shared templates with fresh native block IDs", () => {
    const first = nativeTemplateContent("grammar");
    const second = nativeTemplateContent("grammar");
    expect(first).toHaveLength(6);
    expect(first[0].content).toEqual([{ type: "text", text: "How it works" }]);
    expect(new Set([...first, ...second].map((block) => block.id)).size).toBe(12);
    expect(nativeTemplateContent("blank")).toEqual([]);
  });

  it.each([233, 234, 240])("duplicates a valid %i-character title within the shared limit and preserves its copy suffix", (length) => {
    const title = duplicateNotebookTitle("日".repeat(length));
    expect(title).toBe(`${"日".repeat(Math.min(length, 233))} (copy)`);
    expect(() => parseNotebookMutation({ action: "create_page", page: { id: "copy", title } })).not.toThrow();
  });

  it("does not split an emoji while shortening a duplicate title", () => {
    expect(duplicateNotebookTitle("📓".repeat(120))).toBe(`${"📓".repeat(116)} (copy)`);
    expect(duplicateNotebookTitle("")).toBe("Untitled (copy)");
  });
});
