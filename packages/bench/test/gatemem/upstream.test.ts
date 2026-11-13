// Fidelity of the port against GateMem's own Python code. The golden file was
// written by packages/bench/scripts/upstream-golden.py, which ran upstream's
// LongContextAgent, run_episode and rule-based score_one on this fixture with
// the same scripted responses. The port must reproduce the prompts it sent,
// the outputs it parsed and the scores it gave.
import { createHash } from "node:crypto";
import { memoryCache } from "@engram/model";
import { describe, expect, test } from "vitest";
import type { queryRequest } from "../../src/gatemem/prompt.ts";
import { readRunConfig, readScript, runGateMem, scriptedByItem } from "../../src/gatemem/run.ts";
import type { Checkpoint } from "../../src/gatemem/schema.ts";
import { type Score, scoreOne } from "../../src/gatemem/score.ts";
import { CONFIG, fixture, readJson } from "./fixture.ts";

interface GoldenRow {
  checkpoint_id: string;
  system_sha256: string;
  user_sha256: string;
  output: Record<string, unknown>;
  prompt_memory_block_sha256: string;
  score: Score;
  score_turn_dump: Score;
  score_patterns: Score;
}
interface Golden {
  rows: GoldenRow[];
  summary: Record<string, number>;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const golden = readJson<Golden>("upstream-golden.json");

async function run() {
  const config = readRunConfig(CONFIG);
  const requests = new Map<string, ReturnType<typeof queryRequest>>();
  const scripted = scriptedByItem(readScript(config.script as string));
  const result = await runGateMem(config, {
    model: (id) => async (request) => {
      requests.set(id, request);
      return scripted(id)(request);
    },
    cache: memoryCache(),
    offline: false,
  });
  return { ...result, requests };
}

describe("GateMem port against upstream's Python on the fixture", () => {
  test("sends the same system and user prompts as upstream's LongContextAgent", async () => {
    const { requests } = await run();
    for (const row of golden.rows) {
      const request = requests.get(row.checkpoint_id);
      expect(sha256(request?.system ?? ""), row.checkpoint_id).toBe(row.system_sha256);
      expect(sha256(request?.messages[0]?.content ?? ""), row.checkpoint_id).toBe(row.user_sha256);
    }
  });

  test("parses the same outputs and memory block as upstream", async () => {
    const { predictions } = await run();
    for (const row of golden.rows) {
      const p = predictions.find((x) => x.checkpoint_id === row.checkpoint_id);
      const o = p?.output ?? ({} as Record<string, unknown>);
      const mine = Object.fromEntries(Object.keys(row.output).map((k) => [k, o[k]]));
      expect(mine, row.checkpoint_id).toEqual(row.output);
      expect(sha256(String(o.prompt_memory_block))).toBe(row.prompt_memory_block_sha256);
    }
  });

  test("gives the same rule-based score per checkpoint and the same summary", async () => {
    const { scores, summary } = await run();
    for (const row of golden.rows) {
      const mine = scores.find((s) => s.checkpoint_id === row.checkpoint_id);
      expect({ ...mine, aux: { ...mine?.aux, gated_by_action: undefined } }).toEqual({
        ...row.score,
        aux: { ...row.score.aux, gated_by_action: undefined },
      });
    }
    for (const [k, v] of Object.entries(golden.summary)) {
      expect(summary[k as keyof typeof summary], k).toBeCloseTo(v, 12);
    }
  });

  test("matches upstream's patterns on the episode text and on the patterns themselves", () => {
    const byId = new Map(fixture().flatMap((d) => d.checkpoints.map((c) => [c.checkpoint_id, c])));
    const episodes = new Map(fixture().flatMap((d) => d.episodes.map((e) => [e.episode_id, e])));
    for (const row of golden.rows) {
      const c = byId.get(row.checkpoint_id) as Checkpoint;
      const turns = episodes.get(c.episode_id)?.turns ?? [];
      const upto = turns.slice(0, turns.findIndex((t) => t.turn_id === c.as_of_turn_id) + 1);
      const dump = {
        action: "answer",
        answer: upto.map((t) => t.text).join("\n"),
        answer_structured: {},
      };
      expect(scoreOne(c, dump), row.checkpoint_id).toEqual(row.score_turn_dump);
      const patterns = [
        ...(c.judge_spec.include ?? []),
        ...(c.judge_spec.not_include ?? []),
        ...(c.leak_targets ?? []),
      ];
      const literal = {
        action: "answer",
        answer: patterns.join("\n"),
        answer_structured: { note: "patterns" },
      };
      expect(scoreOne(c, literal), row.checkpoint_id).toEqual(row.score_patterns);
    }
  });
});
