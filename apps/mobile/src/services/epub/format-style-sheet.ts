import parseCss from "./css-parser/css-parser";
import stringifyCss from "./css-parser/css-stringify";
import type { Declaration, Rule } from "./css-parser/types";

const HTML_REGEX = /\s?html\s?/gi;
const BODY_REGEX = /\s?body\s?/gi;

export default function formatStyleSheet(styleSheet: string, parentSelector: string): string {
  if (!styleSheet.trim()) {
    return "";
  }

  let cssTree;
  try {
    cssTree = parseCss(styleSheet);
  } catch {
    return styleSheet;
  }

  const newRules = cssTree.stylesheet.rules
    .filter((rule) => rule.type === "rule")
    .filter((rule) => !rule.selectors.some((selector) => HTML_REGEX.test(selector) || BODY_REGEX.test(selector)));

  newRules.forEach((rule) => {
    const newDeclarations: Record<string, string> = {};

    rule.declarations = rule.declarations.filter(
      (declaration) => !/line-height$/.test(declaration.property) && !/text-indent$/.test(declaration.property)
    );

    const lineBreakFormatter = new LineBreakFormatter(rule.declarations, newDeclarations);

    rule.declarations.forEach((declaration) => {
      assignKeyValToObj(newDeclarations, convertPrefixedDeclaration(declaration));
      assignKeyValToObj(newDeclarations, convertFontFamily(declaration));
      assignKeyValToObj(newDeclarations, lineBreakFormatter.convert(declaration));
    });

    Object.entries(newDeclarations).forEach(([property, value]) => {
      rule.declarations.push({
        type: "declaration",
        property,
        value,
      });
    });

    rule.declarations = rule.declarations.filter((declaration) => !/writing-mode\s*$/.test(declaration.property));
  });

  newRules.push(getGeckoBrSolutionRule());

  newRules.forEach((rule) => {
    rule.selectors = encapsulatedSelectors(rule.selectors, parentSelector);
  });

  return stringifyCss({
    stylesheet: {
      rules: newRules,
    },
    type: "stylesheet",
  });
}

function encapsulatedSelectors(selectors: string[], parentSelector: string): string[] {
  return selectors.map((selector) => `${parentSelector} ${selector}`);
}

function assignKeyValToObj(
  obj: Record<string, string>,
  keyValObj:
    | {
        key: string;
        value: string;
      }
    | undefined
): Record<string, string> {
  if (keyValObj) {
    obj[keyValObj.key] = keyValObj.value;
  }

  return obj;
}

function convertPrefixedDeclaration(declaration: Declaration):
  | {
      key: string;
      value: string;
    }
  | undefined {
  const regexResult = /(?:(?:-epub-)|(?:-webkit-))(.+)/i.exec(declaration.property);
  if (!regexResult) {
    return undefined;
  }

  return {
    key: regexResult[1],
    value: declaration.value,
  };
}

function convertFontFamily(declaration: Declaration):
  | {
      key: string;
      value: string;
    }
  | undefined {
  if (declaration.property !== "font-family") {
    return undefined;
  }

  let newValue = declaration.value;
  if (newValue.includes("sans-serif")) {
    newValue = "var(--font-family-sans-serif, Noto Sans JP, sans-serif)";
  } else if (newValue.includes("serif")) {
    newValue = "var(--font-family-serif, Noto Serif JP, serif)";
  }

  return {
    key: declaration.property,
    value: newValue,
  };
}

class LineBreakFormatter {
  private hasLineBreakDefined?: boolean;

  constructor(
    private ruleDeclarations: Declaration[],
    private newDeclarations: Readonly<Record<string, string>>
  ) {}

  convert(declaration: Declaration):
    | {
        key: string;
        value: string;
      }
    | undefined {
    if (
      /(?:(?:-epub-)|(?:-webkit-))?word-break$/i.exec(declaration.property) &&
      declaration.value === "break-all"
    ) {
      if (this.hasLineBreakDefined === undefined) {
        this.hasLineBreakDefined = this.ruleDeclarations.some(
          (ruleDeclaration) =>
            ruleDeclaration.type === "declaration" && ruleDeclaration.property === "line-break"
        );
      }

      if (!this.hasLineBreakDefined && !this.newDeclarations["line-break"]) {
        return {
          key: "line-break",
          value: "loose",
        };
      }
    }

    return undefined;
  }
}

function getGeckoBrSolutionRule(): Rule {
  return {
    type: "rule",
    selectors: ["br"],
    declarations: [
      {
        type: "declaration",
        property: "display",
        value: "inline!important",
      },
    ],
  };
}
