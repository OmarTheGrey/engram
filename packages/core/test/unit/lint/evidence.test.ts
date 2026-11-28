// Acceptance for card L9 of the second absorb plan (layer 1, and through the
// real Plane): quote grounding of the model-based lints, the policy option
// `lints.model.evidence`. On, each lint asks a flag for the words behind it,
// and a deterministic check (exact after NFC and whitespace folding, at
// least 12 characters, lint/evidence.ts) keeps a flag whose quotes are found
// as a finding carrying them and downgrades one whose quote is not to the
// judgment `ungrounded`, which is not a finding. Absent or off, nothing a
// lint sends or records changes: the registered H3 runs and their cassettes.
//
// The checkQuote cases marked "ported" are tests/test_verify_quotes.py of
// obsidian-second-brain (MIT, commit 7f4ddfdafa4e4652b01209f1847c3a3fc7d07754)
// rewritten over an item's text; its path and line cases have no
// counterpart, since an item has neither.
import { describe, expect, test } from "vitest";
import type { Actor } from "../../../src/actor.ts";
import { strictContentHash } from "../../../src/content-hash.ts";
import { appendEvent } from "../../../src/events.ts";
import type { LintContext } from "../../../src/lint/det.ts";
import { checkQuote, foldQuoteText, MIN_QUOTE } from "../../../src/lint/evidence.ts";
import {
  GROUNDED_MAX_TOKENS,
  GROUNDED_PROMPTS,
  GROUNDED_SCHEMAS,
  LINT_PROMPTS,
  LINT_SCHEMAS,
  MODEL_LINT_SETTINGS,
  type ModelLintSetup,
  modelLintUnits,
  parseLintReply,
  runModelLints,
} from "../../../src/lint/model.ts";
import { MODEL_LINT_IDS } from "../../../src/lint.ts";
import { createPlane } from "../../../src/plane.ts";
import { CedarExportError, exportCedar } from "../../../src/policy/cedar.ts";
import { loadPreset, PRESETS, parsePolicy } from "../../../src/policy/load.ts";
import { notBuiltOptions } from "../../../src/policy/options.ts";
import type { MemoryItem, Policy } from "../../../src/schema.ts";
import { scriptedLintModel, USAGE } from "../../fakes/lint-model.ts";
import { fresh, id, item, testPolicy } from "../plane/helpers.ts";

const SETUP = { model: "scripted/lint-1", seed: 7 };
const SCOPE = "team:platform";

const withEvidence = (evidence: "on" | "off" | undefined, base: Policy = testPolicy()): Policy => ({
  ...base,
  lints: {
    ...base.lints,
    enabled: ["contradiction", "unsupported-claim"],
    ...(evidence === undefined ? {} : { model: { evidence } }),
  },
});

function ctx(items: MemoryItem[], policy: Policy): LintContext {
  return {
    policy,
    at: "2026-10-25T12:00:00Z",
    items: new Map(items.map((i) => [i.id, i])),
    retiredBy: new Map(),
    canReach: () => true,
    dated: () => false,
  };
}

const derived = (
  n: number,
  source: MemoryItem,
  content: string,
  over: { class?: "episodic" | "semantic"; scope?: string } = {},
) =>
  item(n, {
    content,
    provenance: {
      kind: "user",
      ref: source.id,
      hash: strictContentHash(source.content),
      actor: "person:omar",
    },
    ...over,
  });

const friday = item(1, { content: "The release freeze starts on Friday." });
const monday = item(2, { content: "The release freeze starts on Monday." });
// Episodic, so the contradiction lint pairs only the two semantic items.
const incident = item(3, {
  class: "episodic",
  content: "Incident 42: the payment service failed on Tuesday because a certificate expired.",
});
const failover = derived(
  4,
  incident,
  "The payment outage on Tuesday was caused by a database failover.",
  { class: "episodic" },
);
const ITEMS = [friday, monday, incident, failover];

/** A grounded reply. */
const grounded = (verdict: string, quotes: Record<string, unknown>, reason = "scripted reason") =>
  JSON.stringify({ verdict, reason, ...quotes });

describe("checkQuote", () => {
  const NOTE =
    "## For future agent\n\nRevenue rose 12% in the third quarter of 2026.\nThe pilot uses a local search index.\n";

  test("a real quote is found (ported)", () => {
    expect(checkQuote("Revenue rose 12% in the third quarter", NOTE)).toEqual({
      found: true,
      quote: "Revenue rose 12% in the third quarter",
    });
  });
  test("an invented quote is not found (ported)", () => {
    expect(checkQuote("Revenue doubled after the product launch", NOTE)).toEqual({
      found: false,
      quote: "Revenue doubled after the product launch",
      reason: "the quote is not in the item",
    });
  });
  test("one changed word is not found (ported)", () => {
    expect(checkQuote("Revenue fell 12% in the third quarter", NOTE).found).toBe(false);
  });
  test(`a quote shorter than ${MIN_QUOTE} characters proves nothing (ported)`, () => {
    expect(checkQuote("Revenue", NOTE)).toEqual({
      found: false,
      quote: "Revenue",
      reason: `the quote is shorter than ${MIN_QUOTE} characters and proves nothing`,
    });
    // Twelve characters is enough; the bound counts characters, not UTF-16 units.
    expect(checkQuote("Revenue rose", NOTE).found).toBe(true);
    expect(checkQuote("café café c", "café café café").found).toBe(false);
  });
  test("decomposed accents, a byte order mark, CRLF and doubled spaces still match (ported)", () => {
    const text = "﻿Café owners  reported a strong summer season.\r\n".normalize("NFD");
    expect(checkQuote("Café owners reported a strong summer", text).found).toBe(true);
    expect(checkQuote("Café\towners   reported a strong\nsummer", text).found).toBe(true);
  });
  test("a quote across a line break matches, since an item has no lines (a divergence)", () => {
    expect(checkQuote("third quarter of 2026. The pilot uses", NOTE).found).toBe(true);
  });
  test("no quote, an empty one or one that is not text grounds nothing", () => {
    for (const q of [undefined, null, 12, ["Revenue rose 12% in the third quarter"]])
      expect(checkQuote(q, NOTE)).toEqual({ found: false, quote: null, reason: "no quote given" });
    expect(checkQuote("   ", NOTE)).toEqual({ found: false, quote: "", reason: "no quote given" });
  });
  test("folding is NFC, every whitespace run one space, trimmed", () => {
    expect(foldQuoteText("  a \t b\r\n\nc ".normalize("NFD"))).toBe("a b c");
    expect(foldQuoteText("é")).toBe("é");
  });
});

describe("the option absent or off changes nothing a lint sends", () => {
  test.each([undefined, "off"] as const)(
    "evidence %s: the registered prompt, schema and settings",
    (evidence) => {
      const units = modelLintUnits(
        ctx(ITEMS, withEvidence(evidence)),
        SCOPE,
        MODEL_LINT_IDS,
        SETUP,
      );
      expect(units.map((u) => u.lint_id)).toEqual(["contradiction", "unsupported-claim"]);
      for (const u of units) {
        expect(u.request.system).toBe(LINT_PROMPTS[u.lint_id]);
        expect(u.request.responseSchema).toEqual(LINT_SCHEMAS[u.lint_id]);
        expect(u.request.maxTokens).toBe(MODEL_LINT_SETTINGS.maxTokens);
        expect("grounding" in u).toBe(false);
      }
      // Byte for byte the requests of a policy that never names the option.
      const plain = modelLintUnits(
        ctx(ITEMS, withEvidence(undefined)),
        SCOPE,
        MODEL_LINT_IDS,
        SETUP,
      );
      expect(JSON.stringify(units)).toBe(JSON.stringify(plain));
    },
  );

  test("a reply carrying quotes is read as before, and its judgment carries no grounding", async () => {
    const model = scriptedLintModel((lint) =>
      lint === "contradiction"
        ? grounded("contradiction", { quote_a: "nothing like A at all", quote_b: "x" })
        : grounded("unsupported", { quote: "nothing like the claim" }),
    );
    const units = modelLintUnits(ctx(ITEMS, withEvidence("off")), SCOPE, MODEL_LINT_IDS, SETUP);
    const out = await runModelLints(units, model.call);
    expect(out.judgments.map((j) => j.outcome)).toEqual(["flag", "flag"]);
    expect(out.findings).toHaveLength(2);
    for (const j of out.judgments) expect("grounding" in j).toBe(false);
    for (const f of out.findings) expect(f.evidence.some((e) => e.startsWith("quote"))).toBe(false);
  });
});

describe("the option on", () => {
  const on = withEvidence("on");

  test("each lint sends its grounded prompt, schema and token limit, with the same inputs", () => {
    const units = modelLintUnits(ctx(ITEMS, on), SCOPE, MODEL_LINT_IDS, SETUP);
    const plain = modelLintUnits(ctx(ITEMS, withEvidence(undefined)), SCOPE, MODEL_LINT_IDS, SETUP);
    expect(units.map((u) => u.unit)).toEqual(plain.map((u) => u.unit));
    for (const [i, u] of units.entries()) {
      expect(u.request.system).toBe(GROUNDED_PROMPTS[u.lint_id]);
      expect(u.request.responseSchema).toEqual(GROUNDED_SCHEMAS[u.lint_id]);
      expect(u.request.maxTokens).toBe(GROUNDED_MAX_TOKENS);
      expect(u.request.messages).toEqual(plain[i]?.request.messages);
    }
    expect(GROUNDED_SCHEMAS.contradiction.schema).toMatchObject({
      required: ["verdict", "reason", "quote_a", "quote_b"],
      additionalProperties: false,
    });
    expect(GROUNDED_SCHEMAS["unsupported-claim"].schema).toMatchObject({
      required: ["verdict", "reason", "quote"],
    });
    // The grounded prompt is the registered one with the quote rule before its answer line.
    for (const lint of MODEL_LINT_IDS)
      expect(
        GROUNDED_PROMPTS[lint].startsWith(LINT_PROMPTS[lint].split("\n").slice(0, -1).join("\n")),
      ).toBe(true);
    expect(GROUNDED_PROMPTS["unsupported-claim"]).toContain("never quote the source");
  });

  test("a contradiction's quotes come from A and B, a claim's from the claim alone", () => {
    const [pair, claim] = modelLintUnits(ctx(ITEMS, on), SCOPE, MODEL_LINT_IDS, SETUP);
    expect(pair?.grounding).toEqual([
      { field: "quote_a", item_id: id(1), text: friday.content },
      { field: "quote_b", item_id: id(2), text: monday.content },
    ]);
    expect(claim?.grounding).toEqual([{ field: "quote", item_id: id(4), text: failover.content }]);
  });

  test("a flag whose every quote is found is a finding whose evidence carries the quotes", async () => {
    const model = scriptedLintModel((lint) =>
      lint === "contradiction"
        ? grounded("contradiction", {
            quote_a: "freeze  starts on Friday",
            quote_b: "The release freeze starts on Monday.",
          })
        : grounded("unsupported", { quote: "caused by a database failover" }),
    );
    const units = modelLintUnits(ctx(ITEMS, on), SCOPE, MODEL_LINT_IDS, SETUP);
    const out = await runModelLints(units, model.call);
    expect(out.judgments.map((j) => j.outcome)).toEqual(["flag", "flag"]);
    expect(out.findings.map((f) => f.evidence)).toEqual([
      [
        `contradicts ${id(1)}`,
        "model scripted/lint-1, seed 7",
        "reason: scripted reason",
        `quote of ${id(1)}: "freeze starts on Friday"`,
        `quote of ${id(2)}: "The release freeze starts on Monday."`,
      ],
      [
        `source ${id(3)}`,
        `recorded ${strictContentHash(incident.content)}`,
        "model scripted/lint-1, seed 7",
        "reason: scripted reason",
        `quote of ${id(4)}: "caused by a database failover"`,
      ],
    ]);
    expect(out.judgments[0]?.grounding).toEqual([
      { field: "quote_a", item_id: id(1), quote: "freeze starts on Friday", found: true },
      {
        field: "quote_b",
        item_id: id(2),
        quote: "The release freeze starts on Monday.",
        found: true,
      },
    ]);
  });

  test("a flag with a quote not found, too short or missing is ungrounded: a judgment, not a finding", async () => {
    const replies = [
      // One side invented: the pair fails (ported: one failing side fails the pair).
      grounded("contradiction", {
        quote_a: "The release freeze starts on Friday",
        quote_b: "The release freeze starts on Sunday",
      }),
      grounded("unsupported", { quote: "failover" }),
    ];
    let n = 0;
    const model = scriptedLintModel(() => replies[n++] ?? "");
    const units = modelLintUnits(ctx(ITEMS, on), SCOPE, MODEL_LINT_IDS, SETUP);
    const out = await runModelLints(units, model.call);
    expect(out.findings).toEqual([]);
    expect(out.judgments.map((j) => [j.outcome, j.reason, j.usage])).toEqual([
      ["ungrounded", "scripted reason", USAGE],
      ["ungrounded", "scripted reason", USAGE],
    ]);
    expect(out.judgments[0]?.grounding).toEqual([
      {
        field: "quote_a",
        item_id: id(1),
        quote: "The release freeze starts on Friday",
        found: true,
      },
      {
        field: "quote_b",
        item_id: id(2),
        quote: "The release freeze starts on Sunday",
        found: false,
        reason: "the quote is not in the item",
      },
    ]);
    expect(out.judgments[1]?.grounding?.[0]?.reason).toBe(
      `the quote is shorter than ${MIN_QUOTE} characters and proves nothing`,
    );
    const missing = await runModelLints(
      units.slice(1),
      scriptedLintModel(() => JSON.stringify({ verdict: "unsupported", reason: "r" })).call,
    );
    expect(missing.judgments[0]?.outcome).toBe("ungrounded");
    expect(missing.judgments[0]?.grounding?.[0]).toMatchObject({
      quote: null,
      reason: "no quote given",
    });
  });

  test("a claim quoting its source, not itself, is ungrounded, so a source outside the scope never reaches evidence", async () => {
    const outside = item(5, {
      content: "Dana's laptop runs Linux and nothing else.",
      scope: "person:omar",
    });
    const windows = derived(6, outside, "Dana's laptop runs Windows.");
    const units = modelLintUnits(ctx([outside, windows], on), SCOPE, ["unsupported-claim"], SETUP);
    const quoting = (q: string) =>
      scriptedLintModel(() => grounded("unsupported", { quote: q }, "r")).call;
    const source = await runModelLints(units, quoting("Dana's laptop runs Linux"));
    expect(source.findings).toEqual([]);
    expect(source.judgments[0]?.outcome).toBe("ungrounded");
    const own = await runModelLints(units, quoting("Dana's laptop runs Windows"));
    expect(own.findings[0]?.evidence).toEqual([
      `source ${id(5)}`,
      `recorded ${strictContentHash(outside.content)}`,
      "model scripted/lint-1, seed 7",
      `reason not shown: the source is outside ${SCOPE}`,
      `quote of ${id(6)}: "Dana's laptop runs Windows"`,
    ]);
    expect(JSON.stringify(own.findings)).not.toContain("Linux");
  });

  test("a pass, a refusal and a malformed reply read as before, with no grounding", async () => {
    const replies = [grounded("consistent", { quote_a: "", quote_b: "" }), "", "no JSON here"];
    let n = 0;
    const model = scriptedLintModel(() => replies[n++] ?? "");
    const c = item(7, { content: "The release freeze starts on Sunday." });
    const units = modelLintUnits(ctx([friday, monday, c], on), SCOPE, ["contradiction"], SETUP);
    const out = await runModelLints(units, model.call);
    expect(out.judgments.map((j) => j.outcome)).toEqual(["pass", "refused", "malformed"]);
    for (const j of out.judgments) expect("grounding" in j).toBe(false);
  });

  test("parseLintReply keeps the quote fields only when grounded", () => {
    const text = grounded("unsupported", { quote: "a quote of the claim", extra: 1 });
    expect(parseLintReply("unsupported-claim", text)).toEqual({
      outcome: "flag",
      reason: "scripted reason",
    });
    expect(parseLintReply("unsupported-claim", text, true)).toEqual({
      outcome: "flag",
      reason: "scripted reason",
      quotes: { quote: "a quote of the claim" },
    });
  });
});

describe("through Plane.lint", () => {
  const ACTOR: Actor = {
    id: "person:omar",
    level: "person",
    memberships: ["person:omar", SCOPE],
    source: "user",
  };

  function seeded(policy: Policy, lintModel: ModelLintSetup) {
    const base = fresh(policy);
    const plane = createPlane({ ...base.deps, lintModel });
    for (const [n, it] of [friday, monday].entries())
      appendEvent(base.db, {
        id: id(500 + n),
        ts: "2026-10-01T00:00:00Z",
        op: "write",
        item_id: it.id,
        actor: "person:omar",
        scope_from: null,
        scope_to: it.scope,
        decision: "allow",
        reason: "seeded",
        policy_id: "test/write/team",
        item: it,
        schema_version: 1,
      });
    return plane;
  }

  test("a grounded finding's lint event carries the quotes; an ungrounded flag appends nothing", async () => {
    const policy = withEvidence("on");
    const found = scriptedLintModel(() =>
      grounded("contradiction", {
        quote_a: "starts on Friday.",
        quote_b: "starts on Monday.",
      }),
    );
    const report = await seeded(policy, {
      call: found.call,
      model: "scripted/lint-1",
      seed: 1,
    }).lint(ACTOR, "2026-10-25T12:00:00Z", SCOPE);
    expect(report.findings.map((f) => [f.lint_id, f.tier, f.item_id])).toEqual([
      ["contradiction", "model", id(2)],
    ]);
    expect(report.events[0]?.reason).toContain(`quote of ${id(1)}: "starts on Friday."`);
    expect(report.events[0]?.reason).toContain(`quote of ${id(2)}: "starts on Monday."`);

    const invented = scriptedLintModel(() =>
      grounded("contradiction", { quote_a: "starts on Friday.", quote_b: "starts on Thursday." }),
    );
    const none = await seeded(policy, {
      call: invented.call,
      model: "scripted/lint-1",
      seed: 1,
    }).lint(ACTOR, "2026-10-25T12:00:00Z", SCOPE);
    expect(none.findings).toEqual([]);
    expect(none.events).toEqual([]);
    expect(none.judgments?.map((j) => j.outcome)).toEqual(["ungrounded"]);
  });
});

describe("the policy option", () => {
  const VALID = (lintsModel: string) => `id: test-policy
version: 1
write:
  - { scope: person, allowed_sources: [user, model], confidence_floor: 0.5, forbidden_classes: [], requires_review: false }
  - { scope: role, allowed_sources: [user], confidence_floor: 0.5, forbidden_classes: [], requires_review: false }
  - { scope: team, allowed_sources: [user], confidence_floor: 0.5, forbidden_classes: [], requires_review: false }
  - { scope: org, allowed_sources: [user], confidence_floor: 0.5, forbidden_classes: [], requires_review: false }
read:
  matrix:
    - { reader: person, may_read: [person, org] }
    - { reader: role, may_read: [role, org] }
    - { reader: team, may_read: [team, org] }
    - { reader: org, may_read: [org] }
  honour_grants: true
retention: []
promotion:
  episodic_to_semantic: { confirmations: 3, or_review: true }
  procedural: { replay_k: 4, replay_n: 5 }
lints:
  enabled: [contradiction, unsupported-claim]
  thresholds: {}
${lintsModel}schema_version: 1
`;

  test.each(["on", "off"])("the loader takes evidence %s as written", (v) => {
    const policy = parsePolicy(VALID(`  model:\n    evidence: "${v}"\n`), "test.yaml");
    expect(policy.lints.model).toEqual({ evidence: v });
    expect(notBuiltOptions(policy)).toEqual([]);
  });

  test("no registered preset sets it", () => {
    for (const name of PRESETS) expect(loadPreset(name).lints.model).toBeUndefined();
  });

  test("the Cedar export is the same with it on, off or absent: a lint decides no read or write", () => {
    const medium = loadPreset("medium");
    const plain = exportCedar(medium);
    for (const evidence of ["on", "off"] as const) {
      const set: Policy = { ...medium, lints: { ...medium.lints, model: { evidence } } };
      expect(() => exportCedar(set)).not.toThrow(CedarExportError);
      expect(exportCedar(set)).toEqual(plain);
    }
  });

  test("Plane.simulate takes a candidate that sets it", async () => {
    const medium = loadPreset("medium");
    const { plane } = fresh(medium);
    const candidate: Policy = { ...medium, lints: { ...medium.lints, model: { evidence: "on" } } };
    const report = await plane.simulate({ id: "w", actors: {}, steps: [] }, candidate);
    expect(report.changed).toEqual([]);
  });
});
