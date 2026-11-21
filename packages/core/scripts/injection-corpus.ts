// Card E2.10's corpus run: every entry of fixtures/injection-screen/corpus.json
// written through the real Plane (the fake adapter, an in-memory log) under a
// policy that admits every kind in person scope, once per profile of
// `content_guards.injection_screen`, and whether the gate held it as a
// candidate. research/scripts/injection_screen.py turns the rows into the
// escape and false-hold rates; nothing here computes a rate. No model, no
// clock: ids and times are fixed.
//
//   node packages/core/scripts/injection-corpus.ts --corpus <file> --profiles off,default,hardened --out <rows.jsonl>
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { createFakeAdapter } from "@engram/adapters";
import type { Actor } from "../src/actor.ts";
import { migrate } from "../src/db/migrate.ts";
import { openSqlite } from "../src/db/sqlite.ts";
import { createPlane } from "../src/plane.ts";
import { INJECTION_SCREEN_ID } from "../src/policy/injection-screen.ts";
import type { MemoryItem, Policy, Provenance } from "../src/schema.ts";

type Kind = Provenance["kind"];
type Profile = "off" | "default" | "hardened";

interface Entry {
  id: string;
  group: string;
  kind: Kind;
  expected: string;
  category?: string;
  content?: string;
  repeat?: { repeat: number; unit: string };
}

const AT = "2026-11-21T12:00:00Z";
const KINDS: Kind[] = ["user", "document", "tool", "model", "import", "compaction", "external"];
const fid = (n: number) => `01950000-0000-7000-8000-${String(n).padStart(12, "0")}`;

/** Every kind admitted in person scope, no floor, no review: the screen is the only stage that can hold. */
function policyFor(profile: Profile): Policy {
  return {
    id: `fixture.injection-screen.${profile}`,
    version: 1,
    write: [
      {
        scope: "person",
        allowed_sources: KINDS,
        confidence_floor: 0,
        forbidden_classes: [],
        requires_review: false,
      },
    ],
    read: { matrix: [{ reader: "person", may_read: ["person"] }], honour_grants: false },
    retention: [],
    promotion: {
      episodic_to_semantic: { confirmations: 3, or_review: true },
      procedural: { replay_k: 4, replay_n: 5 },
    },
    lints: { enabled: [], thresholds: {} },
    content_guards: { injection_screen: profile },
    schema_version: 1,
  };
}

const contentOf = (e: Entry): string =>
  e.repeat ? e.repeat.unit.repeat(e.repeat.repeat) : (e.content ?? "");

async function run(entries: Entry[], profile: Profile) {
  const db = openSqlite(":memory:");
  migrate(db);
  let n = 0;
  const plane = createPlane({
    db,
    adapter: createFakeAdapter(),
    policy: policyFor(profile),
    newId: () => fid(900_000 + ++n),
  });
  const rows = [];
  for (const [i, e] of entries.entries()) {
    const actor: Actor = {
      id: "person:corpus",
      level: "person",
      memberships: ["person:corpus"],
      source: e.kind,
    };
    const item = {
      id: fid(i + 1),
      class: "semantic",
      scope: "person:corpus",
      owner: "person:corpus",
      content: contentOf(e),
      provenance: {
        kind: e.kind,
        ref: `corpus:${e.id}`,
        hash: `sha256:${"0".repeat(64)}`,
        actor: actor.id,
      },
      confidence: 0.9,
      valid_from: AT,
      valid_to: null,
      ttl: null,
      grants: [],
      version: 1,
      lineage: [],
      status: "active",
      store_ref: null,
      schema_version: 1,
    } as MemoryItem;
    const r = await plane.write(actor, item, AT);
    // The policy admits every kind, so any outcome but an allow (active, or a
    // candidate the screen held) is a broken run, never a write "not held"
    // (review finding E2.10-9).
    const held = r.event.policy_id === INJECTION_SCREEN_ID;
    if (r.event.decision !== "allow" || r.item?.status !== (held ? "candidate" : "active"))
      throw new Error(
        `${e.id} under ${profile}: ${r.event.decision} ${r.item?.status ?? "no item"} by ${r.event.policy_id}; expected an allow`,
      );
    rows.push({
      id: e.id,
      profile,
      decision: r.event.decision,
      status: r.item?.status ?? null,
      held,
      failed_closed: held && r.event.reason.includes("fails closed"),
    });
  }
  db.close();
  return rows;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      corpus: { type: "string" },
      profiles: { type: "string" },
      out: { type: "string" },
    },
  });
  if (!values.corpus || !values.profiles || !values.out)
    throw new Error(
      "usage: injection-corpus.ts --corpus <file> --profiles <a,b> --out <rows.jsonl>",
    );
  const corpus = JSON.parse(readFileSync(values.corpus, "utf8")) as { entries: Entry[] };
  const lines: string[] = [];
  for (const profile of values.profiles.split(",") as Profile[]) {
    if (!["off", "default", "hardened"].includes(profile))
      throw new Error(`unknown profile ${profile}`);
    for (const row of await run(corpus.entries, profile)) lines.push(JSON.stringify(row));
  }
  writeFileSync(values.out, `${lines.join("\n")}\n`);
}

await main();
