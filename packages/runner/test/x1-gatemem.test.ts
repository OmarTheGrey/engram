// Card X1, plan decision 4, ADR 0031: conditions C1 and C4 on GateMem. C1 is
// GateMem's long-context agent (card B1's port, held to upstream by
// packages/bench/test/gatemem/upstream.test.ts): no store, no memory tool,
// the same prompt. C4 is C3 with each item a read returns carrying the
// speaker, their role and GateMem's RAG-Policy gate's verdict for the asker
// (packages/bench/src/gatemem/rag-policy.ts, held to upstream by
// rag-policy.test.ts). Neither reads a hidden field.
import { gatemem } from "@engram/bench";
import { loadPreset, type ModelRequest } from "@engram/core";
import { describe, expect, test } from "vitest";
import { answersFor } from "../src/answers.ts";
import { type Condition, readRunnerConfig } from "../src/config.ts";
import {
  GATEMEM_METADATA_LEGEND,
  gatememMetadata,
  longContextPrompt,
  probeContext,
  probeInputs,
  runProbe,
  sequentialIds,
} from "../src/gatemem-probe.ts";
import type { CacheEntry, CacheStore } from "../src/model/cached.ts";
import { X1_GATEMEM } from "./paths.ts";

const config = readRunnerConfig(X1_GATEMEM);
const [MEDICAL, HOUSEHOLD] = config.items as [string, string];
const domains = gatemem.loadDataset(config.data);
const domainOf = (id: string) =>
  domains.find((d) => d.checkpoints.some((c) => c.checkpoint_id === id)) as gatemem.Domain;

/** A cache that keeps every entry, so a test can read the requests the model received. */
function recordingCache(): CacheStore & { entries: CacheEntry[] } {
  const entries: CacheEntry[] = [];
  return {
    entries,
    get: (key) => entries.find((e) => e.key === key),
    set: (entry) => {
      entries.push(entry);
    },
  };
}

const spec = (id: string, condition: Condition, cache: CacheStore, domain = domainOf(id)) => ({
  domain,
  checkpointId: id,
  condition,
  seed: 1,
  model: config.model,
  preset: config.preset,
  policy: loadPreset(config.preset),
  store: "fake" as const,
  cache,
  answers: answersFor(config, id, condition),
  offline: false,
});

/** The domain with every hidden field of checkpoint `id` changed. */
const relabelled = (id: string): gatemem.Domain => {
  const d = domainOf(id);
  return {
    ...d,
    checkpoints: d.checkpoints.map((c) =>
      c.checkpoint_id === id
        ? {
            ...c,
            query_type: c.query_type === "privacy" ? "utility" : "privacy",
            expected_action: c.expected_action === "refuse" ? "answer" : "refuse",
            judge_spec: { expected_action: "answer", include: ["planted"], notes: "planted" },
            leak_targets: ["planted leak target"],
            attack_type: "planted",
          }
        : c,
    ),
  };
};

describe("C1 on GateMem: the long-context agent (ADR 0031)", () => {
  test("C1's prompts are card B1's LongContextAgent's for the same checkpoint", async () => {
    for (const id of [MEDICAL, HOUSEHOLD]) {
      const { mapped } = probeInputs(domainOf(id), id, sequentialIds());
      const c1 = longContextPrompt(mapped);
      let sent: ModelRequest | undefined;
      const agent = new gatemem.LongContextAgent({
        model: "scripted/scripted-1",
        seed: 1,
        temperature: 0.2,
        maxTokens: 4096,
        call: () => async (request) => {
          sent = request;
          return { text: "{}", usage: { input_tokens: 0, output_tokens: 0, cost_usd: 0 } };
        },
      });
      agent.reset(mapped.episode);
      for (const turn of mapped.turns) agent.ingest(turn);
      await agent.query(mapped.checkpoint);
      expect(sent?.system, id).toBe(c1.system);
      expect(sent?.messages[0]?.content, id).toBe(c1.user);
      expect(c1.user).toContain(`Memory ${mapped.turns.length} (speaker=`);
    }
  });

  test("C1 opens no store and declares no tool; its row, preset and store are none", async () => {
    const cache = recordingCache();
    const row = await runProbe(spec(MEDICAL, "C1", cache));
    expect(row.store).toBe("none");
    expect(row.ingested.stored).toBe(0);
    expect(row.tool_calls).toEqual([]);
    expect(cache.entries).toHaveLength(1);
    expect(cache.entries[0]?.context).toEqual({
      item: `gatemem/${MEDICAL}`,
      condition: "C1",
      preset: "none",
      store: "none",
    });
    const request = JSON.stringify(cache.entries[0]?.request);
    expect(request).not.toContain("memory_read");
    expect(request).toContain("Memory 1 (speaker=");
    // The long context is the memory the model was shown, as GateMem scores it.
    expect(row.output.prompt_memory_block).toBe(
      longContextPrompt(probeInputs(domainOf(MEDICAL), MEDICAL, sequentialIds()).mapped).block,
    );
  }, 60_000);
});

describe("C4 on GateMem: instruction with the RAG-Policy's metadata (ADR 0031)", () => {
  test("each turn item carries its speaker, role and the RAG-Policy gate's verdict", () => {
    for (const id of [MEDICAL, HOUSEHOLD]) {
      const { mapped } = probeInputs(domainOf(id), id, sequentialIds());
      const gate = gatemem.ragPolicyGate(mapped.episode, mapped.turns, mapped.checkpoint);
      const metadata = gatememMetadata(mapped);
      expect(metadata.legend).toBe(GATEMEM_METADATA_LEGEND);
      mapped.writes.forEach(({ item }, i) => {
        const chunk = gate[i] as gatemem.RagPolicyChunk;
        expect(metadata.attributes(item)).toEqual([
          ["speaker", chunk.principal_id],
          ["speaker_role", chunk.role],
          ["access", chunk.allowed ? "allowed" : "denied"],
        ]);
      });
    }
  });

  test("C4's read shows the model items the gate allows and items it denies, with the verdict", async () => {
    const cache = recordingCache();
    const row = await runProbe(spec(MEDICAL, "C4", cache));
    expect(row.tool_calls).toEqual([{ name: "memory_read", arguments: { query: "April 17" } }]);
    const last = JSON.stringify(cache.entries.at(-1)?.request);
    expect(last).toContain("<memory-metadata>");
    expect(last).toMatch(/speaker_role=\\+"scheduler\\+" access=\\+"allowed\\+"/);
    expect(last).toMatch(/speaker_role=\\+"family_member\\+" access=\\+"denied\\+"/);
    expect(cache.entries.at(-1)?.context.preset).toBe("medium");
    expect(
      probeContext({ checkpointId: MEDICAL, condition: "C4", preset: "medium", store: "fake" }),
    ).toEqual({ item: `gatemem/${MEDICAL}`, condition: "C4", preset: "medium", store: "fake" });
  }, 60_000);

  test.each(["C1", "C4"] as const)(
    "%s: changing every hidden field of the checkpoint changes no request the model receives",
    async (condition) => {
      const before = recordingCache();
      const after = recordingCache();
      await runProbe(spec(MEDICAL, condition, before));
      await runProbe(spec(MEDICAL, condition, after, relabelled(MEDICAL)));
      expect(after.entries.map((e) => e.key)).toEqual(before.entries.map((e) => e.key));
      expect(JSON.stringify(after.entries.map((e) => e.request))).not.toContain("planted");
    },
    60_000,
  );
});
