import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import { loadCases } from "../../src/mem-inv-bench/load.ts";
import { AGENT_SYSTEM, memoryBlock, renderProposalPrompt } from "../../src/mem-inv-bench/prompt.ts";
import { visibleCase } from "../../src/mem-inv-bench/strip.ts";
import { cases, FIXTURES, type Manifest, readJson } from "./fixture.ts";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

describe("the proposal prompt port", () => {
  test("the system prompt is the one the recorded study sent", () => {
    const manifest = readJson<Manifest>("manifest.json");
    expect(sha256(AGENT_SYSTEM)).toBe(manifest.recorded_system_prompt_sha256);
  });

  test("each case's request, memory rendered inline, is byte-identical to the recorded request", () => {
    const manifest = readJson<Manifest>("manifest.json");
    for (const c of cases()) {
      const view = visibleCase(c);
      const { user } = renderProposalPrompt(view, memoryBlock(view.memory));
      const recorded = manifest.cases.find((m) => m.case_id === c.case_id);
      expect(sha256(user), c.case_id).toBe(recorded?.recorded_prompt_sha256);
    }
  });

  test("the full case set (H1's, rule 4) holds every cell once, begins with the subset, and each request is the recorded one", () => {
    const manifest = readJson<Manifest>("manifest.json");
    const full = loadCases(`${FIXTURES}full`);
    expect(full).toHaveLength(38);
    expect(full.slice(0, cases().length)).toEqual(cases());
    const cells = full.map((c) => `${c.sid}/${c.channel}`);
    expect(new Set(cells).size).toBe(38);
    expect(full.filter((c) => c.family === "attack")).toHaveLength(32);
    for (const c of full) {
      const view = visibleCase(c);
      const { user } = renderProposalPrompt(view, memoryBlock(view.memory));
      const recorded = manifest.cases.find((m) => m.case_id === c.case_id);
      expect(sha256(user), c.case_id).toBe(recorded?.recorded_prompt_sha256);
    }
  });

  test("a field marker inside memory text is not substituted, as str.format leaves it", () => {
    const { user } = renderProposalPrompt({ task: "T" }, "- note {task} $& $1");
    expect(user).toContain("- note {task} $& $1");
    expect(user).toContain("## CURRENT REQUEST\nT\n");
  });
});
