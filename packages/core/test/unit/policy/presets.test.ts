// Acceptance for card E2.1: the three bundled presets load, and their
// strictness is ordered. Stances are checked through the invariant oracles
// (test/property/oracle.ts), the same reading of a policy the invariants use.
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { LINT_IDS, LINT_THRESHOLD_KEYS } from "../../../src/lint.ts";
import type { Actor } from "../../../src/plane.ts";
import { loadPreset, PRESETS, type PresetName, presetUrl } from "../../../src/policy/load.ts";
import type { MemoryItem, Policy, ScopeLevel } from "../../../src/schema.ts";
import { readable, writeForbidden } from "../../property/oracle.ts";

const LEVELS: ScopeLevel[] = ["person", "role", "team", "org"];
const SOURCES = ["user", "document", "tool", "model", "import", "compaction"] as const;
const CLASSES = ["episodic", "semantic", "procedural"] as const;
const SCOPE_OF: Record<ScopeLevel, string> = {
  person: "person:omar",
  role: "role:lead",
  team: "team:platform",
  org: "org",
};

function item(
  level: ScopeLevel,
  kind: (typeof SOURCES)[number],
  cls: (typeof CLASSES)[number],
): MemoryItem {
  return {
    id: "01890a5d-ac96-7000-8000-000000000001",
    class: cls,
    scope: SCOPE_OF[level],
    owner: "person:omar",
    content: "x",
    provenance: { kind, ref: "r", hash: `sha256:${"0".repeat(64)}`, actor: "person:omar" },
    confidence: 1,
    valid_from: "2026-10-25T00:00:00Z",
    valid_to: null,
    ttl: null,
    grants: [],
    version: 1,
    lineage: [],
    status: "active",
    store_ref: null,
    schema_version: 0,
  } as MemoryItem;
}

const ruleFor = (p: Policy, level: ScopeLevel) => p.write.find((r) => r.scope === level);
const mayRead = (p: Policy, level: ScopeLevel) =>
  p.read.matrix.find((r) => r.reader === level)?.may_read ?? [];
const subset = <T>(a: readonly T[], b: readonly T[]) => a.every((x) => b.includes(x));

const strict = loadPreset("strict");
const medium = loadPreset("medium");
const permissive = loadPreset("permissive");
/** Adjacent pairs, stricter first. */
const PAIRS: [string, Policy, Policy][] = [
  ["strict over medium", strict, medium],
  ["medium over permissive", medium, permissive],
];

test("the bundled presets are exactly strict, medium and permissive", () => {
  expect([...PRESETS]).toEqual(["strict", "medium", "permissive"]);
});

describe.each(PRESETS)("preset %s", (name: PresetName) => {
  const policy = loadPreset(name);

  test("loads, and its id names the preset", () => {
    expect(policy.id).toBe(`preset.${name}`);
    expect(policy.schema_version).toBe(0);
  });

  test("opens with a comment block that states its stance", () => {
    const text = readFileSync(presetUrl(name), "utf8");
    expect(text.split("\n")[0]).toMatch(/^# /);
  });

  test("has a write rule and a read matrix row for every scope level", () => {
    expect(policy.write.map((r) => r.scope).sort()).toEqual([...LEVELS].sort());
    expect(policy.read.matrix.map((r) => r.reader).sort()).toEqual([...LEVELS].sort());
  });

  test("forbids model and compaction writes outside person scope (ADR 0004, 0007)", () => {
    for (const level of LEVELS.filter((l) => l !== "person"))
      for (const kind of ["model", "compaction"] as const)
        for (const cls of CLASSES)
          expect(writeForbidden(policy, item(level, kind, cls))).toBe(true);
  });

  test("admits a user-sourced semantic write in every scope", () => {
    for (const level of LEVELS)
      expect(writeForbidden(policy, item(level, "user", "semantic"))).toBe(false);
  });

  test("lets a person read their own person scope and honours grants", () => {
    const actor: Actor = { id: "person:omar", level: "person", memberships: ["person:omar"] };
    expect(
      readable(policy, actor, item("person", "user", "semantic"), "2026-10-25T00:00:00Z"),
    ).toBe(true);
    expect(policy.read.honour_grants).toBe(true);
  });

  test("never lets a non-person reading context see person scope it is not granted (ADR 0021)", () => {
    // Without membership, scope alone never admits; with membership, only person and
    // (outside strict) role contexts may read person scope.
    const outsider: Actor = { id: "person:ada", level: "person", memberships: ["person:ada"] };
    expect(
      readable(policy, outsider, item("person", "user", "semantic"), "2026-10-25T00:00:00Z"),
    ).toBe(false);
    // The person themself, acting in a team or org context, is a member of
    // their person scope, and still may not read it from that context.
    for (const level of ["team", "org"] as const) {
      const context: Actor = {
        id: "person:omar",
        level,
        memberships: ["person:omar", SCOPE_OF.team, SCOPE_OF.org],
      };
      expect(
        readable(policy, context, item("person", "user", "semantic"), "2026-10-25T00:00:00Z"),
        `${level} context`,
      ).toBe(false);
      expect(
        readable(policy, context, item(level, "user", "semantic"), "2026-10-25T00:00:00Z"),
        `${level} context reading its own level`,
      ).toBe(true);
    }
  });

  test("declares retention for every class it admits at every level, episodic with a budget (ADR 0010)", () => {
    for (const level of LEVELS)
      for (const cls of CLASSES) {
        if (ruleFor(policy, level)?.forbidden_classes.includes(cls)) continue;
        const rule = policy.retention.find((r) => r.scope === level && r.class === cls);
        expect(rule, `${level} ${cls}`).toBeDefined();
        if (cls === "episodic") expect(rule?.budget, `${level} ${cls} budget`).not.toBeNull();
      }
  });

  test("uses only registered lint ids and threshold keys (D2, ADR 0008)", () => {
    for (const id of policy.lints.enabled) expect(LINT_IDS).toContain(id);
    for (const key of Object.keys(policy.lints.thresholds))
      expect(LINT_THRESHOLD_KEYS).toContain(key);
  });

  test("its comment says what the lint list is for and where its numbers come from (D2)", () => {
    const header = readFileSync(presetUrl(name), "utf8")
      .split("\n")
      .filter((l) => l.startsWith("#"))
      .map((l) => l.replace(/^#\s?/, ""))
      .join(" ");
    expect(header).toMatch(/lint-running condition \(C6\)/);
    expect(header).toMatch(/does not turn lints on/);
    expect(header).toMatch(/C5 runs the write gate and the read filter only/);
    expect(header).toMatch(/proposed values/);
    expect(header).not.toMatch(/promoted through review/);
  });

  test("declares retention for person-scope episodic memory (ADR 0010)", () => {
    expect(policy.retention.some((r) => r.scope === "person" && r.class === "episodic")).toBe(true);
  });
});

describe.each(PAIRS)("strictness is ordered, %s", (_label, stricter, looser) => {
  test("the stricter preset admits a subset of the looser one's sources in every scope", () => {
    for (const level of LEVELS)
      expect(
        subset(
          ruleFor(stricter, level)?.allowed_sources ?? [],
          ruleFor(looser, level)?.allowed_sources ?? [],
        ),
      ).toBe(true);
  });

  test("the stricter preset forbids at least the classes the looser one forbids", () => {
    for (const level of LEVELS)
      expect(
        subset(
          ruleFor(looser, level)?.forbidden_classes ?? [],
          ruleFor(stricter, level)?.forbidden_classes ?? [],
        ),
      ).toBe(true);
  });

  test("the stricter preset forbids every write the looser one forbids", () => {
    for (const level of LEVELS)
      for (const kind of SOURCES)
        for (const cls of CLASSES) {
          const it = item(level, kind, cls);
          if (writeForbidden(looser, it)) expect(writeForbidden(stricter, it)).toBe(true);
        }
  });

  test("the stricter preset has confidence floors at least as high and review at least as often", () => {
    for (const level of LEVELS) {
      const s = ruleFor(stricter, level);
      const l = ruleFor(looser, level);
      expect(s?.confidence_floor).toBeGreaterThanOrEqual(l?.confidence_floor ?? 0);
      if (l?.requires_review) expect(s?.requires_review).toBe(true);
    }
  });

  test("the stricter preset's read matrix is contained in the looser one's", () => {
    for (const level of LEVELS)
      expect(subset(mayRead(stricter, level), mayRead(looser, level))).toBe(true);
  });

  test("the stricter preset needs at least as much evidence to promote", () => {
    const s = stricter.promotion;
    const l = looser.promotion;
    expect(s.episodic_to_semantic.confirmations).toBeGreaterThanOrEqual(
      l.episodic_to_semantic.confirmations,
    );
    expect(s.procedural.replay_k / s.procedural.replay_n).toBeGreaterThanOrEqual(
      l.procedural.replay_k / l.procedural.replay_n,
    );
  });

  test("the stricter preset enables at least the lints the looser one enables", () => {
    expect(subset(looser.lints.enabled, stricter.lints.enabled)).toBe(true);
  });
});

test("under strict a role context cannot read person scope, even its own person's", () => {
  // strict.yaml's comment: a context reads its own level and the levels above
  // it, never person scope except as that person. The person acting in a role
  // context is a member of their person scope, so only the read matrix stops
  // the read; medium and permissive let a role context read it.
  const context: Actor = {
    id: "person:omar",
    level: "role",
    memberships: ["person:omar", SCOPE_OF.role, SCOPE_OF.team, SCOPE_OF.org],
  };
  const at = "2026-10-25T00:00:00Z";
  expect(readable(strict, context, item("person", "user", "semantic"), at)).toBe(false);
  for (const level of ["role", "team", "org"] as const)
    expect(readable(strict, context, item(level, "user", "semantic"), at), level).toBe(true);
  for (const looser of [medium, permissive])
    expect(readable(looser, context, item("person", "user", "semantic"), at), looser.id).toBe(true);
});

test("the presets differ: strict forbids a write that permissive admits", () => {
  const it = item("team", "tool", "episodic");
  expect(writeForbidden(strict, it)).toBe(true);
  expect(writeForbidden(permissive, it)).toBe(false);
});

test("loadPreset refuses a name that is not a bundled preset", () => {
  expect(() => loadPreset("../schema" as PresetName)).toThrow(/unknown preset/);
});
