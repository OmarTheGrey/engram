// Vendors the GateMem fixture subset (card B1). Deterministic: the same
// upstream files and seed always give the same bytes. Development time only;
// it reads a local copy of the upstream repository and never the network.
//
//   node packages/bench/scripts/vendor-gatemem.ts --upstream <dir> --out fixtures/bench/gatemem
//
// <dir> holds the upstream files at commit a983828 (a clone checked out at
// that commit, or the raw files fetched at that commit); the manifest records
// the sha256 of every upstream file read, so a different commit is visible.
//
// Selection rule, per domain in alphabetical order:
//   1. sort the domain's episode ids; draw one with the seeded PRNG;
//   2. group that episode's checkpoints by query_type, sort each group by
//      checkpoint_id and shuffle it with the PRNG;
//   3. take 2 utility, 2 privacy (access control) and 2 safety (forgetting),
//      minus one from the type at position (domain index mod 3), so 5 per
//      domain and 20 in all; the privacy picks prefer one expected "refuse"
//      and one expected "answer_redacted" when the episode has both.
// The scripted model's responses (script.json) follow a fixed rule too, see
// scriptResponses below.
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

export const UPSTREAM = {
  repository: "https://github.com/rzhub/GateMem",
  commit: "a983828b3bb7565e16e25ac8cdc2fc1982633b0b",
  dataset: "https://huggingface.co/datasets/Ray368/GateMem",
  dataset_revision: "b4304866ec8d9784fb77bebb1ce4660806abcded",
} as const;

export const DOMAINS = ["education", "household", "medical", "office"] as const;
export const SEED = 20261025;
const TYPES = ["utility", "privacy", "safety"] as const;

/** Upstream files read by the port or the vendoring, hashed into the manifest. */
export const HASHED_FILES = [
  "LICENSE",
  "DATASET_CARD.md",
  "CITATION.cff",
  "bench/agents/base.py",
  "bench/agents/example_agent.py",
  "bench/agents/long_context.py",
  "bench/agents/utils_llm.py",
  "bench/domains.py",
  "bench/eval/metrics.py",
  "bench/eval/runner.py",
  "bench/eval/scorer.py",
  "bench/prompts/query_prompt.txt",
  "bench/prompts/judge_prompt.txt",
  "bench/scripts/score_predictions.py",
  "docs/evaluation_protocol.md",
  "docs/prediction_format.md",
  ...DOMAINS.flatMap((d) => [
    `bench/data/${d}/episodes.jsonl`,
    `bench/data/${d}/checkpoints.jsonl`,
  ]),
] as const;

const sha256 = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");

/** mulberry32: a small seeded PRNG, so the selection never depends on Math.random. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

interface Line {
  text: string;
  value: Record<string, unknown>;
}

function jsonlLines(path: string): Line[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((text) => ({ text, value: JSON.parse(text) as Record<string, unknown> }));
}

const byId = (key: string) => (a: Line, b: Line) =>
  String(a.value[key]) < String(b.value[key]) ? -1 : 1;

function pickPrivacy(group: Line[], n: number): Line[] {
  const picked: Line[] = [];
  for (const action of ["refuse", "answer_redacted"]) {
    const hit = group.find((c) => c.value.expected_action === action && !picked.includes(c));
    if (hit && picked.length < n) picked.push(hit);
  }
  for (const c of group) if (picked.length < n && !picked.includes(c)) picked.push(c);
  return picked;
}

export interface Selection {
  domain: string;
  episode: Line;
  checkpoints: Line[];
}

export function select(upstream: string, seed = SEED): Selection[] {
  const rand = prng(seed);
  return DOMAINS.map((domain, index) => {
    const dir = join(upstream, "bench", "data", domain);
    const episodes = jsonlLines(join(dir, "episodes.jsonl")).sort(byId("episode_id"));
    const episode = episodes[Math.floor(rand() * episodes.length)] as Line;
    const all = jsonlLines(join(dir, "checkpoints.jsonl"));
    const mine = all.filter((c) => c.value.episode_id === episode.value.episode_id);
    const picked = new Set<Line>();
    TYPES.forEach((type, t) => {
      const group = shuffle(
        mine.filter((c) => c.value.query_type === type).sort(byId("checkpoint_id")),
        rand,
      );
      const n = t === index % 3 ? 1 : 2;
      const take = type === "privacy" ? pickPrivacy(group, n) : group.slice(0, n);
      for (const c of take) picked.add(c);
    });
    // Upstream order, so the vendored file is a subsequence of the upstream one.
    return { domain, episode, checkpoints: all.filter((c) => picked.has(c)) };
  });
}

const REFUSE_PRIV =
  "I can’t help with that because the requester is not authorized to access that information.";
const NO_MEMORY = "I don’t have corresponding memory for that.";

function looksLikeRegex(p: string): boolean {
  return p.includes("\\") || /[[\]()|?+*{}]/.test(p);
}

function leakPatterns(c: Record<string, unknown>): string[] {
  const spec = (c.judge_spec ?? {}) as { not_include?: string[] };
  return [...(spec.not_include ?? []), ...((c.leak_targets as string[] | undefined) ?? [])];
}

/**
 * The scripted model's raw text per checkpoint. Rule: answer with the
 * expected action and a neutral sentence (the upstream refusal and no-memory
 * strings for those actions), except four planted cases, in selection order:
 * the first privacy checkpoint with a literal leak pattern answers with that
 * pattern (a planted leak); the first privacy checkpoint expected to refuse
 * refuses (a planted refusal); the first utility checkpoint answers inside a
 * ```json fence; the first safety checkpoint answers in plain text, not JSON,
 * so the upstream fallback that infers an action from text runs.
 */
export function scriptResponses(selection: Selection[]): {
  responses: Record<string, string>;
  planted: Record<string, string>;
} {
  const all = selection.flatMap((s) => s.checkpoints.map((c) => c.value));
  const id = (c: Record<string, unknown>) => String(c.checkpoint_id);
  const leak = all.find(
    (c) => c.query_type === "privacy" && leakPatterns(c).some((p) => !looksLikeRegex(p)),
  );
  const refusal = all.find(
    (c) => c !== leak && c.query_type === "privacy" && c.expected_action === "refuse",
  );
  const fenced = all.find((c) => c.query_type === "utility");
  const plain = all.find((c) => c.query_type === "safety");
  if (!leak || !refusal || !fenced || !plain) throw new Error("selection lacks a planted case");
  const json = (action: string, answer: string) =>
    JSON.stringify({ action, answer, answer_structured: {}, used_record_ids: [] });
  const neutral: Record<string, string> = {
    answer: "Scripted answer from the fixture model.",
    answer_redacted: "Here is a high-level summary (details redacted).",
    refuse: REFUSE_PRIV,
    no_memory: NO_MEMORY,
  };
  const responses: Record<string, string> = {};
  for (const c of all) {
    const action = String(c.expected_action);
    responses[id(c)] = json(action, neutral[action] ?? neutral.answer ?? "");
  }
  const literal = leakPatterns(leak).find((p) => !looksLikeRegex(p)) as string;
  responses[id(leak)] = json("answer", `Scripted leak: ${literal}.`);
  responses[id(refusal)] = json("refuse", REFUSE_PRIV);
  responses[id(fenced)] = `\`\`\`json\n${json("answer", neutral.answer ?? "")}\n\`\`\``;
  responses[id(plain)] = "I don't have corresponding memory for that.";
  return {
    responses,
    planted: {
      leak: id(leak),
      refusal: id(refusal),
      fenced_json: id(fenced),
      plain_text: id(plain),
    },
  };
}

function main(): number {
  const { values } = parseArgs({
    options: { upstream: { type: "string" }, out: { type: "string" } },
  });
  if (!values.upstream || !values.out) {
    console.error("usage: vendor-gatemem.ts --upstream <dir> --out <dir>");
    return 2;
  }
  const { upstream, out } = values;
  const selection = select(upstream);
  for (const s of selection) {
    mkdirSync(join(out, s.domain), { recursive: true });
    writeFileSync(join(out, s.domain, "episodes.jsonl"), `${s.episode.text}\n`);
    writeFileSync(
      join(out, s.domain, "checkpoints.jsonl"),
      s.checkpoints.map((c) => `${c.text}\n`).join(""),
    );
  }
  copyFileSync(join(upstream, "LICENSE"), join(out, "UPSTREAM-LICENSE"));
  const { responses, planted } = scriptResponses(selection);
  writeFileSync(join(out, "script.json"), `${JSON.stringify({ planted, responses }, null, 2)}\n`);
  const manifest = {
    source: UPSTREAM,
    seed: SEED,
    rule: "packages/bench/scripts/vendor-gatemem.ts (header comment)",
    upstream_sha256: Object.fromEntries(
      HASHED_FILES.map((f) => [f, sha256(readFileSync(join(upstream, f)))]),
    ),
    selection: selection.map((s) => ({
      domain: s.domain,
      episode_id: s.episode.value.episode_id,
      episode_line_sha256: sha256(s.episode.text),
      turns: (s.episode.value.turns as unknown[]).length,
      checkpoints: s.checkpoints.map((c) => ({
        checkpoint_id: c.value.checkpoint_id,
        query_type: c.value.query_type,
        expected_action: c.value.expected_action,
        line_sha256: sha256(c.text),
      })),
    })),
  };
  writeFileSync(join(out, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  const n = selection.reduce((k, s) => k + s.checkpoints.length, 0);
  console.log(`vendored ${selection.length} episodes and ${n} checkpoints into ${out}`);
  return 0;
}

if (import.meta.main) process.exitCode = main();
