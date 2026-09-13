import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BlockNoteEditor } from "@blocknote/core";
import { describe, expect, it, vi } from "vitest";
import type { Subject } from "@/types/wanikani";
import { sanitizeNotebookBlocks, type NotebookSentence } from "./model";
import { notebookSchema, NotebookStudyProvider, SentenceReference } from "./editor-schema";
import { findNotebookSubjects, isSafeNotebookLink } from "./editor-utils";
import NotebookSentenceForm from "./NotebookSentenceForm";
import NotebookSubjectReference from "./NotebookSubjectReference";

function word(id: number, japanese: string, reading: string, meaning: string): Subject {
  return { id, object: "vocabulary", url: "", data_updated_at: "2026-09-07T00:00:00.000Z", data: {
    level: 1, created_at: "2026-09-07T00:00:00.000Z", slug: japanese, document_url: "", hidden_at: null, characters: japanese,
    meanings: [{ meaning, primary: true, accepted_answer: true }], readings: [{ reading, primary: true, accepted_answer: true }], auxiliary_meanings: [],
  } };
}

const subjects = [word(1, "日本", "にほん", "Japan"), word(2, "天気", "てんき", "Weather")];
const sentence: NotebookSentence = { id: "sentence-1", japanese: "日本へ行きます。", kana: "にほんへいきます。", english: "I am going to Japan.", subjectIds: [1], revision: 3, createdAt: "2026-09-07T00:00:00.000Z", updatedAt: "2026-09-07T00:00:00.000Z" };

describe("Notebook editor document compatibility", () => {
  it("round-trips real BlockNote output through portable validation, including tables, formatting, and study references", () => {
    const editor = BlockNoteEditor.create({ schema: notebookSchema, initialContent: [
      { type: "paragraph", content: [{ type: "text", text: "A rule for ", styles: { bold: true } }, { type: "vocabularyMention", props: { subjectId: 1, label: "日本" } }, { type: "link", href: "https://example.com/grammar", content: " grammar" }] },
      { type: "heading", props: { level: 2, isToggleable: true }, content: "Examples", children: [{ type: "paragraph", content: "Nested explanation" }] },
      { type: "checkListItem", props: { checked: true }, content: "Read aloud" },
      { type: "numberedListItem", props: { start: 2 }, content: "Practice" },
      { type: "toggleListItem", content: "Translation", children: [{ type: "quote", content: "Because…" }] },
      { type: "codeBlock", props: { language: "text" }, content: "Verb + から" },
      { type: "table", content: { type: "tableContent", rows: [{ cells: ["Pattern", "Meaning"] }, { cells: ["から", "because"] }] } },
      { type: "callout", content: "Remember the polite form." },
      { type: "vocabulary", props: { subjectId: 2, label: "天気" } },
      { type: "sentence", props: { sentenceId: sentence.id } },
      { type: "pageLink", props: { pageId: "grammar-page" } },
      { type: "divider" },
    ] });
    const clean = sanitizeNotebookBlocks(editor.document);
    const reloaded = BlockNoteEditor.create({ schema: notebookSchema, initialContent: clean as typeof notebookSchema.PartialBlock[] });
    expect(sanitizeNotebookBlocks(reloaded.document)).toEqual(clean);
    expect(clean.find((block) => block.type === "sentence")).toMatchObject({ props: { sentenceId: sentence.id } });
    expect(JSON.stringify(clean)).not.toContain(sentence.japanese);
    expect(notebookSchema.blockSchema).not.toHaveProperty("image");
    expect(notebookSchema.blockSchema).not.toHaveProperty("file");
    editor.unmount();
    reloaded.unmount();
  });

  it("allows ordinary references but rejects active, embedded, and protocol-relative links", () => {
    for (const link of ["https://example.com/grammar?q=a", "http://example.com", "mailto:teacher@example.com", "/subjects/1"]) expect(isSafeNotebookLink(link)).toBe(true);
    for (const link of ["javascript:alert(1)", "data:text/html,hello", "//example.com", "/\\evil.example", "https://example.com\n", "vbscript:example", ""]) expect(isSafeNotebookLink(link)).toBe(false);
  });

  it("finds Japanese words by characters, English meaning, reading, or romaji", () => {
    expect(findNotebookSubjects(subjects, "日本").map((item) => item.id)).toEqual([1]);
    expect(findNotebookSubjects(subjects, "weather").map((item) => item.id)).toEqual([2]);
    expect(findNotebookSubjects(subjects, "にほん").map((item) => item.id)).toEqual([1]);
    expect(findNotebookSubjects(subjects, "nihon").map((item) => item.id)).toEqual([1]);
  });
});

describe("Shared notebook sentences", () => {
  it("keeps writing and word assignments available while the catalog loads or retries", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onRetrySubjects = vi.fn();
    const props = { sentence, onSave, onCancel: vi.fn(), onRetrySubjects };
    const view = render(<NotebookSentenceForm {...props} subjects={[]} subjectsLoading />);
    fireEvent.change(screen.getByLabelText("Add to word cards"), { target: { value: "weather" } });
    fireEvent.change(screen.getByLabelText("Japanese sentence"), { target: { value: "今日は晴れです。" } });
    expect(screen.getByRole("status")).toHaveTextContent("Loading subjects…");
    expect(screen.queryByText("No vocabulary found.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
    view.rerender(<NotebookSentenceForm {...props} subjects={[]} subjectsError="Offline" />);
    fireEvent.click(screen.getByRole("button", { name: "Retry subjects" }));
    expect(onRetrySubjects).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("Japanese sentence")).toHaveValue("今日は晴れです。");
    view.rerender(<NotebookSentenceForm {...props} subjects={subjects} />);
    fireEvent.click(screen.getByRole("button", { name: /天気/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ japanese: "今日は晴れです。", subjectIds: [1, 2] })));
  });
  it("renders a refreshed shared record without changing its reference and opens its word and edit actions", () => {
    const onOpenSubject = vi.fn();
    const onEditSentence = vi.fn();
    const props = { subjects, pages: [], readOnly: false, onOpenSubject, onOpenPage: vi.fn(), onEditSentence };
    const view = render(<NotebookStudyProvider {...props} sentences={[sentence]}><SentenceReference sentenceId={sentence.id} /></NotebookStudyProvider>);
    expect(screen.getByText(sentence.japanese)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "日本" })).toHaveAttribute("href", "/subjects/1");
    expect(screen.getByRole("link", { name: "日本" })).toHaveAttribute("target", "_blank");
    expect(screen.queryByText(sentence.kana)).not.toBeInTheDocument();
    expect(screen.queryByText("Linked sentence")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit linked sentence" }));
    expect(onEditSentence).toHaveBeenCalledWith(sentence.id);
    view.rerender(<NotebookStudyProvider {...props} sentences={[{ ...sentence, japanese: "日本に住んでいます。", revision: 4 }]}><SentenceReference sentenceId={sentence.id} /></NotebookStudyProvider>);
    expect(screen.queryByText(sentence.japanese)).not.toBeInTheDocument();
    expect(screen.getByText("日本に住んでいます。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Translation" })).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps the translation control beside its vocabulary while exposing only expanded text", () => {
    const props = { subjects, pages: [], readOnly: false, onOpenSubject: vi.fn(), onOpenPage: vi.fn(), onEditSentence: vi.fn() };
    render(<NotebookStudyProvider {...props} sentences={[sentence]}><SentenceReference sentenceId={sentence.id} /></NotebookStudyProvider>);
    const toggle = screen.getByRole("button", { name: "Translation" });
    const footer = toggle.parentElement;
    const panel = document.getElementById(toggle.getAttribute("aria-controls")!);
    expect(footer).toContainElement(screen.getByRole("link", { name: "日本" }));
    expect(footer).not.toContainElement(panel);
    expect(panel).toHaveTextContent(sentence.english);
    expect(panel).toHaveAttribute("aria-hidden", "true");
    expect(panel).toHaveAttribute("inert");

    toggle.focus();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveFocus();
    expect(toggle.parentElement).toBe(footer);
    expect(panel).toHaveAttribute("aria-hidden", "false");
    expect(panel).not.toHaveAttribute("inert");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle.parentElement).toBe(footer);
    expect(panel).toHaveAttribute("aria-hidden", "true");
    expect(panel).toHaveAttribute("inert");
    expect(panel).toHaveTextContent(sentence.english);
  });

  it("keeps the form's original revision after a remote refresh and retains writing on a save conflict", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("This sentence changed in another session."));
    const props = { subjects, onSave, onCancel: vi.fn() };
    const view = render(<NotebookSentenceForm {...props} sentence={sentence} />);
    fireEvent.change(screen.getByLabelText("Japanese sentence"), { target: { value: "日本に住んでいます。" } });
    view.rerender(<NotebookSentenceForm {...props} sentence={{ ...sentence, japanese: "日本が好きです。", revision: 4 }} />);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: sentence.id, revision: 3, japanese: "日本に住んでいます。", kana: sentence.kana })));
    expect(await screen.findByRole("alert")).toHaveTextContent("changed in another session");
    expect(screen.getByLabelText("Japanese sentence")).toHaveValue("日本に住んでいます。");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
  });

  it("assigns one example to multiple word cards while keeping its shared ID", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<NotebookSentenceForm sentence={sentence} subjects={subjects} onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Add to word cards"), { target: { value: "weather" } });
    fireEvent.click(await screen.findByRole("button", { name: /天気/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: sentence.id, subjectIds: [1, 2] })));
  });
});

describe("Notebook subject reference previews", () => {
  it("keeps its real link and focused preview as loading resolves into a subject", async () => {
    const view = render(<NotebookSubjectReference subjectId={1} label="" inline subjectsLoading />);
    const link = screen.getByRole("link", { name: "Loading linked subject" });
    expect(link).toHaveAttribute("href", "/subjects/1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(screen.queryByText("Subject 1")).not.toBeInTheDocument();
    fireEvent.focus(link);
    expect(await screen.findByRole("dialog", { name: "Linked subject details" })).toHaveTextContent("Loading subject details…");
    view.rerender(<NotebookSubjectReference subject={subjects[0]} subjectId={1} label="" inline />);
    expect(screen.getByRole("link", { name: "日本" })).toBe(link);
    expect(screen.getByRole("dialog", { name: "日本 details" })).toHaveTextContent("Japan");
    expect(screen.queryByText("Loading subject details…")).not.toBeInTheDocument();
  });

  it("preserves the saved label and offers retry when subject details fail to load", async () => {
    const onRetrySubjects = vi.fn();
    render(<NotebookSubjectReference subjectId={1} label="日本" inline subjectsError="Offline" onRetrySubjects={onRetrySubjects} />);
    fireEvent.focus(screen.getByRole("link", { name: "日本" }));
    expect(await screen.findByRole("dialog", { name: "日本 details" })).toHaveTextContent("Subject details could not be loaded.");
    fireEvent.click(screen.getByRole("button", { name: "Retry subjects" }));
    expect(onRetrySubjects).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "View details" })).toHaveAttribute("target", "_blank");
  });
  it.each([true, false])("opens a rich preview on focus while preserving a real new-tab link (inline %s)", async (inline) => {
    render(<NotebookSubjectReference subject={subjects[0]} subjectId={1} label="日本" inline={inline} />);
    const link = screen.getByRole("link", { name: /日本/ });
    expect(link).toHaveAttribute("href", "/subjects/1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("data-kind", "vocabulary");
    fireEvent.focus(link);
    const preview = await screen.findByRole("dialog", { name: "日本 details" });
    expect(preview).toHaveTextContent("にほん");
    expect(preview).toHaveTextContent("Japan");
    expect(preview).toHaveTextContent("Vocabulary");
    expect(preview).toHaveTextContent("Lv 1");
    expect(screen.getByRole("link", { name: "View details" })).toHaveAttribute("target", "_blank");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "日本 details" })).not.toBeInTheDocument();
  });

  it("uses radical artwork and the correct subject kind for image-only references", async () => {
    const radical: Subject = { ...subjects[0], id: 3, object: "radical", data: { ...subjects[0].data, characters: null, slug: "rib-cage", meanings: [{ meaning: "Rib Cage", primary: true, accepted_answer: true }], readings: [], character_images: [{ url: "https://files.wanikani.com/rib-cage.svg", content_type: "image/svg+xml" }] } };
    render(<NotebookSubjectReference subject={radical} subjectId={3} label="Rib Cage" inline />);
    const link = screen.getByRole("link", { name: "Rib Cage radical" });
    expect(link).toHaveAttribute("data-kind", "radical");
    expect(link).toHaveAttribute("href", "/subjects/3");
    expect(screen.getByRole("img", { name: "Rib Cage radical" })).toHaveAttribute("src", "https://files.wanikani.com/rib-cage.svg");
    fireEvent.mouseEnter(link);
    expect(await screen.findByRole("dialog", { name: "rib-cage details" })).toHaveTextContent("Radical");
  });

  it("keeps kanji references distinct from vocabulary", () => {
    const kanji: Subject = { ...subjects[0], object: "kanji" };
    render(<NotebookSubjectReference subject={kanji} subjectId={1} label="日" inline />);
    expect(screen.getByRole("link")).toHaveAttribute("data-kind", "kanji");
  });
});
