// The normalised content hash (ADR 0018's exact rule), shared by the
// retired-content gate (card E2.4), promotion's confirmations (E2.5) and the
// duplicate lint (L1).
import { describe, expect, test } from "vitest";
import { contentHash, normaliseContent } from "../../src/content-hash.ts";

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
