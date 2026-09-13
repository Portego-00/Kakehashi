import { NOTEBOOK_TEMPLATES } from "../../../web/src/features/notebooks/templates";
import type { NotebookBlock, NotebookPage } from "./model";

export { NOTEBOOK_TEMPLATES };

export function newNotebookId(prefix = "page"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function nativeTemplateContent(templateId: string): NotebookBlock[] {
  return (NOTEBOOK_TEMPLATES.find((template) => template.id === templateId)?.blocks ?? []).map((block) => ({
    id: newNotebookId("block"),
    type: block.type,
    ...(block.level ? { props: { level: block.level } } : {}),
    content: [{ type: "text", text: block.text }],
  }));
}

export function duplicateNotebookBlocks(blocks: NotebookBlock[]): NotebookBlock[] {
  return blocks.map((block) => ({
    ...block,
    id: newNotebookId("block"),
    ...(block.children ? { children: duplicateNotebookBlocks(block.children) } : {}),
  }));
}

export function duplicateNotebookTitle(title: string): string {
  const suffix = " (copy)";
  // Match the shared 240 UTF-16-unit title limit without cutting an emoji in half.
  const prefix = (title || "Untitled").slice(0, 240 - suffix.length).replace(/[\uD800-\uDBFF]$/, "");
  return `${prefix}${suffix}`;
}

export function notebookDescendantIds(pages: readonly NotebookPage[], pageId: string): Set<string> {
  const ids = new Set([pageId]);
  for (let pass = 0; pass < pages.length; pass += 1) {
    const before = ids.size;
    for (const page of pages) if (page.parentId && ids.has(page.parentId)) ids.add(page.id);
    if (before === ids.size) break;
  }
  return ids;
}

export function notebookPageTree(pages: readonly NotebookPage[], expanded: ReadonlySet<string>): { page: NotebookPage; depth: number; hasChildren: boolean }[] {
  const live = pages.filter((page) => !page.trashedAt).sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
  const knownIds = new Set(live.map((page) => page.id));
  const children = new Map<string | null, NotebookPage[]>();
  for (const page of live) {
    const parentId = page.parentId && knownIds.has(page.parentId) ? page.parentId : null;
    const siblings = children.get(parentId) ?? [];
    siblings.push(page);
    children.set(parentId, siblings);
  }
  const rows: { page: NotebookPage; depth: number; hasChildren: boolean }[] = [];
  const visited = new Set<string>();
  function visit(parentId: string | null, depth: number) {
    for (const page of children.get(parentId) ?? []) {
      if (visited.has(page.id)) continue;
      visited.add(page.id);
      rows.push({ page, depth, hasChildren: !!children.get(page.id)?.length });
      if (expanded.has(page.id)) visit(page.id, depth + 1);
    }
  }
  visit(null, 0);
  return rows;
}
