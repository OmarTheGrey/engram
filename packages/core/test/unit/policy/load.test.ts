// Acceptance for card E2.1: an invalid policy is rejected with a line number.
// Each case starts from a valid policy document and breaks one line of it; the
// error must name that line (1-based) and the field.
import { describe, expect, test } from "vitest";
import { parse as parseYaml } from "yaml";
import { LINT_IDS, LINT_THRESHOLD_KEYS } from "../../../src/lint.ts";
import { PolicyError, type PolicyProblem, parsePolicy } from "../../../src/policy/load.ts";
import { GuardMode, InjectionScreen, Policy, TrustSwitch } from "../../../src/schema.ts";

const VALID = `id: test-policy
version: 1
write:
  - scope: person
    allowed_sources: [user, model]
    confidence_floor: 0.5
    forbidden_classes: []
    requires_review: false
  - { scope: role, allowed_sources: [user], confidence_floor: 0.5, forbidden_classes: [], requires_review: false }
  - { scope: team, allowed_sources: [user], confidence_floor: 0.5, forbidden_classes: [], requires_review: false }
  - { scope: org, allowed_sources: [user], confidence_floor: 0.5, forbidden_classes: [], requires_review: false }
read:
  matrix:
    - reader: person
      may_read: [person, org]
    - { reader: role, may_read: [role, org] }
    - { reader: team, may_read: [team, org] }
    - { reader: org, may_read: [org] }
  honour_grants: true
retention:
  - scope: person
    class: episodic
    ttl: 86400
    budget: null
    eviction: recency
promotion:
  episodic_to_semantic:
    confirmations: 3
    or_review: true
  procedural:
    replay_k: 4
    replay_n: 5
lints:
  enabled: [expired-validity]
  thresholds: {}
schema_version: 1
`;

/** Replace line `n` (1-based) of the valid document. */
function withLine(n: number, replacement: string): string {
  const lines = VALID.split("\n");
  lines[n - 1] = replacement;
  return lines.join("\n");
}

/** Insert `extra` after line `n` (1-based), so it becomes line n + 1. */
function insertAfter(n: number, extra: string): string {
  const lines = VALID.split("\n");
  lines.splice(n, 0, extra);
  return lines.join("\n");
}

function problemsOf(text: string): PolicyProblem[] {
  try {
    parsePolicy(text, "test.yaml");
  } catch (e) {
    expect(e).toBeInstanceOf(PolicyError);
    return (e as PolicyError).problems;
  }
  throw new Error("expected the policy to be rejected");
}

test("accepts the valid base document and returns a typed Policy", () => {
  const policy = parsePolicy(VALID, "test.yaml");
  expect(policy.id).toBe("test-policy");
  expect(policy.write[0]?.allowed_sources).toEqual(["user", "model"]);
});

describe("rejects an invalid policy with the line number of the fault", () => {
  test("an unknown field is reported at the line of its key", () => {
    const [p, ...rest] = problemsOf(insertAfter(6, "    max_size: 10"));
    expect(rest).toEqual([]);
    expect(p?.line).toBe(7);
    expect(p?.col).toBe(5);
    expect(p?.message).toMatch(/max_size/);
    expect(p?.path).toEqual(["write", 0]);
  });

  test("a wrong enum value is reported at the line of the value", () => {
    const [p, ...rest] = problemsOf(withLine(22, "    class: semnatic"));
    expect(rest).toEqual([]);
    expect(p?.line).toBe(22);
    expect(p?.col).toBe(12);
    expect(p?.path).toEqual(["retention", 0, "class"]);
  });

  test("a wrong enum value inside a flow sequence is reported at that value", () => {
    const [p] = problemsOf(withLine(5, "    allowed_sources: [user, oracle]"));
    expect(p?.line).toBe(5);
    expect(p?.col).toBe(29);
    expect(p?.path).toEqual(["write", 0, "allowed_sources", 1]);
  });

  test("a missing required field is reported at the line of the mapping that lacks it", () => {
    const text = VALID.split("\n")
      .filter((_, i) => i !== 7) // drop line 8, requires_review
      .join("\n");
    const [p, ...rest] = problemsOf(text);
    expect(rest).toEqual([]);
    expect(p?.line).toBe(4);
    expect(p?.message).toMatch(/requires_review/);
    expect(p?.path).toEqual(["write", 0, "requires_review"]);
  });

  test("a value out of range is reported at the line of the value", () => {
    const [p] = problemsOf(withLine(6, "    confidence_floor: 1.5"));
    expect(p?.line).toBe(6);
    expect(p?.path).toEqual(["write", 0, "confidence_floor"]);
  });

  test("broken YAML syntax is reported at the line of the syntax error", () => {
    const [p] = problemsOf(withLine(22, "    class: episodic: semantic"));
    expect(p?.line).toBe(22);
    expect(p?.path).toEqual([]);
  });

  test("a duplicate key is a syntax problem at the line of the second key", () => {
    const [p] = problemsOf(insertAfter(2, "version: 2"));
    expect(p?.line).toBe(3);
  });

  test("several faults are all reported, in line order", () => {
    const text = withLine(22, "    class: semnatic").replace(
      "    requires_review: false",
      "    requires_review: maybe",
    );
    expect(problemsOf(text).map((p) => p.line)).toEqual([8, 22]);
  });

  test("an empty document is rejected at line 1", () => {
    const [p] = problemsOf("");
    expect(p?.line).toBe(1);
  });

  test("a document that is not a mapping is rejected at line 1", () => {
    const [p] = problemsOf("- just\n- a list\n");
    expect(p?.line).toBe(1);
  });

  test("two documents in one file are rejected", () => {
    expect(problemsOf(`${VALID}---\n${VALID}`).length).toBeGreaterThan(0);
  });
});

describe("rejects a policy the schema accepts but the evaluator could not read unambiguously", () => {
  test("two write rules for the same scope level, at the second rule", () => {
    const text = insertAfter(
      8,
      [
        "  - scope: person",
        "    allowed_sources: [user]",
        "    confidence_floor: 0.9",
        "    forbidden_classes: []",
        "    requires_review: true",
      ].join("\n"),
    );
    const [p, ...rest] = problemsOf(text);
    expect(rest).toEqual([]);
    expect(p?.line).toBe(9);
    expect(p?.path).toEqual(["write", 1, "scope"]);
    expect(p?.message).toMatch(/person/);
  });

  test("two read matrix rows for the same reader, at the second row", () => {
    const text = insertAfter(15, "    - reader: person\n      may_read: [org]");
    const [p] = problemsOf(text);
    expect(p?.line).toBe(16);
    expect(p?.path).toEqual(["read", "matrix", 1, "reader"]);
  });

  test("two retention rules for the same scope level and class, at the second rule", () => {
    const text = insertAfter(
      25,
      [
        "  - scope: person",
        "    class: episodic",
        "    ttl: null",
        "    budget: 10",
        "    eviction: manual",
      ].join("\n"),
    );
    const [p] = problemsOf(text);
    expect(p?.line).toBe(26);
    expect(p?.path).toEqual(["retention", 1, "scope"]);
  });

  test("replay_k larger than replay_n, at replay_k", () => {
    const [p] = problemsOf(withLine(31, "    replay_k: 6"));
    expect(p?.line).toBe(31);
    expect(p?.path).toEqual(["promotion", "procedural", "replay_k"]);
  });
});

test("the error message names the source and the first problem's position", () => {
  try {
    parsePolicy(withLine(22, "    class: semnatic"), "policies/mine.yaml");
    expect.unreachable();
  } catch (e) {
    expect((e as Error).message).toMatch(/^policies\/mine\.yaml:22:12: /);
    expect((e as PolicyError).source).toBe("policies/mine.yaml");
  }
});

/** Drop line `n` (1-based) of `text`. */
const without = (text: string, n: number) =>
  text
    .split("\n")
    .filter((_, i) => i !== n - 1)
    .join("\n");

describe("rejects an incomplete policy at the node that lacks a level (D3, ADR 0006)", () => {
  test("an empty write list, at the write key, naming every level", () => {
    const lines = VALID.split("\n");
    lines.splice(2, 9, "write: []");
    const [p, ...rest] = problemsOf(lines.join("\n"));
    expect(rest).toEqual([]);
    expect(p).toMatchObject({ path: ["write"], line: 3, col: 1 });
    expect(p?.message).toMatch(/person, role, team, org/);
  });

  test("a missing write rule for one level, at the write key", () => {
    const [p, ...rest] = problemsOf(without(VALID, 10));
    expect(rest).toEqual([]);
    expect(p).toMatchObject({ path: ["write"], line: 3 });
    expect(p?.message).toMatch(/write rule.*team/);
  });

  test("a missing read matrix row for one level, at the matrix key", () => {
    const [p, ...rest] = problemsOf(without(VALID, 18));
    expect(rest).toEqual([]);
    expect(p).toMatchObject({ path: ["read", "matrix"], line: 13, col: 3 });
    expect(p?.message).toMatch(/read matrix row.*org/);
  });
});

describe("rejects lint ids and threshold keys outside the registry (D2, ADR 0008)", () => {
  test("an unknown lint id, at its item", () => {
    const [p, ...rest] = problemsOf(withLine(34, "  enabled: [expired-validity, expird-validity]"));
    expect(rest).toEqual([]);
    expect(p).toMatchObject({ path: ["lints", "enabled", 1], line: 34, col: 31 });
    expect(p?.message).toMatch(/unknown lint id "expird-validity"/);
  });

  test("a duplicate lint id, at the second occurrence", () => {
    const [p, ...rest] = problemsOf(withLine(34, "  enabled: [orphan, duplicate, orphan]"));
    expect(rest).toEqual([]);
    expect(p).toMatchObject({ path: ["lints", "enabled", 2], line: 34, col: 32 });
    expect(p?.message).toMatch(/second.*orphan/);
  });

  test("a lifecycle trigger listed as a lint, with the reason", () => {
    const [p] = problemsOf(withLine(34, "  enabled: [replay-drift]"));
    expect(p).toMatchObject({ path: ["lints", "enabled", 0], line: 34 });
    expect(p?.message).toMatch(/lifecycle trigger/);
  });

  test("near-duplicate is a threshold key, not a lint id", () => {
    const [p] = problemsOf(withLine(34, "  enabled: [near-duplicate]"));
    expect(p?.message).toMatch(/threshold key/);
  });

  test("an unknown threshold key, at its key", () => {
    const text = withLine(
      35,
      "  thresholds:\n    near-duplicate: 0.8\n    replay-drift.succes-floor: 0.7",
    );
    const [p, ...rest] = problemsOf(text);
    expect(rest).toEqual([]);
    expect(p).toMatchObject({ path: ["lints", "thresholds"], line: 37, col: 5 });
    expect(p?.message).toMatch(/unknown threshold key "replay-drift.succes-floor"/);
  });

  test("every registered lint id and threshold key is accepted", () => {
    const text = withLine(34, `  enabled: [${LINT_IDS.join(", ")}]`).replace(
      "  thresholds: {}",
      `  thresholds: {${LINT_THRESHOLD_KEYS.map((k) => `${k}: 1`).join(", ")}}`,
    );
    expect(parsePolicy(text, "test.yaml").lints.enabled).toEqual([...LINT_IDS]);
  });
});

// Card E2.8: the optional content_guards and trust blocks (ADRs 0039 and
// 0040). Every value of every option passes the schema; until the card that
// enforces an option lands, the loader refuses any value but `off`, naming
// that card, so a policy never sets a guard that is silently ignored.
describe("the content_guards and trust blocks", () => {
  // Inserted before `schema_version`, so content_guards is line 36.
  const OFF = [
    "content_guards:",
    "  secrets: off",
    "  pii: off",
    "  injection_screen: off",
    "trust:",
    "  unattested_floor: off",
    "  protect_trusted: off",
    "",
  ].join("\n");
  const withBlocks = (blocks: string) =>
    VALID.replace("schema_version: 1\n", `${blocks}schema_version: 1\n`);
  /** The document with one option of one block set to `value`; the option is line 37. */
  const withOption = (block: string, option: string, value: string) =>
    withBlocks(`${block}:\n  ${option}: ${value}\n`);

  test("a policy without them has neither key", () => {
    const policy = parsePolicy(VALID, "test.yaml");
    expect("content_guards" in policy).toBe(false);
    expect("trust" in policy).toBe(false);
  });

  test("a policy with every option off loads, each value as written", () => {
    const policy = parsePolicy(withBlocks(OFF), "test.yaml");
    expect(policy.content_guards).toEqual({ secrets: "off", pii: "off", injection_screen: "off" });
    expect(policy.trust).toEqual({ unattested_floor: "off", protect_trusted: "off" });
  });

  test("every option may be left out of its block", () => {
    const policy = parsePolicy(withBlocks("content_guards: {}\ntrust: {}\n"), "test.yaml");
    expect(policy.content_guards).toEqual({});
    expect(policy.trust).toEqual({});
  });

  // Each option, every value its schema admits, and the card that enforces it;
  // null for an option its card has landed (injection_screen, card E2.10).
  const OPTIONS: [block: string, option: string, values: string[], card: string | null][] = [
    ["content_guards", "secrets", [...GuardMode.options], "E2.9"],
    ["content_guards", "pii", [...GuardMode.options], "E2.9"],
    ["content_guards", "injection_screen", [...InjectionScreen.options], null],
    ["content_guards", "max_content_bytes", ["1", "65536"], "E2.9"],
    // Both trust options landed with card E2.11 (policy/trust.ts).
    ["trust", "unattested_floor", [...TrustSwitch.options], null],
    ["trust", "protect_trusted", [...TrustSwitch.options], null],
  ];
  describe.each(OPTIONS)("%s.%s", (block, option, values, card) => {
    test.each(values)("%s passes the schema; only off loads, until its card", (value) => {
      const text = withOption(block, option, value);
      const parsed = Policy.safeParse(parseYaml(text));
      expect(parsed.error).toBeUndefined();
      if (value === "off" || card === null) {
        expect(parsePolicy(text, "test.yaml")[block as "trust"]).toEqual({ [option]: value });
        return;
      }
      const [p, ...rest] = problemsOf(text);
      expect(rest).toEqual([]);
      expect(p).toMatchObject({ path: [block, option], line: 37 });
      expect(p?.message).toContain(`card ${card}`);
      expect(p?.message).toContain("not enforced yet");
    });
  });

  test("an unknown value inside content_guards is reported at its line", () => {
    const [p, ...rest] = problemsOf(withOption("content_guards", "secrets", "redact"));
    expect(rest).toEqual([]);
    expect(p).toMatchObject({ path: ["content_guards", "secrets"], line: 37 });
    expect(p?.message).not.toContain("quote the value");
  });

  test("an unknown value inside trust is reported at its line", () => {
    const [p, ...rest] = problemsOf(withOption("trust", "protect_trusted", "maybe"));
    expect(rest).toEqual([]);
    expect(p).toMatchObject({ path: ["trust", "protect_trusted"], line: 37 });
  });

  test("a value YAML 1.1 reads as a boolean is reported with a hint to quote it", () => {
    for (const [block, option] of [
      ["trust", "unattested_floor"],
      ["content_guards", "secrets"],
    ] as const) {
      const text = `%YAML 1.1\n---\n${withOption(block, option, "on")}`;
      const [p, ...rest] = problemsOf(text);
      expect(rest).toEqual([]);
      expect(p?.path).toEqual([block, option]);
      expect(p?.message).toContain("quote the value");
    }
  });

  test("an unknown option inside a block is reported at its key", () => {
    const text = withBlocks(OFF.replace("  pii: off", "  pii: off\n  pan: block"));
    const [p, ...rest] = problemsOf(text);
    expect(rest).toEqual([]);
    expect(p?.path).toEqual(["content_guards"]);
    expect(p?.message).toMatch(/pan/);
    expect(p?.line).toBe(39);
  });

  test("a size limit that is not a positive integer is rejected by the schema", () => {
    for (const bad of ["0", "-1", "1.5", "null"]) {
      const [p] = problemsOf(withOption("content_guards", "max_content_bytes", bad));
      expect(p?.path, bad).toEqual(["content_guards", "max_content_bytes"]);
      expect(p?.message, bad).not.toContain("not enforced yet");
    }
  });
});
