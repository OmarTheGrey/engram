// Fidelity of the port where Python and JavaScript differ (findings R6-1 and
// R6-12). The golden file was written by
// packages/bench/scripts/upstream-edge-golden.py, which ran GateMem's own
// generate_llm_output, flatten_output_text and pattern_hits on crafted
// inputs: floats and exponents in a model's JSON, str() of dicts and lists,
// key order, unescaped control characters, NaN and Infinity, replies that
// are Python literals rather than JSON (upstream's ast.literal_eval
// fallback), and regular expressions on non-ASCII text, case-insensitive
// included. The fixture's scripted answers never reach these paths, so
// upstream.test.ts alone cannot catch a divergence here. Where the port
// cannot reproduce upstream (a set or complex number in a reply, a
// case-insensitive back reference), it must throw, never answer differently.
import { describe, expect, test } from "vitest";
import { UntranslatableLiteral } from "../../src/gatemem/literal.ts";
import { parseModelOutput } from "../../src/gatemem/parse.ts";
import { UntranslatablePattern } from "../../src/gatemem/py.ts";
import { flattenOutputText, patternHits } from "../../src/gatemem/score.ts";
import { readJson } from "./fixture.ts";

interface ParseRow {
  raw: string;
  action: string;
  answer: string;
  used_record_ids: string[];
  flattened: string;
}
interface PatternRow {
  text: string;
  pattern: string;
  hits: boolean;
}
interface EdgeGolden {
  parse: ParseRow[];
  patterns: PatternRow[];
  /** Upstream's output where the port must throw instead. */
  parse_untranslatable: ParseRow[];
  patterns_untranslatable: PatternRow[];
}

const golden = readJson<EdgeGolden>("upstream-edge-golden.json");

describe("GateMem port against upstream's Python on edge cases", () => {
  test.each(golden.parse.map((r, i) => [i, r] as const))(
    "parses model output %i as upstream does, and flattens it to the same text",
    (_i, row) => {
      const out = parseModelOutput(row.raw);
      expect(out.action).toBe(row.action);
      expect(out.answer).toBe(row.answer);
      expect(out.used_record_ids).toEqual(row.used_record_ids);
      expect(flattenOutputText(out)).toBe(row.flattened);
    },
  );

  test.each(golden.patterns.map((r) => [r.pattern, r.text, r.hits] as const))(
    "pattern %j on %j hits as upstream: %s",
    (pattern, text, hits) => {
      expect(patternHits(text, pattern)).toBe(hits);
    },
  );

  test.each(golden.parse_untranslatable.map((r) => [r.raw] as const))(
    "throws on the Python literal %j rather than reading it differently",
    (raw) => {
      expect(() => parseModelOutput(raw)).toThrow(UntranslatableLiteral);
    },
  );

  test.each(golden.patterns_untranslatable.map((r) => [r.pattern, r.text] as const))(
    "throws on pattern %j (on %j) rather than matching differently",
    (pattern, text) => {
      expect(() => patternHits(text, pattern)).toThrow(UntranslatablePattern);
    },
  );
});
