// Acceptance for card E2.14 of the second absorb plan: the policy options
// seven later cards build on (lints.model.evidence, procedures.safety_scan,
// procedures.drift, consent, erasure.mode, approval, grants.expiry_cap), added
// under ADR 0002's decision D2: optional, without a default, so a policy
// without them parses and serialises byte for byte as before. Absent is the
// only value the loader accepts until each option's card builds it: every
// value the schema admits is refused, at its key, naming that card. Each
// consuming card removes its own row of NOT_BUILT below, as it lifts the
// refusal in policy/load.ts. Card E2.21 (part 2) removed grants.expiry_cap's
// row: the option loads, runs and stays refused by the Cedar export, which
// cannot state a rule judged grant by grant (the describe at the end).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { parse as parseYaml } from "yaml";
import { InvalidCallError } from "../../../src/plane.ts";
import { CedarExportError, exportCedar } from "../../../src/policy/cedar.ts";
import {
  EXTRA_PRESETS,
  loadPreset,
  PolicyError,
  type PolicyProblem,
  PRESETS,
  type PresetName,
  parsePolicy,
} from "../../../src/policy/load.ts";
import { NOT_BUILT_YET, notBuiltOptions } from "../../../src/policy/options.ts";
import { Policy } from "../../../src/schema.ts";
import { fresh } from "../plane/helpers.ts";

const VALID = `id: test-policy
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
retention:
  - { scope: person, class: episodic, ttl: 86400, budget: null, eviction: recency }
promotion:
  episodic_to_semantic: { confirmations: 3, or_review: true }
  procedural: { replay_k: 4, replay_n: 5 }
lints:
  enabled: [expired-validity]
  thresholds: {}
schema_version: 1
`;

/** The top-level keys this card adds; `lints.model` is nested in an existing block. */
const NEW_KEYS = ["procedures", "consent", "erasure", "approval", "grants"] as const;

/** VALID with `yaml` (top-level blocks) inserted before `schema_version`. */
const withBlocks = (yaml: string) =>
  VALID.replace("schema_version: 1\n", `${yaml}schema_version: 1\n`);
/** VALID with `yaml` (indented under lints) added to the lints block. */
const withLints = (yaml: string) =>
  VALID.replace("  thresholds: {}\n", `  thresholds: {}\n${yaml}`);

function problemsOf(text: string): PolicyProblem[] {
  try {
    parsePolicy(text, "test.yaml");
  } catch (e) {
    expect(e).toBeInstanceOf(PolicyError);
    return (e as PolicyError).problems;
  }
  throw new Error("expected the policy to be rejected");
}

/** The 1-based line of the first line of `text` that starts with `prefix` after `after`. */
function lineOf(text: string, prefix: string, after = "lints:"): number {
  const lines = text.split("\n");
  const from = lines.findIndex((l) => l.startsWith(after));
  return lines.findIndex((l, i) => i > from && l.startsWith(prefix)) + 1;
}

describe("absent, every option parses as today", () => {
  test("a policy without the options has none of their keys", () => {
    const policy = parsePolicy(VALID, "test.yaml");
    for (const key of NEW_KEYS) expect(key in policy, key).toBe(false);
    expect("model" in policy.lints).toBe(false);
    expect(Object.keys(policy.lints)).toEqual(["enabled", "thresholds"]);
  });

  // The hashes card E2.8 took on main before its own change, which this card
  // must not move either: C3 and C4 embed the parsed preset in their prompts,
  // and the cassette key hashes the prompt.
  const BEFORE: Record<PresetName, string> = {
    strict: "dda81773bc1e010da0831d947515e6d0b76e90e402ee26235bb2375104aa10b6",
    medium: "d6da16ae501dbb7ac29038e65f13a066606093e18428a78a2fe96907ff5855f0",
    permissive: "d2349a547842d245d82a04aa4a6babb709bec7f6f2470e7caee8785097501c23",
  };
  test.each(PRESETS)(
    "the registered preset %s parses to the same bytes, with none of them",
    (name) => {
      const policy = loadPreset(name);
      expect(createHash("sha256").update(JSON.stringify(policy)).digest("hex")).toBe(BEFORE[name]);
      for (const key of NEW_KEYS) expect(key in policy, key).toBe(false);
      expect("model" in policy.lints).toBe(false);
    },
  );

  const PROFILES = ["twin", "knowledge"].map(
    (p) => new URL(`../../../../pi-package/profiles/${p}.yaml`, import.meta.url),
  );
  test.each([...EXTRA_PRESETS])("the bundled preset %s sets none of them", (name) => {
    const policy = loadPreset(name);
    for (const key of NEW_KEYS) expect(key in policy, key).toBe(false);
    expect("model" in policy.lints).toBe(false);
  });
  // Card E2.21 sets grants.expiry_cap on in both profiles, the lead's answer
  // of 2026-11-25; every other option stays absent there.
  test.each(PROFILES)("the profile %s sets none of them but grants.expiry_cap", (url) => {
    const policy = parsePolicy(readFileSync(url, "utf8"), url.pathname);
    for (const key of NEW_KEYS.filter((k) => k !== "grants"))
      expect(key in policy, key).toBe(false);
    expect(policy.grants).toEqual({ expiry_cap: "on" });
    expect("model" in policy.lints).toBe(false);
  });

  test("an empty container holds every option absent and loads as written", () => {
    const text = withLints("  model: {}\n").replace(
      "schema_version: 1\n",
      "procedures: {}\nerasure: {}\ngrants: {}\nschema_version: 1\n",
    );
    const policy = parsePolicy(text, "test.yaml");
    expect(policy.lints.model).toEqual({});
    expect(policy.procedures).toEqual({});
    expect(policy.erasure).toEqual({});
    expect(policy.grants).toEqual({});
  });
});

// Each option: a document setting it to a value the schema admits, the key
// the refusal points at, and the card that builds it. Every value the
// option's schema admits is listed, so "off" is refused too: absent is the
// only value accepted (the card's step 2).
// Card L9 built lints.model.evidence: its loader test is in
// test/unit/lint/evidence.test.ts.
const NOT_BUILT: [option: string, card: string, key: string, texts: string[]][] = [
  // consent: built by card E9.12; its loader tests are in test/unit/policy/consent.test.ts.
  [
    "erasure.mode",
    "E9.13",
    "  mode:",
    ["redact", "shred"].map((v) => withBlocks(`erasure:\n  mode: ${v}\n`)),
  ],
  [
    "approval",
    "E2.19",
    "approval:",
    [
      withBlocks("approval:\n  routes: []\n"),
      withBlocks("approval:\n  routes:\n    - { scope: person, approvers: [owner] }\n"),
      withBlocks(
        "approval:\n  routes:\n    - { scope: team:platform, approvers: [role:lead, person:ada], expires_after: 604800 }\n",
      ),
    ],
  ],
];

describe.each(NOT_BUILT)("%s, until card %s builds it", (option, card, key, texts) => {
  test.each(texts.map((t, i) => [i, t] as const))(
    "value %i passes the schema and is refused at its key",
    (_i, text) => {
      const parsed = Policy.safeParse(parseYaml(text));
      expect(parsed.error).toBeUndefined();
      const [p, ...rest] = problemsOf(text);
      expect(rest).toEqual([]);
      expect(p?.path).toEqual(option.split("."));
      expect(p?.line).toBe(lineOf(text, key));
      expect(p?.message).toContain(`card ${card}`);
      expect(p?.message).toContain(`${option} is not built yet`);
    },
  );
});

describe("the options' schemas", () => {
  test.each([
    ["erasure.mode", withBlocks("erasure:\n  mode: delete\n")],
    ["procedures.safety_scan", withBlocks("procedures:\n  safety_scan: block\n")],
    ["grants.expiry_cap", withBlocks("grants:\n  expiry_cap: 365\n")],
    ["lints.model.evidence", withLints("  model:\n    evidence: yes please\n")],
    ["procedures.drift.period", withBlocks("procedures:\n  drift:\n    period: 0\n")],
  ])("an unknown value of %s is reported at its path", (option, text) => {
    expect(Policy.safeParse(parseYaml(text)).success).toBe(false);
    const [p, ...rest] = problemsOf(text);
    expect(rest).toEqual([]);
    expect(p?.path).toEqual(option.split("."));
    expect(p?.message).not.toContain("not built yet");
  });

  test.each([
    ["grants", withBlocks("grants:\n  expiry_cap: 'on'\n  limit: 10\n")],
    ["procedures", withBlocks("procedures:\n  rollback: 'on'\n")],
    ["lints.model", withLints("  model:\n    grounding: 'on'\n")],
  ])("an unknown option inside %s is reported", (block, text) => {
    const problems = problemsOf(text);
    expect(
      problems.some((p) => p.path.join(".") === block && /unknown field/.test(p.message)),
    ).toBe(true);
  });

  test("a consent opt-out names a person scope, and an approval route at least one approver", () => {
    for (const text of [
      withBlocks("consent:\n  opt_outs:\n    - { scope: team:platform, topic: health }\n"),
      withBlocks("approval:\n  routes:\n    - { scope: team, approvers: [] }\n"),
      // An approver is owner, role:<id> or person:<id>: no typo, no agent, no team.
      withBlocks("approval:\n  routes:\n    - { scope: team, approvers: [rol:lead] }\n"),
      withBlocks("approval:\n  routes:\n    - { scope: team, approvers: [agent:pi] }\n"),
      withBlocks("approval:\n  routes:\n    - { scope: team, approvers: [team:platform] }\n"),
      withBlocks("approval:\n  routes:\n    - { scope: team, approvers: [Owner] }\n"),
    ])
      expect(Policy.safeParse(parseYaml(text)).success).toBe(false);
  });

  test("a switch YAML 1.1 reads as a boolean is reported with a hint to quote it", () => {
    for (const [option, text] of [
      ["grants.expiry_cap", withBlocks("grants:\n  expiry_cap: on\n")],
      ["lints.model.evidence", withLints("  model:\n    evidence: on\n")],
    ] as const) {
      const [p, ...rest] = problemsOf(`%YAML 1.1\n---\n${text}`);
      expect(rest).toEqual([]);
      expect(p?.path).toEqual(option.split("."));
      expect(p?.message).toContain("quote the value");
    }
  });
});

// The review of 2026-11-28: a policy object that never met the loader (the
// HTTP simulate route's candidate, a policy built in code handed to
// exportCedar) is held to the same refusal, through notBuiltOptions.
describe("readers of an already-parsed policy refuse what the loader refuses", () => {
  const medium = loadPreset("medium");
  /** One policy per option, each setting it, typed as the schema admits it. */
  const SETTING: [option: string, policy: Policy][] = [
    ["erasure.mode", { ...medium, erasure: { mode: "redact" } }],
    ["approval", { ...medium, approval: { routes: [] } }],
  ];

  test("the shared table lists exactly the options the loader refuses", () => {
    expect(NOT_BUILT_YET.map((r) => r.path.join("."))).toEqual(SETTING.map(([o]) => o));
  });

  test("a registered preset and an empty container set nothing", () => {
    for (const name of PRESETS) expect(notBuiltOptions(loadPreset(name))).toEqual([]);
    const empty: Policy = {
      ...medium,
      lints: { ...medium.lints, model: {} },
      procedures: {},
      erasure: {},
      grants: {},
    };
    expect(notBuiltOptions(empty)).toEqual([]);
  });

  test.each(SETTING)("%s: notBuiltOptions names it and its card", (option, policy) => {
    const [o, ...rest] = notBuiltOptions(policy);
    expect(rest).toEqual([]);
    expect(o?.path).toEqual(option.split("."));
    expect(o?.message).toContain(`${option} is not built yet`);
  });

  test.each(SETTING)("%s: exportCedar refuses it", (option, policy) => {
    expect(() => exportCedar(policy)).toThrow(CedarExportError);
    expect(() => exportCedar(policy)).toThrow(`${option} is not built yet`);
  });

  test.each(SETTING)(
    "%s: Plane.simulate refuses it as a candidate, logging nothing",
    async (option, policy) => {
      const { plane } = fresh(medium);
      const workload = { id: "w", actors: {}, steps: [] };
      await expect(plane.simulate(workload, policy)).rejects.toThrow(InvalidCallError);
      await expect(plane.simulate(workload, policy)).rejects.toThrow(`${option} is not built yet`);
      expect(plane.events()).toEqual([]);
    },
  );

  test("Plane.simulate and exportCedar still take a policy that sets none of them", async () => {
    const { plane } = fresh(medium);
    const report = await plane.simulate({ id: "w", actors: {}, steps: [] }, loadPreset("strict"));
    expect(report.changed).toEqual([]);
    expect(exportCedar(medium).policies.length).toBeGreaterThan(0);
  });
});

// Card E2.21, part 2: grants.expiry_cap is built. The loader takes it, off or
// on, quoted or not; the plane runs it (test/unit/plane/write-grants.test.ts);
// Plane.simulate takes it as a candidate; the Cedar export takes it off and
// refuses it on, with its reason (ADR 0041, decision 5), since the cap and the
// first-write rule judge every grant of a list, which Cedar cannot quantify.
describe("grants.expiry_cap, built by card E2.21", () => {
  const medium = loadPreset("medium");

  test.each([
    ["off", 'grants:\n  expiry_cap: "off"\n'],
    ["on", 'grants:\n  expiry_cap: "on"\n'],
    ["on", "grants:\n  expiry_cap: on\n"],
  ])("the loader takes expiry_cap: %s", (value, block) => {
    expect(parsePolicy(withBlocks(block), "policy").grants).toEqual({ expiry_cap: value });
  });

  test("notBuiltOptions no longer names it, off or on", () => {
    for (const v of ["off", "on"] as const)
      expect(notBuiltOptions({ ...medium, grants: { expiry_cap: v } })).toEqual([]);
    expect(NOT_BUILT_YET.some((r) => r.path.join(".") === "grants.expiry_cap")).toBe(false);
  });

  test("the twin and knowledge profiles set it on; no registered preset sets it", () => {
    for (const name of ["twin", "knowledge"]) {
      const url = new URL(`../../../../pi-package/profiles/${name}.yaml`, import.meta.url);
      expect(parsePolicy(readFileSync(url, "utf8"), `${name}.yaml`).grants).toEqual({
        expiry_cap: "on",
      });
    }
    for (const name of [...PRESETS, ...EXTRA_PRESETS])
      expect(loadPreset(name as PresetName).grants).toBeUndefined();
  });

  test("the Cedar export takes it off and refuses it on, naming why", () => {
    expect(exportCedar({ ...medium, grants: { expiry_cap: "off" } })).toEqual(exportCedar(medium));
    const on: Policy = { ...medium, grants: { expiry_cap: "on" } };
    expect(() => exportCedar(on)).toThrow(CedarExportError);
    expect(() => exportCedar(on)).toThrow("grants.expiry_cap");
    expect(() => exportCedar(on)).toThrow("grant by grant");
    expect(() => exportCedar(on)).not.toThrow("not built yet");
  });

  test("Plane.simulate takes it as a candidate", async () => {
    const { plane } = fresh(medium);
    const report = await plane.simulate(
      { id: "w", actors: {}, steps: [] },
      { ...medium, grants: { expiry_cap: "on" } },
    );
    expect(report.changed).toEqual([]);
  });
});
