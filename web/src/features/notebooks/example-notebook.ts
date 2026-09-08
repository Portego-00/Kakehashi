import type { NotebookBlock, NotebookInline, NotebookPage, NotebookState } from "./model";

export const EXAMPLE_NOTEBOOK_PAGE_IDS = {
  start: "example-notebook-start-v1",
  context: "example-notebook-context-v1",
  playground: "example-notebook-playground-v1",
} as const;
export const EXAMPLE_NOTEBOOK_ROOT_ID = EXAMPLE_NOTEBOOK_PAGE_IDS.start;
export const EXAMPLE_NOTEBOOK_SENTENCE_ID = "example-notebook-sentence-v1";
export const EXAMPLE_NOTEBOOK_ICONS: Record<string, string> = {
  [EXAMPLE_NOTEBOOK_PAGE_IDS.start]: "🧭",
  [EXAMPLE_NOTEBOOK_PAGE_IDS.context]: "🌱",
  [EXAMPLE_NOTEBOOK_PAGE_IDS.playground]: "✍️",
};

// WaniKani level-one subjects, verified in the bundled demo subject catalog.
export const EXAMPLE_NOTEBOOK_SUBJECT = { id: 2504, label: "山" } as const;
export const EXAMPLE_NOTEBOOK_RADICAL = { id: 1, label: "一" } as const;
export const EXAMPLE_NOTEBOOK_KANJI = { id: 455, label: "山" } as const;

const text = (value: string, styles?: Record<string, string | boolean>): NotebookInline => ({
  type: "text", text: value, ...(styles ? { styles } : {}),
});
const bold = (value: string) => text(value, { bold: true });
const code = (value: string) => text(value, { code: true });
const link = (label: string, href: string): NotebookInline => ({ type: "link", href, content: [text(label)] });
const mention = (subject: { id: number; label: string } = EXAMPLE_NOTEBOOK_SUBJECT): NotebookInline => ({ type: "vocabularyMention", props: { subjectId: subject.id, label: subject.label } });

function block(id: string, type: string, content?: string | NotebookInline[], props?: NotebookBlock["props"], children?: NotebookBlock[]): NotebookBlock {
  return { id: `example-${id}`, type, ...(content === undefined ? {} : { content: typeof content === "string" ? [text(content)] : content }), ...(props ? { props } : {}), ...(children ? { children } : {}) };
}
const heading = (id: string, title: string) => block(id, "heading", title, { level: 2 });
const pageLink = (id: string, pageId: string) => block(id, "pageLink", undefined, { pageId });
const sentence = (id: string) => block(id, "sentence", undefined, { sentenceId: EXAMPLE_NOTEBOOK_SENTENCE_ID });

/** A small, editable tour. Stable IDs let accounts receive it once and remove it together. */
export function createExampleNotebook(now: string | Date): NotebookState {
  const timestamp = now instanceof Date ? now.toISOString() : now;
  const page = (id: string, title: string, parentId: string | null, sortOrder: number, content: NotebookBlock[]): NotebookPage => ({
    id, title, parentId, sortOrder, content, icon: EXAMPLE_NOTEBOOK_ICONS[id] ?? "📓", favorite: false, trashedAt: null,
    createdAt: timestamp, updatedAt: timestamp, revision: 0,
  });

  return {
    version: 1,
    pages: [
      page(EXAMPLE_NOTEBOOK_PAGE_IDS.start, "Start here", null, -100, [
        block("start-intro", "paragraph", "A little space for the words, grammar, and examples you want to make your own. This notebook is a hands-on tour: everything here is editable."),
        block("start-tip", "callout", "Try a few things, keep what helps, and use Delete example notebook above when you’re done.", { icon: "→" }),
        heading("start-tour", "Take a two-minute tour"),
        block("start-context-intro", "paragraph", [bold("1. Connect your learning"), text(" — open a real word card, edit a shared sentence, and see it update in another page.")]),
        pageLink("start-context", EXAMPLE_NOTEBOOK_PAGE_IDS.context),
        block("start-playground-intro", "paragraph", [bold("2. Make it yours"), text(" — try formatting, checklists, tables, and a few small writing exercises.")]),
        pageLink("start-playground", EXAMPLE_NOTEBOOK_PAGE_IDS.playground),
        heading("start-routine", "Build your own notebook"),
        block("start-create", "checkListItem", [text("Choose "), bold("New page"), text(" in the sidebar, or return to "), bold("Notebooks"), text(" for a grammar, lesson, or reading template.")], { checked: false }),
        block("start-nest", "checkListItem", [text("Use "), bold("Page options → Add nested page"), text(" to keep related notes together. These two tour pages are already nested under Start here.")], { checked: false }),
        block("start-star", "checkListItem", "Star a page in the top bar to keep it in Favorites. Try starring this one.", { checked: false }),
        heading("start-organization", "Find a home for every idea"),
        block("start-search", "bulletListItem", [bold("Search"), text(" the sidebar for page titles, writing, or linked sentence text. Try “mountain” after opening the context example.")]),
        block("start-move", "bulletListItem", [bold("Move page"), text(" changes its parent. "), bold("Duplicate page"), text(" makes an editable copy and keeps its sentence references connected.")]),
        block("start-links", "bulletListItem", [bold("Page link"), text(" connects two notes. The destination lists incoming links at the bottom, so you can follow the thought back.")]),
        heading("start-saving", "Saved, and easy to take with you"),
        block("start-autosave", "paragraph", [text("Writing saves automatically; look for "), bold("Saved"), text(" in the top bar. Connected accounts keep notes private and available across browsers. In demo mode, notes stay in this browser.")]),
        block("start-exports", "bulletListItem", [bold("Export Markdown"), text(" in Page options downloads this page. "), bold("Export notebooks"), text(" in the sidebar downloads all your notebook data as JSON.")]),
        block("start-trash", "bulletListItem", [bold("Move to Trash"), text(" keeps a page recoverable. Open "), bold("Trash"), text(" to restore it or delete it permanently; deleting a parent includes its nested pages.")]),
        block("start-care", "toggleListItem", "A few useful details", undefined, [
          block("start-keep", "paragraph", "Want to keep a sample as your own? Choose Duplicate page before deleting the example notebook. Delete example notebook removes the three original tour pages; your other pages stay."),
          block("start-recovery", "paragraph", "If saving fails, your writing stays in a local draft. If another tab changes the same page, you can keep your draft as a new page or load the saved version."),
          block("start-storage", "paragraph", "Your notebook has a text allowance, and pages in Trash still count. Text and links keep these notebooks small; attachments are not stored."),
          block("start-pin", "paragraph", "To reach your notes faster, add Notebooks to the desktop navigation in Settings. It is always available in More."),
        ]),
      ]),
      page(EXAMPLE_NOTEBOOK_PAGE_IDS.context, "Japanese in context", EXAMPLE_NOTEBOOK_ROOT_ID, 0, [
        block("context-intro", "paragraph", "One word, a useful pattern, and an example you can reuse. This is what a small grammar note can look like."),
        heading("context-word-title", "Begin with a word"),
        block("context-word", "vocabulary", undefined, { subjectId: EXAMPLE_NOTEBOOK_SUBJECT.id, label: EXAMPLE_NOTEBOOK_SUBJECT.label }),
        block("context-mention", "paragraph", [text("Hover over the word above or this inline mention of "), mention(), text(" for a preview. Click to open its details in a new tab. Add radicals, kanji, or vocabulary with "), bold("Word"), text(" or type "), code("@"), text(" followed by a character, reading, or meaning.")]),
        heading("context-subject-types", "Radicals and kanji belong here, too"),
        block("context-radical", "vocabulary", undefined, { subjectId: EXAMPLE_NOTEBOOK_RADICAL.id, label: EXAMPLE_NOTEBOOK_RADICAL.label }),
        block("context-kanji", "vocabulary", undefined, { subjectId: EXAMPLE_NOTEBOOK_KANJI.id, label: EXAMPLE_NOTEBOOK_KANJI.label }),
        block("context-subject-types-tip", "paragraph", [text("Blue marks a radical, like "), mention(EXAMPLE_NOTEBOOK_RADICAL), text(" (Ground). Pink marks a kanji, like "), mention(EXAMPLE_NOTEBOOK_KANJI), text(" (Mountain); the purple "), mention(), text(" above is vocabulary. The kanji and word have separate cards and readings—hover to compare them.")]),
        block("context-subject-filters", "paragraph", [text("Try "), bold("Word → Radicals"), text(" or "), bold("Kanji"), text(" to filter your search. Select "), bold("Insert within the text"), text(" for an inline reference like these. Every subject opens in a new tab when clicked.")]),
        heading("context-rule-title", "A pattern to notice"),
        block("context-rule", "callout", [bold("Noun + が見えます"), text(" — say that something is visible, or that you can see it.")], { icon: "文" }),
        sentence("context-sentence"),
        block("context-sentence-tip", "paragraph", [text("Open "), bold("Translation"), text(" to check the meaning. The speaker reads the Japanese aloud when your browser supports speech. The pencil edits the Japanese, kana, translation, and linked words.")]),
        heading("context-sync-title", "Change it once, see it everywhere"),
        block("context-sync-one", "numberedListItem", "Edit this sentence’s English translation with the pencil and save.", { start: 1 }),
        block("context-sync-two", "numberedListItem", "Open Writing playground below. Its linked sentence shows the same change.", { start: 2 }),
        block("context-sync-three", "numberedListItem", "Open 山 and find the Notebook section. You can edit the sentence there too; both pages stay connected.", { start: 3 }),
        pageLink("context-playground", EXAMPLE_NOTEBOOK_PAGE_IDS.playground),
        heading("context-capture-title", "Collect examples as you study"),
        block("context-capture", "bulletListItem", [text("On a word card, choose "), bold("Add to notebook"), text(" in the Notebook section to save the word. Pick an existing page or create one without losing your place. To collect examples, use "), bold("Sentence"), text(" in your notebook.")]),
        block("context-review", "bulletListItem", "The same capture tools are in subject details during lessons and reviews. After revealing a sentence in context practice, you can add that example directly."),
        block("context-picker", "bulletListItem", [text("Choose "), bold("Sentence"), text(" above to search saved and built-in examples, or write your own. Add it to one or more word cards in the sentence editor.")]),
        block("context-practice", "paragraph", [text("On a linked word card, choose "), bold("Practice context sentences"), text(" to practice your examples alongside its existing sentences. A linked word must appear in the Japanese text to become a fill-in-the-blank question.")]),
        block("context-personal", "toggleListItem", "What stays connected?", undefined, [
          block("context-shared", "paragraph", "A linked sentence is one saved example shared by every page and word card that uses it. Removing its block from a page removes only that reference."),
          block("context-built-in", "paragraph", "Capturing a built-in example creates your own editable copy. The original vocabulary example stays as it was."),
          block("context-delete", "paragraph", "To delete a shared example completely, remove its page references first, including any in Trash. Then use Delete in the Existing sentences picker or Delete sentence on its word card."),
          block("context-mnemonics", "paragraph", "Use this space for grammar, context, and connections. Meaning and Reading notes on your cards still have their own place for memory cues."),
        ]),
        pageLink("context-back", EXAMPLE_NOTEBOOK_ROOT_ID),
      ]),
      page(EXAMPLE_NOTEBOOK_PAGE_IDS.playground, "Writing playground", EXAMPLE_NOTEBOOK_ROOT_ID, 1, [
        block("play-intro", "paragraph", "Try editing anything on this page. Type / on a new line to see the block menu; use the handle beside a block to move it or change its type."),
        heading("play-format-title", "Make a little emphasis go a long way"),
        block("play-formats", "paragraph", [text("Select some text for "), bold("bold"), text(", "), text("italic", { italic: true }), text(", "), text("underline", { underline: true }), text(", or "), text("strikethrough", { strike: true }), text(". Use "), text("color", { textColor: "blue" }), text(" or a "), text("highlight", { backgroundColor: "yellow" }), text(" for a key idea, and "), code("inline code"), text(" for a pattern.")]),
        block("play-shortcuts", "paragraph", [text("Try "), code("⌘/Ctrl + B"), text(" for bold, "), code("⌘/Ctrl + I"), text(" for italics, and "), code("⌘/Ctrl + Z"), text(" to undo. Paste a link or select text to add one, like "), link("open the notebooks overview", "/notebooks"), text(".")]),
        block("play-heading-three", "heading", "A smaller heading for a smaller thought", { level: 3 }),
        block("play-heading-tip", "paragraph", "Use headings to give a long note structure. Change a heading’s level from the block menu, or choose a heading from the slash menu."),
        block("play-divider", "divider"),
        heading("play-lists-title", "Turn an idea into a small practice"),
        block("play-bullet", "bulletListItem", "Things I noticed today", undefined, [
          block("play-nested-bullet", "bulletListItem", "山 can be a word card, an inline mention, or part of a linked sentence."),
          block("play-nesting-tip", "bulletListItem", "Indent a list item with Tab; use Shift + Tab to move it back."),
        ]),
        block("play-done", "checkListItem", "Open a notebook and try one thing.", { checked: true }),
        block("play-check", "checkListItem", "Write one example from my own day.", { checked: false }),
        block("play-next", "checkListItem", "Read it aloud, then hide the translation and try again.", { checked: false }),
        block("play-toggle", "toggleListItem", "Open this toggle for a writing prompt", undefined, [
          block("play-prompt", "paragraph", "What can you see from your window? Write a sentence below using が見えます."),
          block("play-quote", "quote", "A short sentence that belongs to your day is a good place to begin."),
          block("play-answer", "paragraph", "My example: "),
        ]),
        heading("play-table-title", "Compare patterns side by side"),
        {
          id: "example-play-table", type: "table", content: {
            type: "tableContent", headerRows: 1, rows: [
              { cells: [[bold("Pattern")], [bold("Example")]] },
              { cells: [[text("Something is visible")], [text("山が見えます。")]] },
              { cells: [[text("Something is audible")], [text("音が聞こえます。")]] },
            ],
          },
        },
        block("play-table-tip", "paragraph", [text("Edit any cell. Use the table controls to add rows or columns. For a wider comparison, try "), bold("Page options → Full width"), text(".")]),
        block("play-code", "codeBlock", "noun + が + 見えます\nnoun + が + 聞こえます", { language: "text" }),
        block("play-code-tip", "paragraph", "A code block keeps a formula or plain-text reference together. A quote block works well for a passage you want to reflect on."),
        block("play-heading-toggle", "heading", "A heading can fold, too", { level: 3, isToggleable: true }, [
          block("play-heading-toggle-tip", "paragraph", "Toggle headings help a long grammar page stay easy to scan. Open or close this section with its arrow."),
        ]),
        heading("play-linked-title", "The same sentence, in a new place"),
        sentence("play-linked-sentence"),
        block("play-linked-tip", "paragraph", "This is the example from Japanese in context. Edit it here and check the other page: both use the same saved sentence."),
        pageLink("play-context", EXAMPLE_NOTEBOOK_PAGE_IDS.context),
        pageLink("play-back", EXAMPLE_NOTEBOOK_ROOT_ID),
      ]),
    ],
    sentences: [{
      id: EXAMPLE_NOTEBOOK_SENTENCE_ID,
      japanese: "山が見えます。",
      kana: "やまがみえます。",
      english: "I can see a mountain.",
      subjectIds: [EXAMPLE_NOTEBOOK_SUBJECT.id],
      createdAt: timestamp, updatedAt: timestamp, revision: 0,
    }],
  };
}
