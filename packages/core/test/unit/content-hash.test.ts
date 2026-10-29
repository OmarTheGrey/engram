// The normalised content hash (ADR 0018's exact rule), shared by the
// retired-content gate (card E2.4), promotion's confirmations (E2.5) and the
// duplicate lint (L1).
import { describe, expect, test } from "vitest";
import {
  contentHash,
  mergingContentHash,
  normaliseContent,
  normaliseContentMerging,
  normaliseContentStrict,
  strictContentHash,
} from "../../src/content-hash.ts";

describe("the merging (broad) and strict normal forms (review finding P5-12)", () => {
  test("the merging form joins compatibility forms and case; the strict form keeps them apart", () => {
    expect(mergingContentHash("10²")).toBe(mergingContentHash("102"));
    expect(mergingContentHash("US")).toBe(mergingContentHash("us"));
    expect(strictContentHash("10²")).not.toBe(strictContentHash("102"));
    expect(strictContentHash("US")).not.toBe(strictContentHash("us"));
  });

  test("the strict form collapses whitespace and nothing more: format characters stay (P5-14)", () => {
    expect(normaliseContentStrict("  Deploy\tRuns \n")).toBe("text:Deploy Runs");
    expect(strictContentHash("Deploy\u200b runs")).not.toBe(strictContentHash("Deploy runs"));
    // A tag-character payload is not the plain sentence.
    const tags = [..."hi"].map((c) => String.fromCodePoint(0xe0000 + c.charCodeAt(0))).join("");
    expect(strictContentHash(`Deploy runs${tags}`)).not.toBe(strictContentHash("Deploy runs"));
    expect(strictContentHash({ b: " X  y", a: 1 })).toBe(strictContentHash({ a: 1, b: "X y" }));
    expect(strictContentHash("x")).not.toBe(strictContentHash({ x: "x" }));
  });

  test("the strict form keeps what the merging form drops: a variation selector", () => {
    // U+FE0F is default-ignorable, which the merging form drops (P4-14).
    expect(mergingContentHash("tea\ufe0f")).toBe(mergingContentHash("tea"));
    expect(strictContentHash("tea\ufe0f")).not.toBe(strictContentHash("tea"));
  });

  test("the plain names are the merging form", () => {
    expect(contentHash("US")).toBe(mergingContentHash("US"));
    expect(normaliseContent("US")).toBe(normaliseContentMerging("US"));
  });
});

describe("normaliseContent", () => {
  test("text is NFKC, lower case, with whitespace runs collapsed and trimmed", () => {
    expect(normaliseContent("  Deploys\tHAPPEN\n\non  Tuesdays ")).toBe(
      "text:deploys happen on tuesdays",
    );
    // NFKC folds compatibility forms: the ligature and the full-width letters.
    expect(normaliseContent("ﬁle ＡＢ")).toBe("text:file ab");
  });

  test("structured content is canonical JSON with sorted keys and normalised strings", () => {
    expect(normaliseContent({ b: " X ", a: [1, "Y  z"] })).toBe('json:{"a":[1,"y z"],"b":"x"}');
    expect(normaliseContent({ a: [1, "y z"], b: "x" })).toBe(
      normaliseContent({ b: "X", a: [1, "Y z"] }),
    );
    // Array order is content.
    expect(normaliseContent({ a: [1, 2] })).not.toBe(normaliseContent({ a: [2, 1] }));
  });

  test("format characters that render as nothing are dropped (finding P4-7)", () => {
    const plain = normaliseContent("omar likes tea");
    expect(normaliseContent("omar​ likes tea")).toBe(plain);
    expect(normaliseContent("omar li­kes tea")).toBe(plain);
    expect(normaliseContent("omar likes᠎ tea")).toBe(plain);
    expect(normaliseContent("﻿omar likes⁠ tea")).toBe(plain);
    expect(normaliseContent({ t: "te​a" })).toBe(normaliseContent({ t: "tea" }));
  });

  test("default-ignorable code points go too, and NFKC runs again after (finding P4-14)", () => {
    const plain = normaliseContent("omar likes tea");
    expect(normaliseContent("omar️ likes tea")).toBe(plain);
    expect(normaliseContent("omar li͏kes tea")).toBe(plain);
    expect(normaliseContent("omarㅤ likes tea")).toBe(plain);
    expect(normaliseContent("ᅟomar likes tea")).toBe(plain);
    expect(normaliseContent("cafe​́")).toBe(normaliseContent("café"));
  });

  test("text never collides with structured content that prints the same", () => {
    expect(normaliseContent('{"a":1}')).not.toBe(normaliseContent({ a: 1 }));
  });

  test("procedural content is structured content", () => {
    expect(normaliseContent({ body: "Run  It", tools: ["bash"] })).toBe(
      'json:{"body":"run it","tools":["bash"]}',
    );
  });
});

describe("contentHash", () => {
  test("is sha256 of the normal form, equal exactly when the normal forms are", () => {
    expect(contentHash("A b")).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(contentHash("A   b")).toBe(contentHash("a b"));
    expect(contentHash("a b")).not.toBe(contentHash("a  c"));
  });
});
