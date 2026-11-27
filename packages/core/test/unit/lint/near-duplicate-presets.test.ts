// Card L5 (layer 1): the near-duplicate tier moves nothing a registered preset
// lints. Every registered preset's whole lint report, and its `duplicate`
// findings alone, over the fault catalogue (fixtures/faults/) and over card
// L2's fixture-size base (fixtures/fault-sets/longmemeval/), hash to what
// they hashed to on main before the tier landed (origin/main at 0e15f8b8).
// The tier runs only under its own lint id, which no preset lists.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import type { FaultFixture } from "../../../scripts/faults.ts";
import type { Actor } from "../../../src/actor.ts";
import { appendEvent } from "../../../src/events.ts";
import { loadPreset, PRESETS, type PresetName } from "../../../src/policy/load.ts";
import type { LintFinding, MemoryEvent, Policy } from "../../../src/schema.ts";
import { fresh } from "../plane/helpers.ts";

const ROOT = join(import.meta.dirname, "../../../../..");
const FAULTS = join(ROOT, "fixtures/faults");
const BASE = join(ROOT, "fixtures/fault-sets/longmemeval/states.jsonl");

interface State {
  question_id: string;
  at: string;
  actor: Actor;
  scopes: string[];
  events: MemoryEvent[];
}

/** One lint run: the log it reads, who lints which scopes, and when. */
interface Run {
  name: string;
  events: MemoryEvent[];
  actor: Actor;
  scopes: string[];
  at: string;
}

// The catalogue as it stood before card L5: the tier's own fixtures are new
// and are linted by their own tests, not by this one.
const catalogue: Run[] = readdirSync(FAULTS)
  .filter((f) => f.endsWith(".json") && !f.startsWith("near-duplicate-tier."))
  .sort()
  .map((file) => {
    const f = JSON.parse(readFileSync(join(FAULTS, file), "utf8")) as FaultFixture;
    return { name: file, events: f.events, actor: f.actor, scopes: [f.scope], at: f.at };
  });

const base: Run[] = readFileSync(BASE, "utf8")
  .split("\n")
  .filter((l) => l.trim() !== "")
  .map((l) => JSON.parse(l) as State)
  .map((s) => ({
    name: s.question_id,
    events: s.events,
    actor: s.actor,
    scopes: s.scopes,
    at: s.at,
  }));

/** Every lint report of `runs` under `policy`, in run and scope order. */
async function reports(runs: Run[], policy: Policy) {
  const out: {
    run: string;
    scope: string;
    decision: string;
    findings: LintFinding[];
    events: MemoryEvent[];
  }[] = [];
  for (const run of runs) {
    const { plane, db } = fresh(policy);
    for (const { seq: _seq, ...e } of run.events) appendEvent(db, e);
    for (const scope of run.scopes) {
      const r = await plane.lint(run.actor, run.at, scope, { reach: "scope-registered" });
      out.push({
        run: run.name,
        scope,
        decision: r.decision,
        findings: r.findings,
        events: r.events,
      });
    }
    db.close();
  }
  return out;
}

const sha256 = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

/** sha256 of the whole reports and of their duplicate findings, per preset and corpus, on main at 0e15f8b8. */
const MAIN: Record<
  PresetName,
  Record<"catalogue" | "base", { report: string; duplicate: string; duplicates: number }>
> = {
  strict: {
    catalogue: {
      report: "14121daee97e60c027c757171a945b2d585066f84620b93614139d8814ea642b",
      duplicate: "4eb798699a80e306151763324921ebe6600e9efd99a681a1f8399fc22fbe4030",
      duplicates: 1,
    },
    base: {
      report: "5527b35d060fd07b7a84f4f7b6adbecc8ef72d3776c896489f9faa0e1e1a5ac4",
      duplicate: "424c3ccd7255a7a332668b2da446e34118c37478f7066d0c715d4b5e0bfe3b13",
      duplicates: 0,
    },
  },
  medium: {
    catalogue: {
      report: "76912d0768673c5f0855eb7a886b1709ddc6748dc42c2d3ff999a1c1fcd13a46",
      duplicate: "4eb798699a80e306151763324921ebe6600e9efd99a681a1f8399fc22fbe4030",
      duplicates: 1,
    },
    base: {
      report: "d3d18b4f42abcdcf04bfa793f59f8129ca85c45b43009c3c76e693d2f852f3cb",
      duplicate: "424c3ccd7255a7a332668b2da446e34118c37478f7066d0c715d4b5e0bfe3b13",
      duplicates: 0,
    },
  },
  permissive: {
    catalogue: {
      report: "d46dcc3ec117e8b74e73ad1ce4f1ba1274e46eeab9e3cb665ebb58918662f4e2",
      duplicate: "5fbc149764c7a24393bf72a60a2d102b6e6076c13e51b165e1230f3d49c5b7e6",
      duplicates: 0,
    },
    base: {
      report: "6341ffb0d52d1cedd5a195765ebae9ebdfd64e697666b4a8f0532d1c518232c1",
      duplicate: "424c3ccd7255a7a332668b2da446e34118c37478f7066d0c715d4b5e0bfe3b13",
      duplicates: 0,
    },
  },
};

describe("the registered presets with the near-duplicate tier merged", () => {
  test("no registered preset lists near-duplicate-tier", () => {
    for (const name of PRESETS)
      expect(loadPreset(name).lints.enabled, name).not.toContain("near-duplicate-tier");
  });

  for (const name of PRESETS)
    for (const [corpus, runs] of [
      ["catalogue", catalogue],
      ["base", base],
    ] as const)
      test(`${name}: the lint report and the duplicate findings over the ${corpus} are main's`, async () => {
        const got = await reports(runs, loadPreset(name));
        const duplicate = got.map((r) => r.findings.filter((f) => f.lint_id === "duplicate"));
        expect(got.length).toBeGreaterThan(0);
        expect({
          report: sha256(got),
          duplicate: sha256(duplicate),
          duplicates: duplicate.flat().length,
        }).toEqual(MAIN[name][corpus]);
      }, 60_000);
});
