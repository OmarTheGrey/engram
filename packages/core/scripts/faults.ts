// The seeded-fault catalogue for the deterministic lints (card L1,
// docs/conventions/testing.md "Fixtures"): for each lint a fixture it must
// flag and a near-miss it must not. Each fixture is an event log produced by
// driving the real Plane over the fake adapter (fixed ids, every call
// timed), the policy the lint runs under, and the item ids it must flag,
// declared here by hand, never computed by the lints.
//
//   node packages/core/scripts/faults.ts write <dir>           regenerate fixtures/faults (make fixtures)
//   node packages/core/scripts/faults.ts workspace <fixture> <dir>   a SQLite log and policy file to lint with the CLI
//
// A scope-class mismatch arises when a policy changes after a write, so a
// fixture's events are written under WRITE_POLICY (everything allowed) and
// linted under its own `policy`.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createFakeAdapter } from "@engram/adapters";
import type { Actor } from "../src/actor.ts";
import { strictContentHash } from "../src/content-hash.ts";
import { migrate } from "../src/db/migrate.ts";
import { openSqlite } from "../src/db/sqlite.ts";
import { appendEvent } from "../src/events.ts";
import type { DeterministicLintId } from "../src/lint.ts";
import { createPlane, type Plane } from "../src/plane.ts";
import type { MemoryEvent, MemoryItem, Policy } from "../src/schema.ts";

export interface FaultFixture {
  description: string;
  lint_id: DeterministicLintId;
  kind: "flag" | "near-miss";
  /** The policy the lint runs under. */
  policy: Policy;
  actor: Actor;
  scope: string;
  at: string;
  /** The log the lint reads, in seq order. */
  events: MemoryEvent[];
  /** The items the lint must flag, by id; empty for a near-miss. */
  flags: string[];
}

export const LINT_AT = "2026-11-06T12:00:00Z";
const T = (minute: number) => `2026-11-01T09:${String(minute).padStart(2, "0")}:00Z`;
const fid = (n: number) => `01950000-0000-7000-8000-${String(n).padStart(12, "0")}`;
const ZERO = `sha256:${"0".repeat(64)}`;

const DANA: Actor = {
  id: "person:dana",
  level: "person",
  memberships: ["person:dana", "team:core"],
  source: "user",
};
const asSource = (source: Actor["source"]): Actor => ({ ...DANA, source });

function rule(scope: Policy["write"][number]["scope"]): Policy["write"][number] {
  return {
    scope,
    allowed_sources: ["user", "document", "tool", "model", "import", "compaction"],
    confidence_floor: 0.3,
    forbidden_classes: [],
    requires_review: false,
  };
}

/** Everything allowed, so any fault can be written; no lints. */
export const WRITE_POLICY: Policy = {
  id: "fixture.faults",
  version: 1,
  write: [rule("person"), rule("role"), rule("team"), rule("org")],
  read: {
    matrix: [
      { reader: "person", may_read: ["person", "role", "team", "org"] },
      { reader: "role", may_read: ["role", "team", "org"] },
      { reader: "team", may_read: ["team", "org"] },
      { reader: "org", may_read: ["org"] },
    ],
    honour_grants: true,
  },
  retention: [],
  promotion: {
    episodic_to_semantic: { confirmations: 3, or_review: true },
    procedural: { replay_k: 4, replay_n: 5 },
  },
  lints: { enabled: [], thresholds: {} },
  schema_version: 0,
};

function item(n: number, over: Partial<MemoryItem> = {}): MemoryItem {
  return {
    id: fid(n),
    class: "semantic",
    scope: "team:core",
    owner: "person:dana",
    content: `fault fixture fact ${n}`,
    provenance: { kind: "user", ref: "engram-cli", hash: ZERO, actor: "person:dana" },
    confidence: 0.9,
    valid_from: "2026-10-01T00:00:00Z",
    valid_to: null,
    ttl: null,
    grants: [],
    version: 1,
    lineage: [],
    status: "active",
    store_ref: null,
    schema_version: 0,
    ...over,
  } as MemoryItem;
}

interface Spec {
  description: string;
  lint_id: DeterministicLintId;
  kind: "flag" | "near-miss";
  scope?: string;
  /** The lint-time policy, from WRITE_POLICY with this lint enabled. */
  policy?: (p: Policy) => Policy;
  steps: (plane: Plane) => Promise<void>;
  flags: string[];
}

async function written(plane: Plane, actor: Actor, it: MemoryItem, at: string): Promise<void> {
  const r = await plane.write(actor, it, at);
  if (r.item === null) throw new Error(`fixture write of ${it.id} denied: ${r.event.reason}`);
}

const SOURCE_TEXT = "The release freeze starts on Friday.";

const SPECS: Record<string, Spec> = {
  "expired-validity.flag": {
    description:
      "An active item whose valid_to is before the lint time, and one past its own ttl: both flagged.",
    lint_id: "expired-validity",
    kind: "flag",
    steps: async (p) => {
      await written(p, DANA, item(1, { valid_to: "2026-11-02T00:00:00Z" }), T(0));
      await written(p, DANA, item(2, { valid_from: "2026-11-05T00:00:00Z", ttl: 3600 }), T(1));
    },
    flags: [fid(1), fid(2)],
  },
  "expired-validity.near-miss": {
    description:
      "An item whose valid_to is one second after the lint time, and one whose ttl runs out one second after it: neither flagged.",
    lint_id: "expired-validity",
    kind: "near-miss",
    steps: async (p) => {
      await written(p, DANA, item(1, { valid_to: "2026-11-06T12:00:01Z" }), T(0));
      await written(p, DANA, item(2, { valid_from: "2026-11-06T11:00:01Z", ttl: 3600 }), T(1));
    },
    flags: [],
  },
  "source-changed.flag": {
    description:
      "An item derived from another item, whose source was then rewritten with new content: the derived item is flagged.",
    lint_id: "source-changed",
    kind: "flag",
    steps: async (p) => {
      await written(p, DANA, item(1, { content: SOURCE_TEXT }), T(0));
      const derived = item(2, {
        content: "No deploys after Thursday.",
        provenance: {
          kind: "user",
          ref: fid(1),
          hash: strictContentHash(SOURCE_TEXT),
          actor: "person:dana",
        },
      });
      await written(p, DANA, derived, T(1));
      await written(
        p,
        DANA,
        item(1, { content: "The release freeze starts on Monday.", version: 2 }),
        T(2),
      );
    },
    flags: [fid(2)],
  },
  "source-changed.near-miss": {
    description:
      "The same, but the rewrite only changes whitespace, which the strict content hash collapses: not flagged.",
    lint_id: "source-changed",
    kind: "near-miss",
    steps: async (p) => {
      await written(p, DANA, item(1, { content: SOURCE_TEXT }), T(0));
      const derived = item(2, {
        content: "No deploys after Thursday.",
        provenance: {
          kind: "user",
          ref: `item:${fid(1)}`,
          hash: strictContentHash(SOURCE_TEXT),
          actor: "person:dana",
        },
      });
      await written(p, DANA, derived, T(1));
      await written(
        p,
        DANA,
        item(1, { content: "  The release   freeze starts on Friday. ", version: 2 }),
        T(2),
      );
    },
    flags: [],
  },
  "scope-class-mismatch.flag": {
    description:
      "An episodic item written to team scope before the policy forbade episodic items there: flagged under the new policy.",
    lint_id: "scope-class-mismatch",
    kind: "flag",
    policy: (pol) => ({
      ...pol,
      write: pol.write.map((r) =>
        r.scope === "team" ? { ...r, forbidden_classes: ["episodic"] } : r,
      ),
    }),
    steps: async (p) => {
      await written(p, DANA, item(1, { class: "episodic" }), T(0));
      await written(p, DANA, item(2), T(1));
    },
    flags: [fid(1)],
  },
  "scope-class-mismatch.near-miss": {
    description:
      "The same policy change, but the team item is semantic, and the episodic item is in person scope, where episodic is still allowed: not flagged.",
    lint_id: "scope-class-mismatch",
    kind: "near-miss",
    policy: (pol) => ({
      ...pol,
      write: pol.write.map((r) =>
        r.scope === "team" ? { ...r, forbidden_classes: ["episodic"] } : r,
      ),
    }),
    steps: async (p) => {
      await written(p, DANA, item(1, { class: "episodic", scope: "person:dana" }), T(0));
      await written(p, DANA, item(2), T(1));
    },
    flags: [],
  },
  "missing-provenance.flag": {
    description:
      "A model write that names no model, and a compaction that names its model but no session entry: both flagged.",
    lint_id: "missing-provenance",
    kind: "flag",
    scope: "person:dana",
    steps: async (p) => {
      await written(
        p,
        asSource("model"),
        item(1, {
          scope: "person:dana",
          provenance: { kind: "model", ref: "pi:tool_call/1", hash: ZERO, actor: "person:dana" },
        }),
        T(0),
      );
      await written(
        p,
        asSource("compaction"),
        item(2, {
          scope: "person:dana",
          provenance: {
            kind: "compaction",
            ref: "pi:compaction/1",
            hash: ZERO,
            actor: "person:dana",
            model: "scripted/none",
          },
        }),
        T(1),
      );
    },
    flags: [fid(1), fid(2)],
  },
  "missing-provenance.near-miss": {
    description:
      "A model write naming its model, a compaction naming its model and session entry, and a user write with neither: none flagged.",
    lint_id: "missing-provenance",
    kind: "near-miss",
    scope: "person:dana",
    steps: async (p) => {
      await written(
        p,
        asSource("model"),
        item(1, {
          scope: "person:dana",
          provenance: {
            kind: "model",
            ref: "pi:tool_call/1",
            hash: ZERO,
            actor: "person:dana",
            model: "scripted/none",
          },
        }),
        T(0),
      );
      await written(
        p,
        asSource("compaction"),
        item(2, {
          scope: "person:dana",
          provenance: {
            kind: "compaction",
            ref: "pi:compaction/1",
            hash: ZERO,
            actor: "person:dana",
            model: "scripted/none",
            session_entry_id: "entry-7",
          },
        }),
        T(1),
      );
      await written(p, DANA, item(3, { scope: "person:dana" }), T(2));
    },
    flags: [],
  },
  "orphan.flag": {
    description:
      "An item whose provenance ref names an item retired by its ttl, and one whose lineage names an item never logged: both flagged.",
    lint_id: "orphan",
    kind: "flag",
    steps: async (p) => {
      await written(p, DANA, item(1, { valid_from: "2026-11-01T00:00:00Z", ttl: 60 }), T(0));
      await p.retain(DANA, "team:core", T(1));
      const ref = { kind: "user" as const, ref: fid(1), hash: ZERO, actor: "person:dana" };
      await written(p, DANA, item(2, { provenance: ref }), T(2));
      await written(p, DANA, item(3, { lineage: [fid(99)] }), T(3));
    },
    flags: [fid(2), fid(3)],
  },
  "orphan.near-miss": {
    description:
      "An item whose provenance ref names an active item, one whose lineage names an active item, and one whose ref is not an item id: none flagged.",
    lint_id: "orphan",
    kind: "near-miss",
    steps: async (p) => {
      await written(p, DANA, item(1), T(0));
      const ref = { kind: "user" as const, ref: fid(1), hash: ZERO, actor: "person:dana" };
      await written(p, DANA, item(2, { provenance: ref }), T(1));
      await written(p, DANA, item(3, { lineage: [fid(1)] }), T(2));
      await written(p, DANA, item(4), T(3));
    },
    flags: [],
  },
  "duplicate.flag": {
    description:
      "Two active semantic items in team:core whose text differs only in whitespace: the later one is flagged.",
    lint_id: "duplicate",
    kind: "flag",
    steps: async (p) => {
      await written(p, DANA, item(1, { content: SOURCE_TEXT }), T(0));
      await written(p, DANA, item(2, { content: "The release  freeze starts on Friday.\n" }), T(1));
    },
    flags: [fid(2)],
  },
  "duplicate.near-miss": {
    description:
      "The same text in another scope, in another class, and with different letter case, which the strict hash keeps apart: none flagged.",
    lint_id: "duplicate",
    kind: "near-miss",
    steps: async (p) => {
      await written(p, DANA, item(1, { content: SOURCE_TEXT }), T(0));
      await written(p, DANA, item(2, { content: SOURCE_TEXT, scope: "person:dana" }), T(1));
      await written(p, DANA, item(3, { content: SOURCE_TEXT, class: "episodic" }), T(2));
      await written(p, DANA, item(4, { content: SOURCE_TEXT.toLowerCase() }), T(3));
    },
    flags: [],
  },
};

/** Every fault fixture, by file name without `.json`. */
export async function faultFixtures(): Promise<Record<string, FaultFixture>> {
  const out: Record<string, FaultFixture> = {};
  for (const [name, spec] of Object.entries(SPECS)) {
    const db = openSqlite(":memory:");
    migrate(db);
    let n = 0;
    const plane = createPlane({
      db,
      adapter: createFakeAdapter(),
      policy: WRITE_POLICY,
      newId: () => fid(900_000 + ++n),
    });
    await spec.steps(plane);
    const lintPolicy = spec.policy ? spec.policy(WRITE_POLICY) : WRITE_POLICY;
    out[name] = {
      description: spec.description,
      lint_id: spec.lint_id,
      kind: spec.kind,
      policy: { ...lintPolicy, lints: { enabled: [spec.lint_id], thresholds: {} } },
      actor: DANA,
      scope: spec.scope ?? "team:core",
      at: LINT_AT,
      events: plane.events(),
      flags: spec.flags,
    };
    db.close();
  }
  return out;
}

/** The fixture as a file: two-space JSON with a final newline. */
export const fixtureText = (f: FaultFixture) => `${JSON.stringify(f, null, 2)}\n`;

async function main(argv: string[]): Promise<void> {
  const [mode, a, b] = argv;
  if (mode === "write" && a) {
    mkdirSync(a, { recursive: true });
    for (const [name, f] of Object.entries(await faultFixtures()))
      writeFileSync(join(a, `${name}.json`), fixtureText(f));
    return;
  }
  if (mode === "workspace" && a && b) {
    const f = JSON.parse(readFileSync(a, "utf8")) as FaultFixture;
    mkdirSync(b, { recursive: true });
    const db = openSqlite(join(b, "engram.db"));
    migrate(db);
    if (db.prepare("SELECT count(*) AS n FROM events").get()?.n !== 0)
      throw new Error(`${join(b, "engram.db")} already holds events; give an empty folder`);
    for (const { seq: _seq, ...e } of f.events) appendEvent(db, e);
    db.close();
    writeFileSync(join(b, "policy.yaml"), `${JSON.stringify(f.policy, null, 2)}\n`);
    process.stdout.write(
      `${b}: ${f.events.length} events; lint with: engram lint --db ${join(b, "engram.db")} --policy ${join(b, "policy.yaml")} --as ${f.actor.id} ${f.actor.memberships.map((m) => `--member ${m}`).join(" ")} --scope ${f.scope} --at ${f.at}\n`,
    );
    return;
  }
  throw new Error("usage: faults.ts write <dir> | faults.ts workspace <fixture.json> <dir>");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await main(process.argv.slice(2));
