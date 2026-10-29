import { type ModelRequest, requestHash } from "@engram/core";
import { scriptedModelCall } from "@engram/runner";
import { describe, expect, test } from "vitest";
import { ExampleAgent, LongContextAgent } from "../../src/gatemem/agents.ts";
import { runBenchmark } from "../../src/gatemem/harness.ts";
import { type AnswerModel, memoryBlock, queryRequest } from "../../src/gatemem/prompt.ts";
import { visibleCheckpoint, visibleEpisode } from "../../src/gatemem/strip.ts";
import { fixture, readJson, type Script } from "./fixture.ts";

const model: AnswerModel = {
  model: "scripted/scripted-1",
  seed: 1,
  temperature: 0.2,
  maxTokens: 4096,
};

/**
 * The scripted table keyed on request hash: for each checkpoint, the request
 * the agent must send if it puts the last `maxTurns` turns up to the as-of
 * turn in the prompt, and nothing later.
 */
function table(maxTurns: number): Record<string, string> {
  const script = readJson<Script>("script.json").responses;
  const out: Record<string, string> = {};
  for (const domain of fixture()) {
    for (const episode of domain.episodes) {
      for (const c of domain.checkpoints.filter((x) => x.episode_id === episode.episode_id)) {
        const upto = episode.turns.findIndex((t) => t.turn_id === c.as_of_turn_id);
        const items = episode.turns
          .slice(0, upto + 1)
          .slice(-maxTurns)
          .map((t) => ({
            record_id: t.turn_id,
            turn_id: t.turn_id,
            principal_id: t.speaker.principal_id,
            role: t.speaker.role,
            text: t.text,
            record_refs: [],
          }));
        const request = queryRequest(
          visibleEpisode(episode),
          visibleCheckpoint(c),
          memoryBlock(items),
          model,
        );
        out[requestHash(request)] = script[c.checkpoint_id] as string;
      }
    }
  }
  return out;
}

describe("GateMem reference agent (Long-Context)", () => {
  test("produces one prediction per checkpoint through the scripted model", async () => {
    const seen: ModelRequest[] = [];
    const scripted = scriptedModelCall(table(300));
    const agent = new LongContextAgent({
      ...model,
      call: () => async (request) => {
        seen.push(request);
        return scripted(request);
      },
    });
    const rows = await runBenchmark(agent, fixture());
    expect(rows).toHaveLength(20);
    expect(seen).toHaveLength(20);
    const script = readJson<Script>("script.json");
    const action = (id: string) => rows.find((r) => r.checkpoint_id === id)?.output.action;
    expect(action(script.planted.leak)).toBe("answer");
    expect(action(script.planted.refusal)).toBe("refuse");
    expect(action(script.planted.fenced_json)).toBe("answer");
    expect(action(script.planted.plain_text)).toBe("no_memory");
  });

  test("puts only the most recent max_turns turns in the prompt", async () => {
    const agent = new LongContextAgent({
      ...model,
      maxTurns: 10,
      call: () => scriptedModelCall(table(10)),
    });
    const rows = await runBenchmark(agent, fixture());
    expect(rows.every((r) => r.output.context_turns === 10)).toBe(true);
  });

  test("calls the model under the checkpoint it answers, so the cache keys on the item", async () => {
    const items: string[] = [];
    const scripted = scriptedModelCall(table(300));
    const agent = new LongContextAgent({
      ...model,
      call: (id) => {
        items.push(id);
        return scripted;
      },
    });
    const rows = await runBenchmark(agent, fixture());
    expect(items).toEqual(rows.map((r) => r.checkpoint_id));
  });

  test("the upstream example agent refuses every checkpoint without a model", async () => {
    const rows = await runBenchmark(new ExampleAgent(), fixture());
    expect(rows).toHaveLength(20);
    expect(new Set(rows.map((r) => r.output.action))).toEqual(new Set(["refuse"]));
  });
});
