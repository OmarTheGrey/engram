// The near-duplicate tier (card L5, ADR 0018): MinHash over shingles for
// candidates, then a precision tier that vetoes a pair whose rare terms,
// numbers or polarity differ. Pure functions: no store, no clock, no model,
// no randomness beyond a fixed seed. det.ts turns a match into a finding.
//
// Absorbed (ADR 0037, docs/absorbed.md):
//
// - thedotmack/claude-mem at f1bb834527637231e23575e2a70c57375efdac04,
//   Apache-2.0 (LICENSE and NOTICE read at the commit), port of
//   src/services/dedup/idf.ts (the smoothed IDF), tfidfCosine.ts (the IDF
//   cosine with tf 1), idfVeto.ts (the rare-term veto), nearDuplicate.ts (the
//   shared-token guard before the cosine, and the rule that a near-duplicate is
//   a candidate a person decides on, never a merge) and the cutoff of
//   src/services/sqlite/dedup-store.ts (a term in at most `vetoDf` items is
//   rare). Changed: the veto fires only when each side holds a rare term the
//   other lacks (a substitution), not on a rare term one side adds; the
//   shared-token guard asks for min(2, |A|, |B|) shared distinct tokens, not
//   2, so a one-token text can match one-token text; the tokens drop edge
//   punctuation. The golden vectors of
//   tests/dedup/fixtures/golden.json are ported as tests.
// - DeusData/codebase-memory-mcp at 1111d9a9e1380a0429ef2250f63223706af6289a,
//   MIT (LICENSE read at the commit), port of src/simhash/minhash.c's layout:
//   K minima, one per seeded hash, the estimate as the fraction of equal
//   minima, LSH bands of r consecutive minima. Its parameters (K 64, 32 bands
//   of 2 rows, threshold 0.95, AST trigrams) are not taken; ours are derived
//   below for thresholds of 0.8 to 0.9 over text.
// - itpartypattaya/hermes-dreaming at 5b93369764cea9875d38507482f97101a9d59d1c,
//   MIT, idea only (skills/dreaming/scripts/dream.py: `_numbers_differ`,
//   `_negations`): a pair is no duplicate when, for some kind, each side holds
//   a number the other lacks, or when a word one side negates the other states
//   plainly. Written here from the idea, English only.
import { normaliseContent } from "../content-hash.ts";
import type { MemoryItem } from "../schema.ts";

// Parameters, derived (decision entry 2026-11-21-l5-decision-minhash-parameters):
//
// K = 128 permutations: the estimate's standard error sqrt(J(1-J)/K) is at
// most 0.044 (J = 0.5) and 0.032 at J = 0.85; codebase-memory-mcp's K = 64
// gives 0.063 and 0.045.
// 32 bands of 4 rows: a pair becomes a candidate with probability
// 1 - (1 - J^4)^32, which is 0.9998 at J = 0.7, 0.05 at J = 0.2 and 0.003 at
// J = 0.1; the curve's midpoint (1/32)^(1/4) is 0.42, well under the lowest
// registered threshold (0.8), so a pair the estimate would flag is almost
// never lost to banding. 32 bands of 2 rows (codebase-memory-mcp) put the
// midpoint at 0.18 and make 95 percent of pairs at J = 0.3 candidates.
// Shingles: character 3-grams for text under 32 words, word 2-grams from 32
// words. A one-word insertion keeps character 3-gram similarity near 0.9 in a
// ten-word sentence, where word 2-grams fall to 0.73; from 32 words, word
// 2-grams keep a one-word insertion at (n-2)/(n+1) >= 0.91 and keep word order.
export const MINHASH_PERMUTATIONS = 128;
export const LSH_BANDS = 32;
export const LSH_ROWS = 4;
export const MINHASH_SEED = 0x4c35;
export const WORD_SHINGLE_FLOOR = 32;
export const CHAR_SHINGLE = 3;
export const WORD_SHINGLE = 2;
/** The similarity used when a policy enables the tier and sets no `near-duplicate` threshold: preset medium's. */
export const DEFAULT_NEAR_DUPLICATE_THRESHOLD = 0.85;
/** A term in at most this many of the scope's items is rare (claude-mem's shipped `idfVetoDf`). */
export const RARE_TERM_DF = 10;
/** Shared tokens required before the cosine is trusted (claude-mem's `minSharedTokens`). */
export const MIN_SHARED_TOKENS = 2;
/**
 * The most earlier members of one LSH bucket an item reads, and the most
 * earlier candidates it estimates, the earliest by id (review finding L5-4).
 * Without it a templated corpus is quadratic; with it the pass does at most
 * 64 estimates and 32 x 64 bucket reads per item, at the cost of missing a
 * near-duplicate that only shares crowded buckets past the first 64.
 */
export const CANDIDATE_CAP = 64;

// ---------------------------------------------------------------- text

/** Leading and trailing characters that are not letters, digits or marks. */
const EDGE = /^[^\p{L}\p{N}\p{M}]+|[^\p{L}\p{N}\p{M}]+$/gu;

/** Every string in a structured content, in canonical key order. */
function strings(value: unknown, out: string[]): string[] {
  if (typeof value === "string") out.push(value);
  else if (typeof value === "number") out.push(String(value));
  else if (Array.isArray(value)) for (const v of value) strings(v, out);
  else if (value !== null && typeof value === "object")
    for (const [, v] of Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      strings(v, out);
  return out;
}

/**
 * The text a content is compared by: the merging normal form (NFKC, case
 * folded, invisible characters dropped, whitespace collapsed; ADR 0018) of a
 * text, or of a structured content's strings and numbers in key order (its
 * keys are the schema, not the content).
 */
export function comparableText(content: MemoryItem["content"]): string {
  const text = typeof content === "string" ? content : strings(content, []).join(" ");
  // A right single quotation mark (U+2019) is an apostrophe.
  return normaliseContent(text).slice("text:".length).replaceAll(String.fromCharCode(0x2019), "'");
}

/**
 * Whitespace tokens with their edge punctuation dropped, so `documented.` is
 * `documented` while a compound such as `rdlp-api` or `ffmpeg-7.1.conf` stays
 * one token (claude-mem's `tokenizeWs`, which keeps such tokens whole).
 */
export function tokens(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(" ")) {
    const t = raw.replace(EDGE, "");
    if (t !== "") out.push(t);
  }
  return out;
}

/** Which shingles a text of `words` tokens is compared by. */
export const shingleKind = (words: number): "char" | "word" =>
  words < WORD_SHINGLE_FLOOR ? "char" : "word";

/** Character 3-grams of the tokens joined by one space, or word 2-grams; a text shorter than one shingle is one shingle. */
export function shingles(toks: readonly string[], kind: "char" | "word"): Set<string> {
  const out = new Set<string>();
  if (toks.length === 0) return out;
  if (kind === "char") {
    // Code points, not UTF-16 units: an astral character is one character (review finding L5-7).
    const cps = Array.from(toks.join(" "));
    if (cps.length <= CHAR_SHINGLE) out.add(cps.join(""));
    else
      for (let i = 0; i + CHAR_SHINGLE <= cps.length; i++)
        out.add(cps.slice(i, i + CHAR_SHINGLE).join(""));
  } else if (toks.length <= WORD_SHINGLE) out.add(toks.join(" "));
  else
    for (let i = 0; i + WORD_SHINGLE <= toks.length; i++)
      out.add(toks.slice(i, i + WORD_SHINGLE).join(" "));
  return out;
}

/** Exact Jaccard similarity of two sets. */
export function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let shared = 0;
  for (const x of a) if (b.has(x)) shared++;
  return shared / (a.size + b.size - shared);
}

// ---------------------------------------------------------------- MinHash

/** Murmur3's 32-bit finaliser: a bijection that spreads every input bit. */
function fmix32(h: number): number {
  let x = h >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return x >>> 0;
}

/** FNV-1a over the UTF-16 code units, finalised by fmix32: the shingle's base hash. */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return fmix32(h);
}

/** The fixed seeds of the K hash functions: splitmix32 from MINHASH_SEED, two words per permutation. */
const SEEDS: Uint32Array = (() => {
  const out = new Uint32Array(MINHASH_PERMUTATIONS * 2);
  let state = MINHASH_SEED >>> 0;
  for (let i = 0; i < out.length; i++) {
    state = (state + 0x9e3779b9) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    out[i] = (z ^ (z >>> 16)) >>> 0;
  }
  return out;
})();

/**
 * The MinHash signature of a shingle set: for each of the K seeded hash
 * functions, the least value over the shingles (codebase-memory-mcp's
 * layout). The k-th function is fmix32((h xor a_k) + b_k) of the shingle's
 * base hash h, a bijection of 32-bit values for each k.
 */
export function signature(set: ReadonlySet<string>): Uint32Array {
  const sig = new Uint32Array(MINHASH_PERMUTATIONS).fill(0xffffffff);
  for (const s of set) {
    const h = hash32(s);
    for (let k = 0; k < MINHASH_PERMUTATIONS; k++) {
      const v = fmix32(((h ^ (SEEDS[2 * k] as number)) + (SEEDS[2 * k + 1] as number)) >>> 0);
      if (v < (sig[k] as number)) sig[k] = v;
    }
  }
  return sig;
}

/** The estimated Jaccard similarity: the fraction of equal minima. */
export function estimate(a: Uint32Array, b: Uint32Array): number {
  let equal = 0;
  for (let k = 0; k < MINHASH_PERMUTATIONS; k++) if (a[k] === b[k]) equal++;
  return equal / MINHASH_PERMUTATIONS;
}

/** The LSH band keys of a signature: band b's key is its r minima. */
export function bandKeys(sig: Uint32Array): string[] {
  const out: string[] = [];
  for (let b = 0; b < LSH_BANDS; b++)
    out.push(`${b}:${Array.from(sig.subarray(b * LSH_ROWS, (b + 1) * LSH_ROWS)).join(",")}`);
  return out;
}

/** The probability that a pair of Jaccard similarity `j` shares at least one band. */
export const candidateProbability = (j: number) => 1 - (1 - j ** LSH_ROWS) ** LSH_BANDS;

// ---------------------------------------------------------------- the precision tier

/** Smoothed IDF, log(1 + N / (df + 0.5)), finite and largest for an unseen term (claude-mem). */
export const idf = (df: number, n: number): number => Math.log(1 + n / (df + 0.5));

/** IDF-weighted cosine of two token bags with tf 1 (claude-mem's `tfidfCosine`). */
export function idfCosine(
  a: readonly string[],
  b: readonly string[],
  idfOf: (t: string) => number,
): number {
  const va = new Set(a);
  const vb = new Set(b);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const t of va) {
    const w = idfOf(t);
    na += w * w;
    if (vb.has(t)) dot += w * w;
  }
  for (const t of vb) {
    const w = idfOf(t);
    nb += w * w;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / Math.sqrt(na * nb);
}

/** How many distinct tokens two bags share. */
export function sharedTokens(a: readonly string[], b: readonly string[]): number {
  const vb = new Set(b);
  let n = 0;
  for (const t of new Set(a)) if (vb.has(t)) n++;
  return n;
}

/**
 * The rare-term veto: each side holds a term the other lacks whose IDF
 * exceeds `theta`, so the two differ in a discriminating term
 * (`rdlp-api` and `rdlp-plugin`, Friday and Monday). claude-mem fires on a
 * rare term on either side alone; here a rare term one side adds is no veto,
 * since a restatement with one word more is the near-duplicate this tier is for.
 * Returns the two terms, the highest-IDF one of each side, or null.
 */
export function rareTermVeto(
  a: readonly string[],
  b: readonly string[],
  idfOf: (t: string) => number,
  theta: number,
): [string, string] | null {
  const rarest = (x: readonly string[], other: ReadonlySet<string>): string | null => {
    let best: string | null = null;
    let bestIdf = theta;
    for (const t of [...new Set(x)].sort())
      if (!other.has(t) && idfOf(t) > bestIdf) {
        best = t;
        bestIdf = idfOf(t);
      }
    return best;
  };
  const ta = rarest(a, new Set(b));
  const tb = rarest(b, new Set(a));
  return ta !== null && tb !== null ? [ta, tb] : null;
}

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
// A leading minus is kept when no letter or digit precedes it, so -20 is not 20 while ffmpeg-7.1 reads 7.1.
const NUMBER = /(?<![\p{L}\p{N}])-?\d+(?:[.:/-]\d+)*|\d+(?:[.:/-]\d+)*/gu;

/**
 * The numbers of a text by kind (hermes-dreaming's idea): times (with a
 * colon), dates (with a slash, a dash or two dots), other numbers, and the
 * weekdays and months it names. Thousands separators are dropped; a time's
 * or a date's parts lose their leading zeros, so 09:00 is 9:00.
 */
export function numbersByKind(text: string): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const add = (kind: string, value: string) => {
    const set = out.get(kind) ?? new Set<string>();
    set.add(value);
    out.set(kind, set);
  };
  const plain = text.replace(/(\d),(?=\d{3}(?!\d))/g, "$1");
  for (const m of plain.matchAll(NUMBER)) {
    const n = m[0];
    const body = n.startsWith("-") ? n.slice(1) : n;
    const dated = /[/-]/.test(body) || (body.match(/\./g)?.length ?? 0) >= 2;
    const kind = n.includes(":") ? "time" : dated ? "date" : "number";
    add(kind, kind === "number" ? n : n.replace(/\d+/g, (d) => String(Number(d))));
  }
  for (const t of tokens(text)) {
    if (WEEKDAYS.includes(t)) add("weekday", t);
    if (MONTHS.includes(t) && t !== "may") add("month", t);
  }
  return out;
}

/** The number veto: for some kind, each side holds a value the other lacks. Returns the kind and the two values, or null. */
export function numberVeto(a: string, b: string): [string, string, string] | null {
  const na = numbersByKind(a);
  const nb = numbersByKind(b);
  for (const [kind, va] of [...na].sort(([x], [y]) => (x < y ? -1 : 1))) {
    const vb = nb.get(kind);
    if (vb === undefined) continue;
    const onlyA = [...va].filter((v) => !vb.has(v)).sort();
    const onlyB = [...vb].filter((v) => !va.has(v)).sort();
    if (onlyA.length > 0 && onlyB.length > 0) return [kind, onlyA[0] as string, onlyB[0] as string];
  }
  return null;
}

const NEGATIONS = new Set([
  "not",
  "no",
  "never",
  "nor",
  "neither",
  "none",
  "nothing",
  "nobody",
  "without",
  "cannot",
]);
/** A modal or auxiliary carries the negated verb: the word after it is negated too (hermes-dreaming). */
const AUXILIARIES = new Set(
  "can could should would will must may might need needs have has had do does did be been is are was were want wants going".split(
    " ",
  ),
);

const isNegation = (t: string) => NEGATIONS.has(t) || t.endsWith("n't");

/** The word a polarity is compared by: a trailing `'s` and a plural or third-person `s` dropped. */
export function stem(t: string): string {
  let s = t.endsWith("'s") ? t.slice(0, -2) : t;
  if (s.length > 4 && s.endsWith("ies")) s = `${s.slice(0, -3)}y`;
  else if (s.length > 3 && s.endsWith("s") && !s.endsWith("ss")) s = s.slice(0, -1);
  return s;
}

/** The stems a text negates, and the stems it states plainly. */
function polarity(toks: readonly string[]): { negated: Set<string>; plain: Set<string> } {
  const negatedAt = new Set<number>();
  toks.forEach((t, i) => {
    if (!isNegation(t)) return;
    for (let j = i + 1; j < toks.length; j++) {
      const w = toks[j] as string;
      if (isNegation(w) || w.length < 3) continue;
      negatedAt.add(j);
      if (!AUXILIARIES.has(w)) break;
    }
  });
  const negated = new Set<string>();
  const plain = new Set<string>();
  toks.forEach((t, i) => {
    if (negatedAt.has(i)) negated.add(stem(t));
    else if (!isNegation(t) && t.length >= 3 && !AUXILIARIES.has(t)) plain.add(stem(t));
  });
  for (const s of negated) if (AUXILIARIES.has(s)) negated.delete(s);
  return { negated, plain };
}

/** The polarity veto: a word one side negates, the other states plainly. Returns that word, or null. */
export function polarityVeto(a: readonly string[], b: readonly string[]): string | null {
  const pa = polarity(a);
  const pb = polarity(b);
  const flips = [
    ...[...pa.negated].filter((s) => !pb.negated.has(s) && pb.plain.has(s)),
    ...[...pb.negated].filter((s) => !pa.negated.has(s) && pa.plain.has(s)),
  ].sort();
  return flips[0] ?? null;
}

// ---------------------------------------------------------------- the pass

/** One item as the pass compares it. */
interface Prepared {
  item: MemoryItem;
  text: string;
  toks: string[];
  /** Signatures by shingle kind: char for a text under WORD_SHINGLE_FLOOR / t words, word from WORD_SHINGLE_FLOOR * t. */
  sigs: Partial<Record<"char" | "word", Uint32Array>>;
}

/** What the pass found about one later item: its earliest near-duplicate and the figures that admitted it. */
export interface NearDuplicateMatch {
  item: MemoryItem;
  of: MemoryItem;
  kind: "char" | "word";
  estimate: number;
  cosine: number;
}

/** What the pass did, for the near-linearity test and the research script. */
export interface NearDuplicateStats {
  items: number;
  /** Pairs that shared an LSH band and were estimated. */
  candidates: number;
  /** Candidate pairs at or above the threshold, before the precision tier. */
  similar: number;
  /** Of those, how many each veto stopped, first veto first (rare term, number, polarity), and the cosine or shared-token guard. */
  vetoed: { rare_term: number; number: number; polarity: number; cosine: number };
  /** Items whose earlier candidates were cut at CANDIDATE_CAP (review finding L5-4). */
  capped: number;
}

/** Why the precision tier refused a similar pair, or null when it admits it. */
export function precisionVeto(
  a: { text: string; toks: readonly string[] },
  b: { text: string; toks: readonly string[] },
  idfOf: (t: string) => number,
  theta: number,
  threshold: number,
):
  | { veto: "rare_term" | "number" | "polarity" | "cosine"; cosine: number }
  | { veto: null; cosine: number } {
  const cosine =
    sharedTokens(a.toks, b.toks) >=
    Math.min(MIN_SHARED_TOKENS, new Set(a.toks).size, new Set(b.toks).size)
      ? idfCosine(a.toks, b.toks, idfOf)
      : 0;
  if (cosine < threshold) return { veto: "cosine", cosine };
  if (rareTermVeto(a.toks, b.toks, idfOf, theta) !== null) return { veto: "rare_term", cosine };
  if (numberVeto(a.text, b.text) !== null) return { veto: "number", cosine };
  if (polarityVeto(a.toks, b.toks) !== null) return { veto: "polarity", cosine };
  return { veto: null, cosine };
}

/**
 * The near-duplicates among one scope's active items: for each item, by id,
 * the earliest earlier item of its class whose estimated Jaccard similarity
 * and IDF cosine reach `threshold` and which no veto refuses. An item whose
 * strict content hash an earlier item of its class shares is the exact lint's
 * (`duplicate`) and takes no part. IDF is over every item given. Only pairs
 * sharing an LSH band are estimated, at most CANDIDATE_CAP per item: linear in
 * the items with a bound of 64 estimates each, near-linear in practice on
 * varied text (1,351 estimates for 10,000 items in the test), and capped,
 * not exhaustive, on templated text.
 */
export function findNearDuplicates(
  items: readonly MemoryItem[],
  threshold: number,
  strictHash: (item: MemoryItem) => string,
): { matches: NearDuplicateMatch[]; stats: NearDuplicateStats } {
  if (!(threshold > 0 && threshold <= 1))
    throw new Error(`near-duplicate threshold ${threshold} is not in (0, 1]`);
  const sorted = [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const stats: NearDuplicateStats = {
    items: sorted.length,
    candidates: 0,
    similar: 0,
    vetoed: { rare_term: 0, number: 0, polarity: 0, cosine: 0 },
    capped: 0,
  };

  // IDF over the scope's items: document frequency of each token.
  const prepared: Prepared[] = sorted.map((item) => {
    const text = comparableText(item.content);
    return { item, text, toks: tokens(text), sigs: {} };
  });
  const df = new Map<string, number>();
  let n = 0;
  for (const p of prepared) {
    if (p.toks.length === 0) continue;
    n++;
    for (const t of new Set(p.toks)) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const idfOf = (t: string) => idf(df.get(t) ?? 0, n);
  // A term in at most RARE_TERM_DF items is rare: its IDF exceeds that of RARE_TERM_DF + 1.
  const theta = idf(RARE_TERM_DF + 1, n);

  const matches: NearDuplicateMatch[] = [];
  const byClass = new Map<string, Prepared[]>();
  for (const p of prepared) {
    if (p.toks.length === 0) continue;
    const group = byClass.get(p.item.class) ?? [];
    group.push(p);
    byClass.set(p.item.class, group);
  }
  for (const group of byClass.values()) {
    // The first item of each strict hash; later exact copies are duplicate's.
    const seen = new Set<string>();
    const distinct = group.filter((p) => {
      const h = strictHash(p.item);
      if (seen.has(h)) return false;
      seen.add(h);
      return true;
    });
    // A pair's kind is that of its shorter text: by characters when it has
    // fewer than WORD_SHINGLE_FLOOR words, else by word pairs. Every text of
    // WORD_SHINGLE_FLOOR words or more gets a word signature. Every shorter
    // text gets a character one, and so does a longer text whose character
    // shingle set is small enough to reach the threshold with one of them:
    // Jaccard is at most the ratio of the two set sizes, so a longer text
    // with more than M / threshold character shingles, M the largest set of a
    // shorter text in the class, cannot (review finding L5-2).
    const charSets = distinct.map((p) => shingles(p.toks, "char"));
    let largestShort = 0;
    distinct.forEach((p, i) => {
      if (shingleKind(p.toks.length) === "char")
        largestShort = Math.max(largestShort, (charSets[i] as Set<string>).size);
    });
    const buckets = { char: new Map<string, number[]>(), word: new Map<string, number[]>() };
    distinct.forEach((p, index) => {
      const kinds: ("char" | "word")[] = [];
      const own = shingleKind(p.toks.length);
      if (own === "char" || (charSets[index] as Set<string>).size * threshold <= largestShort)
        kinds.push("char");
      if (own === "word") kinds.push("word");
      for (const kind of kinds) {
        const sig = signature(
          kind === "char" ? (charSets[index] as Set<string>) : shingles(p.toks, kind),
        );
        p.sigs[kind] = sig;
        for (const key of bandKeys(sig)) {
          const bucket = buckets[kind].get(key);
          if (bucket === undefined) buckets[kind].set(key, [index]);
          else bucket.push(index);
        }
      }
    });
    distinct.forEach((p, j) => {
      // At most CANDIDATE_CAP earlier members of each bucket are read, and at
      // most CANDIDATE_CAP earlier candidates estimated, the earliest by id:
      // a templated corpus fills buckets with hundreds of items, and reading
      // them all made the pass quadratic (review finding L5-4).
      const earlier = new Set<number>();
      let cut = false;
      for (const kind of ["char", "word"] as const) {
        const sig = p.sigs[kind];
        if (sig === undefined) continue;
        for (const key of bandKeys(sig)) {
          let read = 0;
          for (const i of buckets[kind].get(key) ?? []) {
            if (i >= j) break;
            if (read++ === CANDIDATE_CAP) {
              cut = true;
              break;
            }
            const q = distinct[i] as Prepared;
            if (shingleKind(Math.min(q.toks.length, p.toks.length)) === kind) earlier.add(i);
          }
        }
      }
      const ordered = [...earlier].sort((x, y) => x - y);
      if (ordered.length > CANDIDATE_CAP) cut = true;
      if (cut) stats.capped++;
      for (const i of ordered.slice(0, CANDIDATE_CAP)) {
        const q = distinct[i] as Prepared;
        const kind = shingleKind(Math.min(q.toks.length, p.toks.length));
        stats.candidates++;
        const est = estimate(q.sigs[kind] as Uint32Array, p.sigs[kind] as Uint32Array);
        if (est < threshold) continue;
        stats.similar++;
        const v = precisionVeto(q, p, idfOf, theta, threshold);
        if (v.veto !== null) {
          stats.vetoed[v.veto]++;
          continue;
        }
        matches.push({ item: p.item, of: q.item, kind, estimate: est, cosine: v.cosine });
        break;
      }
    });
  }
  matches.sort((a, b) => (a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0));
  return { matches, stats };
}
