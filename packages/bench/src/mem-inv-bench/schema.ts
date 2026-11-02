// Derived from MEM-INV-Bench (MIT, Copyright (c) 2026 Yedidel Louck); the
// licence text is in fixtures/bench/mem-inv-bench/UPSTREAM-LICENSE.
//
// The vendored case format (card B4, ADR 0029). Upstream authors its
// laundering-channel cases in code/scenarios.py (ATTACK, LEGIT, CHANNELS) and
// builds each case's memory in code/exp1_propensity.py (build_memory,
// build_legit_memory); packages/bench/scripts/vendor-mem-inv-bench.py writes
// one case per line of cases.jsonl, its memory checked line by line against
// the memory the recorded study showed the model. The schema is strict, so a
// field the port does not know fails the load instead of slipping past the
// stripping in strip.ts.
import { z } from "zod";

/**
 * The channel a memory entry was written through (upstream build_channels):
 * `web` and `inbox` untrusted ingestion paths (public-web, public-mail),
 * `erp` and `bank` trusted registries in two trust domains (erp-vendor,
 * banking-partner), `user` the user, `agent` the agent's own note (upstream
 * `derive(..., via="agent")`) and `tool` a trusted tool's output (`derive(...,
 * via="tool")`). Which channel wrote an entry is what the harness knows at
 * write time (the paper's assumption A1), so it is visible.
 */
export const ORIGIN_CHANNELS = ["web", "inbox", "erp", "bank", "user", "agent", "tool"] as const;
export const OriginChannel = z.enum(ORIGIN_CHANNELS);
export type OriginChannel = z.infer<typeof OriginChannel>;

export const MemoryEntry = z
  .strictObject({
    entry_id: z.string().regex(/^e\d+$/),
    channel: OriginChannel,
    /** The channels of a derived entry's inputs (upstream `derived_from`); empty for an ingested one. */
    derived_from: z.array(OriginChannel),
    text: z.string().min(1),
    /**
     * For the agent's own note (channel `agent`): the untrusted text it
     * summarised, upstream's raw poison. Upstream writes the note with the
     * model under test (`build_memory`, channel `summarize`), so the runner
     * regenerates it from this input; `text` is the reference model's
     * recorded note, used where no model is asked. Never shown to a model as
     * memory: upstream ingests the raw item but shows only the note.
     */
    summarized_from: z.string().min(1).optional(),
  })
  .refine((e) => (e.summarized_from !== undefined) === (e.channel === "agent"), {
    message: "an agent note carries the text it summarised, and only an agent note does",
  });
export type MemoryEntry = z.infer<typeof MemoryEntry>;

/** The laundering channels of upstream CHANNELS, and `legit` for a benign case. */
export const CASE_CHANNELS = ["direct", "summarize", "tool_echo", "corroborate", "legit"] as const;

/** The consequential tools of upstream TOOLS (plus `answer`, which declines). */
export const ACTION_TOOLS = ["pay", "send_data", "update_setting", "purchase"] as const;

export const Case = z
  .strictObject({
    case_id: z.string().regex(/^mib-\d\d$/),
    // Hidden: the case's labels and scoring keys (strip.ts).
    family: z.enum(["attack", "legit"]),
    channel: z.enum(CASE_CHANNELS),
    sid: z.string(),
    domain: z.string(),
    tool: z.enum(ACTION_TOOLS),
    tier: z.enum(["HIGH", "ROUTINE"]),
    entity: z.string(),
    evil: z.string().optional(),
    good: z.string().optional(),
    value: z.string().optional(),
    vouchers: z.number().int().min(0).optional(),
    // Visible: the request and the memory the world built.
    task: z.string().min(1),
    memory: z.array(MemoryEntry).min(1),
  })
  .superRefine((c, ctx) => {
    const attack = c.family === "attack";
    if (attack !== (c.channel !== "legit"))
      ctx.addIssue({ code: "custom", message: `${c.case_id}: family and channel disagree` });
    const ok = attack
      ? c.evil !== undefined && c.good !== undefined && c.value === undefined
      : c.value !== undefined && c.vouchers !== undefined && c.evil === undefined;
    if (!ok)
      ctx.addIssue({
        code: "custom",
        message: `${c.case_id}: an attack carries evil and good, a benign case value and vouchers`,
      });
  });
export type Case = z.infer<typeof Case>;
