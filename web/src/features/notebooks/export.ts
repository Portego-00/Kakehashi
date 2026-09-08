import type { NotebookBlock, NotebookPage, NotebookState } from "./model";

function inlineText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => {
    if (part.type === "link") return `[${inlineText(part.content)}](${part.href})`;
    if (part.type === "vocabularyMention") return `[${part.props?.label || "Word"}](/subjects/${part.props?.subjectId})`;
    if (typeof part.text !== "string") return "";
    let text = part.text;
    if (part.styles?.bold) text = `**${text}**`;
    if (part.styles?.italic) text = `*${text}*`;
    return text;
  }).join("");
}

export function notebookMarkdown(page: NotebookPage, state: NotebookState): string {
  const render = (blocks: NotebookBlock[]): string => blocks.map((block) => {
    let text = inlineText(block.content);
    if (block.type === "heading") text = `${"#".repeat(Number(block.props?.level) || 2)} ${text}`;
    if (block.type === "bulletListItem") text = `- ${text}`;
    if (block.type === "numberedListItem") text = `1. ${text}`;
    if (block.type === "checkListItem") text = `- [${block.props?.checked ? "x" : " "}] ${text}`;
    if (block.type === "quote") text = `> ${text}`;
    if (block.type === "codeBlock") text = `\`\`\`${block.props?.language || ""}\n${text}\n\`\`\``;
    if (block.type === "vocabulary") text = `[${block.props?.label || "Word"}](/subjects/${block.props?.subjectId})`;
    if (block.type === "pageLink") text = `[${state.pages.find((item) => item.id === block.props?.pageId)?.title || "Page"}](/notebooks/${block.props?.pageId})`;
    if (block.type === "sentence") {
      const sentence = state.sentences.find((item) => item.id === block.props?.sentenceId);
      text = sentence ? [sentence.japanese, sentence.kana, sentence.english].filter(Boolean).join("  \n") : "";
    }
    if (block.type === "table" && block.content && !Array.isArray(block.content) && typeof block.content === "object" && "rows" in block.content) {
      text = block.content.rows.map((row, index) => {
        const cells = row.cells.map((cell) => inlineText(Array.isArray(cell) ? cell : cell.content));
        return `| ${cells.join(" | ")} |${index === 0 ? `\n| ${cells.map(() => "---").join(" | ")} |` : ""}`;
      }).join("\n");
    }
    return text + (block.children?.length ? `\n${render(block.children)}` : "");
  }).join("\n\n");
  return `# ${page.title || "Untitled"}\n\n${render(page.content)}\n`;
}

export function downloadNotebook(filename: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.replace(/[<>:"/\\|?*]/g, "-");
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
