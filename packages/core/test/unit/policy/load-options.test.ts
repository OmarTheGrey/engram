// Acceptance for card E2.14 of the second absorb plan: the policy options
// seven later cards build on (lints.model.evidence, procedures.safety_scan,
// procedures.drift, consent, erasure.mode, approval, grants.expiry_cap), added
// under ADR 0002's decision D2: optional, without a default, so a policy
// without them parses and serialises byte for byte as before. Absent is the
// only value the loader accepts until each option's card builds it: every
// value the schema admits is refused, at its key, naming that card. Each
// consuming card removes its own row of NOT_BUILT below, as it lifts the
// refusal in policy/load.ts.
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
  test.each(PROFILES)("the profile %s sets none of them", (url) => {
    const policy = parsePolicy(readFileSync(url, "utf8"), url.pathname);
    for (const key of NEW_KEYS) expect(key in policy, key).toBe(false);
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
const NOT_BUILT: [option: string, card: string, key: string, texts: string[]][] = [
  [
    "lints.model.evidence",
    "L9",
    "    evidence:",
    ["off", "on"].map((v) => withLints(`  model:\n    evidence: "${v}"\n`)),
  ],
  [
    "procedures.safety_scan",
    "D5",
    "  safety_scan:",
    ["off", "report", "hold"].map((v) => withBlocks(`procedures:\n  safety_scan: "${v}"\n`)),
  ],
  [
    "procedures.drift",
    "D4",
    "  drift:",
    [
      withBlocks("procedures:\n  drift: {}\n"),
      withBlocks('procedures:\n  drift:\n    environment_change: "on"\n'),
      withBlocks('procedures:\n  drift:\n    environment_change: "off"\n    period: 604800\n'),
    ],
  ],
  [
    "consent",
    "E9.12",
    "consent:",
    [
      withBlocks("consent:\n  opt_outs: []\n"),
      withBlocks("consent:\n  opt_outs:\n    - { scope: person:omar, topic: health }\n"),
      withBlocks(
        "consent:\n  opt_outs:\n    - { scope: person:omar, source: tool, except_topics: [calendar] }\n",
      ),
      withBlocks(
        'consent:\n  opt_outs:\n    - { scope: person:omar, since: "2026-12-01T00:00:00Z", until: "2026-12-02T00:00:00Z" }\n',
      ),
    ],
  ],
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
      withBlocks("approval:\n  routes:\n    - { scope: team, approvers: [owner] }\n"),
      withBlocks(
        "approval:\n  routes:\n    - { scope: team:platform, approvers: [role:lead, person:ada], expires_after: 604800 }\n",
      ),
    ],
  ],
  [
    "grants.expiry_cap",
    "E2.21",
    "  expiry_cap:",
    ["off", "on"].map((v) => withBlocks(`grants:\n  expiry_cap: "${v}"\n`)),
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
    ["lints.model.evidence", { ...medium, lints: { ...medium.lints, model: { evidence: "on" } } }],
    ["procedures.safety_scan", { ...medium, procedures: { safety_scan: "hold" } }],
    ["procedures.drift", { ...medium, procedures: { drift: { environment_change: "on" } } }],
    ["consent", { ...medium, consent: { opt_outs: [] } }],
    ["erasure.mode", { ...medium, erasure: { mode: "redact" } }],
    ["approval", { ...medium, approval: { routes: [] } }],
    ["grants.expiry_cap", { ...medium, grants: { expiry_cap: "off" } }],
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
