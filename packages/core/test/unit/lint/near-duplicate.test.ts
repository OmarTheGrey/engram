// Card L5 (layer 1): the near-duplicate tier's parts and its pass. The IDF
// cosine, the rare-term veto and the shared-token guard are ported from
// thedotmack/claude-mem at f1bb834527637231e23575e2a70c57375efdac04
// (Apache-2.0); so are their tests below, and the golden vectors are copied
// from its tests/dedup/fixtures/golden.json (NOTICE). The MinHash layout is
// ported from DeusData/codebase-memory-mcp at
// 1111d9a9e1380a0429ef2250f63223706af6289a (MIT), its parameters re-derived.
import { describe, expect, test } from "vitest";
import { strictContentHash } from "../../../src/content-hash.ts";
import { type LintContext, lintScope, nearDuplicates } from "../../../src/lint/det.ts";
import {
  bandKeys,
  CHAR_SHINGLE,
  candidateProbability,
  comparableText,
  estimate,
  findNearDuplicates,
  hash32,
  idf,
  idfCosine,
  jaccard,
  LSH_BANDS,
  LSH_ROWS,
  MINHASH_PERMUTATIONS,
  numbersByKind,
  numberVeto,
  polarityVeto,
  precisionVeto,
  rareTermVeto,
  shingleKind,
  shingles,
  signature,
  stem,
  tokens,
  WORD_SHINGLE_FLOOR,
} from "../../../src/lint/near-duplicate.ts";
import type { MemoryItem } from "../../../src/schema.ts";
import { AT, id, item, testPolicy } from "../plane/helpers.ts";

const toks = (s: string) => tokens(comparableText(s));
const strict = (i: MemoryItem) => strictContentHash(i.content);
const find = (items: MemoryItem[], t = 0.85) => findNearDuplicates(items, t, strict);

/** A small seeded generator (mulberry32), so a sampled case reruns from its seed. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

describe("the parameters, re-derived for thresholds 0.8 to 0.9", () => {
  test("K is 128 in 32 bands of 4 rows", () => {
    expect([MINHASH_PERMUTATIONS, LSH_BANDS, LSH_ROWS]).toEqual([128, 32, 4]);
    expect(LSH_BANDS * LSH_ROWS).toBe(MINHASH_PERMUTATIONS);
  });
  test("banding keeps almost every pair of similarity 0.7 and drops most pairs under 0.2", () => {
    expect(candidateProbability(0.7)).toBeGreaterThan(0.9998);
    expect(candidateProbability(0.8)).toBeGreaterThan(0.99999);
    expect(candidateProbability(0.2)).toBeLessThan(0.06);
    expect(candidateProbability(0.1)).toBeLessThan(0.004);
  });
  test("codebase-memory-mcp's 32 bands of 2 rows would make most pairs at 0.3 candidates", () => {
    // Its midpoint (1/32)^(1/2) is 0.18: the reason its parameters are not taken.
    expect(1 - (1 - 0.3 ** 2) ** 32).toBeGreaterThan(0.95);
  });
});

describe("tokens and shingles", () => {
  test("tokens drop edge punctuation and case, and keep a compound identifier whole", () => {
    expect(toks("Added rdlp-redact to ffmpeg-7.1.conf, done.")).toEqual([
      "added",
      "rdlp-redact",
      "to",
      "ffmpeg-7.1.conf",
      "done",
    ]);
    expect(toks("  ...  ")).toEqual([]);
  });
  test("a structured content is compared by its strings and numbers in key order, not its keys", () => {
    expect(comparableText({ b: "World", a: ["Hello", 2] })).toBe("hello 2 world");
  });
  test("a right single quotation mark reads as an apostrophe", () => {
    expect(toks(`Dana doesn${String.fromCharCode(0x2019)}t eat meat`)).toEqual(
      toks("Dana doesn't eat meat"),
    );
  });
  test(`a text under ${WORD_SHINGLE_FLOOR} words is shingled by characters, a longer one by word pairs`, () => {
    expect(shingleKind(WORD_SHINGLE_FLOOR - 1)).toBe("char");
    expect(shingleKind(WORD_SHINGLE_FLOOR)).toBe("word");
    expect([...shingles(["ab", "cd"], "char")]).toEqual(["ab ", "b c", " cd"]);
    expect([...shingles(["a", "b", "c"], "word")]).toEqual(["a b", "b c"]);
    expect([...shingles(["x"], "word")]).toEqual(["x"]);
    expect([...shingles(["xy"], "char")]).toEqual(["xy"]);
    expect(CHAR_SHINGLE).toBe(3);
  });
  test("jaccard is the shared fraction of the union", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["b", "c"]))).toBeCloseTo(1 / 3, 12);
    expect(jaccard(new Set(), new Set())).toBe(1);
  });
});

describe("MinHash", () => {
  test("a signature is fixed by its set: the same set gives the same minima, whatever the order", () => {
    const a = signature(new Set(["x", "y", "z"]));
    expect(signature(new Set(["z", "y", "x"]))).toEqual(a);
    expect(a).toHaveLength(MINHASH_PERMUTATIONS);
    expect(hash32("near-duplicate")).toBe(hash32("near-duplicate"));
    expect(bandKeys(a)).toHaveLength(LSH_BANDS);
  });
  test("the estimate is unbiased and as precise as K = 128 allows, on seeded pairs of known similarity", () => {
    const next = rng(20261121);
    for (const target of [0.3, 0.5, 0.7, 0.85, 0.95]) {
      let bias = 0;
      let sq = 0;
      const n = 150;
      for (let trial = 0; trial < n; trial++) {
        const tag = Math.floor(next() * 1e9);
        const shared = 40;
        const extra = Math.round(shared / target) - shared;
        const a = new Set<string>();
        const b = new Set<string>();
        for (let i = 0; i < shared; i++) {
          a.add(`s${tag}-${i}`);
          b.add(`s${tag}-${i}`);
        }
        for (let i = 0; i < Math.ceil(extra / 2); i++) a.add(`a${tag}-${i}`);
        for (let i = 0; i < Math.floor(extra / 2); i++) b.add(`b${tag}-${i}`);
        const err = estimate(signature(a), signature(b)) - jaccard(a, b);
        bias += err;
        sq += err * err;
      }
      const sigma = Math.sqrt((target * (1 - target)) / MINHASH_PERMUTATIONS);
      expect(Math.abs(bias / n), `bias at ${target}`).toBeLessThan(0.012);
      expect(Math.sqrt(sq / n), `rmse at ${target}`).toBeLessThan(1.3 * sigma);
    }
  });
});

// Ported from claude-mem's tests/dedup/tfidf-cosine.test.ts.
describe("idfCosine (claude-mem)", () => {
  const DF = new Map<string, number>([
    ["added", 500],
    ["rdlp-redact", 50],
    ["dependency", 300],
    ["to", 900],
    ["crate", 200],
    ["rdlp-api", 3],
    ["rdlp-plugin", 3],
  ]);
  const idfOf = (t: string) => idf(DF.get(t) ?? 0, 1000);
  const tc = (a: string, b: string) => idfCosine(toks(a), toks(b), idfOf);
  test("scores identical strings 1 and a pure word reorder 1", () => {
    expect(
      tc("Added rdlp-redact to rdlp-api crate", "Added rdlp-redact to rdlp-api crate"),
    ).toBeCloseTo(1, 5);
    expect(tc("rdlp-redact dependency added", "added rdlp-redact dependency")).toBeCloseTo(1, 5);
  });
  test("scores low when the only difference is a rare discriminating token", () => {
    expect(
      tc(
        "Added rdlp-redact dependency to rdlp-api crate",
        "Added rdlp-redact dependency to rdlp-plugin crate",
      ),
    ).toBeLessThan(0.78);
  });
  test("scores 0 for disjoint token sets, and is symmetric", () => {
    expect(tc("added rdlp-redact", "dependency crate")).toBe(0);
    const a = "Added rdlp-redact dependency to rdlp-api crate";
    const b = "Added rdlp-redact dependency to rdlp-plugin crate";
    expect(tc(a, b)).toBeCloseTo(tc(b, a), 10);
  });
});

// Copied from claude-mem's tests/dedup/fixtures/golden.json (Apache-2.0; NOTICE).
// The `exact` case (Tier-0) is the exact duplicate lint's, not this tier's.
const GOLDEN = {
  cosineThreshold: 0.78,
  vetoDf: 2,
  corpus: [
    "Hardened on-demand checkpoint against transcript read race",
    "On-demand checkpoint hardened against transcript read race",
    "Race condition fixed in checkpoint hook transcript reading",
    "Added rdlp-redact dependency to rdlp-api crate",
    "Added rdlp-redact dependency to rdlp-plugin crate",
    "Pinned ninja and meson versions in ffmpeg-7.1.conf",
    "Pinned ninja and meson versions in ffmpeg-6.1.conf",
    "Code review approval for xeve archive",
    "Security review approval for xeve archive",
    "Erebus platform architecture settled and documented",
    "Erebus platform architecture settled and fully documented",
    "Added fuzzy dedup guard",
    "Fixed worker respawn poison loop",
    "Code review of the parser module",
    "Security review of the parser module",
    "Code review approval for the build",
    "Security review approval for the build",
    "Erebus platform documented in detail",
    "Erebus architecture fully documented with docs",
    "Added dependency to the build crate",
    "Pinned versions in the build config",
    "Settled the platform architecture docs",
    "Fully documented the release with docs",
    "Reviewed the parser module for the build",
    "Worker respawn guard added to the loop",
  ],
  cases: [
    [
      "Hardened on-demand checkpoint against transcript read race",
      "On-demand checkpoint hardened against transcript read race",
      "candidate",
      "reporter trio: pure word-reorder reword -> flagged",
    ],
    [
      "Hardened on-demand checkpoint against transcript read race",
      "Race condition fixed in checkpoint hook transcript reading",
      "none",
      "reporter trio: semantic paraphrase -> lexical miss (Branch-2 LLM tier)",
    ],
    [
      "Added rdlp-redact dependency to rdlp-api crate",
      "Added rdlp-redact dependency to rdlp-plugin crate",
      "none",
      "class-3: rare identifier discriminator vetoed (DISTINCT)",
    ],
    [
      "Pinned ninja and meson versions in ffmpeg-7.1.conf",
      "Pinned ninja and meson versions in ffmpeg-6.1.conf",
      "none",
      "class-3: rare version token vetoed (DISTINCT)",
    ],
    [
      "Code review approval for xeve archive",
      "Security review approval for xeve archive",
      "candidate",
      "common-token discriminator: Branch-1 flags candidate, never auto-merges; Branch-2 resolves",
    ],
    [
      "Erebus platform architecture settled and documented",
      "Erebus platform architecture settled and fully documented",
      "candidate",
      "true recurring near-dup (#3038 accumulation pattern)",
    ],
    ["Added fuzzy dedup guard", "Fixed worker respawn poison loop", "none", "unrelated"],
  ] as const,
};

describe("the precision tier on claude-mem's golden vectors", () => {
  const n = GOLDEN.corpus.length;
  const df = new Map<string, number>();
  for (const title of GOLDEN.corpus)
    for (const t of new Set(toks(title))) df.set(t, (df.get(t) ?? 0) + 1);
  const idfOf = (t: string) => idf(df.get(t) ?? 0, n);
  const side = (s: string) => ({ text: comparableText(s), toks: toks(s) });
  for (const [a, b, tier, note] of GOLDEN.cases)
    test(`${tier}: ${note}`, () => {
      const v = precisionVeto(
        side(a),
        side(b),
        idfOf,
        idf(GOLDEN.vetoDf, n),
        GOLDEN.cosineThreshold,
      );
      expect(v.veto === null ? "candidate" : "none").toBe(tier);
    });

  // Ported from claude-mem's tests/dedup/near-duplicate.test.ts (the shared-token pre-filter).
  test("a pair sharing one rare token is no candidate, however high its cosine", () => {
    const DF2 = new Map<string, number>([
      ["apifoo", 1],
      ["common1", 800],
      ["common2", 800],
      ["common3", 800],
      ["common4", 800],
    ]);
    const idf2 = (t: string) => idf(DF2.get(t) ?? 0, 1000);
    const a = side("apifoo common1 common2");
    const b = side("apifoo common3 common4");
    expect(idfCosine(a.toks, b.toks, idf2)).toBeGreaterThan(0.8);
    expect(precisionVeto(a, b, idf2, idf(10, 1000), 0.8)).toMatchObject({
      veto: "cosine",
      cosine: 0,
    });
  });
});

describe("rareTermVeto", () => {
  const idfOf = (t: string) => (["rdlp-api", "rdlp-plugin", "fully"].includes(t) ? 5 : 0.1);
  test("fires when each side holds a rare term the other lacks, naming the rarest of each", () => {
    expect(rareTermVeto(toks("rdlp-api crate"), toks("rdlp-plugin crate"), idfOf, 1)).toEqual([
      "rdlp-api",
      "rdlp-plugin",
    ]);
  });
  test("does not fire on a rare term one side adds (claude-mem's veto would), nor on common terms", () => {
    expect(
      rareTermVeto(toks("settled and documented"), toks("settled and fully documented"), idfOf, 1),
    ).toBeNull();
    expect(rareTermVeto(toks("code review"), toks("security review"), idfOf, 1)).toBeNull();
  });
});

describe("numberVeto (hermes-dreaming's idea)", () => {
  test("fires when, for one kind, each side holds a value the other lacks", () => {
    expect(numberVeto("failed for 20 minutes", "failed for 45 minutes")).toEqual([
      "number",
      "20",
      "45",
    ]);
    expect(numberVeto("starts on friday", "starts on monday")).toEqual([
      "weekday",
      "friday",
      "monday",
    ]);
    expect(numberVeto("due in march", "due in april")).toEqual(["month", "march", "april"]);
    expect(numberVeto("at 09:30", "at 10:30")).toEqual(["time", "9:30", "10:30"]);
  });
  test("does not fire on the same value written otherwise, on a value one side adds, or across kinds", () => {
    expect(numberVeto("at 09:00", "at 9:00")).toBeNull();
    expect(numberVeto("costs 1,500", "costs 1500")).toBeNull();
    expect(numberVeto("room 4", "room 4 at 9:00")).toBeNull();
    expect(numberVeto("on 2026-11-21", "for 3 days")).toBeNull();
    expect(numberVeto("you may go", "you may go in may")).toBeNull();
  });
  test("reads kinds as it should", () => {
    expect(
      Object.fromEntries(
        [...numbersByKind("on 07.03.2026 at 9:05, 1.5 hours, friday")].map(([k, v]) => [k, [...v]]),
      ),
    ).toEqual({
      date: ["7.3.2026"],
      time: ["9:5"],
      number: ["1.5"],
      weekday: ["friday"],
    });
  });
});

describe("polarityVeto (hermes-dreaming's idea)", () => {
  test("fires when a word one side negates the other states plainly", () => {
    expect(
      polarityVeto(toks("Dana is not allergic to peanuts"), toks("Dana is allergic to peanuts")),
    ).toBe("allergic");
    expect(polarityVeto(toks("Dana doesn't eat meat"), toks("Dana eats meat"))).toBe("eat");
    expect(polarityVeto(toks("Dana never drinks coffee"), toks("Dana drinks coffee"))).toBe(
      "drink",
    );
    expect(polarityVeto(toks("Dana does not have a car"), toks("Dana has a car"))).toBe("car");
  });
  test("does not fire when both negate it, or when the negated word is not in the other text", () => {
    expect(polarityVeto(toks("Dana is not allergic"), toks("Dana isn't allergic"))).toBeNull();
    expect(polarityVeto(toks("Dana does not smoke"), toks("Dana likes tea"))).toBeNull();
    expect(polarityVeto(toks("same words here"), toks("same words here"))).toBeNull();
  });
  test("stems a trailing s, an ies and a possessive", () => {
    expect([stem("eats"), stem("studies"), stem("dana's"), stem("glass"), stem("gas")]).toEqual([
      "eat",
      "study",
      "dana",
      "glass",
      "gas",
    ]);
  });
});

describe("findNearDuplicates", () => {
  const PREF = "Dana prefers short answers and dislikes long preambles in replies.";
  const pref2 = PREF.replace("in replies", "in her replies");
  test("flags the later of a pair, naming the earliest earlier match, with its estimate and cosine", () => {
    const { matches } = find([item(2, { content: pref2 }), item(1, { content: PREF })]);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ kind: "char" });
    expect(matches[0]?.item.id).toBe(id(2));
    expect(matches[0]?.of.id).toBe(id(1));
    expect(matches[0]?.estimate).toBeGreaterThanOrEqual(0.85);
    expect(matches[0]?.cosine).toBeGreaterThanOrEqual(0.85);
  });
  test("leaves an exact copy to the duplicate lint, and compares no other class", () => {
    const { matches } = find([
      item(1, { content: PREF }),
      item(2, { content: `${PREF}  ` }),
      item(3, { content: pref2, class: "episodic" }),
    ]);
    expect(matches).toEqual([]);
  });
  test("a pair the precision tier vetoes is similar, counted, and not flagged", () => {
    const allergy = "Dana is allergic to peanuts and carries an epinephrine pen.";
    const { matches, stats } = find([
      item(1, { content: allergy }),
      item(2, { content: allergy.replace("is allergic", "is not allergic") }),
    ]);
    expect(matches).toEqual([]);
    expect(stats).toMatchObject({ similar: 1, vetoed: { polarity: 1 } });
  });
  test("compares a text just under the word floor with one just over it, by characters", () => {
    const words = Array.from({ length: WORD_SHINGLE_FLOOR - 1 }, (_, i) => `word${i}`);
    const short = words.join(" ");
    const long = `${short} more`;
    const { matches } = find([item(1, { content: short }), item(2, { content: long })]);
    expect(matches.map((m) => [m.item.id, m.kind])).toEqual([[id(2), "char"]]);
  });
  test("answers the same whatever the order of its input", () => {
    const items = [
      PREF,
      pref2,
      "The on-call rota changes every Monday.",
      "The on-call rota changes every Monday!",
    ].map((content, i) => item(i + 1, { content }));
    const one = find(items).matches.map((m) => [m.item.id, m.of.id, m.estimate]);
    expect(find([...items].reverse()).matches.map((m) => [m.item.id, m.of.id, m.estimate])).toEqual(
      one,
    );
    expect(one).toHaveLength(2);
  });
  test("refuses a threshold outside (0, 1]", () => {
    expect(() => find([], 0)).toThrow(/not in \(0, 1\]/);
    expect(() => find([], 1.5)).toThrow(/not in \(0, 1\]/);
  });

  test("stays near-linear at 10,000 items: few candidate pairs, well inside a generous time", () => {
    const next = rng(10_000);
    // A vocabulary of 3,000 words of 3 to 9 random letters.
    const letters = "abcdefghijklmnopqrstuvwxyz";
    const words = Array.from({ length: 3000 }, () =>
      Array.from(
        { length: 3 + Math.floor(next() * 7) },
        () => letters[Math.floor(next() * 26)],
      ).join(""),
    );
    const sentence = () =>
      Array.from(
        { length: 8 + Math.floor(next() * 12) },
        () => words[Math.floor(next() * words.length)],
      ).join(" ");
    const contents: string[] = [];
    for (let i = 0; i < 9_000; i++) contents.push(sentence());
    // A thousand near-duplicates: one word added to an earlier sentence.
    for (let i = 0; i < 1_000; i++) contents.push(`${contents[i * 9]} extra`);
    const items = contents.map((content, i) => item(i + 1, { content }));
    const started = performance.now();
    const { matches, stats } = find(items);
    const ms = performance.now() - started;
    expect(stats.items).toBe(10_000);
    // All pairs would be 49,995,000; banding estimates fewer than one per
    // item (1,351 at this seed: the thousand planted pairs and a few hundred more).
    expect(stats.candidates).toBeLessThan(stats.items);
    expect(matches.length).toBeGreaterThan(900);
    expect(ms).toBeLessThan(60_000);
  }, 120_000);
});

describe("the near-duplicate-tier lint", () => {
  const ctx = (items: MemoryItem[], thresholds: Record<string, number> = {}): LintContext => ({
    policy: testPolicy({ lints: { enabled: [], thresholds } }),
    at: AT,
    items: new Map(items.map((i) => [i.id, i])),
    retiredBy: new Map(),
    canReach: () => true,
  });
  const PAIR = [
    item(1, { content: "The release freeze starts on Friday." }),
    item(2, { content: "The release freeze starts on Friday!" }),
    item(3, { content: "The release freeze starts on Friday." }),
  ];
  test("a finding names the earlier item and carries the estimated Jaccard similarity, never content", () => {
    const [f, ...rest] = nearDuplicates(PAIR, 0.85);
    expect(rest).toEqual([]);
    expect(f).toMatchObject({ lint_id: "near-duplicate-tier", item_id: id(2), severity: "info" });
    expect(f?.message).toBe(
      `it nearly restates ${id(1)}, an earlier active semantic item in team:platform: estimated Jaccard similarity 1.000, threshold 0.850`,
    );
    expect(f?.evidence).toEqual([
      `near-duplicate of ${id(1)}`,
      "estimated Jaccard 1.000 over 128 MinHash permutations of character 3-grams",
      "IDF cosine 1.000",
      "no rare-term, number or polarity veto",
    ]);
    expect(JSON.stringify(f)).not.toContain("freeze");
  });
  test("runs only when a policy lists its id, and leaves the duplicate lint's findings as they are", () => {
    expect(
      lintScope(ctx(PAIR), "team:platform", ["duplicate"]).map((f) => [f.lint_id, f.item_id]),
    ).toEqual([["duplicate", id(3)]]);
    const both = lintScope(ctx(PAIR), "team:platform", ["near-duplicate-tier", "duplicate"]);
    expect(both.map((f) => [f.lint_id, f.item_id])).toEqual([
      ["duplicate", id(3)],
      ["near-duplicate-tier", id(2)],
    ]);
    expect(both.filter((f) => f.lint_id === "duplicate")).toEqual(
      lintScope(ctx(PAIR), "team:platform", ["duplicate"]),
    );
  });
  test("reads its similarity from the near-duplicate threshold", () => {
    const pref = [
      item(1, { content: "Dana prefers short answers and dislikes long preambles in replies." }),
      item(2, {
        content: "Dana prefers short answers and dislikes long preambles in her replies.",
      }),
    ];
    const run = (t: number) =>
      lintScope(ctx(pref, { "near-duplicate": t }), "team:platform", ["near-duplicate-tier"]);
    expect(run(0.8)).toHaveLength(1);
    expect(run(0.99)).toEqual([]);
  });
});
