// Vendors the LongMemEval fixture subset (card B5). Deterministic: the same
// upstream files and seed always give the same bytes. Development time only;
// it reads a local copy of the upstream files and never the network.
//
//   node packages/bench/scripts/vendor-longmemeval.ts --upstream <dir> --out fixtures/bench/longmemeval [--fetch]
//
// <dir> holds `repo/` (upstream's files at commit 9e0b455: LICENSE, README.md,
// src/evaluation/evaluate_qa.py, src/evaluation/print_qa_metrics.py,
// src/generation/run_generation.py) and `data/longmemeval_oracle.json` (the
// cleaned release at revision 98d7416). The manifest records the sha256 of
// every upstream file read, so a different commit or revision is visible.
// Upstream code is read as text, never imported or run.
//
// Selection rule:
//   1. group the 500 questions by category: the question type, with
//      `+abstention` when the id contains `_abs` (upstream's rule): ten
//      categories, from 6 to 127 questions each;
//   2. in each category, in the order of CATEGORIES, keep the questions whose
//      record is at most MAX_BYTES of JSON (the fixture stays small enough to
//      commit), sort them by id and shuffle them with the seeded PRNG; take the
//      first PER_CATEGORY (if fewer qualify, the smallest records of the
//      category, by size then id): 20 questions;
//   3. questions.jsonl lists them in category order, each upstream record
//      re-serialised with its keys in upstream's order.
//
// The scripted reader and judge replies (script.json, judge-script.json)
// follow fixed rules, see scriptSteps and judgeScript below; they check the
// pipeline and are never results.
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { LONGMEMEVAL_UPSTREAM } from "../src/longmemeval/pinned.ts";
import {
  categoryOf,
  isAbstention,
  QUESTION_TYPES,
  type Question,
} from "../src/longmemeval/schema.ts";
import { prng } from "./vendor-gatemem.ts";

export const SEED = 20261107;
export const PER_CATEGORY = 2;
export const MAX_BYTES = 12_000;

/** The ten categories, upstream's type order, each followed by its abstention variant where one exists. */
export const CATEGORIES = QUESTION_TYPES.flatMap((t) => [t, `${t}+abstention`]);

/** Upstream files read, hashed into the manifest; the sources are vendored for prompt.test.ts. */
export const HASHED_FILES = [
  "repo/LICENSE",
  "repo/README.md",
  "repo/src/evaluation/evaluate_qa.py",
  "repo/src/evaluation/print_qa_metrics.py",
  "repo/src/generation/run_generation.py",
  "data/longmemeval_oracle.json",
] as const;
const VENDORED_SOURCES = [
  "src/evaluation/evaluate_qa.py",
  "src/evaluation/print_qa_metrics.py",
  "src/generation/run_generation.py",
] as const;

const sha256 = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const lineHashes = (text: string) => {
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines.map(sha256);
};

function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/** The selection rule of the header, over upstream's records. */
export function selectQuestions(all: readonly Question[], seed = SEED): Question[] {
  const rand = prng(seed);
  const size = (q: Question) => Buffer.byteLength(JSON.stringify(q));
  return CATEGORIES.flatMap((category) => {
    const members = all.filter((q) => categoryOf(q) === category);
    if (members.length === 0) return [];
    const small = members
      .filter((q) => size(q) <= MAX_BYTES)
      .sort((a, b) => (a.question_id < b.question_id ? -1 : 1));
    const picked = shuffle(small, rand).slice(0, PER_CATEGORY);
    if (picked.length === PER_CATEGORY) return picked;
    const rest = members
      .filter((q) => !picked.includes(q))
      .sort((a, b) => size(a) - size(b) || (a.question_id < b.question_id ? -1 : 1));
    return [...picked, ...rest.slice(0, PER_CATEGORY - picked.length)];
  });
}

/**
 * The scripted reader of each question: one memory_read with the question as
 * its query, then a reply. The reply is upstream's answer for the first pick
 * of each non-abstention category and "I don't know." for the second; for an
 * abstention question it says the chat history does not hold it. So the
 * pipeline meets both judge labels in every category.
 */
export function scriptSteps(selected: readonly Question[]): Record<string, unknown[]> {
  const seen = new Map<string, number>();
  return Object.fromEntries(
    selected.map((q) => {
      const k = seen.get(categoryOf(q)) ?? 0;
      seen.set(categoryOf(q), k + 1);
      const reply = isAbstention(q)
        ? "The chat history does not say, so I cannot answer that."
        : k === 0
          ? String(q.answer)
          : "I don't know.";
      return [
        q.question_id,
        [
          {
            toolCall: { id: "call-1", name: "memory_read", arguments: { query: q.question } },
          },
          { text: reply },
        ],
      ];
    }),
  );
}

/** The scripted judge: "yes" exactly when the scripted reply is upstream's answer or an abstention. */
export function judgeScript(
  selected: readonly Question[],
  steps: Record<string, unknown[]>,
): Record<string, string> {
  return Object.fromEntries(
    selected.map((q) => {
      const step = steps[q.question_id]?.[1] as { text: string } | undefined;
      const reply = step?.text ?? "";
      return [q.question_id, isAbstention(q) || reply === String(q.answer) ? "yes" : "no"];
    }),
  );
}

/** Where each hashed file comes from at the pin: the repository's raw files and the dataset's revision. */
export function pinnedUrl(file: (typeof HASHED_FILES)[number]): string {
  const u = LONGMEMEVAL_UPSTREAM;
  if (file.startsWith("repo/")) {
    const path = file.slice("repo/".length);
    return `https://raw.githubusercontent.com/xiaowu0162/LongMemEval/${u.commit}/${path}`;
  }
  return `${u.dataset}/resolve/${u.dataset_revision}/${u.file}`;
}

/**
 * Fetch every missing upstream file at the pin into `up` (data and source
 * text only; nothing fetched is run). Refused under ENGRAM_OFFLINE=1.
 */
async function fetchMissing(up: string): Promise<void> {
  const missing = HASHED_FILES.filter((f) => !existsSync(join(up, f)));
  if (missing.length === 0) return;
  if (process.env.ENGRAM_OFFLINE === "1") {
    throw new Error(`ENGRAM_OFFLINE=1: refusing to fetch ${missing.join(", ")} into ${up}`);
  }
  for (const f of missing) {
    const res = await fetch(pinnedUrl(f));
    if (!res.ok) throw new Error(`fetching ${pinnedUrl(f)}: HTTP ${res.status}`);
    mkdirSync(dirname(join(up, f)), { recursive: true });
    writeFileSync(join(up, f), Buffer.from(await res.arrayBuffer()));
    console.log(`fetched ${f}`);
  }
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      upstream: { type: "string" },
      out: { type: "string" },
      fetch: { type: "boolean", default: false },
    },
  });
  if (!values.upstream || !values.out) {
    console.error("usage: vendor-longmemeval.ts --upstream <dir> --out <dir> [--fetch]");
    return 2;
  }
  if (values.fetch) await fetchMissing(values.upstream);
  const up = values.upstream;
  const out = values.out;
  const all = JSON.parse(
    readFileSync(join(up, "data/longmemeval_oracle.json"), "utf8"),
  ) as Question[];
  const selected = selectQuestions(all);
  const steps = scriptSteps(selected);
  const judge = judgeScript(selected, steps);

  mkdirSync(out, { recursive: true });
  const questions = selected.map((q) => `${JSON.stringify(q)}\n`).join("");
  const script = `${JSON.stringify({ steps }, null, 2)}\n`;
  const judgeText = `${JSON.stringify(judge, null, 2)}\n`;
  writeFileSync(join(out, "questions.jsonl"), questions);
  writeFileSync(join(out, "script.json"), script);
  writeFileSync(join(out, "judge-script.json"), judgeText);
  copyFileSync(join(up, "repo/LICENSE"), join(out, "UPSTREAM-LICENSE"));
  const files: Record<string, string[]> = {
    "questions.jsonl": lineHashes(questions),
    "script.json": lineHashes(script),
    "judge-script.json": lineHashes(judgeText),
  };
  for (const f of VENDORED_SOURCES) {
    const target = join(out, "upstream", f);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(up, "repo", f), target);
    files[`upstream/${f}`] = lineHashes(readFileSync(target, "utf8"));
  }
  const manifest = {
    source: LONGMEMEVAL_UPSTREAM,
    seed: SEED,
    rule: "packages/bench/scripts/vendor-longmemeval.ts (module header)",
    upstream_sha256: Object.fromEntries(
      HASHED_FILES.map((f) => [f, sha256(readFileSync(join(up, f)))]),
    ),
    questions: selected.map((q) => ({
      question_id: q.question_id,
      category: categoryOf(q),
      sessions: q.haystack_sessions.length,
      turns: q.haystack_sessions.reduce((n, s) => n + s.length, 0),
    })),
    files,
  };
  writeFileSync(join(out, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`vendored ${selected.length} questions into ${out}`);
  return 0;
}

if (import.meta.main) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (e: unknown) => {
      console.error(e instanceof Error ? e.message : e);
      process.exitCode = 1;
    },
  );
}
