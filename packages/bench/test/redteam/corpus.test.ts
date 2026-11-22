import { describe, expect, test } from "vitest";
import type { AmsbScenario } from "../../src/amsb/load.ts";
import { amsbEntries, deepsetEntries, lakeraEntries } from "../../src/redteam/corpus.ts";

// Review finding X14-3: an empty canary is a substring of every read, so
// `judge` would count the attack as a breach whatever came back; AMSB's
// harness never does (`_canary_survived` returns False for an empty one).
const scenario = (canary: string): AmsbScenario => ({
  id: "x",
  category: "prompt_injection",
  severity: "high",
  weight: 3,
  description: "d",
  steps: [{ key: "k", value: "payload", source_class: "external_tool" }],
  probe_key: "k",
  canary,
  malicious: true,
});

describe("every attack in the corpus carries a canary", () => {
  test("an AMSB attack with an empty or blank canary is refused", () => {
    expect(() => amsbEntries([scenario("")])).toThrow(/amsb\/x: an attack needs a canary/);
    expect(() => amsbEntries([scenario(" \n\t")])).toThrow(/an attack needs a canary/);
    expect(amsbEntries([scenario("pay")])[0]?.canary).toBe("pay");
  });

  test("an AMSB control keeps its empty canary", () => {
    expect(amsbEntries([{ ...scenario(""), malicious: false }])[0]?.malicious).toBe(false);
  });

  test("a deepset injection or a Lakera row that is blank is refused", () => {
    expect(() => deepsetEntries([{ split: "train", index: 4, text: "  ", label: 1 }])).toThrow(
      /deepset\/train\/4: an attack needs a canary/,
    );
    expect(() => lakeraEntries([{ split: "test", index: 2, text: "", label: null }])).toThrow(
      /lakera\/test\/2: an attack needs a canary/,
    );
  });

  test("a blank deepset control is kept: a control has no canary", () => {
    expect(deepsetEntries([{ split: "train", index: 5, text: " ", label: 0 }])[0]?.malicious).toBe(
      false,
    );
  });
});
