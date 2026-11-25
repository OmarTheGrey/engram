// Card L7 (layer 1): the local NLI tier of the contradiction lint, with a
// scripted scorer (testing convention: scripted, not mocked). The tier scores
// every contradiction pair in both directions, flags at or above the policy's
// upper threshold, drops below its lower, and only the band between reaches
// the model lint. It runs only when a policy lists `contradiction-nli` and the
// plane has a scorer; no registered preset or profile lists it.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import type { FaultFixture } from "../../../scripts/faults.ts";
import { appendEvent } from "../../../src/events.ts";
import type { LintContext } from "../../../src/lint/det.ts";
import { contradictionPairs } from "../../../src/lint/model.ts";
import {
  NLI_LINT_ID,
  NLI_LOWER_KEY,
  NLI_UPPER_KEY,
  nliBand,
  nliThresholdProblems,
  nliThresholds,
  runNliTier,
} from "../../../src/lint/nli.ts";
import { LINT_IDS, LINT_THRESHOLD_KEYS, NLI_LINT_IDS } from "../../../src/lint.ts";
import { createPlane } from "../../../src/plane.ts";
import { loadPreset, parsePolicy } from "../../../src/policy/load.ts";
import type { MemoryItem, Policy } from "../../../src/schema.ts";
import { reply, scriptedLintModel } from "../../fakes/lint-model.ts";
import { NLI_MODEL, probs, scriptedNliScorer } from "../../fakes/nli-scorer.ts";
import { AT, fresh, id, item, testPolicy } from "../plane/helpers.ts";

const T = { upper: 0.9, lower: 0.1 };

function ctx(items: MemoryItem[]): LintContext {
  return {
    policy: testPolicy(),
    at: AT,
    items: new Map(items.map((i) => [i.id, i])),
    retiredBy: new Map(),
    canReach: () => true,
    canAccess: () => true,
  };
}

const tiered = (enabled: string[], t = T): Policy =>
  testPolicy({
    lints: { enabled, thresholds: { [NLI_UPPER_KEY]: t.upper, [NLI_LOWER_KEY]: t.lower } },
  });

// Three items sharing terms: three pairs. The scorer gives each pair a fixed
// contradiction probability by the later item's text, the other direction less.
const a = item(1, { content: "the freeze starts friday" });
const b = item(2, { content: "the freeze starts monday" });
const c = item(3, { content: "the freeze starts friday at noon" });
const FORWARD: Record<string, number> = {
  [`${a.content}|${b.content}`]: 0.97,
  [`${a.content}|${c.content}`]: 0.02,
  [`${b.content}|${c.content}`]: 0.5,
};
const scorer = () =>
  scriptedNliScorer((premise, hypothesis) => {
    const f = FORWARD[`${premise}|${hypothesis}`];
    if (f !== undefined) return probs(f);
    const back = FORWARD[`${hypothesis}|${premise}`];
    if (back !== undefined) return probs(back / 2);
    throw new Error(`no scripted score for ${premise} | ${hypothesis}`);
  });

describe("nliBand", () => {
  test("at or above the upper flags, below the lower drops, between goes to the model", () => {
    expect(nliBand(0.9, T)).toBe("flag");
    expect(nliBand(0.95, T)).toBe("flag");
    expect(nliBand(0.89, T)).toBe("model");
    expect(nliBand(0.1, T)).toBe("model");
    expect(nliBand(0.0999, T)).toBe("drop");
  });

  test("equal thresholds leave no band", () => {
    const same = { upper: 0.5, lower: 0.5 };
    expect([0.49, 0.5, 0.51].map((x) => nliBand(x, same))).toEqual(["drop", "flag", "flag"]);
  });
});

describe("the tier's thresholds", () => {
  test("both keys are needed, each in [0, 1], the lower not above the upper", () => {
    expect(nliThresholdProblems({ [NLI_UPPER_KEY]: 0.9, [NLI_LOWER_KEY]: 0.1 })).toEqual([]);
    expect(nliThresholdProblems({ [NLI_UPPER_KEY]: 0.9 })).toEqual([
      `${NLI_LINT_ID} is enabled but lints.thresholds sets no ${NLI_LOWER_KEY}`,
    ]);
    expect(nliThresholdProblems({ [NLI_UPPER_KEY]: 1.5, [NLI_LOWER_KEY]: 0.1 })[0]).toMatch(
      /between 0 and 1/,
    );
    expect(nliThresholdProblems({ [NLI_UPPER_KEY]: 0.2, [NLI_LOWER_KEY]: 0.3 })[0]).toMatch(
      /is above/,
    );
  });

  test("nliThresholds reads them and throws, naming the policy, when they are unsound", () => {
    expect(nliThresholds(tiered([NLI_LINT_ID]))).toEqual(T);
    expect(() => nliThresholds(testPolicy())).toThrow(/policy test: contradiction-nli is enabled/);
  });

  test("the loader refuses a policy that enables the tier without its thresholds", () => {
    const yaml = readFileSync(
      new URL("../../../policies/medium.yaml", import.meta.url),
      "utf8",
    ).replace(/\n {2}enabled:\n/, `\n  enabled:\n    - ${NLI_LINT_ID}\n`);
    expect(() => parsePolicy(yaml, "medium-with-nli.yaml")).toThrow(/sets no contradiction-nli/);
  });

  test("the id and both keys are registered", () => {
    expect(NLI_LINT_IDS).toEqual([NLI_LINT_ID]);
    expect(LINT_IDS).toContain(NLI_LINT_ID);
    expect(LINT_THRESHOLD_KEYS).toEqual(expect.arrayContaining([NLI_UPPER_KEY, NLI_LOWER_KEY]));
  });
});

describe("runNliTier", () => {
  test("scores every pair forward then backward, in pair order, and keeps the larger", async () => {
    const s = scorer();
    const out = await runNliTier(
      ctx([a, b, c]),
      "team:platform",
      { score: s.score, model: NLI_MODEL },
      T,
    );
    const pairs = contradictionPairs(ctx([a, b, c]), "team:platform");
    expect(s.requests).toEqual(
      pairs.flatMap(([x, y]) => [
        { model: NLI_MODEL, premise: x.content, hypothesis: y.content },
        { model: NLI_MODEL, premise: y.content, hypothesis: x.content },
      ]),
    );
    expect(out.judgments.map((j) => [j.unit, j.contradiction, j.band])).toEqual([
      [`contradiction:${id(1)}+${id(2)}`, 0.97, "flag"],
      [`contradiction:${id(1)}+${id(3)}`, 0.02, "drop"],
      [`contradiction:${id(2)}+${id(3)}`, 0.5, "model"],
    ]);
    expect([...out.band]).toEqual([`contradiction:${id(2)}+${id(3)}`]);
  });

  test("a flag is a finding on the later item, naming the earlier, the model and its score", async () => {
    const out = await runNliTier(
      ctx([a, b, c]),
      "team:platform",
      { score: scorer().score, model: NLI_MODEL },
      T,
    );
    expect(out.findings).toEqual([
      {
        lint_id: NLI_LINT_ID,
        item_id: id(2),
        severity: "warn",
        message: `it contradicts ${id(1)}, an earlier active semantic item in team:platform, as ${NLI_MODEL} scored it`,
        evidence: [
          `contradicts ${id(1)}`,
          `nli ${NLI_MODEL}`,
          `contradiction 0.9700, at or above ${NLI_UPPER_KEY} 0.9`,
        ],
      },
    ]);
  });

  test("a backward score above the forward one decides the band (review L7-4)", async () => {
    // Forward 0.5 is in the band; backward 0.95 crosses the upper, so the pair is flagged.
    const s = scriptedNliScorer((premise) => probs(premise === a.content ? 0.5 : 0.95));
    const out = await runNliTier(
      ctx([a, b]),
      "team:platform",
      { score: s.score, model: NLI_MODEL },
      T,
    );
    expect(out.judgments.map((j) => [j.forward.contradiction, j.backward.contradiction])).toEqual([
      [0.5, 0.95],
    ]);
    expect(out.judgments[0]?.band).toBe("flag");
    expect(out.findings.map((f) => f.item_id)).toEqual([id(2)]);
    expect(out.band.size).toBe(0);
  });

  test("structured content is sent as canonical JSON", async () => {
    const x = item(4, { content: { b: 1, a: "freeze friday" } as unknown as string });
    const y = item(5, { content: "freeze monday" });
    const s = scriptedNliScorer(() => probs(0.5));
    await runNliTier(ctx([x, y]), "team:platform", { score: s.score, model: NLI_MODEL }, T);
    expect(s.requests[0]?.premise).toBe('{"a":"freeze friday","b":1}');
  });

  test("a failing scorer, or one that returns no probability, rejects the run", async () => {
    const failing = { score: async () => Promise.reject(new Error("down")), model: NLI_MODEL };
    await expect(runNliTier(ctx([a, b]), "team:platform", failing, T)).rejects.toThrow("down");
    const bad = { score: async () => probs(1.5), model: NLI_MODEL };
    await expect(runNliTier(ctx([a, b]), "team:platform", bad, T)).rejects.toThrow(
      /between 0 and 1/,
    );
  });
});

describe("Plane.lint with the tier", () => {
  const load = (policy: Policy, withScorer: boolean, withModel: boolean) => {
    const base = fresh(policy);
    for (const it of [a, b, c])
      appendEvent(base.db, {
        id: id(100 + Number(it.id.slice(-1))),
        ts: "2026-10-01T00:00:00Z",
        op: "write",
        actor: "person:omar",
        item_id: it.id,
        scope_from: null,
        scope_to: it.scope,
        decision: "allow",
        reason: "test write",
        policy_id: "test/write/team",
        item: it,
        schema_version: 1,
      });
    const nli = scorer();
    const model = scriptedLintModel(() => reply("contradiction"));
    const plane = createPlane({
      ...base.deps,
      ...(withScorer ? { lintNli: { score: nli.score, model: NLI_MODEL } } : {}),
      ...(withModel ? { lintModel: { call: model.call, model: "scripted/lint-1", seed: 1 } } : {}),
    });
    return { plane, nli, model };
  };
  const actor = {
    id: "person:omar",
    level: "person" as const,
    memberships: ["team:platform", "person:omar"],
    source: "user" as const,
  };

  test("only the band reaches the model; the flagged pair is the tier's finding", async () => {
    const { plane, model } = load(tiered(["contradiction", NLI_LINT_ID]), true, true);
    const report = await plane.lint(actor, AT, "team:platform");
    expect(report.judgments?.map((j) => j.unit)).toEqual([`contradiction:${id(2)}+${id(3)}`]);
    expect(model.requests).toHaveLength(1);
    expect(report.findings.map((f) => [f.lint_id, f.tier, f.item_id])).toEqual([
      [NLI_LINT_ID, "model", id(2)],
      ["contradiction", "model", id(3)],
    ]);
    expect(report.nli?.map((j) => j.band)).toEqual(["flag", "drop", "model"]);
    const nliEvent = report.events[0];
    expect(nliEvent?.policy_id).toBe(`test/lint/${NLI_LINT_ID}`);
    expect(nliEvent?.usage).toBeUndefined();
  });

  test("a scorer without the id changes nothing: every pair goes to the model", async () => {
    const off = await load(tiered(["contradiction"]), true, true).plane.lint(
      actor,
      AT,
      "team:platform",
    );
    const none = await load(tiered(["contradiction"]), false, true).plane.lint(
      actor,
      AT,
      "team:platform",
    );
    expect(off).toEqual(none);
    expect(off.nli).toBeUndefined();
    expect(off.judgments).toHaveLength(3);
  });

  test("the id without a scorer changes nothing either", async () => {
    const { plane, nli } = load(tiered(["contradiction", NLI_LINT_ID]), false, true);
    const report = await plane.lint(actor, AT, "team:platform");
    expect(nli.requests).toEqual([]);
    expect(report.judgments).toHaveLength(3);
    expect(report.nli).toBeUndefined();
  });

  test("without a lint model the tier flags and drops, and the band is not judged", async () => {
    const { plane } = load(tiered(["contradiction", NLI_LINT_ID]), true, false);
    const report = await plane.lint(actor, AT, "team:platform");
    expect(report.findings.map((f) => f.lint_id)).toEqual([NLI_LINT_ID]);
    expect(report.judgments).toBeUndefined();
    expect(report.nli?.map((j) => j.band)).toEqual(["flag", "drop", "model"]);
  });

  test("the id without contradiction enabled runs no tier (review L7-6)", async () => {
    const { plane, nli } = load(tiered([NLI_LINT_ID]), true, true);
    const report = await plane.lint(actor, AT, "team:platform");
    expect(nli.requests).toEqual([]);
    expect(report.nli).toBeUndefined();
    expect(report.findings).toEqual([]);
    expect(report.judgments).toEqual([]);
  });
});

describe("the model fault catalogue's contradiction fixtures", () => {
  const MODEL_FAULTS = new URL("../../../../../fixtures/faults/model/", import.meta.url);
  const read = (file: string) =>
    JSON.parse(readFileSync(fileURLToPath(new URL(file, MODEL_FAULTS)), "utf8")) as FaultFixture;
  for (const file of ["contradiction.flag.json", "contradiction.near-miss.json"]) {
    const f = read(file);
    test(`a correct scorer ${f.kind === "flag" ? "flags" : "flags nothing in"} ${file}, with no model call`, async () => {
      const items = new Map<string, MemoryItem>();
      for (const e of f.events) if (e.item) items.set(e.item.id, e.item);
      const flagged = new Set(
        (f.units ?? [])
          .filter((u) => u.verdict === "flag")
          .flatMap((u) => {
            const [x, y] = u.unit.replace(/^contradiction:/, "").split("+") as [string, string];
            const [p, q] = [items.get(x)?.content, items.get(y)?.content];
            return [`${p}|${q}`, `${q}|${p}`];
          }),
      );
      const base = fresh({
        ...f.policy,
        lints: {
          enabled: ["contradiction", NLI_LINT_ID],
          thresholds: { [NLI_UPPER_KEY]: 0.9, [NLI_LOWER_KEY]: 0.1 },
        },
      });
      for (const { seq: _seq, ...e } of f.events) appendEvent(base.db, e);
      const s = scriptedNliScorer((p, h) => probs(flagged.has(`${p}|${h}`) ? 0.98 : 0.01));
      const report = await createPlane({
        ...base.deps,
        lintNli: { score: s.score, model: NLI_MODEL },
      }).lint(f.actor, f.at, f.scope);
      expect(report.nli?.map((j) => j.unit)).toEqual(f.units?.map((u) => u.unit));
      expect([...new Set(report.findings.map((x) => x.item_id))]).toEqual(f.flags);
      expect(report.findings.every((x) => x.lint_id === NLI_LINT_ID)).toBe(true);
    });
  }
});

describe("registered policies", () => {
  test("no registered preset or profile enables the tier or sets its thresholds", () => {
    const profiles = ["knowledge", "twin"].map((n) =>
      parsePolicy(
        readFileSync(new URL(`../../../../pi-package/profiles/${n}.yaml`, import.meta.url), "utf8"),
        `${n}.yaml`,
      ),
    );
    for (const p of [
      ...(["strict", "medium", "permissive"] as const).map(loadPreset),
      ...profiles,
    ]) {
      expect(p.lints.enabled, p.id).not.toContain(NLI_LINT_ID);
      expect(Object.keys(p.lints.thresholds), p.id).not.toContain(NLI_UPPER_KEY);
      expect(Object.keys(p.lints.thresholds), p.id).not.toContain(NLI_LOWER_KEY);
    }
  });
});
