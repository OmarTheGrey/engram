// The local NLI scorer of the contradiction lint's middle tier (card L7, arm
// P3 of the pre-registration's proposed amendments, not registered). Core
// defines the scorer's shape (NliScore, packages/core/src/lint/nli.ts) and
// imports no runtime; this file builds the real scorer, the cache every score
// goes through, and a scripted scorer for tests.
//
// - The model: cross-encoder/nli-deberta-v3-small (Apache-2.0, trained on
//   SNLI and MultiNLI) at a pinned revision, its fp32 ONNX export and its
//   tokenizer fetched by sha256 into .engram/upstream, never committed. Every
//   file is checked against its hash before a session is built.
// - The runtime: onnxruntime-node (MIT; its Windows, Linux and macOS CPU
//   binaries ship in the package, so nothing is compiled) and
//   @huggingface/tokenizers (Apache-2.0, pure JavaScript). One pair per run,
//   no padding, one thread, so a score depends on its pair alone.
// - The cache (AGENTS.md rules 6 and 7): every score is keyed on the model's
//   hash, the runtime's version and the pair's hash. The scorer draws
//   nothing, so there is no seed. With ENGRAM_OFFLINE=1, or offline set, a
//   miss is an error, so a replay computes no score. Scores are committed as
//   cassettes, one JSON file per key, like the model cassettes.
import { createHash } from "node:crypto";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import {
  canonicalJson,
  type NliRequest,
  type NliResponse,
  type NliScore,
  sha256,
} from "@engram/core";

/** The pinned model: repository, revision, the files the scorer reads and their sha256. */
export const NLI_MODEL = {
  repository: "cross-encoder/nli-deberta-v3-small",
  revision: "fa2804872c3b4bd748f38c0185cc85775361e735",
  /** The id a request names, and the evidence of a finding. */
  id: "cross-encoder/nli-deberta-v3-small@fa2804872c3b4bd748f38c0185cc85775361e735",
  /** The folder under .engram/upstream the files are fetched into. */
  folder: "nli-deberta-v3-small-fa2804872c3b",
  files: {
    "onnx/model.onnx": "59fd8dd78926e15907ab419303179e4196bdedd710e888773e2f0143fe430897",
    "tokenizer.json": "5124ef2ead1a10a717703bc436de7f353da76d6340e4587719b42b1693707964",
    "tokenizer_config.json": "f3eecd07c370ef0bf7dd3780d3cd68cf9c8b00c267e21a208ddcd8f82bfec1a6",
    "config.json": "885d0dceae8fa5c136da9209121ec9eb11160488e840de3bc1f29353674e5712",
    "README.md": "a9aa108025ad1984374c5e80365406bafe331aea5abc30239e1796ec0a7c267d",
  },
  /** config.json's id2label, in logit order. */
  labels: ["contradiction", "entailment", "neutral"],
  /** The longest input the model takes, special tokens included. */
  maxTokens: 512,
} as const;

/** The versions every score depends on besides the model: part of each cache key. */
export const NLI_RUNTIME = "onnxruntime-node@1.31.1+@huggingface/tokenizers@0.2.0";

/** Where the pinned files live under a repository root. */
export const nliModelDir = (repo: string) => join(repo, ".engram", "upstream", NLI_MODEL.folder);

async function fileSha256(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

/** Every pinned file in `dir` checked against its sha256; throws naming the first missing or different one. */
export async function verifyNliModel(dir: string): Promise<void> {
  for (const [file, expected] of Object.entries(NLI_MODEL.files)) {
    const path = join(dir, file);
    if (!existsSync(path))
      throw new Error(`${path} is missing; fetch the pinned NLI model first (make nli-fetch)`);
    const got = await fileSha256(path);
    if (got !== expected)
      throw new Error(`${path} has sha256 ${got}, not the pinned ${expected}; fetch it again`);
  }
}

/**
 * Fetches each pinned file missing or different in `dir` from the Hub at the
 * pinned revision, checks its sha256, and moves it into place; a file whose
 * hash differs is never kept. Refused under ENGRAM_OFFLINE=1.
 */
export async function fetchNliModel(
  dir: string,
  options: { fetch?: typeof fetch; log?: (line: string) => void } = {},
): Promise<{ fetched: string[]; kept: string[] }> {
  const get = options.fetch ?? fetch;
  const fetched: string[] = [];
  const kept: string[] = [];
  for (const [file, expected] of Object.entries(NLI_MODEL.files)) {
    const path = join(dir, file);
    if (existsSync(path) && (await fileSha256(path)) === expected) {
      kept.push(file);
      continue;
    }
    if (process.env.ENGRAM_OFFLINE === "1")
      throw new Error(`offline (ENGRAM_OFFLINE=1): ${path} is missing and is not fetched`);
    const url = `https://huggingface.co/${NLI_MODEL.repository}/resolve/${NLI_MODEL.revision}/${file}`;
    options.log?.(`fetching ${url}`);
    const response = await get(url);
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const got = createHash("sha256").update(bytes).digest("hex");
    if (got !== expected)
      throw new Error(`${url} has sha256 ${got}, not the pinned ${expected}; nothing was kept`);
    mkdirSync(dirname(path), { recursive: true });
    const temporary = `${path}.${process.pid}.tmp`;
    writeFileSync(temporary, bytes);
    renameSync(temporary, path);
    fetched.push(file);
  }
  return { fetched, kept };
}

/** Softmax in double precision, the largest logit subtracted first. */
export function softmax(logits: readonly number[]): number[] {
  const top = Math.max(...logits);
  const e = logits.map((x) => Math.exp(x - top));
  const sum = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / sum);
}

/**
 * Cuts the longer of two token lists one token at a time until both fit
 * `room` together (the Hugging Face tokenizers' `longest_first`, the second
 * list losing the tie).
 */
export function truncatePair(a: number[], b: number[], room: number): [number[], number[]] {
  const x = [...a];
  const y = [...b];
  while (x.length + y.length > room) {
    if (x.length > y.length) x.pop();
    else y.pop();
  }
  return [x, y];
}

/**
 * The version of the installed package `name`: the package.json above its
 * entry point (a package's exports may not list package.json itself).
 */
export function installedVersion(name: string): string {
  let dir = dirname(createRequire(import.meta.url).resolve(name));
  for (;;) {
    const file = join(dir, "package.json");
    if (existsSync(file)) {
      const pkg = JSON.parse(readFileSync(file, "utf8")) as { name?: string; version?: string };
      if (pkg.name === name && pkg.version !== undefined) return pkg.version;
    }
    const up = dirname(dir);
    if (up === dir) throw new Error(`no package.json for ${name}`);
    dir = up;
  }
}

/** One score with the logits it came from. */
export interface NliScored extends NliResponse {
  logits: number[];
}

/** The real scorer over a request, with the logits; what the cache records. */
export type NliRawScore = (request: NliRequest) => Promise<NliScored>;

/**
 * The real scorer: the pinned ONNX model in `dir` on onnxruntime-node, one
 * pair per run on one thread. Every file is checked against its sha256 first,
 * and the installed runtime against NLI_RUNTIME. A request for another model
 * is refused. The runtime is imported here, when a scorer is built, so
 * nothing that imports @engram/model loads a native binding.
 */
export async function onnxNliScore(dir: string): Promise<NliRawScore> {
  await verifyNliModel(dir);
  const versions = ["onnxruntime-node", "@huggingface/tokenizers"].map(
    (name) => `${name}@${installedVersion(name)}`,
  );
  if (versions.join("+") !== NLI_RUNTIME)
    throw new Error(`installed ${versions.join("+")}, but scores are keyed on ${NLI_RUNTIME}`);
  const ort = await import("onnxruntime-node");
  const { Tokenizer } = await import("@huggingface/tokenizers");
  const tokenizer = new Tokenizer(
    JSON.parse(readFileSync(join(dir, "tokenizer.json"), "utf8")),
    JSON.parse(readFileSync(join(dir, "tokenizer_config.json"), "utf8")),
  );
  const session = await ort.InferenceSession.create(join(dir, "onnx", "model.onnx"), {
    executionProviders: ["cpu"],
    intraOpNumThreads: 1,
    interOpNumThreads: 1,
    executionMode: "sequential",
  });
  const cls = tokenizer.token_to_id("[CLS]");
  const sep = tokenizer.token_to_id("[SEP]");
  if (cls === undefined || sep === undefined)
    throw new Error("the tokenizer has no [CLS] or [SEP]");
  const pieces = (text: string) => tokenizer.encode(text, { add_special_tokens: false }).ids;
  return async (request) => {
    if (request.model !== NLI_MODEL.id)
      throw new Error(`this scorer runs ${NLI_MODEL.id}, not ${request.model}`);
    const [a, b] = truncatePair(
      pieces(request.premise),
      pieces(request.hypothesis),
      NLI_MODEL.maxTokens - 3,
    );
    const ids = [cls, ...a, sep, ...b, sep];
    const tensor = (values: number[]) =>
      new ort.Tensor("int64", BigInt64Array.from(values.map(BigInt)), [1, values.length]);
    const feeds: Record<string, InstanceType<typeof ort.Tensor>> = {};
    for (const name of session.inputNames) {
      if (name === "input_ids") feeds[name] = tensor(ids);
      else if (name === "attention_mask") feeds[name] = tensor(ids.map(() => 1));
      else if (name === "token_type_ids")
        feeds[name] = tensor([0, ...a.map(() => 0), 0, ...b.map(() => 1), 1]);
      else throw new Error(`the NLI model asks for an input ${name} this scorer does not know`);
    }
    const out = await session.run(feeds);
    const output = out[session.outputNames[0] as string];
    if (output === undefined) throw new Error("the NLI model returned no output");
    const logits = [...(output.data as Float32Array)].map(Number);
    if (logits.length !== NLI_MODEL.labels.length)
      throw new Error(
        `the NLI model returned ${logits.length} logits, not ${NLI_MODEL.labels.length}`,
      );
    const [contradiction, entailment, neutral] = softmax(logits) as [number, number, number];
    return { contradiction, entailment, neutral, logits };
  };
}

/** The hash of a pair, as its cache key names it. */
export const nliPairHash = (request: Pick<NliRequest, "premise" | "hypothesis">) =>
  sha256(canonicalJson({ premise: request.premise, hypothesis: request.hypothesis }));

/** A score's cache key: the model's hash, the runtime's version and the pair's hash. */
export function nliCacheKey(request: NliRequest): string {
  if (request.model !== NLI_MODEL.id && !request.model.startsWith("scripted/"))
    throw new Error(`no pinned hash for the NLI model ${request.model}`);
  const model = request.model.startsWith("scripted/")
    ? request.model
    : NLI_MODEL.files["onnx/model.onnx"];
  return sha256(canonicalJson({ model, runtime: NLI_RUNTIME, pair: nliPairHash(request) }));
}

/** One cassette: a score and what it was keyed on. */
export interface NliCacheEntry {
  key: string;
  model: string;
  model_sha256: string;
  runtime: string;
  pair: string;
  request: NliRequest;
  response: NliScored;
}

export interface NliCacheStore {
  get(key: string): NliCacheEntry | undefined;
  set(entry: NliCacheEntry): void;
}

export function memoryNliCache(): NliCacheStore {
  const entries = new Map<string, NliCacheEntry>();
  return { get: (k) => entries.get(k), set: (e) => void entries.set(e.key, e) };
}

/** One JSON file per score, named by key; a file that does not parse is an error, never a miss. */
export function nliFileCache(dir: string): NliCacheStore {
  const path = (key: string) => join(resolve(dir), `${key}.json`);
  return {
    get(key) {
      let text: string;
      try {
        text = readFileSync(path(key), "utf8");
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") return undefined;
        throw e;
      }
      try {
        return JSON.parse(text) as NliCacheEntry;
      } catch (e) {
        throw new Error(`corrupt NLI cassette ${path(key)}: ${(e as Error).message}`);
      }
    },
    set(entry) {
      mkdirSync(resolve(dir), { recursive: true });
      const target = path(entry.key);
      const temporary = `${target}.${process.pid}.tmp`;
      writeFileSync(temporary, `${JSON.stringify(entry, null, 2)}\n`);
      renameSync(temporary, target);
    },
  };
}

export class NliMissError extends Error {
  readonly key: string;

  constructor(key: string, request: NliRequest) {
    super(
      `offline (ENGRAM_OFFLINE=1, or a replay) and no NLI score for key ${key} (model ${request.model}, pair ${nliPairHash(request)}); record it first (make nli-scores)`,
    );
    this.key = key;
  }
}

export interface CachedNliOptions {
  cache: NliCacheStore;
  /** Refuse misses. When unset, ENGRAM_OFFLINE=1 is checked on every score. */
  offline?: boolean;
  /** Called once per score: whether the cache answered it. */
  onScore?: (record: { key: string; hit: boolean }) => void;
}

/**
 * An NliScore behind the cache: a hit returns the recorded probabilities, a
 * miss asks `inner` (when not offline) and records its answer. What core gets
 * is the three probabilities; the logits stay in the cassette.
 */
export function cachedNli(inner: NliRawScore, options: CachedNliOptions): NliScore {
  const offline = () => options.offline ?? process.env.ENGRAM_OFFLINE === "1";
  return async (request) => {
    const key = nliCacheKey(request);
    let scored = options.cache.get(key)?.response;
    const hit = scored !== undefined;
    if (scored === undefined) {
      if (offline()) throw new NliMissError(key, request);
      scored = await inner(request);
      options.cache.set({
        key,
        model: request.model,
        model_sha256:
          request.model === NLI_MODEL.id ? NLI_MODEL.files["onnx/model.onnx"] : request.model,
        runtime: NLI_RUNTIME,
        pair: nliPairHash(request),
        request,
        response: scored,
      });
    }
    options.onScore?.({ key, hit });
    return {
      contradiction: scored.contradiction,
      entailment: scored.entailment,
      neutral: scored.neutral,
    };
  };
}

/**
 * A scripted scorer for tests (testing convention, "Models are scripted, not
 * mocked"): it answers a pair from `answer`, as logits, and fails loudly on a
 * pair `answer` does not know (returns undefined for) or on another model.
 */
export function scriptedNliScore(
  model: string,
  answer: (premise: string, hypothesis: string) => readonly number[] | undefined,
): NliRawScore {
  if (!model.startsWith("scripted/"))
    throw new Error(`a scripted NLI scorer is named scripted/<id>, not ${model}`);
  return async (request) => {
    if (request.model !== model)
      throw new Error(`this scripted scorer is ${model}, not ${request.model}`);
    const logits = answer(request.premise, request.hypothesis);
    if (logits === undefined)
      throw new Error(`the scripted NLI scorer has no answer for ${JSON.stringify(request)}`);
    const [contradiction, entailment, neutral] = softmax(logits) as [number, number, number];
    return { contradiction, entailment, neutral, logits: [...logits] };
  };
}
