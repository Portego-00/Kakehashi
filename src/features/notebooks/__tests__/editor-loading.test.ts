/** @jest-environment jsdom */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getNotebookStartupScript } from "../editor-loading";

const editorStyles = readFileSync(join(__dirname, "../mobile-editor.css"), "utf8");

function loadEditorStyles() {
  const style = document.createElement("style");
  style.textContent = editorStyles;
  document.head.append(style);
}

describe("notebook theme before the editor mounts", () => {
  beforeEach(() => {
    document.head.replaceChildren();
    document.body.replaceChildren();
    document.documentElement.removeAttribute("style");
    delete document.documentElement.dataset.notebookTheme;
  });

  afterEach(() => jest.restoreAllMocks());

  it("selects dark colors before React runs or the stylesheet loads", () => {
    const root = document.documentElement;
    // JSDOM 20 does not parse var() in inline color properties. Capture the
    // browser assignment here; the native smoke test verifies its painted color.
    const background = jest.spyOn(root.style, "backgroundColor", "set");
    window.eval(getNotebookStartupScript("dark", "#1e1e1e"));

    expect(root.dataset.notebookTheme).toBe("dark");
    expect(root.style.colorScheme).toBe("dark");
    expect(background).toHaveBeenCalledWith("var(--nb-bg, #1e1e1e)");
    expect(root.style.getPropertyValue("--nb-bg")).toBe("");

    loadEditorStyles();
    expect(window.getComputedStyle(root).getPropertyValue("--nb-bg").trim()).toBe("#1e1e1e");
  });

  it("honors a light app theme even when the device prefers dark mode", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: jest.fn((query: string) => ({ matches: query === "(prefers-color-scheme: dark)" })),
    });
    window.eval(getNotebookStartupScript("light", "#ffffff"));
    loadEditorStyles();

    expect(document.documentElement.dataset.notebookTheme).toBe("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(window.getComputedStyle(document.documentElement).getPropertyValue("--nb-bg").trim()).toBe("#fff");
  });

  it("leaves CSS theme variables free to follow later theme changes", () => {
    window.eval(getNotebookStartupScript("dark", "#0A0A0A"));
    loadEditorStyles();
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--nb-bg")).toBe("");

    root.dataset.notebookTheme = "light";
    root.style.colorScheme = "light";
    expect(window.getComputedStyle(root).getPropertyValue("--nb-bg").trim()).toBe("#fff");
  });

  it("applies the theme when the document root arrives after the startup script", async () => {
    const root = document.documentElement;
    document.removeChild(root);
    try {
      window.eval(getNotebookStartupScript("dark", "#1e1e1e"));
      document.appendChild(root);
      await Promise.resolve();
      expect(root.dataset.notebookTheme).toBe("dark");
      expect(root.style.colorScheme).toBe("dark");
    } finally {
      if (!document.documentElement) document.appendChild(root);
    }
  });
});
