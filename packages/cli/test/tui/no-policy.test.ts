// No policy in the TUI (card E8.15c, docs/design/tui.md 4.8, 6.3, 10.1 and
// 13; AGENTS.md rule 1). No file under packages/cli/src/tui names a policy
// rule id, a preset or remedy text, and none reads a reason or a policy id to
// decide anything: every decision on screen is the field the answer carried.
// The forbidden lists come from core itself: its preset names (PRESETS and
// EXTRA_PRESETS) and every rule id its source writes (`engram/<area>/<rule>`),
// with the `preset.` prefix every preset's policy id starts with.
//
// Since the review fix pass the guard reads the TypeScript syntax tree
// (finding 5): a reason, a policy id or an admitting rule may be used only as
// an argument of a display helper (oneLine, safe, cut, fit, para, wrap) or in
// a template literal, so a branch on one, a method called on one, a local
// holding one or a comparison with one fails; every string the source writes,
// a concatenation of literals folded, is checked against the lists and for
// remedy wording. The reviewer's five survivors are run through it below.
//
// Since the final review (F-8) it walks @engram/view too, which every TUI
// screen and the inspector draw through: a branch on a reason there would
// reach them all. A view also carries a decision field unread, into a field
// of a decision field's name (`policyId: r.event.policy_id`), whose every
// use the guard then checks by that name, or as the value of a labelled row
// (`["reason", e.reason]`), which is drawn. Its one search of reasons, for
// the text the person typed (findInReasons, the Events screen's find), is
// pinned by name in SEARCHES, never marked in the source.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative } from "node:path";
import { EXTRA_PRESETS, PRESETS } from "@engram/core";
import type * as TS from "typescript";
import { describe, expect, it } from "vitest";
import { REPO } from "../helpers.ts";

// The compiler API is TypeScript 5's; the native 7 that `make lint` runs does not ship it (docs/deps.md).
const ts = createRequire(join(REPO, "packages", "cli", "package.json"))("typescript") as typeof TS;

const TUI = join(REPO, "packages", "cli", "src", "tui");
/** @engram/view, which every TUI screen and the inspector draw through (final review F-8). */
const VIEW = join(REPO, "packages", "view", "src");
const CORE = join(REPO, "packages", "core", "src");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".ts") ? [p] : [];
  });
}

const sources = [...files(TUI), ...files(VIEW)].map((p) => ({
  path: relative(REPO, p).split("\\").join("/"),
  text: readFileSync(p, "utf8"),
}));

/** Every rule id core's source writes, `engram/write/membership` and the rest. */
const RULE_IDS = [
  ...new Set(
    files(CORE).flatMap((p) =>
      [...readFileSync(p, "utf8").matchAll(/engram\/[a-z-]+\/[a-z-]+/g)].map((m) => m[0]),
    ),
  ),
].sort();
/** The areas those ids are in: `engram/write/`, `engram/promote/` and the rest. */
const RULE_AREAS = [...new Set(RULE_IDS.map((id) => `${id.split("/").slice(0, 2).join("/")}/`))];
const PRESET_NAMES = [...PRESETS, ...EXTRA_PRESETS];

/** Advice a screen must never give from a reason or a rule id (docs/design/tui.md 10.1). */
const REMEDIES = [
  "use this class",
  "ask this person",
  "try semantic",
  "try episodic",
  "you should",
  "instead, use",
  "choose semantic",
  "a reviewer could approve",
];
/** Remedy wording: an instruction naming a class, or sending the person to someone. */
const REMEDY_PATTERNS = [
  /\b(try|use|choose|pick|switch to|change (it )?to|make it)\b[^.;]*\b(episodic|semantic|procedural)\b/i,
  /\bask (a|an|the|your) (reviewer|owner|admin|administrator)\b/i,
];

/** The decision fields of an answer, which the TUI shows and never reads. */
const DECISION_FIELDS = new Set(["reason", "policy_id", "policyId", "admittedBy", "admitted_by"]);
/** The helpers that only draw text. */
const DISPLAY = new Set(["oneLine", "safe", "cut", "fit", "para", "wrap", "firstLines"]);

/** What a string in the source says that a screen must not: a rule id, a preset, a remedy. */
function badString(value: string): string | undefined {
  for (const area of RULE_AREAS) if (value.includes(area)) return `rule area ${area}`;
  if (/\bpreset\.[a-z]/.test(value)) return "a preset's policy id";
  for (const name of PRESET_NAMES)
    if (new RegExp(`\\b${name}\\b`, "i").test(value)) return `preset ${name}`;
  const lower = value.toLowerCase();
  for (const r of REMEDIES) if (lower.includes(r)) return `remedy "${r}"`;
  for (const p of REMEDY_PATTERNS) if (p.test(value)) return `remedy wording ${p}`;
  return undefined;
}

/** A `+` chain of string literals, folded; undefined when any part is not a literal. */
function folded(node: TS.Node): string | undefined {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isParenthesizedExpression(node)) return folded(node.expression);
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const l = folded(node.left);
    const r = folded(node.right);
    return l === undefined || r === undefined ? undefined : l + r;
  }
  return undefined;
}

/** The node that consumes an expression: past parentheses, `!`, `as` and optional chains. */
function consumer(node: TS.Node): { parent: TS.Node; child: TS.Node } {
  let child = node;
  let parent = node.parent;
  while (
    ts.isParenthesizedExpression(parent) ||
    ts.isNonNullExpression(parent) ||
    ts.isAsExpression(parent)
  ) {
    child = parent;
    parent = parent.parent;
  }
  return { parent, child };
}

/** A property assignment whose name is a decision field's: a decision carried, unread, under its own kind of name. */
function carriedAs(node: TS.Node): boolean {
  let { parent, child } = consumer(node);
  // `admittedBy: e?.policy_id ?? null`: none is carried as null.
  if (
    ts.isBinaryExpression(parent) &&
    parent.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken &&
    parent.left === child &&
    parent.right.kind === ts.SyntaxKind.NullKeyword
  )
    ({ parent, child } = consumer(parent));
  return (
    ts.isPropertyAssignment(parent) &&
    parent.initializer === child &&
    (ts.isIdentifier(parent.name) || ts.isStringLiteral(parent.name)) &&
    DECISION_FIELDS.has(parent.name.text)
  );
}

/** A labelled row, `["reason", e.reason]`: a string label and the value it labels, drawn. */
function labelledRow(parent: TS.Node, child: TS.Node): boolean {
  return (
    ts.isArrayLiteralExpression(parent) &&
    parent.elements.length === 2 &&
    parent.elements[1] === child &&
    ts.isStringLiteral(parent.elements[0] as TS.Node)
  );
}

/** Whether a decision field read at `node` is only drawn: a display helper's argument or a template's, carried or labelled. */
function onlyDrawn(node: TS.Node): boolean {
  if (carriedAs(node)) return true;
  const { parent, child } = consumer(node);
  if (ts.isTemplateSpan(parent)) return true;
  if (labelledRow(parent, child)) return true;
  if (ts.isCallExpression(parent) && parent.arguments.includes(child as TS.Expression)) {
    const callee = parent.expression;
    const name = ts.isIdentifier(callee)
      ? callee.text
      : ts.isPropertyAccessExpression(callee)
        ? callee.name.text
        : "";
    return DISPLAY.has(name);
  }
  return false;
}

/** The comparison and membership operators: a decision field's text compared is a decision drawn from it. */
const COMPARING = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
  ts.SyntaxKind.LessThanToken,
  ts.SyntaxKind.GreaterThanToken,
  ts.SyntaxKind.LessThanEqualsToken,
  ts.SyntaxKind.GreaterThanEqualsToken,
  ts.SyntaxKind.InKeyword,
  ts.SyntaxKind.InstanceOfKeyword,
]);

/** The display expression a drawn field ends in: its template, or its helper's call, outward through nested ones. */
function drawnAs(node: TS.Node): TS.Node {
  let e: TS.Node = node;
  for (;;) {
    const { parent, child } = consumer(e);
    if (ts.isTemplateSpan(parent)) e = parent.parent;
    else if (labelledRow(parent, child)) e = parent;
    else if (ts.isCallExpression(parent) && parent.arguments.includes(child as TS.Expression))
      e = parent;
    else return e;
  }
}

/** Whether text drawn from a decision field is then used to decide: a member of it read or called, compared, branched on (N2, gap 2). */
function usedAfterDrawing(node: TS.Node): boolean {
  return decides(drawnAs(node));
}

/** Whether an expression is decided on: a member of it read or called, compared, negated, branched on. */
function decides(node: TS.Node): boolean {
  const { parent, child } = consumer(node);
  if (
    (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) &&
    parent.expression === child
  )
    return true;
  if (ts.isCallExpression(parent) && parent.expression === child) return true;
  if (ts.isBinaryExpression(parent)) {
    const op = parent.operatorToken.kind;
    if (COMPARING.has(op)) return true;
    if (op === ts.SyntaxKind.AmpersandAmpersandToken || op === ts.SyntaxKind.BarBarToken)
      return true;
  }
  if (ts.isPrefixUnaryExpression(parent)) return true;
  if (
    (ts.isIfStatement(parent) || ts.isWhileStatement(parent) || ts.isDoStatement(parent)) &&
    parent.expression === child
  )
    return true;
  if (ts.isConditionalExpression(parent) && parent.condition === child) return true;
  if (ts.isSwitchStatement(parent) && parent.expression === child) return true;
  if (ts.isCaseClause(parent) && parent.expression === child) return true;
  return false;
}

/**
 * The local a drawn decision text, or a decision field itself, is kept in
 * (re-verification 1): `const why = oneLine(p.reason)`. One level of
 * assignment is followed, which is the guard's recorded limit: a second local
 * copied from the first is not.
 */
/** The class a node is in, by name, for the fields its methods share. */
function classOf(node: TS.Node): string | undefined {
  for (let n: TS.Node | undefined = node.parent; n !== undefined; n = n.parent)
    if (ts.isClassDeclaration(n) || ts.isClassExpression(n)) return n.name?.text ?? "<class>";
  return undefined;
}

/**
 * The field of the class a drawn decision text, or a decision field, is kept
 * in: `this.why = oneLine(p.reason)`, or a field declared with it. Its
 * methods share it as a local's code shares a local, so it carries the taint
 * the same one level.
 */
function keptInField(node: TS.Node): string | undefined {
  let { parent, child } = consumer(drawnAs(node));
  if (
    ts.isBinaryExpression(parent) &&
    parent.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
  )
    ({ parent, child } = consumer(parent));
  const cls = classOf(node);
  if (cls === undefined) return undefined;
  if (
    ts.isBinaryExpression(parent) &&
    parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
    parent.right === child &&
    ts.isPropertyAccessExpression(parent.left) &&
    parent.left.expression.kind === ts.SyntaxKind.ThisKeyword
  )
    return `${cls}.${parent.left.name.text}`;
  if (
    ts.isPropertyDeclaration(parent) &&
    parent.initializer === child &&
    ts.isIdentifier(parent.name)
  )
    return `${cls}.${parent.name.text}`;
  return undefined;
}

/** The fields of a file's classes that hold a decision field's text, found before any use is checked. */
function taintedFields(file: TS.SourceFile): Set<string> {
  const out = new Set<string>();
  const walk = (n: TS.Node): void => {
    if (ts.isPropertyAccessExpression(n) && DECISION_FIELDS.has(n.name.text)) {
      const key = keptInField(n);
      if (key !== undefined) out.add(key);
    }
    ts.forEachChild(n, walk);
  };
  walk(file);
  return out;
}

function keptIn(node: TS.Node): TS.Identifier | undefined {
  const { parent, child } = consumer(drawnAs(node));
  if (
    ts.isVariableDeclaration(parent) &&
    parent.initializer === child &&
    ts.isIdentifier(parent.name)
  )
    return parent.name;
  // `const x = p.reason ?? ""` keeps the field too.
  if (
    ts.isBinaryExpression(parent) &&
    parent.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
  ) {
    const up = consumer(parent);
    if (ts.isVariableDeclaration(up.parent) && ts.isIdentifier(up.parent.name))
      return up.parent.name;
  }
  return undefined;
}

/** A key named by a constant: the string its declaration folds to, if it does. */
function constantOf(checker: TS.TypeChecker, key: TS.Expression): string | undefined {
  if (!ts.isIdentifier(key)) return undefined;
  const decl = checker.getSymbolAtLocation(key)?.valueDeclaration;
  return decl !== undefined && ts.isVariableDeclaration(decl) && decl.initializer !== undefined
    ? folded(decl.initializer)
    : undefined;
}

/** The fields a run keeps an answer in, as it came. */
const ANSWER_SLOTS = new Set(["body", "request"]);

/** Whether a type carries a decision field, at any depth up to four: an answer. */
function bearsDecision(
  checker: TS.TypeChecker,
  type: TS.Type,
  depth = 0,
  seen = new Set<TS.Type>(),
): boolean {
  if (depth > 4 || seen.has(type)) return false;
  seen.add(type);
  if (type.isUnion() || type.isIntersection())
    return type.types.some((t) => bearsDecision(checker, t, depth, seen));
  for (const prop of checker.getPropertiesOfType(type)) {
    if (DECISION_FIELDS.has(prop.getName())) return true;
    const decl = prop.valueDeclaration ?? prop.declarations?.[0];
    // An answer kept as it came, a call's body or request (./runner.ts Exchange), is typed unknown: it may hold one.
    if (ANSWER_SLOTS.has(prop.getName()) && decl !== undefined) {
      const t = checker.getTypeOfSymbolAtLocation(prop, decl);
      if ((t.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) !== 0) return true;
    }
    if (
      decl !== undefined &&
      bearsDecision(checker, checker.getTypeOfSymbolAtLocation(prop, decl), depth + 1, seen)
    )
      return true;
  }
  const items = type.getNumberIndexType() ?? type.getStringIndexType();
  return items !== undefined && bearsDecision(checker, items, depth + 1, seen);
}

/** The calls that read an answer whole, as data, never under src/tui (N2, gap 3). */
const WHOLE = new Set(["JSON.stringify", "Object.values", "Object.entries"]);

/** Every place a source decides on a decision field, or writes a string a screen must not. */
function violations(
  path: string,
  text: string,
  program?: { file: TS.SourceFile; checker: TS.TypeChecker },
): string[] {
  const file =
    program?.file ??
    ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const checker = program?.checker;
  const out: string[] = [];
  /** The locals that hold a decision field's text: by symbol with the checker, else by name. */
  const tainted = new Set<TS.Symbol | string>();
  /** The class fields that hold one: `this.why` set from drawn decision text anywhere in its class. */
  const fields = taintedFields(file);
  const at = (n: TS.Node) => `${path}:${file.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;
  const visit = (n: TS.Node): void => {
    const field =
      ts.isPropertyAccessExpression(n) && DECISION_FIELDS.has(n.name.text)
        ? n.name.text
        : ts.isElementAccessExpression(n) &&
            ts.isStringLiteral(n.argumentExpression) &&
            DECISION_FIELDS.has(n.argumentExpression.text)
          ? n.argumentExpression.text
          : undefined;
    if (field !== undefined && !onlyDrawn(n))
      out.push(
        `${at(n)}: .${field} used other than as text drawn: ${n.parent.getText(file).slice(0, 80)}`,
      );
    else if (field !== undefined && usedAfterDrawing(n))
      out.push(
        `${at(n)}: .${field} drawn, then decided on: ${n.parent.parent?.getText(file).slice(0, 80)}`,
      );
    // A local holding drawn decision text, or the field, carries the taint (re-verification 1).
    if (field !== undefined) {
      const local = keptIn(n);
      if (local !== undefined) tainted.add(checker?.getSymbolAtLocation(local) ?? local.text);
    }
    if (ts.isIdentifier(n) && !(ts.isVariableDeclaration(n.parent) && n.parent.name === n)) {
      const key = checker?.getSymbolAtLocation(n) ?? n.text;
      if (tainted.has(key) && decides(n))
        out.push(`${at(n)}: ${n.text}, which holds a decision field's text, is decided on`);
    }
    // A field of the class holding drawn decision text, decided on in any of its methods.
    if (
      ts.isPropertyAccessExpression(n) &&
      n.expression.kind === ts.SyntaxKind.ThisKeyword &&
      fields.has(`${classOf(n)}.${n.name.text}`) &&
      decides(n)
    )
      out.push(`${at(n)}: this.${n.name.text}, which holds a decision field's text, is decided on`);
    // A regular expression is a string too (re-verification 3).
    if (ts.isRegularExpressionLiteral(n)) {
      const body = n.text.slice(1, n.text.lastIndexOf("/")).replace(/\\(.)/g, "$1");
      const bad = badString(body);
      if (bad !== undefined) out.push(`${at(n)}: ${bad} in ${n.text}`);
    }
    // Gap 1: a destructuring that names a decision field.
    if (ts.isBindingElement(n)) {
      const name = (n.propertyName ?? n.name).getText(file);
      if (DECISION_FIELDS.has(name)) out.push(`${at(n)}: destructures .${name}`);
    }
    // Gap 4: a computed key on a decision-bearing object, or one that folds to a decision field.
    if (ts.isElementAccessExpression(n) && field === undefined) {
      const key = n.argumentExpression;
      const value = folded(key) ?? (checker === undefined ? undefined : constantOf(checker, key));
      const literal =
        ts.isStringLiteral(key) ||
        ts.isNumericLiteral(key) ||
        ts.isNoSubstitutionTemplateLiteral(key);
      // The object as it was before any cast: a cast hides an answer's type, not the answer.
      let object: TS.Expression = n.expression;
      while (
        ts.isAsExpression(object) ||
        ts.isParenthesizedExpression(object) ||
        ts.isNonNullExpression(object)
      )
        object = object.expression;
      if (value !== undefined && DECISION_FIELDS.has(value))
        out.push(`${at(n)}: a computed key that is .${value}`);
      else if (
        !literal &&
        checker !== undefined &&
        // A position in a list is no field: only a key that could name one is read.
        (checker.getTypeAtLocation(key).flags & ts.TypeFlags.NumberLike) === 0 &&
        bearsDecision(checker, checker.getTypeAtLocation(object), 3)
      )
        out.push(`${at(n)}: a computed key on an answer: ${n.getText(file).slice(0, 80)}`);
    }
    // Gap 3: an answer read whole.
    // No exemption marker (re-verification 2): a real non-answer case would get a pinned (file, line) allow-list.
    if (ts.isCallExpression(n) && WHOLE.has(n.expression.getText(file))) {
      const arg = n.arguments[0];
      const type =
        arg === undefined || checker === undefined ? undefined : checker.getTypeAtLocation(arg);
      const answer =
        type === undefined ||
        (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) !== 0 ||
        (checker !== undefined && bearsDecision(checker, type));
      if (answer) out.push(`${at(n)}: ${n.expression.getText(file)} on what may be an answer`);
    }
    const value = folded(n);
    const isOuterChain =
      n.parent === undefined ||
      !(ts.isBinaryExpression(n.parent) && folded(n.parent) !== undefined);
    if (value !== undefined && isOuterChain) {
      const bad = badString(value);
      if (bad !== undefined) out.push(`${at(n)}: ${bad} in ${JSON.stringify(value.slice(0, 80))}`);
    }
    if (ts.isTemplateExpression(n))
      for (const part of [n.head, ...n.templateSpans.map((x) => x.literal)]) {
        const bad = badString(part.text);
        if (bad !== undefined) out.push(`${at(n)}: ${bad} in a template`);
      }
    ts.forEachChild(n, visit);
  };
  visit(file);
  return out;
}

/**
 * The searches of reasons for text the person typed, by file and function:
 * a filter on the person's own words, which decides nothing the plane
 * decided (README, packages/view). Each must be found, once, where it is
 * pinned; any other violation fails.
 */
const SEARCHES = [{ path: "packages/view/src/view.ts", fn: "findInReasons" }];

/** The function a violation's line is in, by name. */
function functionAt(file: TS.SourceFile, line: number): string | undefined {
  let found: string | undefined;
  const walk = (n: TS.Node): void => {
    const start = file.getLineAndCharacterOfPosition(n.getStart()).line + 1;
    const end = file.getLineAndCharacterOfPosition(n.getEnd()).line + 1;
    if (line < start || line > end) return;
    if (ts.isFunctionDeclaration(n) && n.name !== undefined) found = n.name.text;
    ts.forEachChild(n, walk);
  };
  walk(file);
  return found;
}

/** The TUI's sources as one program, for the type checker: answers are told by their types. */
function tuiProgram() {
  const options: TS.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    allowImportingTsExtensions: true,
    resolveJsonModule: true,
    strict: true,
    skipLibCheck: true,
    noEmit: true,
    types: ["node"],
  };
  const files = sources.map((x) => join(REPO, x.path));
  const program = ts.createProgram(files, options);
  return { program, checker: program.getTypeChecker() };
}

/** A probe compiled on its own, with its declarations, so its types are known too. */
function probeProgram(code: string) {
  const name = join(REPO, "packages", "cli", "src", "tui", "__probe__.ts").replaceAll("\\", "/");
  const host = ts.createCompilerHost({ strict: true, noEmit: true, skipLibCheck: true });
  const read = host.getSourceFile.bind(host);
  host.getSourceFile = (f, v) =>
    f === name ? ts.createSourceFile(f, code, ts.ScriptTarget.Latest, true) : read(f, v);
  const program = ts.createProgram(
    [name],
    { strict: true, noEmit: true, skipLibCheck: true },
    host,
  );
  return { file: program.getSourceFile(name) as TS.SourceFile, checker: program.getTypeChecker() };
}

/** An answer's type for probes: a decision under event. */
const ANSWER =
  "declare const answer: { event: { reason: string; policy_id: string }; items: string[] };";

/** A probe's source with a template placeholder: `$[` stands for the dollar and brace a template opens with. */
const tpl = (code: string) => code.replaceAll("$[", `${"$"}{`);

describe("no policy in the TUI's source", () => {
  it("reads its forbidden lists from core, and they are not empty", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(3);
    expect(RULE_IDS.length).toBeGreaterThan(30);
    expect(RULE_AREAS).toEqual(expect.arrayContaining(["engram/write/", "engram/promote/"]));
    expect(sources.length).toBeGreaterThan(20);
    expect(sources.map((x) => x.path)).toEqual(
      expect.arrayContaining(["packages/view/src/view.ts", "packages/view/src/provenance.ts"]),
    );
  });

  it("names no rule id, no rule area and no preset's policy id, anywhere in the text", () => {
    for (const { path, text } of sources) {
      for (const area of RULE_AREAS) expect(text.includes(area), `${path}: ${area}`).toBe(false);
      expect(/\bpreset\.[a-z]/.test(text), `${path}: preset.`).toBe(false);
    }
  });

  it("names no preset, anywhere in the text", () => {
    for (const { path, text } of sources)
      for (const name of PRESET_NAMES)
        expect(new RegExp(`\\b${name}\\b`, "i").test(text), `${path}: ${name}`).toBe(false);
  });

  it("holds no remedy text", () => {
    for (const { path, text } of sources)
      for (const r of REMEDIES) expect(text.toLowerCase().includes(r), `${path}: ${r}`).toBe(false);
  });

  it("uses a reason, a policy id or an admitting rule only as text drawn, and writes no forbidden string (the syntax tree)", () => {
    const { program, checker } = tuiProgram();
    const pinned = new Map<string, number>();
    const found = sources.flatMap((x) => {
      const file = program.getSourceFile(join(REPO, x.path));
      return violations(x.path, x.text, file === undefined ? undefined : { file, checker }).filter(
        (v) => {
          const line = Number(v.slice(x.path.length + 1).split(":")[0]);
          const fn = file === undefined ? undefined : functionAt(file, line);
          const s = SEARCHES.find((p) => p.path === x.path && p.fn === fn);
          if (s === undefined) return true;
          pinned.set(`${s.path} ${s.fn}`, (pinned.get(`${s.path} ${s.fn}`) ?? 0) + 1);
          return false;
        },
      );
    });
    expect(found).toEqual([]);
    // Every pinned search is still there, and is the one use its function makes.
    for (const p of SEARCHES) expect(pinned.get(`${p.path} ${p.fn}`), p.fn).toBe(1);
  }, 120_000);

  it("fails each of the verification's five gaps (N2)", () => {
    const gaps: Record<string, string> = {
      "a destructuring of a reason": "const { reason } = answer.event; if (reason) go();",
      "a destructuring renamed": "const { policy_id: id } = answer.event; void id;",
      "a member of a drawn template": tpl('if (`$[answer.event.reason}`.includes("class")) go();'),
      "a member of a display helper's result":
        'if (oneLine(answer.event!.reason).includes("class")) go();',
      "a drawn reason compared": 'if (oneLine(answer.event.reason) === "x") go();',
      "an answer read whole": 'if (JSON.stringify(answer).includes("episodic")) go();',
      "an answer's values": "for (const v of Object.values(answer.event)) void v;",
      "a run kept whole":
        'declare const run: { calls: { body: unknown }[] }; if (JSON.stringify(run).includes("x")) go();',
      "a computed key folding to a decision field":
        'const r = answer.event["rea" + "son"]; void r;',
      "drawn text kept in a local, then searched":
        'const why = oneLine(answer.event!.reason); if (why.includes("episodic")) go();',
      "a template kept in a let, then compared": tpl(
        'let t = `$[answer.event.reason}`; if (t === "x") go();',
      ),
      "a field kept with a fallback, then tested":
        'const r = answer.event.reason ?? ""; if (r) go();',
      "drawn text kept in a field, then searched in another method":
        'class S { why = ""; set() { this.why = oneLine(answer.event!.reason); } use() { if (this.why.includes("episodic")) go(); } }',
      "a field declared with a reason, then compared":
        'class S { why = answer.event.reason ?? ""; use() { if (this.why === "x") go(); } }',
      "the reviewer's marker mutant":
        '// no-policy: printer\nif (JSON.stringify(answer).includes("x")) go();',
      "a rule id in a regular expression": "const R = /engram\\/write\\/team/; void R;",
      "a preset in a regular expression": "const R = /preset\\.medium/; void R;",
      "a computed key named by a constant, through a cast":
        'const k = "rea" + "son"; void (answer.event as unknown as Record<string, string>)[k];',
      "a computed key on an answer":
        'const k: string = String(1); void (answer.event as Record<string, string>)[k]; void answer.event[k as "reason"];',
    };
    for (const [name, code] of Object.entries(gaps)) {
      const source = `${ANSWER}\ndeclare function oneLine(s: string): string;\ndeclare function go(): void;\n${code}`;
      expect(violations("probe.ts", source, probeProgram(source)).length, name).toBeGreaterThan(0);
    }
    // F-8: a carry or a row is allowed only as it is; anything done with it is not.
    const carried: Record<string, string> = {
      "a reason carried under another name": "const v = { why: answer.event.reason }; void v;",
      "a carried reason with a fallback other than null":
        'const v = { reason: answer.event.reason ?? "x" }; void v;',
      "a row's reason searched":
        'const row = ["reason", answer.event.reason]; if (row[1]?.includes("x")) go();',
      "a row with no label": "const row = [answer.event.policy_id, answer.event.reason]; void row;",
    };
    for (const [name, code] of Object.entries(carried)) {
      const source = `${ANSWER}\ndeclare function go(): void;\n${code}`;
      expect(violations("probe.ts", source, probeProgram(source)).length, name).toBeGreaterThan(0);
    }
    const carries = `${ANSWER}\nconst v = { policyId: answer.event.policy_id, admittedBy: answer.event.policy_id ?? null, reason: answer.event.reason }; const rows = [["policy id", answer.event.policy_id], ["reason", answer.event.reason]]; void v; void rows;`;
    expect(violations("probe.ts", carries, probeProgram(carries))).toEqual([]);
    // Drawn text kept in a local and only drawn again is allowed.
    const allowed = `${ANSWER}\ndeclare function oneLine(s: string): string;\nconst t = oneLine(answer.event.reason); const out: string[] = []; out.push(t);`;
    expect(violations("probe.ts", allowed, probeProgram(allowed))).toEqual([]);
  }, 60_000);

  it("fails each of the review's five survivors, and the earlier probes", () => {
    const survivors: Record<string, string> = {
      "a reason searched for a word":
        'if (p !== undefined && p.reason.toLowerCase().includes("class")) show();',
      "a reason through a local":
        'const why = this.previewAnswer()?.reason ?? ""; if (/episodic/.test(why)) set();',
      "a policy id split and compared":
        'if (this.previewAnswer()?.policy_id.split("/")[2] === "team") this.set("scope", "x");',
      "a remedy sentence":
        'const HINT = "Try a semantic item here, or ask a reviewer to approve it";',
      "a preset split into pieces": 'const PRESET = "pre" + "set.med" + "ium";',
      "a reason compared": 'if (e.reason === "denied") go();',
      "a policy id switched on": "switch (a.event.policy_id) { default: }",
      "a rule id": 'const RULE = "engram/write/membership";',
      "a preset name": 'const FALLBACK = "strict";',
      "a reason in a template is drawn, but its other use is not": tpl(
        "const t = `$[oneLine(e.reason)}`; if (e.reason) f();",
      ),
    };
    for (const [name, code] of Object.entries(survivors))
      expect(violations("probe.ts", code).length, name).toBeGreaterThan(0);
    // And what the screens do is allowed: drawn through a helper or a template.
    const drawn = tpl(
      "out.push(`$[oneLine(e.reason)}`, safe(e.policy_id), para(oneLine(v.reason), w));",
    );
    expect(violations("probe.ts", drawn)).toEqual([]);
  });
});
