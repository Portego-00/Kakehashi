import { z } from "zod";
import { isNotebookDrawingId, isNotebookDrawingSize, isNotebookInkFormat, isNotebookPreviewFormat, supportsNotebookHandwriting, supportsNotebookStrokes, supportsNotebookAppearance, type NotebookDrawingReference } from "./handwriting";
import { isNotebookPaperColor, type NotebookPaperColor } from "./paper-appearance";
import { createExampleNotebook, EXAMPLE_NOTEBOOK_PAGE_IDS, EXAMPLE_NOTEBOOK_SENTENCE_ID } from "./example-notebook";

/** Portable document format with private handwriting asset references. Shared sentences are stored once and referenced by ID. */
export type NotebookInline =
  | { type: "text"; text: string; styles?: Record<string, string | boolean> }
  | { type: "link"; href: string; content: NotebookInline[] }
  | { type: "vocabularyMention"; props: { subjectId: number | string; label: string } };
export type NotebookTableCell = { type: "tableCell"; content: NotebookInline[]; props?: Record<string, string | number | boolean> };
export type NotebookTableContent = { type: "tableContent"; rows: { cells: (NotebookInline[] | NotebookTableCell)[] }[]; columnWidths?: (number | null)[]; headerRows?: number; headerCols?: number };
export type NotebookBlock = { id: string; type: string; props?: Record<string, string | number | boolean>; content?: NotebookInline[] | string | NotebookTableContent; children?: NotebookBlock[] };
export type NotebookPage = { id: string; parentId: string | null; title: string; icon: string; favorite: boolean; trashedAt: string | null; sortOrder: number; content: NotebookBlock[]; createdAt: string; updatedAt: string; revision: number };
export type NotebookSentence = { id: string; japanese: string; kana: string; english: string; subjectIds: number[]; createdAt: string; updatedAt: string; revision: number };
export type NotebookState = { version: 1; pages: NotebookPage[]; sentences: NotebookSentence[]; examples?: { version: 1; status: "installed" | "removed" | "skipped"; contentVersion?: number } };
export const EXAMPLE_NOTEBOOK_CONTENT_VERSION = 2;
export type NotebookLimits = { maxBytes: number; maxPages: number; maxSentences: number; maxPageBytes: number };
export const DEFAULT_NOTEBOOK_LIMITS: NotebookLimits = { maxBytes: 1_048_576, maxPages: 200, maxSentences: 1_500, maxPageBytes: 262_144 };
export const NOTEBOOK_HARD_MAX_BYTES = 4_194_304;

export class NotebookError extends Error {
  constructor(message: string, public code: "invalid" | "conflict" | "limit" | "not_found" | "referenced" | "update_required", public status = code === "update_required" ? 426 : code === "limit" ? 413 : code === "invalid" ? 400 : code === "not_found" ? 404 : 409) { super(message); this.name = "NotebookError"; }
}
const idSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/);
const revisionSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1);
const blocksSchema = z.array(z.unknown()).max(1_500).transform((value) => sanitizeNotebookBlocks(value));
const pageFields = { title: z.string().max(240), parentId: idSchema.nullable(), icon: z.string().max(32), content: blocksSchema, sortOrder: z.number().finite().min(-1_000_000_000).max(1_000_000_000) };
const sentenceInputSchema = z.object({ id: idSchema, japanese: z.string().trim().min(1).max(2_000), kana: z.string().trim().max(2_000), english: z.string().trim().max(4_000), subjectIds: z.array(z.number().int().positive().max(Number.MAX_SAFE_INTEGER)).max(64).transform((ids) => [...new Set(ids)]) }).strict();
const mutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("initialize_examples") }).strict(),
  z.object({ action: z.literal("remove_examples") }).strict(),
  z.object({ action: z.literal("create_page"), page: z.object({ id: idSchema, ...Object.fromEntries(Object.entries(pageFields).map(([key, schema]) => [key, schema.optional()])) }).strict() }).strict(),
  z.object({ action: z.literal("update_page"), pageId: idSchema, expectedRevision: revisionSchema, patch: z.object({ title: pageFields.title.optional(), parentId: pageFields.parentId.optional(), icon: pageFields.icon.optional(), content: blocksSchema.optional(), sortOrder: pageFields.sortOrder.optional(), favorite: z.boolean().optional() }).strict() }).strict(),
  z.object({ action: z.literal("append_blocks"), pageId: idSchema, blocks: blocksSchema }).strict(),
  ...(["trash_page", "restore_page", "delete_page"] as const).map((action) => z.object({ action: z.literal(action), pageId: idSchema, expectedRevision: revisionSchema }).strict()),
  z.object({ action: z.literal("upsert_sentence"), sentence: sentenceInputSchema, expectedRevision: z.number().int().min(-1).max(Number.MAX_SAFE_INTEGER - 1) }).strict(),
  z.object({ action: z.literal("delete_sentence"), sentenceId: idSchema, expectedRevision: revisionSchema }).strict(),
]);
export type NotebookMutation =
  | { action: "initialize_examples" }
  | { action: "remove_examples" }
  | { action: "create_page"; page: { id: string; title?: string; parentId?: string | null; icon?: string; content?: NotebookBlock[]; sortOrder?: number } }
  | { action: "update_page"; pageId: string; expectedRevision: number; patch: Partial<Pick<NotebookPage, "title" | "parentId" | "icon" | "content" | "sortOrder" | "favorite">> }
  | { action: "append_blocks"; pageId: string; blocks: NotebookBlock[] }
  | { action: "trash_page" | "restore_page" | "delete_page"; pageId: string; expectedRevision: number }
  | { action: "upsert_sentence"; sentence: Pick<NotebookSentence, "id" | "japanese" | "kana" | "english" | "subjectIds">; expectedRevision: number }
  | { action: "delete_sentence"; sentenceId: string; expectedRevision: number };

function invalid(message = "This notebook content is invalid."): never { throw new NotebookError(message, "invalid"); }
function record(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) return invalid(); return value as Record<string, unknown>; }
function text(value: unknown, max = 20_000): string { if (typeof value !== "string" || value.length > max || /data:[^\s]{0,100};base64,/i.test(value) || /\u0000/.test(value)) return invalid("Notebooks support text and study references only."); return value; }
function identifier(value: unknown) { const result = idSchema.safeParse(value); if (!result.success) return invalid("A notebook reference is invalid."); return result.data; }
function subjectId(value: unknown) { const id = Number(value); if (!Number.isSafeInteger(id) || id <= 0) return invalid("A vocabulary reference is invalid."); return id; }
function safeLink(value: unknown) { const href = text(value, 2_048); if (/^\/(?![\\/])/.test(href) && !href.includes("\\")) return href; try { const url = new URL(href); if (["http:", "https:", "mailto:"].includes(url.protocol)) return href; } catch {} return invalid("Links must use https, http, mailto, or an app path."); }
const blockTypes = new Set(["paragraph", "heading", "bulletListItem", "numberedListItem", "checkListItem", "toggleListItem", "quote", "table", "divider", "codeBlock", "callout", "vocabulary", "sentence", "pageLink", "handwriting"]);
const commonProps = new Set(["textColor", "backgroundColor", "textAlignment"]);
function props(value: unknown, type: string): Record<string, string | number | boolean> {
  const source = value === undefined ? {} : record(value);
  const allowed = new Set([...commonProps, ...(type === "heading" ? ["level", "isToggleable"] : type === "numberedListItem" ? ["start"] : type === "checkListItem" ? ["checked"] : type === "codeBlock" ? ["language"] : type === "callout" ? ["icon"] : type === "tableCell" ? ["colspan", "rowspan"] : [])]);
  if (type === "handwriting") {
    const inkFormat = source.inkFormat === undefined ? "pencilkit-v1" : source.inkFormat;
    const blank = source.drawingId === "" && inkFormat === "strokes-v1";
    if (!isNotebookInkFormat(inkFormat) || (!blank && !isNotebookDrawingId(source.drawingId)) || !isNotebookDrawingSize(source.width, source.height)) invalid("This handwriting reference is invalid.");
    const paperColor = source.paperColor === "" ? undefined : source.paperColor;
    const previewFormat = source.previewFormat === "" ? undefined : source.previewFormat;
    if (paperColor !== undefined && !isNotebookPaperColor(paperColor) || previewFormat !== undefined && !isNotebookPreviewFormat(previewFormat) || previewFormat && (blank || inkFormat !== "pencilkit-v1")) invalid("This handwriting appearance is invalid.");
    // Preserve the original legacy shape; portable references always carry their format.
    return { drawingId: source.drawingId as string, width: source.width as number, height: source.height as number, ...(inkFormat === "strokes-v1" ? { inkFormat } : {}), ...(paperColor !== undefined ? { paperColor: paperColor as NotebookPaperColor } : {}), ...(previewFormat ? { previewFormat: "themed-v1" } : {}) };
  }
  if (type === "vocabulary") return { subjectId: subjectId(source.subjectId), label: text(source.label, 240) };
  if (type === "sentence") return { sentenceId: identifier(source.sentenceId) };
  if (type === "pageLink") return { pageId: identifier(source.pageId) };
  const result: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(source)) {
    if (!allowed.has(key) || value === undefined) continue;
    if ((key === "textColor" || key === "backgroundColor") && value === "default" || key === "textAlignment" && value === "left") continue;
    if (typeof value === "string") result[key] = text(value, key === "language" ? 120 : 64);
    else if (typeof value === "boolean") result[key] = value;
    else if (typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 1_000_000) result[key] = value;
    else invalid();
  }
  if (result.level !== undefined && (!Number.isInteger(result.level) || Number(result.level) < 1 || Number(result.level) > 6)) invalid();
  if (result.textAlignment !== undefined && !["left", "center", "right", "justify"].includes(String(result.textAlignment))) invalid();
  return result;
}
function inlineContent(value: unknown, depth = 0): NotebookInline[] {
  if (!Array.isArray(value) || value.length > 4_000 || depth > 4) return invalid();
  return value.map((entry) => {
    const item = record(entry);
    if (item.type === "vocabularyMention") return { type: "vocabularyMention", props: props(item.props, "vocabulary") as { subjectId: number; label: string } };
    if (item.type === "link") return { type: "link", href: safeLink(item.href), content: inlineContent(item.content, depth + 1) };
    if (item.type !== "text") return invalid();
    const styles: Record<string, string | boolean> = {};
    if (item.styles !== undefined) for (const [key, value] of Object.entries(record(item.styles))) {
      if (["bold", "italic", "underline", "strike", "code"].includes(key) && typeof value === "boolean") { if (value) styles[key] = true; }
      else if (["textColor", "backgroundColor"].includes(key) && typeof value === "string") styles[key] = text(value, 64);
    }
    return { type: "text", text: text(item.text), ...(Object.keys(styles).length ? { styles } : {}) };
  });
}
function tableContent(value: unknown): NotebookTableContent {
  const table = record(value);
  if (table.type !== "tableContent" || !Array.isArray(table.rows) || table.rows.length > 200) return invalid();
  const rows = table.rows.map((row) => {
    const cells = record(row).cells;
    if (!Array.isArray(cells) || cells.length > 30) return invalid();
    return { cells: cells.map((cell): NotebookInline[] | NotebookTableCell => Array.isArray(cell) ? inlineContent(cell) : { type: "tableCell", content: inlineContent(record(cell).content), props: props(record(cell).props, "tableCell") }) };
  });
  const result: NotebookTableContent = { type: "tableContent", rows };
  if (Array.isArray(table.columnWidths) && table.columnWidths.length <= 30) result.columnWidths = table.columnWidths.map((width) => width === null || width === undefined ? null : typeof width === "number" && Number.isFinite(width) && width > 0 && width <= 10_000 ? width : invalid());
  for (const key of ["headerRows", "headerCols"] as const) if (table[key] !== undefined) { if (!Number.isInteger(table[key]) || Number(table[key]) < 0 || Number(table[key]) > 200) invalid(); result[key] = Number(table[key]); }
  return result;
}
export function sanitizeNotebookBlocks(value: unknown): NotebookBlock[] {
  let count = 0;
  const ids = new Set<string>();
  function visit(value: unknown, depth: number): NotebookBlock[] {
    if (!Array.isArray(value) || depth > 12) return invalid("This page has too many nested blocks.");
    return value.map((entry) => {
      if (++count > 1_500) throw new NotebookError("A page can contain up to 1,500 blocks.", "limit");
      const source = record(entry);
      const id = identifier(source.id);
      if (ids.has(id)) invalid("Block IDs must be unique within a page."); ids.add(id);
      if (typeof source.type !== "string" || !blockTypes.has(source.type)) invalid("This block is not supported. Notebooks store text and study references only.");
      const result: NotebookBlock = { id, type: source.type };
      const cleanProps = props(source.props, source.type);
      if (Object.keys(cleanProps).length) result.props = cleanProps;
      if (source.content !== undefined && !["sentence", "vocabulary", "pageLink", "divider", "handwriting"].includes(source.type)) result.content = source.type === "table" ? tableContent(source.content) : typeof source.content === "string" ? text(source.content) : inlineContent(source.content);
      if (Array.isArray(source.children) && source.children.length) result.children = visit(source.children, depth + 1);
      return result;
    });
  }
  return visit(value, 0);
}
/** Includes nested blocks and trash, which older clients also validate on read. */
export function notebookDrawingReferences(state: NotebookState) {
  const references: (NotebookDrawingReference & { paperColor?: NotebookPaperColor })[] = [];
  for (const page of state.pages) walkBlocks(page.content, (block) => {
    if (block.type === "handwriting") references.push({ drawingId: String(block.props?.drawingId), width: Number(block.props?.width), height: Number(block.props?.height), ...(block.props?.inkFormat === "strokes-v1" ? { inkFormat: "strokes-v1" } : {}), ...(isNotebookPaperColor(block.props?.paperColor) ? { paperColor: block.props.paperColor } : {}), ...(block.props?.previewFormat === "themed-v1" ? { previewFormat: "themed-v1" } : {}) });
  });
  return references;
}
export function assertNotebookFeatures(state: NotebookState, features: string | null | undefined) {
  const references = notebookDrawingReferences(state);
  if ((!supportsNotebookHandwriting(features) && references.length)
    || (!supportsNotebookStrokes(features) && references.some((ref) => ref.inkFormat === "strokes-v1"))
    || (!supportsNotebookAppearance(features) && references.some((ref) => ref.paperColor !== undefined || ref.previewFormat !== undefined))) {
    throw new NotebookError("Update Kakehashi to open and edit notebooks containing handwriting.", "update_required");
  }
}
export function parseNotebookMutation(value: unknown): NotebookMutation {
  const parsed = mutationSchema.safeParse(value);
  if (!parsed.success) invalid("The notebook update is invalid.");
  return parsed.data as NotebookMutation;
}
export function createNotebookState(): NotebookState { return { version: 1, pages: [], sentences: [] }; }
/** The document format stays at v1; the editable tour has its own one-time updates. */
export function notebookExamplesNeedInitialization(state: NotebookState): boolean {
  return !state.examples || state.examples.status === "installed" && (state.examples.contentVersion ?? 1) < EXAMPLE_NOTEBOOK_CONTENT_VERSION;
}
export function notebookStateBytes(state: NotebookState): number { return new TextEncoder().encode(JSON.stringify(state)).byteLength; }
function walkBlocks(blocks: NotebookBlock[], visit: (block: NotebookBlock) => void) { for (const block of blocks) { visit(block); if (block.children) walkBlocks(block.children, visit); } }
function walkInline(content: NotebookBlock["content"], visit: (item: NotebookInline) => void) {
  if (!content || typeof content === "string") return;
  if (!Array.isArray(content)) { for (const row of content.rows) for (const cell of row.cells) walkInline(Array.isArray(cell) ? cell : cell.content, visit); return; }
  for (const item of content) { visit(item); if (item.type === "link") walkInline(item.content, visit); }
}
export function pageText(page: NotebookPage, sentences: readonly NotebookSentence[] = []): string {
  const parts = [page.title];
  walkBlocks(page.content, (block) => {
    if (typeof block.content === "string") parts.push(block.content);
    walkInline(block.content, (item) => { if (item.type === "text") parts.push(item.text); else if (item.type === "vocabularyMention") parts.push(item.props.label); });
    if (block.type === "vocabulary") parts.push(String(block.props?.label || ""));
    if (block.type === "sentence") { const sentence = sentences.find((item) => item.id === block.props?.sentenceId); if (sentence) parts.push(sentence.japanese, sentence.kana, sentence.english); }
  });
  return parts.join(" ");
}
export function pageSubjectIds(page: NotebookPage, sentences: readonly NotebookSentence[] = []): number[] {
  const ids = new Set<number>();
  walkBlocks(page.content, (block) => {
    if (block.type === "vocabulary") ids.add(Number(block.props?.subjectId));
    walkInline(block.content, (item) => { if (item.type === "vocabularyMention") ids.add(Number(item.props.subjectId)); });
    if (block.type === "sentence") sentences.find((item) => item.id === block.props?.sentenceId)?.subjectIds.forEach((id) => ids.add(id));
  });
  return [...ids].filter((id) => Number.isSafeInteger(id) && id > 0);
}
const dateSchema = z.string().datetime({ offset: true });
const pageSchema = z.object({ id: idSchema, parentId: pageFields.parentId, title: pageFields.title, icon: pageFields.icon, favorite: z.boolean(), trashedAt: dateSchema.nullable(), sortOrder: pageFields.sortOrder, content: blocksSchema, createdAt: dateSchema, updatedAt: dateSchema, revision: revisionSchema }).strict();
const savedSentenceSchema = sentenceInputSchema.extend({ createdAt: dateSchema, updatedAt: dateSchema, revision: revisionSchema });
export function validateNotebookState(value: unknown, limits: NotebookLimits = DEFAULT_NOTEBOOK_LIMITS): NotebookState {
  const schema = z.object({ version: z.literal(1), pages: z.array(pageSchema).max(limits.maxPages), sentences: z.array(savedSentenceSchema).max(limits.maxSentences), examples: z.object({ version: z.literal(1), status: z.enum(["installed", "removed", "skipped"]), contentVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional() }).strict().optional() }).strict();
  const raw = record(value);
  if (Array.isArray(raw.pages) && raw.pages.length > limits.maxPages) throw new NotebookError(`Your notebook can contain up to ${limits.maxPages} pages, including trash.`, "limit");
  if (Array.isArray(raw.sentences) && raw.sentences.length > limits.maxSentences) throw new NotebookError(`Your notebook can contain up to ${limits.maxSentences} shared sentences.`, "limit");
  const parsed = schema.safeParse(value);
  if (!parsed.success) invalid();
  const state = parsed.data;
  const pages = new Map(state.pages.map((page) => [page.id, page]));
  const sentences = new Set(state.sentences.map((sentence) => sentence.id));
  if (pages.size !== state.pages.length || sentences.size !== state.sentences.length) invalid("Notebook IDs must be unique.");
  for (const page of state.pages) {
    text(page.title, 240); text(page.icon, 32);
    const ancestors = new Set([page.id]); let parentId = page.parentId;
    while (parentId !== null) { const parent = pages.get(parentId); if (!parent || ancestors.has(parentId) || ancestors.size > 24) invalid("Pages must form a valid tree without cycles."); if (!page.trashedAt && parent.trashedAt) invalid("Move or restore the parent page first."); ancestors.add(parentId); parentId = parent.parentId; }
    walkBlocks(page.content, (block) => { if (block.type === "sentence" && !sentences.has(String(block.props?.sentenceId))) invalid("A linked sentence no longer exists."); if (block.type === "pageLink" && !pages.has(String(block.props?.pageId))) invalid("A linked page no longer exists."); });
    if (new TextEncoder().encode(JSON.stringify(page)).byteLength > limits.maxPageBytes) throw new NotebookError("This page is full. Continue in another page.", "limit");
  }
  for (const sentence of state.sentences) { text(sentence.japanese, 2_000); text(sentence.kana, 2_000); text(sentence.english, 4_000); }
  if (notebookStateBytes(state) > Math.min(limits.maxBytes, NOTEBOOK_HARD_MAX_BYTES)) throw new NotebookError("Your notebook storage is full. Export or remove pages from trash to make room.", "limit");
  return state;
}
function checkRevision(record: { revision: number }, expected: number) { if (record.revision !== expected) throw new NotebookError("This item changed in another session. Reload it before saving your changes.", "conflict"); }
function descendants(state: NotebookState, id: string) { const ids = new Set([id]); for (let pass = 0; pass < state.pages.length; pass++) { const before = ids.size; for (const page of state.pages) if (page.parentId && ids.has(page.parentId)) ids.add(page.id); if (before === ids.size) break; } return ids; }
const exampleSubjectSectionIds = new Set(["example-context-subject-types", "example-context-radical", "example-context-kanji", "example-context-subject-types-tip", "example-context-subject-filters"]);
function upgradeExampleNotebook(current: NotebookState, now: Date, limits: NotebookLimits): NotebookState {
  const template = new Map(createExampleNotebook(now).pages.map((page) => [page.id, page]));
  const pages = current.pages.map((page) => {
    const original = template.get(page.id);
    // A tour update cannot restore deleted pages or change anything in Trash.
    if (!original || page.trashedAt) return page;
    const icon = page.icon === "" || page.icon === "📄" ? original.icon : page.icon;
    let content = page.content;
    if (page.id === EXAMPLE_NOTEBOOK_PAGE_IDS.context) {
      let hasSection = false;
      walkBlocks(content, (block) => { if (exampleSubjectSectionIds.has(block.id)) hasSection = true; });
      // Existing section blocks may have been edited, moved or partly deleted.
      // Leave all of those choices intact; only add a wholly new section.
      if (!hasSection) {
        const mentionIndex = content.findIndex((block) => block.id === "example-context-mention");
        const ruleIndex = content.findIndex((block) => block.id === "example-context-rule-title");
        const index = mentionIndex >= 0 ? mentionIndex + 1 : ruleIndex;
        // A cleared or fully repurposed page is personal writing now.
        if (index >= 0) content = [...content.slice(0, index), ...original.content.filter((block) => exampleSubjectSectionIds.has(block.id)), ...content.slice(index)];
      }
    }
    return icon !== page.icon || content !== page.content ? { ...page, icon, content, revision: page.revision + 1, updatedAt: now.toISOString() } : page;
  });
  const candidate: NotebookState = { ...current, pages, examples: { version: 1, status: "installed", contentVersion: EXAMPLE_NOTEBOOK_CONTENT_VERSION } };
  try { return validateNotebookState(candidate, limits); }
  catch (error) {
    // Retry after space becomes available; never mark a failed update complete.
    if (error instanceof NotebookError && error.code === "limit") return current;
    throw error;
  }
}
export function applyNotebookMutation(current: NotebookState, input: NotebookMutation, now = new Date(), limits: NotebookLimits = DEFAULT_NOTEBOOK_LIMITS): { state: NotebookState; sentenceId?: string } {
  const mutation = parseNotebookMutation(input);
  const state: NotebookState = { ...current, pages: [...current.pages], sentences: [...current.sentences] };
  const timestamp = now.toISOString(); let sentenceId: string | undefined;
  const touch = (page: NotebookPage, patch: Partial<NotebookPage>) => ({ ...page, ...patch, revision: page.revision + 1, updatedAt: timestamp });
  if (mutation.action === "initialize_examples") {
    if (!notebookExamplesNeedInitialization(current)) return { state: current };
    if (current.examples) return { state: upgradeExampleNotebook(current, now, limits) };
    const example = createExampleNotebook(now);
    const pageIds = new Set(example.pages.map((page) => page.id));
    const sentenceIds = new Set(example.sentences.map((sentence) => sentence.id));
    const collision = current.pages.some((page) => pageIds.has(page.id)) || current.sentences.some((sentence) => sentenceIds.has(sentence.id));
    if (!collision) {
      const candidate: NotebookState = { ...state, pages: [...state.pages, ...example.pages], sentences: [...state.sentences, ...example.sentences], examples: { version: 1, status: "installed", contentVersion: EXAMPLE_NOTEBOOK_CONTENT_VERSION } };
      try { return { state: validateNotebookState(candidate, limits) }; }
      catch (error) { if (!(error instanceof NotebookError) || error.code !== "limit") throw error; }
    }
    // Never evict personal work to make room for onboarding, or take ownership
    // of a pre-existing ID. Persist the skip where the account budget permits it.
    state.examples = { version: 1, status: "skipped" };
    try { return { state: validateNotebookState(state, limits) }; }
    catch (error) { if (error instanceof NotebookError && error.code === "limit") return { state: current }; throw error; }
  } else if (mutation.action === "remove_examples") {
    if (current.examples?.status === "removed") return { state: current };
    if (current.examples?.status === "installed") {
      const ids = new Set<string>(Object.values(EXAMPLE_NOTEBOOK_PAGE_IDS));
      const byId = new Map(state.pages.map((page) => [page.id, page]));
      const removeLinks = (blocks: NotebookBlock[]): NotebookBlock[] => blocks.filter((block) => !(block.type === "pageLink" && ids.has(String(block.props?.pageId)))).map((block) => block.children ? { ...block, children: removeLinks(block.children) } : block);
      state.pages = state.pages.filter((page) => !ids.has(page.id)).map((page) => {
        let parentId = page.parentId;
        while (parentId && ids.has(parentId)) parentId = byId.get(parentId)?.parentId ?? null;
        const content = removeLinks(page.content);
        return parentId !== page.parentId || JSON.stringify(content) !== JSON.stringify(page.content) ? touch(page, { parentId, content }) : page;
      });
      const referenced = new Set<string>();
      for (const page of state.pages) walkBlocks(page.content, (block) => { if (block.type === "sentence") referenced.add(String(block.props?.sentenceId)); });
      state.sentences = state.sentences.filter((sentence) => sentence.id !== EXAMPLE_NOTEBOOK_SENTENCE_ID || sentence.revision > 0 || referenced.has(sentence.id));
    }
    state.examples = { version: 1, status: "removed" };
  } else if (mutation.action === "create_page") {
    const prior = state.pages.find((page) => page.id === mutation.page.id);
    if (prior) {
      const sameIcon = prior.icon === (mutation.page.icon ?? "📓") || mutation.page.icon === undefined && prior.icon === "";
      const same = !prior.trashedAt && prior.title === (mutation.page.title ?? "Untitled") && prior.parentId === (mutation.page.parentId ?? null) && sameIcon && JSON.stringify(prior.content) === JSON.stringify(mutation.page.content ?? []) && (mutation.page.sortOrder === undefined || prior.sortOrder === mutation.page.sortOrder);
      if (same) return { state: current };
      throw new NotebookError("A page with this ID already exists.", "conflict");
    }
    state.pages.push({ id: mutation.page.id, title: mutation.page.title ?? "Untitled", icon: mutation.page.icon ?? "📓", parentId: mutation.page.parentId ?? null, content: mutation.page.content ?? [], sortOrder: mutation.page.sortOrder ?? state.pages.length, favorite: false, trashedAt: null, revision: 0, createdAt: timestamp, updatedAt: timestamp });
  } else if (mutation.action === "upsert_sentence") {
    const existing = state.sentences.find((sentence) => sentence.id === mutation.sentence.id);
    if (existing) {
      if (mutation.expectedRevision === -1) {
        if (existing.japanese === mutation.sentence.japanese && existing.kana === mutation.sentence.kana && existing.english === mutation.sentence.english && mutation.sentence.subjectIds.every((id) => existing.subjectIds.includes(id))) return { state: current, sentenceId: existing.id };
        throw new NotebookError("A sentence with this ID already exists.", "conflict");
      }
      checkRevision(existing, mutation.expectedRevision); sentenceId = existing.id; state.sentences = state.sentences.map((sentence) => sentence.id === existing.id ? { ...mutation.sentence, createdAt: existing.createdAt, updatedAt: timestamp, revision: existing.revision + 1 } : sentence); }
    else {
      if (mutation.expectedRevision !== -1) throw new NotebookError("This sentence no longer exists.", "not_found");
      const duplicate = state.sentences.find((sentence) => sentence.japanese.normalize("NFKC") === mutation.sentence.japanese.normalize("NFKC") && sentence.english.normalize("NFKC") === mutation.sentence.english.normalize("NFKC"));
      if (duplicate) { sentenceId = duplicate.id; const ids = [...new Set([...duplicate.subjectIds, ...mutation.sentence.subjectIds])]; if (ids.length !== duplicate.subjectIds.length) state.sentences = state.sentences.map((sentence) => sentence.id === duplicate.id ? { ...sentence, subjectIds: ids, revision: sentence.revision + 1, updatedAt: timestamp } : sentence); }
      else { sentenceId = mutation.sentence.id; state.sentences.push({ ...mutation.sentence, revision: 0, createdAt: timestamp, updatedAt: timestamp }); }
    }
  } else if (mutation.action === "delete_sentence") {
    const existing = state.sentences.find((sentence) => sentence.id === mutation.sentenceId);
    if (!existing) throw new NotebookError("This sentence no longer exists.", "not_found"); checkRevision(existing, mutation.expectedRevision);
    for (const page of state.pages) walkBlocks(page.content, (block) => { if (block.type === "sentence" && block.props?.sentenceId === existing.id) throw new NotebookError("Remove this sentence from notebook pages, including trash, before deleting it.", "referenced"); });
    state.sentences = state.sentences.filter((sentence) => sentence.id !== existing.id);
  } else {
    const page = state.pages.find((page) => page.id === mutation.pageId);
    if (!page) throw new NotebookError("This notebook page no longer exists.", "not_found");
    if (mutation.action !== "append_blocks") checkRevision(page, mutation.expectedRevision);
    if (mutation.action === "update_page") {
      if (page.trashedAt) throw new NotebookError("Restore this page before editing it.", "conflict");
      state.pages = state.pages.map((item) => item.id === page.id ? touch(item, mutation.patch) : item);
    } else if (mutation.action === "append_blocks") {
      if (page.trashedAt) throw new NotebookError("Restore this page before adding to it.", "conflict");
      const existing = new Map<string, NotebookBlock>(); walkBlocks(page.content, (block) => existing.set(block.id, block));
      const additions = mutation.blocks.filter((block) => { const prior = existing.get(block.id); if (prior && JSON.stringify(prior) !== JSON.stringify(block)) throw new NotebookError("A captured block changed. Reload before adding it again.", "conflict"); return !prior; });
      if (additions.length) state.pages = state.pages.map((item) => item.id === page.id ? touch(item, { content: [...item.content, ...additions] }) : item);
    } else if (mutation.action === "trash_page") {
      if (!page.trashedAt) { const ids = descendants(state, page.id); state.pages = state.pages.map((item) => ids.has(item.id) && !item.trashedAt ? touch(item, { trashedAt: timestamp, favorite: false }) : item); }
    } else if (mutation.action === "restore_page") {
      if (page.trashedAt) {
        const ids = descendants(state, page.id);
        state.pages = state.pages.map((item) => ids.has(item.id) && item.trashedAt === page.trashedAt ? touch(item, { trashedAt: null, ...(item.id === page.id && item.parentId && state.pages.find((parent) => parent.id === item.parentId)?.trashedAt ? { parentId: null } : {}) }) : item);
      }
    } else if (mutation.action === "delete_page") {
      if (!page.trashedAt) throw new NotebookError("Move this page to trash before permanently deleting it.", "conflict");
      const ids = descendants(state, page.id);
      function removeLinks(blocks: NotebookBlock[]): NotebookBlock[] { return blocks.filter((block) => !(block.type === "pageLink" && ids.has(String(block.props?.pageId)))).map((block) => block.children ? { ...block, children: removeLinks(block.children) } : block); }
      state.pages = state.pages.filter((item) => !ids.has(item.id)).map((item) => { const content = removeLinks(item.content); return JSON.stringify(content) === JSON.stringify(item.content) ? item : touch(item, { content }); });
    }
  }
  return { state: validateNotebookState(state, limits), ...(sentenceId ? { sentenceId } : {}) };
}
