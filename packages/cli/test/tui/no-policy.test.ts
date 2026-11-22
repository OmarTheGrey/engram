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
const CORE = join(REPO, "packages", "core", "src");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".ts") ? [p] : [];
  });
}

const sources = files(TUI).map((p) => ({
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
const DECISION_FIELDS = new Set(["reason", "policy_id", "policyId", "admittedBy"]);
/** The helpers that only draw text. */
const DISPLAY = new Set(["oneLine", "safe", "cut", "fit", "para", "wrap"]);

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

/** Whether a decision field read at `node` is only drawn: a display helper's argument or a template's. */
function onlyDrawn(node: TS.Node): boolean {
  const { parent, child } = consumer(node);
  if (ts.isTemplateSpan(parent)) return true;
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

/** Every place a source decides on a decision field, or writes a string a screen must not. */
function violations(path: string, text: string): string[] {
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const out: string[] = [];
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
    const value = folded(n);
    const isOuterChain =
      n.parent === undefined ||
      !(ts.isBinaryExpression(n.parent) && folded(n.parent) !== undefined);
    if (value !== undefined && isOuterChain) {
      const bad = badString(value);
      if (bad !== undefined) out.push(`${at(n)}: ${bad} in ${JSON.stringify(value.slice(0, 80))}`);
    }
    if (ts.isTemplateExpression(n))
      for (const part of [n.head, ...n.templateSpans.map((s) => s.literal)]) {
        const bad = badString(part.text);
        if (bad !== undefined) out.push(`${at(n)}: ${bad} in a template`);
      }
    ts.forEachChild(n, visit);
  };
  visit(file);
  return out;
}

/** A probe's source with a template placeholder: `$[` stands for the dollar and brace a template opens with. */
const tpl = (code: string) => code.replaceAll("$[", `${"$"}{`);

describe("no policy in the TUI's source", () => {
  it("reads its forbidden lists from core, and they are not empty", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(3);
    expect(RULE_IDS.length).toBeGreaterThan(30);
    expect(RULE_AREAS).toEqual(expect.arrayContaining(["engram/write/", "engram/promote/"]));
    expect(sources.length).toBeGreaterThan(20);
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
    expect(sources.flatMap((s) => violations(s.path, s.text))).toEqual([]);
  });

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
