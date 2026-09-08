import type { NotebookBlock } from "./model";

type Template = { id: string; title: string; icon: string; description: string; blocks: Array<{ type: string; text: string; level?: number }> };
export const NOTEBOOK_TEMPLATES: Template[] = [
  { id: "blank", title: "Empty page", icon: "📓", description: "Start with a clean page", blocks: [] },
  { id: "grammar", title: "Grammar note", icon: "文", description: "Patterns, examples, and exceptions", blocks: [
    { type: "heading", text: "How it works", level: 2 },
    { type: "paragraph", text: "" },
    { type: "heading", text: "Examples", level: 2 },
    { type: "paragraph", text: "Type /sentence to connect an example to your vocabulary cards." },
    { type: "heading", text: "Things to remember", level: 2 },
    { type: "bulletListItem", text: "" },
  ] },
  { id: "lesson", title: "Lesson notes", icon: "📖", description: "Keep a lesson's words and ideas together", blocks: [
    { type: "heading", text: "What I learned", level: 2 }, { type: "paragraph", text: "" },
    { type: "heading", text: "Words to use", level: 2 }, { type: "paragraph", text: "Type /word to link a word from your vocabulary." },
    { type: "heading", text: "My examples", level: 2 }, { type: "paragraph", text: "" },
    { type: "heading", text: "Questions for next time", level: 2 }, { type: "checkListItem", text: "" },
  ] },
  { id: "reading", title: "Reading journal", icon: "栞", description: "Collect language from what you read", blocks: [
    { type: "heading", text: "Source", level: 2 }, { type: "paragraph", text: "" },
    { type: "heading", text: "Phrases worth keeping", level: 2 }, { type: "paragraph", text: "" },
    { type: "heading", text: "In my own words", level: 2 }, { type: "paragraph", text: "" },
  ] },
];

export function templateContent(id: string): NotebookBlock[] {
  return (NOTEBOOK_TEMPLATES.find((template) => template.id === id)?.blocks ?? []).map((block) => ({
    id: crypto.randomUUID(), type: block.type,
    ...(block.level ? { props: { level: block.level } } : {}),
    content: [{ type: "text" as const, text: block.text, styles: {} }],
  }));
}
