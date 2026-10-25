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
  visit,
} from "yaml";
import type { z } from "zod";
import { LIFECYCLE_TRIGGERS, LINT_IDS, LINT_THRESHOLD_KEYS } from "../lint.ts";
import { Policy, ScopeLevel } from "../schema.ts";

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
    new PolicyError(source, sorted(problems.map((p) => locate(doc, at, p))));
  let js: unknown;
  try {
    js = doc.toJS();
  } catch (e) {
    // The yaml package throws a plain ReferenceError when aliases expand past
    // its limit (a resource exhaustion guard); report it like any other fault.
    // Everything toJS throws is an Error (yaml 2.9.1), so `message` is there.
    const message = `the document cannot be read: ${(e as Error).message}`;
    throw new PolicyError(source, [{ message, path: [], ...at(firstAliasOffset(doc)) }]);
  }
  const parsed = Policy.safeParse(js);
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
  /** Point at the key that holds the node at `path` rather than at the node. */
  atKey?: boolean;
}

function schemaProblems(issue: z.core.$ZodIssue): Located[] {
  const path = issue.path.filter((s): s is string | number => typeof s !== "symbol");
  if (issue.code === "unrecognized_keys")
    return issue.keys.map((key) => ({ path, key, message: `unknown field "${key}"` }));
  return [{ path, message: issue.message }];
}

/**
 * Checks the schema cannot express. The evaluator looks a rule up by scope
 * level (and class, for retention), so two rules for the same key would make
 * the decision depend on their order. A policy must also cover every level
 * (D3, ADR 0006 amendment): the evaluator default-denies a missing level, but
 * a loaded policy with a gap is a mistake to report, not a rule to apply. Lint
 * ids and threshold keys come from the registry in lint.ts (D2, ADR 0008).
 */
function semanticProblems(policy: Policy): Located[] {
  const out: Located[] = [];
  const complete = (present: string[], path: PolicyPath, what: string) => {
    const missing = ScopeLevel.options.filter((level) => !present.includes(level));
    if (missing.length > 0)
      out.push({ path, atKey: true, message: `no ${what} for ${missing.join(", ")}` });
  };
  complete(
    policy.write.map((r) => r.scope),
    ["write"],
    "write rule",
  );
  complete(
    policy.read.matrix.map((r) => r.reader),
    ["read", "matrix"],
    "read matrix row",
  );
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
  const seenLints = new Set<string>();
  policy.lints.enabled.forEach((id, i) => {
    const path = ["lints", "enabled", i];
    if (seenLints.has(id)) out.push({ path, message: `a second entry for lint id ${id}` });
    else if ((LIFECYCLE_TRIGGERS as readonly string[]).includes(id))
      out.push({
        path,
        message: `"${id}" is a procedural lifecycle trigger (ADR 0011), not a lint; set its thresholds under lints.thresholds`,
      });
    else if ((LINT_THRESHOLD_KEYS as readonly string[]).includes(id))
      out.push({
        path,
        message: `"${id}" is a threshold key, not a lint id; set it under lints.thresholds`,
      });
    else if (!(LINT_IDS as readonly string[]).includes(id))
      out.push({
        path,
        message: `unknown lint id "${id}"; expected one of ${LINT_IDS.join(", ")}`,
      });
    seenLints.add(id);
  });
  for (const key of Object.keys(policy.lints.thresholds))
    if (!(LINT_THRESHOLD_KEYS as readonly string[]).includes(key))
      out.push({
        path: ["lints", "thresholds"],
        key,
        message: `unknown threshold key "${key}"; expected one of ${LINT_THRESHOLD_KEYS.join(", ")}`,
      });
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
  { path, message, key: ownKey, atKey }: Located,
): PolicyProblem {
  const walk = atKey ? path.slice(0, -1) : path;
  const key = atKey ? String(path[path.length - 1]) : ownKey;
  let node: unknown = doc.contents;
  let missing: string | number | undefined;
  for (const seg of walk) {
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
    missing !== undefined && walk.length === path.length && path[path.length - 1] === missing
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

/** Where the first alias is, or the start of the document if it has none. */
function firstAliasOffset(doc: Document): number {
  let offset = 0;
  visit(doc, {
    Alias(_, node) {
      offset = offsetOf(node);
      return visit.BREAK;
    },
  });
  return offset;
}

function offsetOf(node: unknown): number {
  return (node as Node | null)?.range?.[0] ?? 0;
}

const sorted = (ps: PolicyProblem[]) => [...ps].sort((a, b) => a.line - b.line || a.col - b.col);
