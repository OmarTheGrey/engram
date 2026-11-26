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
// screen and the inspector draw through. Since the second verification of
// N-1 (2026-11-26) it is an allowlist of uses, not a list of forbidden ones.
// Decision text (a reason, a policy id, an admitting rule, and anything made
// of one) may only be:
//   (a) an argument of a drawing or copying helper, resolved by the checker's
//       symbol through import aliases (HELPERS: layout.ts, rich.ts, the
//       theme, the clipboard, pi-tui), or a span of an untagged template;
//       the result is decision text in turn;
//   (b) measured (`.length`), re-laid (slice, join, pad, trim), indexed,
//       iterated or mapped, each result followed in turn;
//   (c) carried under a decision field's own name, the carrier only
//       returned, listed, kept or added to a list (every later read is a
//       field read, checked again);
//   (d) compared with "", null or undefined, or given "" or "-" as its
//       fallback, to draw a placeholder;
//   (e) kept in a local, a binding, a class field, a list it is pushed to,
//       or returned, after which every use of that local, field, list, call
//       or getter is checked the same way.
// Anything else fails: a comparison, a branch, `+`, a regular expression,
// a method such as includes or localeCompare, any other function's
// argument, a tagged template, a fallback other than none, a callback's
// result other than a map's. A carrier handed where its type is lost (any,
// unknown, a type parameter, a string-keyed record) fails, as does a decision
// field's name handed to a call, a computed key that folds to one, a
// destructuring that names one, and an answer read whole (JSON.stringify,
// Object.values, Reflect.get). The one search of reasons, findInReasons, is
// pinned by its exact text (SEARCHES), and so is its one call, on the find
// field the person types in (SEARCH_CALLS).
//
// Known limits. The guard is a tripwire against accidental policy logic in
// display code, not a sound analysis; review remains the check. It does not
// follow decision text into the body of an allowlisted helper, across a
// method called through an interface, or through a key held in a variable
// and handed to a generic picker (`get(e, k)`). A length, or emptiness,
// carries a little of the text's content, and both are permitted. Only
// packages/cli/src/tui and packages/view are walked: the results of other
// packages/cli/src functions (format.ts's decisionLines, policyName) are not
// followed. The CLI's printed output (RunResult.out and .err) is not a
// source, so text the TUI reads back from a command's output is not
// followed. A lint finding's lint_id and message are not decision fields
// here. And the find field's content is taken to be what the person typed.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
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
    ts.isAsExpression(parent) ||
    ts.isSatisfiesExpression(parent)
  ) {
    child = parent;
    parent = parent.parent;
  }
  return { parent, child };
}

/** A property name that is a decision field's. */
function decisionName(name: TS.PropertyName | TS.BindingName): boolean {
  if (ts.isComputedPropertyName(name)) {
    const v = folded(name.expression);
    return v !== undefined && DECISION_FIELDS.has(v);
  }
  return (
    (ts.isIdentifier(name) ||
      ts.isStringLiteral(name) ||
      ts.isNoSubstitutionTemplateLiteral(name)) &&
    DECISION_FIELDS.has(name.text)
  );
}

/** The name a call is made by: `f(...)` or `x.f(...)`. */
function calleeName(call: TS.CallExpression | TS.NewExpression): string {
  const callee = call.expression;
  return ts.isIdentifier(callee)
    ? callee.text
    : ts.isPropertyAccessExpression(callee)
      ? callee.name.text
      : "";
}

/** A decision field read at `n`: its name, else undefined. */
function fieldRead(n: TS.Node): string | undefined {
  if (ts.isPropertyAccessExpression(n) && DECISION_FIELDS.has(n.name.text)) return n.name.text;
  if (ts.isElementAccessExpression(n)) {
    const key = folded(n.argumentExpression);
    if (key !== undefined && DECISION_FIELDS.has(key)) return key;
  }
  return undefined;
}

/** The class a node is in, by name, for the fields its methods share. */
function classOf(node: TS.Node): string | undefined {
  for (let n: TS.Node | undefined = node.parent; n !== undefined; n = n.parent)
    if (ts.isClassDeclaration(n) || ts.isClassExpression(n)) return n.name?.text ?? "<class>";
  return undefined;
}

/** Whether `n` is the target of a plain `=`, written, not read (`line = cut(line, w)`). */
function assigned(n: TS.Node): boolean {
  const p = n.parent;
  return (
    ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.EqualsToken && p.left === n
  );
}

/** The function a return statement returns from. */
function functionOf(node: TS.Node): TS.SignatureDeclaration | undefined {
  for (let n: TS.Node | undefined = node.parent; n !== undefined; n = n.parent)
    if (ts.isFunctionLike(n)) return n;
  return undefined;
}

/** The call a function is handed to as a callback, if it is one. */
function callbackOf(fn: TS.Node): TS.CallExpression | TS.NewExpression | undefined {
  const { parent, child } = consumer(fn);
  return (ts.isCallExpression(parent) || ts.isNewExpression(parent)) &&
    parent.arguments?.includes(child as TS.Expression) === true
    ? parent
    : undefined;
}

/** The list methods whose callback's result is the list's next value: drawn text stays drawn text. */
const MAPPING = new Set(["map", "flatMap"]);
/** The list methods that call back with each element, whose result is not carried on. */
const EACH = new Set(["forEach"]);
/** String and list methods that return the same text, re-laid: their result stays decision text. */
const RELAYING = new Set(["slice", "join", "padEnd", "padStart", "trim", "trimEnd", "trimStart"]);
/** The fallbacks a screen draws for none: nothing, or a dash. */
const PLACEHOLDERS = new Set(["", "-"]);
/** The array methods that add drawn text to a list being drawn: the list then holds it. */
const ADDING = new Set(["push", "unshift"]);

/**
 * The helpers that only draw or copy text (N-1): resolved by the checker's
 * symbol, following import aliases, to their declarations here, never by
 * name alone (a local function called `cut` that decides is not one). Each
 * file is listed with the names it may draw through; `*` takes every member
 * of the named interface (the theme's colours, the clipboard's copy).
 */
const HELPERS: { file: string; names: readonly string[]; member?: string; args?: number[] }[] = [
  {
    file: "packages/cli/src/tui/layout.ts",
    names: [
      "fit",
      "cut",
      "wrap",
      "para",
      "box",
      "rows",
      "sideBySide",
      "overlay",
      "clean",
      "visibleWidth",
    ],
  },
  {
    file: "packages/cli/src/tui/screens/rich.ts",
    names: ["safe", "oneLine", "firstLines", "boxed", "paneBox"],
  },
  { file: "packages/cli/src/tui/theme.ts", names: ["*"], member: "Theme" },
  { file: "packages/cli/src/tui/clipboard.ts", names: ["osc52", "copy"], member: "Clipboard" },
  // A screen's run: its third argument is lines the confirmation draws (RichScreen.run).
  { file: "packages/cli/src/tui/screens/rich.ts", names: ["run"], member: "RichScreen", args: [2] },
];
/** Without the checker (the syntax-only probes), the helpers by name. */
const HELPER_NAMES = new Set([
  "oneLine",
  "safe",
  "cut",
  "fit",
  "para",
  "wrap",
  "firstLines",
  "box",
]);

/** Whether a declaration is one of HELPERS, or pi-tui's own drawing, for the argument at `arg`. */
function isHelperDeclaration(decl: TS.Declaration, arg: number): boolean {
  const path = decl.getSourceFile().fileName.replaceAll("\\", "/");
  if (path.includes("/@earendil-works/pi-tui/")) return true;
  const rel = path.startsWith(REPO_SLASH) ? path.slice(REPO_SLASH.length) : path;
  const named = (decl as { name?: TS.Node }).name;
  const name = named !== undefined && ts.isIdentifier(named) ? named.text : "";
  return HELPERS.some((h) => {
    if (h.file !== rel) return false;
    if (h.args !== undefined && !h.args.includes(arg)) return false;
    if (h.member !== undefined) {
      const owner = decl.parent;
      const inOwner =
        (ts.isInterfaceDeclaration(owner) || ts.isClassDeclaration(owner)) &&
        owner.name?.text === h.member;
      if (inOwner) return h.names.includes("*") || h.names.includes(name);
      if (h.args !== undefined) return false;
    }
    return h.names.includes(name);
  });
}
const REPO_SLASH = `${REPO.replaceAll("\\", "/")}/`;

/** The symbol a name stands for, past an import alias. */
function realSymbol(checker: TS.TypeChecker, node: TS.Node): TS.Symbol | undefined {
  const sym = checker.getSymbolAtLocation(node);
  if (sym === undefined) return undefined;
  return sym.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(sym) : sym;
}

/** What a call does with its argument `arg`: a drawing helper draws it (its result drawn text), a sink takes it, or neither. */
function helperFor(
  checker: TS.TypeChecker | undefined,
  call: TS.CallExpression | TS.NewExpression,
  arg: TS.Node,
): "draws" | "sink" | undefined {
  if (!isHelperCall(checker, call, arg)) return undefined;
  if (checker === undefined) return "draws";
  const callee = ts.isPropertyAccessExpression(call.expression)
    ? call.expression.name
    : call.expression;
  const decls = realSymbol(checker, callee)?.declarations ?? [];
  const sink = decls.some((d) => {
    const rel = d.getSourceFile().fileName.replaceAll("\\", "/").slice(REPO_SLASH.length);
    const named = (d as { name?: TS.Node }).name;
    const name = named !== undefined && ts.isIdentifier(named) ? named.text : "";
    return HELPERS.some((h) => h.file === rel && h.args !== undefined && h.names.includes(name));
  });
  return sink ? "sink" : "draws";
}

/** Whether a call is to a drawing or copying helper (HELPERS), by symbol, for its argument `arg`. */
function isHelperCall(
  checker: TS.TypeChecker | undefined,
  call: TS.CallExpression | TS.NewExpression,
  arg: TS.Node,
): boolean {
  if (checker === undefined) return HELPER_NAMES.has(calleeName(call));
  const callee = ts.isPropertyAccessExpression(call.expression)
    ? call.expression.name
    : call.expression;
  const sym = realSymbol(checker, callee);
  const at = call.arguments?.indexOf(arg as TS.Expression) ?? -1;
  return (sym?.declarations ?? []).some((d) => isHelperDeclaration(d, at));
}

/**
 * Where decision text, and everything made of it, may go (the coordinator's
 * allowlist of uses, after the N-1 verification): each step of `use` either
 * permits the use, carries the taint to the expression it makes, or fails.
 */
class Uses {
  /** Locals, parameters and bindings holding decision text: by symbol with the checker, else by name. */
  readonly locals = new Set<TS.Symbol | string>();
  /** Class fields holding it, by class and name. */
  readonly fields = new Set<string>();
  /** Functions, methods and getters returning it, by symbol. */
  readonly fns = new Set<TS.Symbol>();
  out: string[] = [];

  readonly file: TS.SourceFile;
  readonly checker: TS.TypeChecker | undefined;
  readonly at: (n: TS.Node) => string;

  constructor(
    file: TS.SourceFile,
    checker: TS.TypeChecker | undefined,
    at: (n: TS.Node) => string,
  ) {
    this.file = file;
    this.checker = checker;
    this.at = at;
  }

  size(): number {
    return this.locals.size + this.fields.size + this.fns.size;
  }

  private fail(n: TS.Node, why: string): void {
    this.out.push(`${this.at(n)}: decision text ${why}: ${n.getText(this.file).slice(0, 80)}`);
  }

  private keyOf(node: TS.Node): TS.Symbol | string {
    return this.checker?.getSymbolAtLocation(node) ?? node.getText(this.file);
  }

  /** A binding name (identifier or list pattern) taking decision text; an object pattern is refused. */
  private bind(name: TS.BindingName, from: TS.Node): void {
    if (ts.isIdentifier(name)) this.locals.add(this.keyOf(name));
    else if (ts.isArrayBindingPattern(name)) {
      for (const el of name.elements) if (ts.isBindingElement(el)) this.bind(el.name, from);
    } else this.fail(from, "destructured by name");
  }

  /** A function returning decision text: its every call is decision text too. */
  private returns(fn: TS.SignatureDeclaration, n: TS.Node): void {
    const call = callbackOf(fn);
    if (call !== undefined) {
      if (ts.isCallExpression(call) && MAPPING.has(calleeName(call))) this.use(call);
      else this.fail(n, `returned to ${calleeName(call) || "a call"}, which decides on it`);
      return;
    }
    if (this.checker === undefined) return;
    const named =
      fn.name ??
      (ts.isVariableDeclaration(fn.parent) && fn.parent.initializer === fn
        ? fn.parent.name
        : undefined);
    const sym = named === undefined ? undefined : this.checker.getSymbolAtLocation(named);
    if (sym !== undefined) this.fns.add(sym);
  }

  /** Whether `n` is a source of decision text other than a field read: a local, a field, a call or getter returning it. */
  holds(n: TS.Node): boolean {
    if (ts.isIdentifier(n)) {
      const p = n.parent;
      if (ts.isVariableDeclaration(p) && p.name === n) return false;
      if (ts.isBindingElement(p) || ts.isParameter(p)) return false;
      if (ts.isPropertyAccessExpression(p) && p.name === n) return false;
      if (ts.isPropertyAssignment(p) && p.name === n) return false;
      if (assigned(n)) return false;
      return this.locals.has(this.keyOf(n));
    }
    if (
      ts.isPropertyAccessExpression(n) &&
      n.expression.kind === ts.SyntaxKind.ThisKeyword &&
      this.fields.has(`${classOf(n)}.${n.name.text}`)
    )
      return !assigned(n);
    if (this.checker === undefined) return false;
    if (ts.isCallExpression(n)) {
      const callee = ts.isPropertyAccessExpression(n.expression) ? n.expression.name : n.expression;
      const sym = realSymbol(this.checker, callee);
      return sym !== undefined && this.fns.has(sym);
    }
    // A getter returning it, read as a property.
    if (ts.isPropertyAccessExpression(n) && !ts.isCallExpression(n.parent)) {
      const sym = realSymbol(this.checker, n.name);
      return sym !== undefined && this.fns.has(sym);
    }
    return false;
  }

  /** A carrier: an object holding decision text under a decision field's own name, whose every later read is checked by that name. */
  carrier(obj: TS.Node): void {
    const { parent, child } = consumer(obj);
    if (ts.isArrayLiteralExpression(parent) || ts.isSpreadElement(parent)) {
      this.carrier(parent);
      return;
    }
    if (ts.isPropertyAssignment(parent) && parent.initializer === child) {
      this.carrier(parent.parent);
      return;
    }
    if (ts.isConditionalExpression(parent) && parent.condition !== child) {
      this.carrier(parent);
      return;
    }
    if (
      ts.isBinaryExpression(parent) &&
      parent.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
    ) {
      this.carrier(parent);
      return;
    }
    if (ts.isVariableDeclaration(parent) && parent.initializer === child) {
      if (!ts.isIdentifier(parent.name)) this.fail(obj, "destructured from its carrier");
      return;
    }
    if (ts.isReturnStatement(parent) || (ts.isArrowFunction(parent) && parent.body === child)) {
      const fn = ts.isReturnStatement(parent) ? functionOf(parent) : parent;
      const call = fn === undefined ? undefined : callbackOf(fn);
      if (call === undefined) return;
      if (ts.isCallExpression(call) && MAPPING.has(calleeName(call))) {
        this.carrier(call);
        return;
      }
      this.fail(obj, `carried into ${calleeName(call) || "a call"}'s callback result`);
      return;
    }
    if (
      ts.isCallExpression(parent) &&
      parent.arguments.includes(child as TS.Expression) &&
      (ADDING.has(calleeName(parent)) || calleeName(parent) === "set")
    )
      return;
    this.fail(obj, "carried, then used other than returned, listed or kept");
  }

  /** Decision text at `n` (a field read, or text made of one): where it goes must be a permitted use. */
  use(n: TS.Node): void {
    const { parent, child } = consumer(n);
    // (a) drawn: a template, then where the template goes.
    if (ts.isTemplateSpan(parent)) {
      const tmpl = parent.parent;
      if (ts.isTaggedTemplateExpression(tmpl.parent)) {
        this.fail(n, "handed to a tagged template's tag");
        return;
      }
      this.use(tmpl);
      return;
    }
    if (ts.isTaggedTemplateExpression(parent)) {
      this.fail(n, "a tagged template");
      return;
    }
    // (a) drawn or copied: a helper's argument (by symbol), whose result is drawn text in turn.
    if (
      (ts.isCallExpression(parent) || ts.isNewExpression(parent)) &&
      parent.arguments?.includes(child as TS.Expression)
    ) {
      const helper = helperFor(this.checker, parent, child);
      // A drawing helper's result is drawn text in turn; a sink (a screen's run) keeps nothing.
      if (helper === "draws") {
        this.use(parent);
        return;
      }
      if (helper === "sink") return;
      if (
        ts.isCallExpression(parent) &&
        ADDING.has(calleeName(parent)) &&
        ts.isPropertyAccessExpression(parent.expression)
      ) {
        // Drawn text added to a list: the list holds it from then on.
        const list = parent.expression.expression;
        if (ts.isIdentifier(list)) this.locals.add(this.keyOf(list));
        else if (
          ts.isPropertyAccessExpression(list) &&
          list.expression.kind === ts.SyntaxKind.ThisKeyword
        ) {
          const cls = classOf(list);
          if (cls !== undefined) this.fields.add(`${cls}.${list.name.text}`);
        } else if (!this.holds(list)) {
          this.fail(n, "added to a list that is not followed");
          return;
        }
        return;
      }
      this.fail(n, `passed to ${calleeName(parent) || "a call"}, which is not a drawing helper`);
      return;
    }
    if (ts.isSpreadElement(parent)) {
      const up = parent.parent;
      if (ts.isArrayLiteralExpression(up)) {
        this.use(up);
        return;
      }
      this.use(parent);
      return;
    }
    // (b) layout: a length, or a member that re-lays the same text.
    if (ts.isPropertyAccessExpression(parent) && parent.expression === child) {
      const name = parent.name.text;
      if (
        name === "length" &&
        !(ts.isCallExpression(parent.parent) && parent.parent.expression === parent)
      )
        return;
      const call = parent.parent;
      if (ts.isCallExpression(call) && call.expression === parent) {
        if (ADDING.has(name)) return;
        if (RELAYING.has(name)) {
          this.use(call);
          return;
        }
        const cb = call.arguments[0];
        if (
          (MAPPING.has(name) || EACH.has(name)) &&
          cb !== undefined &&
          (ts.isArrowFunction(cb) || ts.isFunctionExpression(cb))
        ) {
          const p = cb.parameters[0];
          if (p !== undefined) this.bind(p.name, n);
          return;
        }
        this.fail(n, `.${name}() called on it`);
        return;
      }
      this.fail(n, `.${name} read on it`);
      return;
    }
    if (ts.isElementAccessExpression(parent) && parent.expression === child) {
      this.use(parent);
      return;
    }
    // (d) the one comparison: empty or not, to draw a placeholder.
    if (ts.isBinaryExpression(parent)) {
      const op = parent.operatorToken.kind;
      const other = parent.left === child ? parent.right : parent.left;
      // (d) empty or none: compared with "", null or undefined, to draw a placeholder.
      const nothing =
        folded(other) === "" ||
        other.kind === ts.SyntaxKind.NullKeyword ||
        (ts.isIdentifier(other) && other.text === "undefined");
      if (
        (op === ts.SyntaxKind.EqualsEqualsEqualsToken ||
          op === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
          op === ts.SyntaxKind.EqualsEqualsToken ||
          op === ts.SyntaxKind.ExclamationEqualsToken) &&
        nothing
      )
        return;
      // A fallback for none: `?? null`, `?? ""`; any other fallback is text the code chose.
      if (op === ts.SyntaxKind.QuestionQuestionToken) {
        const none =
          parent.left === child &&
          (parent.right.kind === ts.SyntaxKind.NullKeyword ||
            PLACEHOLDERS.has(folded(parent.right) ?? "\u0000") ||
            (ts.isIdentifier(parent.right) && parent.right.text === "undefined"));
        if (none) this.use(parent);
        else this.fail(n, "given a fallback");
        return;
      }
      if (op === ts.SyntaxKind.EqualsToken && parent.right === child) {
        const left = parent.left;
        if (ts.isIdentifier(left)) this.locals.add(this.keyOf(left));
        else if (
          ts.isPropertyAccessExpression(left) &&
          left.expression.kind === ts.SyntaxKind.ThisKeyword
        ) {
          const cls = classOf(left);
          if (cls !== undefined) this.fields.add(`${cls}.${left.name.text}`);
        } else this.fail(n, "assigned where it is not followed");
        return;
      }
      this.fail(n, `in a ${ts.tokenToString(op) ?? "binary"} expression`);
      return;
    }
    if (ts.isConditionalExpression(parent)) {
      if (parent.condition === child) {
        this.fail(n, "branched on");
        return;
      }
      this.use(parent);
      return;
    }
    if (ts.isArrayLiteralExpression(parent)) {
      this.use(parent);
      return;
    }
    // (c) carried under a decision field's own name.
    if (ts.isPropertyAssignment(parent) && parent.initializer === child) {
      if (decisionName(parent.name)) {
        this.carrier(parent.parent);
        return;
      }
      this.fail(n, `held under the name ${parent.name.getText(this.file)}`);
      return;
    }
    if (ts.isShorthandPropertyAssignment(parent)) {
      if (decisionName(parent.name)) {
        this.carrier(parent.parent);
        return;
      }
      this.fail(n, `held under the name ${parent.name.text}`);
      return;
    }
    // Kept: a local, a binding, a loop variable, a class field.
    if (ts.isVariableDeclaration(parent) && parent.initializer === child) {
      this.bind(parent.name, n);
      return;
    }
    if (ts.isForOfStatement(parent) && parent.expression === child) {
      const init = parent.initializer;
      if (ts.isVariableDeclarationList(init))
        for (const d of init.declarations) this.bind(d.name, n);
      else this.fail(n, "iterated into an assignment");
      return;
    }
    if (ts.isPropertyDeclaration(parent) && parent.initializer === child) {
      const cls = classOf(parent);
      if (cls !== undefined && ts.isIdentifier(parent.name))
        this.fields.add(`${cls}.${parent.name.text}`);
      return;
    }
    // Returned: the function's every call is decision text.
    if (ts.isReturnStatement(parent)) {
      const fn = functionOf(parent);
      if (fn !== undefined) this.returns(fn, n);
      return;
    }
    if (ts.isArrowFunction(parent) && parent.body === child) {
      this.returns(parent, n);
      return;
    }
    if (ts.isExpressionStatement(parent) || ts.isVoidExpression(parent)) return;
    this.fail(n, "used other than drawn");
  }
}

/** Whether a type loses what it holds: any, unknown, or a string-keyed record naming no decision field. */
/** `object` or `{}`: a type that names no field, so whatever it holds is read blind (A09, A10, B05). */
function opaque(checker: TS.TypeChecker, type: TS.Type): boolean {
  if ((type.flags & ts.TypeFlags.NonPrimitive) !== 0) return true;
  return (
    (type.flags & ts.TypeFlags.Object) !== 0 &&
    checker.getPropertiesOfType(type).length === 0 &&
    type.getCallSignatures().length === 0 &&
    type.getConstructSignatures().length === 0 &&
    type.getStringIndexType() === undefined &&
    type.getNumberIndexType() === undefined
  );
}

function loses(checker: TS.TypeChecker, type: TS.Type): boolean {
  // A type parameter loses it too (N9: a generic picker, `get<T, K extends keyof T>`).
  if ((type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.TypeParameter)) !== 0)
    return true;
  if (opaque(checker, type)) return true;
  if (type.isUnion()) return type.types.some((t) => loses(checker, t));
  return (
    type.getStringIndexType() !== undefined &&
    !checker.getPropertiesOfType(type).some((p) => DECISION_FIELDS.has(p.getName()))
  );
}

/** Whether `n` is the key argument of a WeakMap's or WeakSet's method: held by identity, never read or listed. */
function weakKey(checker: TS.TypeChecker, n: TS.Node): boolean {
  const call = n.parent;
  if (!ts.isCallExpression(call) || call.arguments[0] !== n) return false;
  if (!ts.isPropertyAccessExpression(call.expression)) return false;
  const decls = realSymbol(checker, call.expression.name)?.declarations ?? [];
  return decls.some(
    (d) =>
      ts.isInterfaceDeclaration(d.parent) && ["WeakMap", "WeakSet"].includes(d.parent.name.text),
  );
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
const WHOLE = new Set([
  "JSON.stringify",
  "Object.values",
  "Object.entries",
  "Object.getOwnPropertyDescriptor",
  "Object.getOwnPropertyDescriptors",
  "Reflect.get",
  "Reflect.ownKeys",
  "Reflect.getOwnPropertyDescriptor",
]);

/**
 * The calls of the pinned search, by file and exact text (white space
 * folded): its query is the Events screen's find field, what the person
 * typed, never a word the code chose (N23: `findInReasons([e], "denied")`).
 */
const SEARCH_CALLS = [
  {
    path: "packages/cli/src/tui/screens/events.ts",
    text: 'findInReasons(filterEvents(this.events(), this.filter), this.extras.get("find")?.value ?? "")',
  },
];

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
  const at = (n: TS.Node) => `${path}:${file.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;
  // The uses of decision text, walked to a fixed point: a local, field or function found holding
  // it later in the file is followed from its first use on the next pass.
  const uses = new Uses(file, checker, at);
  for (let pass = 0; pass < 8; pass++) {
    const size = uses.size();
    uses.out = [];
    const walk = (n: TS.Node): void => {
      if (fieldRead(n) !== undefined || uses.holds(n)) uses.use(n);
      ts.forEachChild(n, walk);
    };
    walk(file);
    if (uses.size() === size) break;
  }
  out.push(...uses.out);
  const visit = (n: TS.Node): void => {
    // N5, N9: a decision field named as a call's argument, a key handed to a picker (Reflect.get, `get(o, k)`).
    if (
      (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) &&
      DECISION_FIELDS.has(n.text) &&
      (ts.isCallExpression(n.parent) || ts.isNewExpression(n.parent)) &&
      n.parent.arguments?.includes(n) === true
    )
      out.push(`${at(n)}: a decision field's name handed to ${calleeName(n.parent) || "a call"}`);
    // N23: the pinned search is called only on what the person typed.
    if (ts.isCallExpression(n) && calleeName(n) === "findInReasons") {
      const text = foldSpace(n.getText(file));
      if (!SEARCH_CALLS.some((c) => c.path === path && c.text === text))
        out.push(
          `${at(n)}: findInReasons called other than on the find field: ${text.slice(0, 80)}`,
        );
    }
    // N-1: a value carrying a decision field where its type is lost (any, unknown, a string-keyed record), so no key read on it is seen.
    if (
      checker !== undefined &&
      ts.isExpression(n) &&
      (ts.isAsExpression(n.parent) ||
        ts.isCallExpression(n.parent) ||
        ts.isNewExpression(n.parent) ||
        (ts.isVariableDeclaration(n.parent) && ts.isIdentifier(n.parent.name)) ||
        ts.isReturnStatement(n.parent) ||
        ts.isPropertyAssignment(n.parent) ||
        (ts.isBinaryExpression(n.parent) && n.parent.right === n))
    ) {
      const target = ts.isAsExpression(n.parent)
        ? n.parent.expression === n
          ? checker.getTypeFromTypeNode(n.parent.type)
          : undefined
        : ts.isCallExpression(n.parent) && n.parent.expression === n
          ? undefined
          : checker.getContextualType(n);
      if (
        target !== undefined &&
        loses(checker, target) &&
        !weakKey(checker, n) &&
        bearsDecision(checker, checker.getTypeAtLocation(n))
      )
        out.push(
          `${at(n)}: a decision field's carrier where its type is lost: ${n.getText(file).slice(0, 80)}`,
        );
    }
    // A regular expression is a string too (re-verification 3).
    if (ts.isRegularExpressionLiteral(n)) {
      const body = n.text.slice(1, n.text.lastIndexOf("/")).replace(/\\(.)/g, "$1");
      const bad = badString(body);
      if (bad !== undefined) out.push(`${at(n)}: ${bad} in ${n.text}`);
    }
    // Gap 1: a destructuring that names a decision field.
    if (ts.isBindingElement(n)) {
      const name = n.propertyName ?? n.name;
      if (decisionName(name)) out.push(`${at(n)}: destructures .${name.getText(file)}`);
    }
    // Gap 4: a computed key on a decision-bearing object, or one that folds to a decision field.
    // A key that folds to a decision field's name hides it (a plain string key is a field read, checked above).
    if (ts.isElementAccessExpression(n) && !ts.isStringLiteral(n.argumentExpression)) {
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
        (checker !== undefined && (opaque(checker, type) || bearsDecision(checker, type)));
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
 * The searches of reasons for text the person typed, by file, function and
 * exact text (white space folded): a filter on the person's own words, which
 * decides nothing the plane decided (README, packages/view). Each must be
 * found, once, where it is pinned, as it is pinned; any change to it, and any
 * other violation, fails (N-1: a pin by count let its one search be swapped
 * for a decision).
 */
const SEARCHES = [
  {
    path: "packages/view/src/view.ts",
    fn: "findInReasons",
    text: 'export function findInReasons(events: readonly MemoryEvent[], text: string): MemoryEvent[] { const wanted = text.trim().toLowerCase(); return wanted === "" ? [...events] : events.filter((e) => e.reason.toLowerCase().includes(wanted)); }',
  },
];

/** Source text with its white space folded to single spaces. */
const foldSpace = (t: string) =>
  t
    .replace(/\s+/g, " ")
    .replace(/\( /g, "(")
    .replace(/ \)/g, ")")
    .replace(/,\)/g, ")")
    .replace(/,\s*\]/g, "]")
    .trim();

/** The function declaration a line is in, the innermost. */
function functionAt(file: TS.SourceFile, line: number): TS.FunctionDeclaration | undefined {
  let found: TS.FunctionDeclaration | undefined;
  const walk = (n: TS.Node): void => {
    const start = file.getLineAndCharacterOfPosition(n.getStart()).line + 1;
    const end = file.getLineAndCharacterOfPosition(n.getEnd()).line + 1;
    if (line < start || line > end) return;
    if (ts.isFunctionDeclaration(n) && n.name !== undefined) found = n;
    ts.forEachChild(n, walk);
  };
  walk(file);
  return found;
}

/** A source's violations less its pinned searches; a pinned search missing, changed or used twice is one too. */
function unpinned(
  path: string,
  text: string,
  program?: { file: TS.SourceFile; checker: TS.TypeChecker },
): string[] {
  const left: string[] = [];
  const uses = new Map<string, number>();
  for (const v of violations(path, text, program)) {
    const line = Number(v.slice(path.length + 1).split(":")[0]);
    const fn = program === undefined ? undefined : functionAt(program.file, line);
    const s = SEARCHES.find(
      (p) =>
        p.path === path &&
        fn !== undefined &&
        p.fn === fn.name?.text &&
        foldSpace(fn.getText(program?.file)) === p.text,
    );
    if (s === undefined) left.push(v);
    else uses.set(s.fn, (uses.get(s.fn) ?? 0) + 1);
  }
  for (const p of SEARCHES)
    if (p.path === path && uses.get(p.fn) !== 1)
      left.push(`${path}: the pinned search ${p.fn} is not there once, as pinned`);
  return left;
}

/** The TUI's sources as one program, for the type checker: answers are told by their types. */
const OPTIONS: TS.CompilerOptions = {
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

function tuiProgram() {
  const files = sources.map((x) => join(REPO, x.path));
  const program = ts.createProgram(files, OPTIONS);
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

/** The bypasses the guard does not catch, by id: its known limits (the header). */
const LIMITS: string[] = [];

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
    const found = sources.flatMap((x) => {
      const file = program.getSourceFile(join(REPO, x.path));
      return unpinned(x.path, x.text, file === undefined ? undefined : { file, checker });
    });
    expect(found).toEqual([]);
  }, 300_000);

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
      const source = `${ANSWER}\nimport { oneLine } from "./screens/rich.ts";\ndeclare function go(): void;\n${code}`;
      expect(violations("probe.ts", source, probeProgram(source)).length, name).toBeGreaterThan(0);
    }
    // F-8: a carry or a row is allowed only as it is; anything done with it is not.
    const carried: Record<string, string> = {
      "a reason carried under another name": "const v = { why: answer.event.reason }; void v;",
      "a carried reason with a fallback other than null":
        'const v = { reason: answer.event.reason ?? "x" }; void v;',
      "a row's reason searched":
        'const row = ["reason", answer.event.reason]; if (row[1]?.includes("x")) go();',
      "a row put in a Map": 'const rows = new Map([["reason", answer.event.reason]]); void rows;',
      "a row flattened": 'void [["reason", answer.event.reason]].flat();',
      "drawn text in a row, in a Map, read":
        'if (new Map([["r", safe(answer.event.reason)]]).get("r") === "x") go();',
      "drawn text returned, the call compared":
        'const why = () => safe(answer.event.reason); if (why() === "x") go();',
      "drawn text as a filter's result": "void [answer].filter((a) => safe(a.event.reason));",
      "a local copied from a local, then searched":
        'const a = safe(answer.event.reason); const b = a; if (b.includes("x")) go();',
      "a carrier cast to any": "const v = answer as any; void v;",
    };
    for (const [name, code] of Object.entries(carried)) {
      const source = `${ANSWER}\nimport { safe } from "./screens/rich.ts";\ndeclare function go(): void;\n${code}`;
      expect(violations("probe.ts", source, probeProgram(source)).length, name).toBeGreaterThan(0);
    }
    const carries = `${ANSWER}\nconst v = { policyId: answer.event.policy_id, admittedBy: answer.event.policy_id ?? null, reason: answer.event.reason }; void v; const rows = [["reason", answer.event.reason]]; void rows;`;
    expect(violations("probe.ts", carries, probeProgram(carries))).toEqual([]);
    // Drawn text kept in a local and only drawn again is allowed.
    const allowed = `${ANSWER}\nimport { oneLine } from "./screens/rich.ts";\nconst t = oneLine(answer.event.reason); const out: string[] = []; out.push(t);`;
    expect(violations("probe.ts", allowed, probeProgram(allowed))).toEqual([]);
  }, 300_000);

  it("fails each bypass the fix pass's verification found (N-1, B1 to B7), and the fix pass's own source mutants", () => {
    const before = "export function findInReasons(";
    const events = "      filterEvents(this.events(), this.filter),";
    const TOP = "/** One row of the policy tree. */";
    const VIEW_TS = "packages/view/src/view.ts";
    const EVENTS_TS = "packages/cli/src/tui/screens/events.ts";
    const mutants: { name: string; path: string; from: string; to: string }[] = [
      { name: "control: view.ts unchanged", path: VIEW_TS, from: before, to: before },
      { name: "control: events.ts unchanged", path: EVENTS_TS, from: events, to: events },
      {
        name: "B1 findInReasons' one search replaced by a decision",
        path: VIEW_TS,
        from: ": events.filter((e) => e.reason.toLowerCase().includes(wanted));",
        to: ': events.filter((e) => !e.reason.toLowerCase().includes("denied"));',
      },
      {
        name: "B2 a labelled row inside a Map, then read",
        path: VIEW_TS,
        from: before,
        to: `export function hideDenied(events: readonly MemoryEvent[]): MemoryEvent[] {\n  return events.filter((e) => new Map([["reason", e.reason]]).get("reason")?.includes("denied") !== true);\n}\n${before}`,
      },
      {
        name: "B3 a labelled row nested in a list, flattened, searched",
        path: VIEW_TS,
        from: before,
        to: `export function isDenied(e: MemoryEvent): boolean {\n  return [["why", e.reason]].flat().some((s) => s.includes("denied"));\n}\n${before}`,
      },
      {
        name: "B4 a labelled row returned by a function, its value compared",
        path: VIEW_TS,
        from: before,
        to: `const whyRow = (e: MemoryEvent) => ["reason", e.reason] as const;\nexport function isDenied(e: MemoryEvent): boolean {\n  return whyRow(e)[1].startsWith("denied");\n}\n${before}`,
      },
      {
        name: "B5 carried under its own name into a Record, read by a computed key",
        path: VIEW_TS,
        from: before,
        to: `export function isDenied(e: MemoryEvent): boolean {\n  const c: Record<string, string> = { reason: e.reason };\n  const k = ["rea", "son"].join("");\n  return c[k]?.includes("denied") === true;\n}\n${before}`,
      },
      {
        name: "B6 a carrier handed to an any-typed picker",
        path: VIEW_TS,
        from: before,
        to: `function pick(o: any, k: string): string { return o[k]; }\nexport function isDenied(e: MemoryEvent): boolean {\n  return pick({ policyId: e.policy_id }, "policyId").includes("deny");\n}\n${before}`,
      },
      {
        name: "B7 the Events screen hides denied events through a Map row",
        path: EVENTS_TS,
        from: events,
        to: '      filterEvents(this.events(), this.filter).filter((e) => new Map([["reason", e.reason]]).get("reason") !== "denied"),',
      },
      {
        name: "B5t the Events screen hides them through a Record carry",
        path: EVENTS_TS,
        from: events,
        to: '      filterEvents(this.events(), this.filter).filter((e) => { const c: Record<string, string> = { reason: e.reason }; const k = ["rea", "son"].join(""); return c[k] !== "denied"; }),',
      },
      {
        name: "F-8 fix pass: a branch on a reason in a view",
        path: VIEW_TS,
        from: "  reason: r.event.reason,\n",
        to: '  reason: r.event.reason.includes("class") ? "try another" : r.event.reason,\n',
      },
      {
        name: "F-8 fix pass: a second search inside findInReasons",
        path: VIEW_TS,
        from: "  const wanted = text.trim().toLowerCase();\n",
        to: '  const wanted = text.trim().toLowerCase();\n  if (events.some((e) => e.reason === "x")) return [];\n',
      },
      // The verification of the N-1 pass, its 26 bypasses (scratchpad n1/mk.mjs), each a mutant here.
      {
        name: "N1 computed-key destructuring",
        path: VIEW_TS,
        from: "export function findInReasons(",
        to: 'export function isDenied(e: MemoryEvent): boolean { const { ["reason"]: r } = e; return r.startsWith("denied"); }\nexport function findInReasons(',
      },
      {
        name: "N2 string concatenation of a drawn reason",
        path: VIEW_TS,
        from: "export function findInReasons(",
        to: tpl(
          'export function isDenied(e: MemoryEvent): boolean { return ("" + `$[e.reason}`).includes("denied"); }\nexport function findInReasons(',
        ),
      },
      {
        name: "N3 drawn reason as a RegExp.test argument",
        path: VIEW_TS,
        from: "export function findInReasons(",
        to: tpl(
          "export function isDenied(e: MemoryEvent): boolean { return /denied/.test(`$[e.reason}`); }\nexport function findInReasons(",
        ),
      },
      {
        name: "N4 drawn policy id as an Array.includes / Object.is argument",
        path: VIEW_TS,
        from: "export function findInReasons(",
        to: tpl(
          'const DENY = ["x"]; export function isDenied(e: MemoryEvent): boolean { return DENY.includes(`$[e.policy_id}`) || Object.is(`$[e.policy_id}`, "y"); }\nexport function findInReasons(',
        ),
      },
      {
        name: "N5 Reflect.get with a literal key",
        path: VIEW_TS,
        from: "export function findInReasons(",
        to: 'export function isDenied(e: MemoryEvent): boolean { return String(Reflect.get(e, "reason")).startsWith("denied"); }\nexport function findInReasons(',
      },
      {
        name: "N6 Object.values through a destructured alias",
        path: VIEW_TS,
        from: "export function findInReasons(",
        to: 'const { values } = Object; export function isDenied(e: MemoryEvent): boolean { return values(e).includes("denied"); }\nexport function findInReasons(',
      },
      {
        name: "N7 class getter returning the drawn reason",
        path: VIEW_TS,
        from: "export function findInReasons(",
        to: tpl(
          'class Why { e: MemoryEvent; constructor(e: MemoryEvent) { this.e = e; } get text(): string { return `$[this.e.reason}`; } }\nexport function isDenied(e: MemoryEvent): boolean { return new Why(e).text.startsWith("denied"); }\nexport function findInReasons(',
        ),
      },
      {
        name: "N8 a deciding function named like a display helper (cut)",
        path: VIEW_TS,
        from: "export function findInReasons(",
        to: 'function cut(s: string, keep: () => void): string { if (!s.startsWith("denied")) keep(); return s; }\nexport function hideDenied(events: readonly MemoryEvent[]): MemoryEvent[] { const out: MemoryEvent[] = []; for (const e of events) cut(e.reason, () => { out.push(e); }); return out; }\nexport function findInReasons(',
      },
      {
        name: "N9 generic property picker",
        path: VIEW_TS,
        from: "export function findInReasons(",
        to: 'function get<T, K extends keyof T>(o: T, k: K): T[K] { return o[k]; }\nexport function isDenied(e: MemoryEvent): boolean { return get(e, "policy_id") === "x"; }\nexport function findInReasons(',
      },
      {
        name: "N10 optional chaining on a drawn reason (expected caught)",
        path: VIEW_TS,
        from: "export function findInReasons(",
        to: tpl(
          'export function isDenied(e?: MemoryEvent): boolean { return `$[e?.reason}`?.startsWith("denied") === true; }\nexport function findInReasons(',
        ),
      },
      {
        name: "N11 reduce concatenating drawn reasons",
        path: VIEW_TS,
        from: "export function findInReasons(",
        to: tpl(
          'export function anyDenied(events: readonly MemoryEvent[]): boolean { return events.reduce((acc, x) => acc + `$[x.reason}`, "").includes("denied"); }\nexport function findInReasons(',
        ),
      },
      {
        name: "N12 closure over a tainted local",
        path: VIEW_TS,
        from: "export function findInReasons(",
        to: tpl(
          'export function isDenied(e: MemoryEvent): boolean { const t = `$[e.reason}`; const f = () => t; return f().startsWith("denied"); }\nexport function findInReasons(',
        ),
      },
      {
        name: "N13 local predicate handed the drawn policy id",
        path: VIEW_TS,
        from: "export function findInReasons(",
        to: tpl(
          'const deny = (s: string) => s.startsWith("x");\nexport function isDenied(e: MemoryEvent): boolean { return deny(`$[e.policy_id}`); }\nexport function findInReasons(',
        ),
      },
      {
        name: "N14 Array.from of a drawn reason",
        path: VIEW_TS,
        from: "export function findInReasons(",
        to: tpl(
          'export function isDenied(e: MemoryEvent): boolean { return Array.from(`$[e.reason}`).join("").startsWith("denied"); }\nexport function findInReasons(',
        ),
      },
      {
        name: "N15 JSON round trip of a drawn reason",
        path: VIEW_TS,
        from: "export function findInReasons(",
        to: tpl(
          'export function isDenied(e: MemoryEvent): boolean { return (JSON.parse(JSON.stringify(`$[e.reason}`)) as string).startsWith("denied"); }\nexport function findInReasons(',
        ),
      },
      {
        name: "N16 spread then for-in computed key (expected caught)",
        path: VIEW_TS,
        from: "export function findInReasons(",
        to: 'export function isDenied(e: MemoryEvent): boolean { const c = { ...e }; for (const k in c) if (String(c[k as keyof typeof c]).startsWith("denied")) return true; return false; }\nexport function findInReasons(',
      },
      {
        name: "N17 template-literal key (expected caught)",
        path: VIEW_TS,
        from: "export function findInReasons(",
        to: 'export function isDenied(e: MemoryEvent): boolean { return e[`reason`].startsWith("denied"); }\nexport function findInReasons(',
      },
      {
        name: "N18 localeCompare against a drawn reason",
        path: VIEW_TS,
        from: "export function findInReasons(",
        to: tpl(
          'export function isDenied(e: MemoryEvent): boolean { return "denied".localeCompare(`$[e.reason}`) === 0; }\nexport function findInReasons(',
        ),
      },
      {
        name: "N19 String() of a drawn reason compared",
        path: VIEW_TS,
        from: "export function findInReasons(",
        to: tpl(
          'export function isDenied(e: MemoryEvent): boolean { return String(`$[e.reason}`) === "denied"; }\nexport function findInReasons(',
        ),
      },
      {
        name: "N20 Set.has of a drawn policy id",
        path: VIEW_TS,
        from: "export function findInReasons(",
        to: tpl(
          'const DENYING = new Set(["x"]);\nexport function isDenied(e: MemoryEvent): boolean { return DENYING.has(`$[e.policy_id}`); }\nexport function findInReasons(',
        ),
      },
      {
        name: "N21 Events screen hides denied via RegExp.test on a template",
        path: EVENTS_TS,
        from: "      filterEvents(this.events(), this.filter),",
        to: tpl(
          "      filterEvents(this.events(), this.filter).filter((e) => !/denied/.test(`$[e.reason}`)),",
        ),
      },
      {
        name: "N22 Events screen hides via String(safe(...)) compared",
        path: EVENTS_TS,
        from: "      filterEvents(this.events(), this.filter),",
        to: '      filterEvents(this.events(), this.filter).filter((e) => String(safe(e.reason)) !== "denied"),',
      },
      {
        name: "N23 Events screen uses the pinned findInReasons with a fixed word as a decision",
        path: EVENTS_TS,
        from: "      filterEvents(this.events(), this.filter),",
        to: '      filterEvents(this.events(), this.filter).filter((e) => !findInReasons([e], "denied").length),',
      },
      {
        name: "N24 Events screen: concatenation of oneLine(reason)",
        path: EVENTS_TS,
        from: "      filterEvents(this.events(), this.filter),",
        to: '      filterEvents(this.events(), this.filter).filter((e) => (oneLine(e.reason) + "").indexOf("denied") < 0),',
      },
      {
        name: "N25 tagged template on a reason",
        path: VIEW_TS,
        from: "export function findInReasons(",
        to: tpl(
          'const tag = (s: TemplateStringsArray, v: string) => v.startsWith("denied");\nexport function isDenied(e: MemoryEvent): boolean { return tag`$[e.reason}`; }\nexport function findInReasons(',
        ),
      },
      {
        name: "N26 destructuring a carried literal (expected caught)",
        path: VIEW_TS,
        from: "export function findInReasons(",
        to: 'export function isDenied(e: MemoryEvent): boolean { const { reason } = { reason: e.reason }; return reason === "x"; }\nexport function findInReasons(',
      },
      // Its false positives, legitimate display code that must pass (n1/mk2.mjs FP1 to FP4, with
      // the real helpers imported where the probe declared its own; FP2 through an import alias, FP5).
      // The allowlist's verification (scratchpad al/mutants.py): an answer handed to `object` or `{}`.
      {
        name: "A09 event handed to an object-typed param, Object.values searched",
        path: VIEW_TS,
        from: before,
        to: `function anyField(o: object, word: string): boolean { return Object.values(o).some((v) => String(v).includes(word)); }\nexport function mentionsGrant(e: MemoryEvent): boolean { return anyField(e, "grant"); }\n${before}`,
      },
      {
        name: "A10 event JSON.stringify through an object-typed param",
        path: VIEW_TS,
        from: before,
        to: `const dump = (o: object): string => JSON.stringify(o);\nexport function deniedByMembership(e: MemoryEvent): boolean { return dump(e).includes("not a member"); }\n${before}`,
      },
      {
        name: "B05 event handed to a {}-typed param, then for-in",
        path: VIEW_TS,
        from: before,
        to: `function scanAll(o: {}, w: string): boolean { for (const [, v] of Object.entries(o)) if (String(v).includes(w)) return true; return false; }\nexport function viaEmpty(e: MemoryEvent): boolean { return scanAll(e, "deny"); }\n${before}`,
      },
      // And what it relaxed after that verification: a placeholder for none, drawn text reassigned.
      {
        name: "pass P1 a reason that may be null, shown as a dash",
        path: VIEW_TS,
        from: before,
        to: `export function reasonOrDash(e: { reason: string | null }): string { return e.reason === null ? "-" : \`\${e.reason}\`; }\n${before}`,
      },
      {
        name: "pass P2 a policy id that may be missing, with a dash as its fallback",
        path: VIEW_TS,
        from: before,
        to: `export function policyOrDash(e: { policy_id?: string }): string { return e.policy_id ?? "-"; }\n${before}`,
      },
      {
        name: "pass P3 drawn text reassigned, cut again",
        path: EVENTS_TS,
        from: TOP,
        to: `export function shortReason(e: MemoryEvent, w: number): string { let line = oneLine(e.reason); line = cut(line, w); return line; }\n${TOP}`,
      },
      {
        name: "pass P4 a field of drawn text reassigned",
        path: EVENTS_TS,
        from: TOP,
        to: `export class Why { line = ""; set(e: MemoryEvent, w: number): void { this.line = oneLine(e.reason); this.line = cut(this.line, w); } }\n${TOP}`,
      },
      {
        name: "pass FP1 rows of drawn text, then mapped to lines",
        path: VIEW_TS,
        from: before,
        to: `export function detailLines(e: MemoryEvent): string[] { const rows = [["policy id", \`\${e.policy_id}\`], ["reason", \`\${e.reason}\`]]; return rows.map(([k, v]) => \`\${k}  \${v}\`); }\n${before}`,
      },
      {
        name: "pass FP2 a wrapped reason's line count, for scrolling",
        path: EVENTS_TS,
        from: TOP,
        to: `import { wrap as wrapLines } from "../layout.ts";\nexport function reasonHeight(e: MemoryEvent, w: number): number { const lines = wrapLines(e.reason, w); return lines.length; }\n${TOP}`,
      },
      {
        name: "pass FP3 column width from drawn reasons",
        path: VIEW_TS,
        from: before,
        to: `export function reasonWidth(events: readonly MemoryEvent[]): number { return Math.max(0, ...events.map((e) => \`\${e.reason}\`.length)); }\n${before}`,
      },
      {
        name: "pass FP4 the reason copied to the clipboard as it came",
        path: EVENTS_TS,
        from: TOP,
        to: `import type { Clipboard } from "../clipboard.ts";\nexport function copyReason(c: Clipboard, e: MemoryEvent): void { void c.copy(e.reason); }\n${TOP}`,
      },
    ];
    // Each a copy of the real file, beside it so its imports resolve, compiled as one program.
    const made = mutants.map((m, i) => {
      const text = readFileSync(join(REPO, m.path), "utf8").replaceAll("\r\n", "\n");
      expect(text.split(m.from).length - 1, m.name).toBe(1);
      const fake = join(REPO, dirname(m.path), `__mutant${i}__.ts`).replaceAll("\\", "/");
      return { ...m, fake, code: text.replace(m.from, m.to) };
    });
    const host = ts.createCompilerHost(OPTIONS);
    const read = host.getSourceFile.bind(host);
    host.getSourceFile = (f, v) => {
      const m = made.find((x) => x.fake === f);
      return m === undefined
        ? read(f, v)
        : ts.createSourceFile(f, m.code, ts.ScriptTarget.Latest, true);
    };
    const program = ts.createProgram(
      made.map((m) => m.fake),
      OPTIONS,
      host,
    );
    const checker = program.getTypeChecker();
    for (const m of made) {
      const file = program.getSourceFile(m.fake) as TS.SourceFile;
      const found = unpinned(m.path, m.code, { file, checker });
      if (m.name.startsWith("control") || m.name.startsWith("pass "))
        expect(found, m.name).toEqual([]);
      else if (LIMITS.some((l) => m.name.startsWith(`${l} `))) continue;
      else expect(found.length, m.name).toBeGreaterThan(0);
    }
  }, 300_000);

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
