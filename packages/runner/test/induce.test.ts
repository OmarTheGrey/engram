// Card D2's acceptance in process: research/configs/d2-induce-fixture.json
// induces candidates from card D1's fixture sessions, from the committed
// cassettes, twice, the second run with zero new calls; every candidate is a
// procedural item with status candidate, written through the plane, with
// lineage to its sessions and a SKILL.md the specification accepts.
import { fileURLToPath } from "node:url";
import { parseDistillRef, parseSkillMd, validateSkillMd } from "@engram/core";
import { memoryCache } from "@engram/model";
import { describe, expect, test } from "vitest";
import {
  countInduceConfig,
  INDUCE_AT,
  InduceScript,
  loadSessions,
  readInduceConfig,
  runInduceConfig,
  scriptedInduceCall,
} from "../src/induce.ts";

const CONFIG = fileURLToPath(
  new URL("../../../research/configs/d2-induce-fixture.json", import.meta.url),
);
const REPO = fileURLToPath(new URL("../../../", import.meta.url));

describe("acceptance (card D2): candidates from the fixture sessions, from cassettes", () => {
  test("two replays make zero new calls and write the same candidates", async () => {
    const config = readInduceConfig(CONFIG);
    const first = await runInduceConfig(config, { offline: true });
    const second = await runInduceConfig(config, { offline: true });
    expect(first.calls).toEqual({ new: 0, cached: 1 });
    expect(second.calls).toEqual({ new: 0, cached: 1 });
    expect(second.items).toEqual(first.items);
    expect(first.summary).toEqual({
      "awm@1": { candidates: 3, rejected: 2, written: 3, denied: 0 },
      "rule@1": { candidates: 1, rejected: 0, written: 1, denied: 0 },
    });
  });

  test("each candidate is a procedural candidate with lineage to its example sessions", async () => {
    const config = readInduceConfig(CONFIG);
    const result = await runInduceConfig(config, { offline: true });
    const awm = result.rows.find((r) => r.method === "awm");
    expect(awm?.skipped.map((s) => [s.file, s.reason])).toEqual([
      ["d1-02.jsonl", "verdict failure"],
    ]);
    const examples = awm?.examples.map((e) => e.session_id);
    for (const { item, skill_md } of result.items) {
      expect(item).toMatchObject({
        class: "procedural",
        status: "candidate",
        scope: config.scope,
        owner: config.scope,
        valid_from: INDUCE_AT,
        lineage: [],
      });
      expect(item.store_ref).not.toBeNull();
      expect(parseDistillRef(item.provenance.ref)?.sessions).toEqual(examples);
      expect(validateSkillMd(skill_md, parseSkillMd(skill_md).name)).toEqual([]);
    }
    // Every write is one allowed event naming the person rule.
    const writes = result.events[0]?.events.filter((e) => e.op === "write") ?? [];
    expect(writes.map((e) => [e.decision, e.policy_id])).toEqual(
      result.items.map(() => ["allow", "preset.medium/write/person"]),
    );
    // The fixture's examples hold branch summaries, so each candidate is
    // compaction, and the plane recorded the source the runner set (D2-4).
    for (const e of writes) expect(e.reason).toContain("from source compaction");
    for (const { item } of result.items) expect(item.provenance.kind).toBe("compaction");
  });

  test("a miss is an error offline, and the script answers no request but the induction's", async () => {
    const config = readInduceConfig(CONFIG);
    await expect(runInduceConfig(config, { offline: true, cache: memoryCache() })).rejects.toThrow(
      /offline/,
    );
    const call = scriptedInduceCall(
      InduceScript.parse({ replies: [{ reply: "Workflow 1: x" }] }),
      loadSessions(config).map((l) => l.session),
      config,
    );
    await expect(
      call({ model: config.model, seed: 1, messages: [{ role: "user", content: "other" }] }),
    ).rejects.toThrow(/no answer/);
  });

  test("COUNT=1 counts one induction call per seed and calls nothing", () => {
    const count = countInduceConfig(readInduceConfig(CONFIG), REPO);
    expect(count).toMatchObject({
      data: "fixtures/sessions/d1",
      sessions: 11,
      examples: 10,
      calls: 1,
    });
    expect(count.prompt_chars).toBeGreaterThan(0);
  });
});
