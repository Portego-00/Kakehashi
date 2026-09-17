const fs = require("node:fs");
const path = require("node:path");

const [repoRoot, buildDir] = process.argv.slice(2);
if (!repoRoot || !buildDir) throw new Error("Expected repository and build directories");
const ts = require(require.resolve("typescript", { paths: [repoRoot] }));
const sourcePath = path.join(repoRoot, "src/components/ReviewQuestionScreen.tsx");
const source = fs.readFileSync(sourcePath, "utf8");
const ast = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = [
  "reviewInteractionPane", "characterScrollView", "characterWrapper", "characterWrapperWithOpenHint", "characterContainer",
  "ankiCardContainer", "ankiAnswerContainer", "ankiContentSizedPrompt", "ankiContentSizedCard",
  "ankiContentSizedPane", "ankiContextHintPrompt",
  "ankiButtonlessNaturalHeight",
  "banner", "ankiContentContainer", "ankiAnswerScroll", "ankiAnswerSection", "ankiButtonSection",
];
const styles = {};
const attachments = new Map([
  ["reviewInteractionPane", "ankiContentSizedPane"],
  ["characterScrollView", "ankiContentSizedPrompt"],
  ["ankiCardContainer", "ankiContentSizedCard"],
  ["ankiAnswerContainer", "ankiContentSizedCard"],
]);
let revealedMinHeight;
let unrevealedMinHeight;
let contentSizedCondition;
let hintSizingAttached = false;

function literal(node) {
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) {
    return -literal(node.operand);
  }
  throw new Error(`Unsupported nonliteral style value: ${node.getText(ast)}`);
}

function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "styles") {
    for (const property of node.initializer.arguments[0].properties) {
      const name = property.name?.getText(ast);
      if (!names.includes(name)) continue;
      if (!ts.isObjectLiteralExpression(property.initializer)) {
        throw new Error(`Style ${name} must be a plain object`);
      }
      styles[name] = Object.fromEntries(property.initializer.properties.map((entry) =>
        [entry.name.getText(ast), literal(entry.initializer)],
      ));
    }
  }
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "ankiContainerStyle") {
    function findInterpolation(child) {
      if (ts.isCallExpression(child) && child.expression.getText(ast) === "interpolate") {
        revealedMinHeight = literal(child.arguments[2].elements.at(-1));
        unrevealedMinHeight = literal(child.arguments[2].elements[0]);
      }
      ts.forEachChild(child, findInterpolation);
    }
    findInterpolation(node);
  }
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "useContentSizedAnkiCard") {
    contentSizedCondition = node.initializer;
  }
  // Fail if a sizing override survives in StyleSheet but is detached from the UI.
  if (ts.isJsxAttribute(node) && node.name.getText(ast) === "style") {
    const expression = node.initializer?.expression;
    if (expression && ts.isArrayLiteralExpression(expression)) {
      const values = expression.elements.map((entry) => entry.getText(ast));
      if (values.includes("styles.characterScrollView") &&
        values.includes("useContentSizedAnkiCard && isContextHintVisible && styles.ankiContextHintPrompt")) {
        hintSizingAttached = true;
      }
      for (const [base, override] of attachments) {
        if (values.includes(`styles.${base}`) &&
          values.includes(`useContentSizedAnkiCard && styles.${override}`)) {
          attachments.delete(base);
        }
      }
    }
  }
  ts.forEachChild(node, visit);
}
visit(ast);
for (const name of names) if (!styles[name]) throw new Error(`Missing style ${name}`);
if (attachments.size) throw new Error(`Missing revealed sizing attachments: ${[...attachments.keys()].join(", ")}`);
if (!hintSizingAttached) throw new Error("Missing context-hint sizing attachment");
if (!Number.isFinite(revealedMinHeight)) throw new Error("Missing revealed answer min-height interpolation");
if (!Number.isFinite(unrevealedMinHeight)) throw new Error("Missing unrevealed answer min-height interpolation");
if (!contentSizedCondition) throw new Error("Missing Anki sizing condition");

function booleanExpression(node) {
  if (ts.isIdentifier(node)) {
    const value = {
      effectiveAnkiCardMode: "true",
      isCurrentQuestionAnkiRevealed: "revealed",
      effectiveAnkiButtonlessMode: "buttonless",
    }[node.text];
    if (value) return value;
  }
  if (ts.isParenthesizedExpression(node)) return `(${booleanExpression(node.expression)})`;
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) {
    return `!${booleanExpression(node.operand)}`;
  }
  if (ts.isBinaryExpression(node) &&
    [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken].includes(node.operatorToken.kind)) {
    return `(${booleanExpression(node.left)} ${node.operatorToken.getText(ast)} ${booleanExpression(node.right)})`;
  }
  throw new Error(`Unsupported Anki sizing condition: ${node.getText(ast)}`);
}

const pascal = (value) => value.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join("");
function setter(key, value) {
  if (["flex", "flexGrow", "flexShrink", "width", "height", "minHeight", "minWidth", "maxHeight", "maxWidth"].includes(key)) {
    if (typeof value === "string" && value.endsWith("%")) {
      return `YGNodeStyleSet${pascal(key)}Percent(node, ${parseFloat(value)});`;
    }
    return `YGNodeStyleSet${pascal(key)}(node, ${value});`;
  }
  if (key === "flexBasis") {
    return value === "auto" ? "YGNodeStyleSetFlexBasisAuto(node);" : `YGNodeStyleSetFlexBasis(node, ${value});`;
  }
  const enums = {
    flexDirection: ["FlexDirection", "YGFlexDirection"], justifyContent: ["JustifyContent", "YGJustify"],
    alignItems: ["AlignItems", "YGAlign"], alignSelf: ["AlignSelf", "YGAlign"],
    position: ["PositionType", "YGPositionType"], overflow: ["Overflow", "YGOverflow"],
  };
  if (enums[key]) return `YGNodeStyleSet${enums[key][0]}(node, ${enums[key][1]}${pascal(value)});`;
  const edge = /^(padding|margin)(Top|Right|Bottom|Left|Horizontal|Vertical)?$/.exec(key);
  if (edge) return `YGNodeStyleSet${pascal(edge[1])}(node, YGEdge${edge[2] ?? "All"}, ${value});`;
  if (key === "gap") return `YGNodeStyleSetGap(node, YGGutterAll, ${value});`;
  if ((key.startsWith("border") && key.endsWith("Radius")) || key === "backgroundColor") return "";
  throw new Error(`Unhandled style ${key}: ${value}; account for it before trusting this harness`);
}

const header = names.map((name) => `void apply_${name}(YGNodeRef node) {\n${
  Object.entries(styles[name]).map(([key, value]) => setter(key, value)).filter(Boolean)
    .map((line) => `  ${line}`).join("\n")
}\n}`).join("\n");
fs.writeFileSync(path.join(buildDir, "source-styles.h"),
  `constexpr float unrevealedAnswerMinHeight = ${unrevealedMinHeight};\n` +
  `constexpr float revealedAnswerMinHeight = ${revealedMinHeight};\n` +
  `bool contentSizedAnkiCard(bool revealed, bool buttonless) { return ${booleanExpression(contentSizedCondition)}; }\n${header}\n`);
console.log("Read current review styles, sizing condition, and card attachments.");
