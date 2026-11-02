// Card X1, plan decision 4, ADR 0031: conditions C1 and C4 on GateMem. C1 is
// GateMem's long-context agent (card B1's port, held to upstream by
// packages/bench/test/gatemem/upstream.test.ts): no store, no memory tool,
// the same prompt. C4 is C3 with each item a read returns carrying the
// speaker, their role and GateMem's RAG-Policy gate's verdict for the asker
// (packages/bench/src/gatemem/rag-policy.ts, held to upstream by
// rag-policy.test.ts). Neither reads a hidden field.

import { createFakeAdapter } from "@engram/adapters";
import { gatemem } from "@engram/bench";
import {
  createPlane,
  evaluateRead,
  loadPreset,
  type ModelRequest,
  migrate,
  openSqlite,
} from "@engram/core";
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

describe("C4 on GateMem: instruction with each item's verdict (ADR 0031)", () => {
  test("by default each turn item carries its speaker, role and the plane's own read decision for the asker (core's evaluateRead)", () => {
    const policy = loadPreset("medium");
    for (const id of [MEDICAL, HOUSEHOLD]) {
      const { mapped } = probeInputs(domainOf(id), id, sequentialIds());
      const metadata = gatememMetadata(mapped, "engram", policy);
      expect(metadata.legend).toBe(GATEMEM_METADATA_LEGEND);
      mapped.writes.forEach(({ item }, i) => {
        const turn = mapped.turns[i] as gatemem.Turn;
        expect(metadata.attributes(item)).toEqual([
          ["speaker", turn.speaker.principal_id],
          ["speaker_role", turn.speaker.role],
          [
            "access",
            evaluateRead(policy, mapped.asker, item, mapped.at).admitted ? "allowed" : "denied",
          ],
        ]);
      });
    }
  });

  test("C4's engram verdict is exactly what C5's plane admits: an item is allowed if and only if C5's read returns it", async () => {
    for (const id of [MEDICAL, HOUSEHOLD]) {
      const newId = sequentialIds();
      const { mapped } = probeInputs(domainOf(id), id, newId);
      const policy = loadPreset("medium");
      const db = openSqlite(":memory:");
      migrate(db);
      const plane = createPlane({ db, adapter: createFakeAdapter(), policy, newId });
      for (const { actor, item } of mapped.writes) await plane.write(actor, item, item.valid_from);
      const admitted = new Set(
        (await plane.read(mapped.asker, { at: mapped.at })).items.map((i) => i.id),
      );
      const metadata = gatememMetadata(mapped, "engram", policy);
      for (const { item } of mapped.writes) {
        const access = metadata.attributes(item)?.find(([k]) => k === "access")?.[1];
        expect(access, item.provenance.ref).toBe(admitted.has(item.id) ? "allowed" : "denied");
      }
      expect(admitted.size).toBeGreaterThan(0);
      expect(admitted.size).toBeLessThan(mapped.writes.length);
      db.close();
    }
  });

  test("the gatemem-rag source gives GateMem's RAG-Policy gate's verdict instead", () => {
    for (const id of [MEDICAL, HOUSEHOLD]) {
      const { mapped } = probeInputs(domainOf(id), id, sequentialIds());
      const gate = gatemem.ragPolicyGate(mapped.episode, mapped.turns, mapped.checkpoint);
      const metadata = gatememMetadata(mapped, "gatemem-rag");
      mapped.writes.forEach(({ item }, i) => {
        const chunk = gate[i] as gatemem.RagPolicyChunk;
        expect(metadata.attributes(item)?.[2]).toEqual([
          "access",
          chunk.allowed ? "allowed" : "denied",
        ]);
      });
    }
  });

  test("C4's read shows the model items allowed and denied, with the verdict; the config chooses the source", async () => {
    const engram = recordingCache();
    const row = await runProbe(spec(MEDICAL, "C4", engram));
    expect(row.tool_calls).toEqual([{ name: "memory_read", arguments: { query: "April 17" } }]);
    const shown = JSON.stringify(engram.entries.at(-1)?.request);
    expect(shown).toContain("<memory-metadata>");
    expect(shown).toMatch(/access=\\+"allowed\\+"/);
    expect(shown).toMatch(/access=\\+"denied\\+"/);
    expect(engram.entries.at(-1)?.context.preset).toBe("medium");
    const rag = recordingCache();
    await runProbe({ ...spec(MEDICAL, "C4", rag), c4Verdicts: "gatemem-rag" });
    // The family member's own question: the plane admits it (her own scope), the rule table denies it.
    const verdict = (cache: typeof rag) =>
      /speaker_role=\\+"family_member\\+" access=\\+"(\w+)\\+"/.exec(
        JSON.stringify(cache.entries.at(-1)?.request),
      )?.[1];
    expect(verdict(engram)).toBe("allowed");
    expect(verdict(rag)).toBe("denied");
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
