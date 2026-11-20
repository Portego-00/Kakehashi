function attribute(tag: string, name: string) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(new RegExp(`\\s${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"));
  return match?.[1] ?? match?.[2] ?? null;
}

export function extractMnemonicImageUrl(html: string) {
  // WaniKani includes empty component templates before the subject's image.
  const components = html.match(/<wk-mnemonic-image\b[^>]*>/gi) ?? [];
  for (const component of components) {
    const src = attribute(component, "src")?.trim().replace(/^@/, "").trim();
    if (src) return src;
  }

  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    if (!attribute(tag, "class")?.split(/\s+/).includes("subject-mnemonic-image__image")) continue;
    const src = attribute(tag, "src")?.trim().replace(/^@/, "").trim();
    if (src) return src;
  }
  return null;
}
