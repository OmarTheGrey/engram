// Fidelity of the port where Python and JavaScript differ (findings R6-1 and
// R6-12). The golden file was written by
// packages/bench/scripts/upstream-edge-golden.py, which ran GateMem's own
// generate_llm_output, flatten_output_text and pattern_hits on crafted
// inputs: floats and exponents in a model's JSON, str() of dicts and lists,
// key order, unescaped control characters, NaN and Infinity, and regular
// expressions on non-ASCII text. The fixture's scripted answers never reach
// these paths, so upstream.test.ts alone cannot catch a divergence here.
import { describe, expect, test } from "vitest";
import { parseModelOutput } from "../../src/gatemem/parse.ts";
import { flattenOutputText, patternHits } from "../../src/gatemem/score.ts";
import { readJson } from "./fixture.ts";

interface EdgeGolden {
  parse: {
    raw: string;
    action: string;
    answer: string;
    used_record_ids: string[];
    flattened: string;
  }[];
  patterns: { text: string; pattern: string; hits: boolean }[];
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
});
