function attribute(tag: string, name: string) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(new RegExp(`\\s${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"));
  return match?.[1] ?? match?.[2] ?? null;
}

export function extractMnemonicImageUrl(html: string) {
  const component = html.match(/<wk-mnemonic-image\b[^>]*>/i)?.[0];
  if (component) return attribute(component, "src")?.replace(/^@/, "") ?? null;

  const fallback = (html.match(/<img\b[^>]*>/gi) ?? []).find((tag) =>
    attribute(tag, "class")?.split(/\s+/).includes("subject-mnemonic-image__image"),
  );
  return fallback ? attribute(fallback, "src")?.replace(/^@/, "") ?? null : null;
}
