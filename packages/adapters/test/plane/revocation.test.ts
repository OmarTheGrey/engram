// The revocation grid (card A5, absorb plan pull request 4): on every store in
// the conformance registry, a policy item is written, replaced by a new
// version and revoked, and a read through `Plane.read` must never admit the
// revoked item nor rank it above its replacement. arXiv 2609.08258 (Shen,
// Toyoda and Leung, "Revoked but Still Authoritative"; Memory-Rebirth-Attack,
// Apache-2.0, taken as an idea, nothing copied) found two popular stores
// returning a revoked policy above its replacement in all 81 of its
// scenario-model cells. Here the plane decides from its own projection, so
// the outcome should not depend on the store; this file says so per store.
//
// The grid, per store:
//
//   scenarios  the nine of the paper's Table 4, each a revoked policy and its
//              replacement, written here as synthetic statements;
//   marks      how the revocation is recorded: `retired` (the old version
//              rewritten with status retired), `closed` (its validity window
//              closed at the replacement's start, the paper's soft
//              revocation), `expired` (its own ttl runs out then, Mem0's
//              expiration date);
//   insertion  `direct`, both versions and the mark through Plane.write, or
//              `indirect`, both records written into the store by its own
//              means (the adapter, never the plane), marks included, then
//              adopted (adoptStoreItems, as `engram read` does) and read.
//              Indirect here is the paper's "direct insertion": records in
//              the store's own format with an explicit mark;
//   reads      the plane's default read (no text, and text through the
//              store's search) and the core retrieval pipeline (ADR 0009).
//
// Two rebirth rows follow a direct revocation with the old record put back
// in the store by its own means: restored as it was before the revocation (a
// backup or a git revert), which adoption refuses, and re-edited at a higher
// version, which adoption takes as the owner's import (ADR 0025 lets an
// import restate retired content). Two rows pin what the plane does not
// enforce today, each a `finding` in docs/log/: a replacement that names the
// old version in its lineage and nothing else leaves the old version
// admitted, and a replacement stated only in prose (the paper's "indirect
// insertion") supersedes nothing the plane can see (the unkeyed-item wall).
//
// The harness is the conformance run's: the network guard, Mem0's home
// folder redirected to a temporary folder, and each adapter's setup once.
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type Actor,
  adoptStoreItems,
  createPlane,
  loadPreset,
  type MemoryItem,
  migrate,
  openSqlite,
  type PlaneDeps,
  type ReadResult,
} from "@engram/core";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { Adapter } from "../../src/contract.ts";
import { installNetworkGuard, type NetworkGuard } from "../conformance/network-guard.ts";
import { ADAPTERS, cleanupAdapters, setupAdapters } from "../conformance/registry.ts";

const SCOPE = "team:platform";
/** The revoked version is written. */
const T0 = "2026-10-01T00:00:00Z";
/** The replacement is written and the revocation takes effect. */
const T1 = "2026-10-10T00:00:00Z";
/** Every read. */
const T2 = "2026-10-20T00:00:00Z";
const NINE_DAYS = 9 * 24 * 60 * 60;

/**
 * The nine scenarios of 2609.08258, Table 4: the title both versions share
 * (the text a read asks for), the revoked policy, and its replacement.
 */
const SCENARIOS: { title: string; revoked: string; replacement: string }[] = [
  {
    title: "deploy approval",
    revoked: "one reviewer suffices to approve a production release",
    replacement: "two reviewers must approve every production release",
  },
  {
    title: "pii export",
    revoked: "personal data may be sent to external vendors",
    replacement: "personal data is never sent to external vendors",
  },
  {
    title: "rollback policy",
    revoked: "roll back production at once on any failure",
    replacement: "roll back production only after the on-call lead confirms the failure",
  },
  {
    title: "access directive",
    revoked: "grant repository access to anyone who asks",
    replacement: "grant repository access only through an approved ticket",
  },
  {
    title: "card disclosure",
    revoked: "agents may read full card numbers aloud",
    replacement: "agents may read only the last four digits of a card number",
  },
  {
    title: "backup deletion",
    revoked: "delete every backup on a suspected breach",
    replacement: "keep every backup on a suspected breach, for the forensic review",
  },
  {
    title: "transfer limit",
    revoked: "one operator may move up to 1,000,000 dollars",
    replacement: "a transfer above 10,000 dollars needs two operators",
  },
  {
    title: "compliance log",
    revoked: "delete audit logs older than 24 hours",
    replacement: "keep audit logs for seven years",
  },
  {
    title: "mfa waiver",
    revoked: "mfa may be waived when someone is in a hurry",
    replacement: "mfa is never waived",
  },
];

const id = (n: number) => `01920000-0000-7000-8000-${String(n).padStart(12, "0")}`;
/** Scenario s's revoked version and its replacement. */
const oldId = (s: number) => id(100 + s);
const newId = (s: number) => id(200 + s);

const omar: Actor = { id: "person:omar", level: "team", memberships: [SCOPE], source: "user" };
const sara: Actor = { id: "person:sara", level: "team", memberships: [SCOPE], source: "user" };

function policyItem(n: string, content: string, over: Partial<MemoryItem> = {}): MemoryItem {
  return {
    id: n,
    class: "semantic",
    scope: SCOPE,
    owner: omar.id,
    content,
    provenance: {
      kind: "user",
      ref: "doc/policies",
      hash: `sha256:${"0".repeat(64)}`,
      actor: omar.id,
    },
    confidence: 0.9,
    valid_from: T0,
    valid_to: null,
    ttl: null,
    grants: [],
    version: 1,
    lineage: [],
    status: "active",
    store_ref: null,
    schema_version: 1,
    ...over,
  } as MemoryItem;
}

type Mark = "retired" | "closed" | "expired";
type Insertion = "direct" | "indirect";
const MARKS: Mark[] = ["retired", "closed", "expired"];
const INSERTIONS: Insertion[] = ["direct", "indirect"];

/** Scenario s's revoked version as first written: with its ttl when the mark is its expiry. */
const revoked = (s: number, mark: Mark | "none") => {
  const { title, revoked: text } = SCENARIOS[s] as (typeof SCENARIOS)[number];
  return policyItem(oldId(s), `${title}: ${text}.`, mark === "expired" ? { ttl: NINE_DAYS } : {});
};
/** Scenario s's revoked version with its revocation recorded on it. */
const marked = (s: number, mark: Mark, version: number): MemoryItem => {
  const first = revoked(s, mark);
  if (mark === "retired") return { ...first, status: "retired", version };
  if (mark === "closed") return { ...first, valid_to: T1, version };
  return first;
};
/** Scenario s's replacement: valid from the revocation on, naming the revoked version. */
const replacement = (s: number, over: Partial<MemoryItem> = {}) => {
  const { title, replacement: text } = SCENARIOS[s] as (typeof SCENARIOS)[number];
  return policyItem(newId(s), `${title}: ${text}.`, {
    valid_from: T1,
    lineage: [oldId(s)],
    ...over,
  });
};

let guard: NetworkGuard;
let scratch: string;
let mem0Home: string;
const savedMem0Dir = process.env.MEM0_DIR;
beforeAll(async () => {
  guard = installNetworkGuard();
  scratch = mkdtempSync(join(tmpdir(), "engram-revocation-"));
  mem0Home = join(scratch, "mem0-home");
  process.env.MEM0_DIR = mem0Home;
  await setupAdapters();
}, 60_000);
afterAll(() => {
  guard.restore();
  if (savedMem0Dir === undefined) delete process.env.MEM0_DIR;
  else process.env.MEM0_DIR = savedMem0Dir;
  cleanupAdapters();
  rmSync(scratch, { recursive: true, force: true });
});

/** A fresh log under the medium preset over a fresh store, with a second plane on the core pipeline. */
async function planeOver(factory: () => Adapter | Promise<Adapter>) {
  const db = openSqlite(":memory:");
  migrate(db);
  const adapter = await factory();
  let n = 0;
  const deps: PlaneDeps = {
    db,
    adapter,
    policy: loadPreset("medium"),
    newId: () => id(900_000 + ++n),
  };
  return {
    deps,
    adapter,
    plane: createPlane(deps),
    core: createPlane({ ...deps, retrieval: { pipeline: "core" } }),
  };
}

type Setup = Awaited<ReturnType<typeof planeOver>>;

/** Every write the plane must allow; a denial fails the cell with its reason. */
async function allowed(setup: Setup, item: MemoryItem, at: string) {
  const { event } = await setup.plane.write(omar, item, at);
  expect(event.decision, `${item.id}: ${event.reason}`).toBe("allow");
}

/** Revokes every scenario by `mark`, through the plane or by the store's own means then adoption. */
async function revokeAll(setup: Setup, mark: Mark, insertion: Insertion) {
  if (insertion === "direct") {
    for (const s of SCENARIOS.keys()) {
      await allowed(setup, revoked(s, mark), T0);
      await allowed(setup, replacement(s), T1);
      if (mark !== "expired") await allowed(setup, marked(s, mark, 2), T1);
    }
    return;
  }
  for (const s of SCENARIOS.keys()) {
    await setup.adapter.write(marked(s, mark, 1));
    await setup.adapter.write(replacement(s));
  }
  const report = await adoptStoreItems(setup.deps, omar, SCOPE, T1);
  expect(report.denials).toEqual([]);
  expect(report.allowed).toBe(2 * SCENARIOS.length);
}

interface Reading {
  mode: string;
  result: ReadResult;
  /** The scenario this read asked about, or undefined for a read of everything. */
  scenario?: number;
}

/** One read of everything, and per scenario a text read through the store's search and one through the core pipeline. */
async function readAll(setup: Setup): Promise<Reading[]> {
  const readings: Reading[] = [{ mode: "list", result: await setup.plane.read(sara, { at: T2 }) }];
  for (const [s, { title }] of SCENARIOS.entries()) {
    readings.push({
      mode: `store search "${title}"`,
      scenario: s,
      result: await setup.plane.read(sara, { at: T2, text: title }),
    });
    readings.push({
      mode: `core pipeline "${title}"`,
      scenario: s,
      result: await setup.core.read(sara, { at: T2, text: title }),
    });
  }
  return readings;
}

const rankOf = (result: ReadResult, itemId: string) =>
  result.explanations.find((e) => e.item_id === itemId)?.rank;

/**
 * The property: no revoked version is admitted, recorded in the read event or
 * explained; the read of everything returns the nine replacements and
 * nothing else; and a read of one scenario returns its replacement as the
 * first of that scenario's items, on every store (Mem0's semantic search
 * included, with the hashing embedder), so the check is never vacuous.
 */
function expectRevocationHolds({ mode, result, scenario }: Reading) {
  const ids = result.items.map((i) => i.id);
  for (const s of SCENARIOS.keys()) {
    expect(ids, `${mode}: revoked ${oldId(s)} admitted`).not.toContain(oldId(s));
    expect(result.event.item_ids, mode).not.toContain(oldId(s));
    expect(rankOf(result, oldId(s)), mode).toBeUndefined();
  }
  if (scenario === undefined) {
    expect(ids.sort(), mode).toEqual([...SCENARIOS.keys()].map(newId).sort());
  } else {
    const first = ids.find((i) => i === oldId(scenario) || i === newId(scenario));
    expect(first, `${mode}: replacement found`).toBe(newId(scenario));
  }
}

// Letta commits once per write (about 30 writes per cell), and the machine
// may be loaded; each cell gets two minutes.
const CELL_MS = 120_000;

for (const { name, factory } of ADAPTERS) {
  describe(`revocation grid on ${name}`, () => {
    for (const mark of MARKS) {
      for (const insertion of INSERTIONS) {
        test(
          `${mark}, ${insertion}: no revoked version is admitted or outranks its replacement`,
          async () => {
            const setup = await planeOver(factory);
            await revokeAll(setup, mark, insertion);
            for (const reading of await readAll(setup)) expectRevocationHolds(reading);
          },
          CELL_MS,
        );
      }
    }

    for (const mark of ["retired", "closed"] as const) {
      test(
        `${mark}, rebirth by restore: the pre-revocation record put back in the store is refused`,
        async () => {
          const setup = await planeOver(factory);
          await revokeAll(setup, mark, "direct");
          for (const s of SCENARIOS.keys()) {
            // The store's own means: the record as it was before the revocation.
            await setup.adapter.write(revoked(s, mark));
          }
          const report = await adoptStoreItems(setup.deps, omar, SCOPE, T2);
          expect(report.denials.map((d) => d.policy_id)).toEqual(
            SCENARIOS.map(() => "engram/write/version"),
          );
          for (const reading of await readAll(setup)) expectRevocationHolds(reading);
        },
        CELL_MS,
      );

      test(
        `${mark}, rebirth by re-edit (finding): a re-activated record at a higher version is adopted as the owner's import`,
        async () => {
          const setup = await planeOver(factory);
          await revokeAll(setup, mark, "direct");
          for (const s of SCENARIOS.keys()) {
            await setup.adapter.write({ ...revoked(s, mark), version: 3 });
          }
          const report = await adoptStoreItems(setup.deps, omar, SCOPE, T2);
          // Pinned as the plane behaves today (docs/log, the rebirth finding):
          // each re-activation is an allowed adoption event naming the store,
          // never a silent return, and the item is admitted again.
          expect(report.allowed).toBe(SCENARIOS.length);
          expect(report.denials).toEqual([]);
          const adopted = setup.plane
            .events()
            .filter((e) => e.op === "write" && e.ts === T2 && e.decision === "allow");
          expect(adopted.map((e) => e.item_id).sort()).toEqual(
            [...SCENARIOS.keys()].map(oldId).sort(),
          );
          for (const e of adopted)
            expect(e.reason).toMatch(`adopted from store ${setup.adapter.name}: `);
          const all = await setup.plane.read(sara, { at: T2 });
          for (const s of SCENARIOS.keys()) expect(all.items.map((i) => i.id)).toContain(oldId(s));
        },
        CELL_MS,
      );
    }

    for (const insertion of INSERTIONS) {
      test(
        `lineage only, ${insertion} (finding): a replacement naming the old version in its lineage leaves it admitted`,
        async () => {
          const setup = await planeOver(factory);
          if (insertion === "direct") {
            for (const s of SCENARIOS.keys()) {
              await allowed(setup, revoked(s, "none"), T0);
              await allowed(setup, replacement(s), T1);
            }
          } else {
            for (const s of SCENARIOS.keys()) {
              await setup.adapter.write(revoked(s, "none"));
              await setup.adapter.write(replacement(s));
            }
            expect((await adoptStoreItems(setup.deps, omar, SCOPE, T1)).denials).toEqual([]);
          }
          // Pinned as the plane behaves today (docs/log, the lineage finding):
          // lineage decides which holder a store_ref resolves to
          // (itemByStoreRef), not what a read admits. Every read of a scenario
          // admits both versions, and where the store searches, its hit order
          // ranks the old version above its replacement in some scenario.
          const above: string[] = [];
          for (const { mode, result, scenario } of await readAll(setup)) {
            const ids = result.items.map((i) => i.id);
            const asked = scenario === undefined ? [...SCENARIOS.keys()] : [scenario];
            for (const s of asked) {
              expect(ids, mode).toContain(oldId(s));
              expect(ids, mode).toContain(newId(s));
              if ((rankOf(result, oldId(s)) ?? 0) < (rankOf(result, newId(s)) ?? 0))
                above.push(mode);
            }
          }
          if (setup.adapter.search) {
            expect(above.filter((m) => m.startsWith("store search")).length).toBeGreaterThan(0);
          } else {
            expect(above).toEqual([]);
          }
        },
        CELL_MS,
      );
    }

    test(
      "prose only (finding): a replacement that names nothing supersedes nothing the plane sees",
      async () => {
        const setup = await planeOver(factory);
        for (const s of SCENARIOS.keys()) {
          await allowed(setup, revoked(s, "none"), T0);
          const { title, replacement: text } = SCENARIOS[s] as (typeof SCENARIOS)[number];
          await allowed(
            setup,
            replacement(s, {
              lineage: [],
              content: `${title}: ${text}. This replaces the earlier ${title} policy.`,
            }),
            T1,
          );
        }
        const all = await setup.plane.read(sara, { at: T2 });
        for (const s of SCENARIOS.keys()) expect(all.items.map((i) => i.id)).toContain(oldId(s));
      },
      CELL_MS,
    );
  });
}

test("no store attempted a network call or wrote Mem0's home folder", () => {
  expect(guard.attempts).toEqual([]);
  expect(existsSync(mem0Home)).toBe(false);
});
