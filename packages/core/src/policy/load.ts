// Policy loader and validator (card E2.1). YAML text becomes a `Policy`
// (schema.ts, ADR 0006) or a `PolicyError` whose every problem carries the
// line and column of the YAML node at fault, for syntax errors and schema
// errors alike. `parsePolicy` is pure; `loadPreset` reads only the bundled
// files under packages/core/policies/, never a memory store.
import { readFileSync } from "node:fs";
import {
  Document,
  isAlias,
  isMap,
  isPair,
  isScalar,
  isSeq,
  LineCounter,
  type Node,
  type Pair,
  parseDocument,
} from "yaml";
import type { z } from "zod";
import { Policy } from "../schema.ts";

export type PolicyPath = (string | number)[];

/** One reason a policy was rejected; `line` and `col` are 1-based. */
export interface PolicyProblem {
  message: string;
  /** Where in the policy object the fault is; empty for a syntax error. */
  path: PolicyPath;
  line: number;
  col: number;
}

export class PolicyError extends Error {
  readonly source: string;
  readonly problems: PolicyProblem[];

  constructor(source: string, problems: PolicyProblem[]) {
    super(problems.map((p) => `${source}:${p.line}:${p.col}: ${p.message}`).join("\n"));
    this.name = "PolicyError";
    this.source = source;
    this.problems = problems;
  }
}

/** Parse and validate one policy document. `source` names it in errors. */
export function parsePolicy(text: string, source: string): Policy {
  const lineCounter = new LineCounter();
  const doc = parseDocument(text, { lineCounter, prettyErrors: false, uniqueKeys: true });
  const at = (offset: number) => {
    const { line, col } = lineCounter.linePos(offset);
    return { line, col };
  };

  const syntax = [...doc.errors, ...doc.warnings].map((e) => ({
    message: e.message,
    path: [],
    ...at(e.pos[0]),
  }));
  if (syntax.length > 0) throw new PolicyError(source, sorted(syntax));

  const fail = (problems: Located[]) =>
    new PolicyError(
      source,
      sorted(problems.map(({ path, message, key }) => locate(doc, at, path, message, key))),
    );
  const parsed = Policy.safeParse(doc.toJS());
  if (!parsed.success) throw fail(parsed.error.issues.flatMap((issue) => schemaProblems(issue)));
  const semantic = semanticProblems(parsed.data);
  if (semantic.length > 0) throw fail(semantic);
  return parsed.data;
}

/** The bundled strictness presets, strictest first. */
export const PRESETS = ["strict", "medium", "permissive"] as const;
export type PresetName = (typeof PRESETS)[number];

/** Where a bundled preset's YAML lives. */
export function presetUrl(name: PresetName): URL {
  if (!PRESETS.includes(name))
    throw new Error(`unknown preset "${name}"; expected one of ${PRESETS.join(", ")}`);
  return new URL(`../../policies/${name}.yaml`, import.meta.url);
}

/** Load and validate a bundled preset by name. */
export function loadPreset(name: PresetName): Policy {
  return parsePolicy(readFileSync(presetUrl(name), "utf8"), `policies/${name}.yaml`);
}

interface Located {
  path: PolicyPath;
  message: string;
  /** Point at this key of the mapping at `path` rather than at the mapping. */
  key?: string;
}

function schemaProblems(issue: z.core.$ZodIssue): Located[] {
  const path = issue.path.filter((s): s is string | number => typeof s !== "symbol");
  if (issue.code === "unrecognized_keys")
    return issue.keys.map((key) => ({ path, key, message: `unknown field "${key}"` }));
  return [{ path, message: issue.message }];
}

/**
 * Checks the schema cannot express: the evaluator looks a rule up by scope
 * level (and class, for retention), so two rules for the same key would make
 * the decision depend on their order.
 */
function semanticProblems(policy: Policy): Located[] {
  const out: Located[] = [];
  const unique = <T>(
    rows: T[],
    key: (r: T) => string,
    path: (i: number) => PolicyPath,
    what: string,
  ) => {
    const seen = new Set<string>();
    rows.forEach((row, i) => {
      const k = key(row);
      if (seen.has(k)) out.push({ path: path(i), message: `a second ${what} for ${k}` });
      seen.add(k);
    });
  };
  unique(
    policy.write,
    (r) => r.scope,
    (i) => ["write", i, "scope"],
    "write rule",
  );
  unique(
    policy.read.matrix,
    (r) => r.reader,
    (i) => ["read", "matrix", i, "reader"],
    "read matrix row",
  );
  unique(
    policy.retention,
    (r) => `${r.scope} ${r.class}`,
    (i) => ["retention", i, "scope"],
    "retention rule",
  );
  const { replay_k, replay_n } = policy.promotion.procedural;
  if (replay_k > replay_n)
    out.push({
      path: ["promotion", "procedural", "replay_k"],
      message: `replay_k (${replay_k}) exceeds replay_n (${replay_n})`,
    });
  return out;
}

/** Find the YAML node for `path`, falling back to the deepest node that exists. */
function locate(
  doc: Document,
  at: (offset: number) => { line: number; col: number },
  path: PolicyPath,
  message: string,
  key?: string,
): PolicyProblem {
  let node: unknown = doc.contents;
  let missing: string | number | undefined;
  for (const seg of path) {
    const next = child(doc, node, seg);
    if (next === undefined) {
      missing = seg;
      break;
    }
    node = next;
  }
  if (key !== undefined && missing === undefined) {
    const pair = pairFor(node, key);
    if (pair) node = pair.key;
  }
  const where = at(offsetOf(node));
  const text =
    missing !== undefined && path[path.length - 1] === missing
      ? `missing required field "${missing}"`
      : message;
  return { message: text, path, ...where };
}

function child(doc: Document, node: unknown, seg: string | number): unknown {
  let next: unknown;
  if (isMap(node)) {
    const pair = pairFor(node, String(seg));
    next = pair ? (pair.value ?? pair.key) : undefined;
  } else if (isSeq(node) && typeof seg === "number") {
    next = node.items[seg];
  }
  return isAlias(next) ? next.resolve(doc) : next;
}

function pairFor(node: unknown, key: string): Pair | undefined {
  if (!isMap(node)) return undefined;
  return node.items.find((p) => isPair(p) && keyText(p.key) === key) as Pair | undefined;
}

/**
 * A key as the schema sees it: a scalar's value, or a complex key (`? [a, b]`)
 * as its YAML flow text, which is how the yaml package names it in toJS.
 */
function keyText(key: unknown): string {
  return isScalar(key) ? String(key.value) : new Document(key).toString().trim();
}

function offsetOf(node: unknown): number {
  return (node as Node | null)?.range?.[0] ?? 0;
}

const sorted = (ps: PolicyProblem[]) => [...ps].sort((a, b) => a.line - b.line || a.col - b.col);
