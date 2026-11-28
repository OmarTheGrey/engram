// The canary workspace of card E8.16, shared by the leak and parity suites of
// the server, MCP, the CLI (with the TUI) and the pi extension. Ported in
// shape from ClickHouse/loom's tests/integration/test_cross_principal_leakage.py
// (https://github.com/ClickHouse/loom, commit 61b22646a1af, Apache License
// 2.0, Copyright ClickHouse, Inc.): seeded canary nonces planted by one
// principal, probed as others, and a leak counted whenever a probe's answer
// carries a canary its principal may not see. Rewritten for Engram's write
// paths, its probe actors and its surfaces; nothing of loom's code is kept
// beyond that structure.
//
// Every canary is a nonce derived from the seed of research/configs/leakage.json
// and its label, carried in the item's content, under an item id derived the
// same way. Each is written through one write path of the plane, at T0, over
// whatever log and store the caller gives (the fake store for the server, MCP
// and pi; the files store for the CLI). The probes run later, at NOW, so the
// grant that expired between them is an expired grant.
//
// Probe actors (the card's three and one partial):
// - mallory, a member of nothing but her own person scope;
// - eve, an expired grantee: two of dana's items were granted to her until
//   EXPIRED, one at its write and one by a grant change;
// - fred, a former member: a member of team:x who wrote there and in his own
//   person scope, then offboarded (his person scope erased, ADR 0010), probed
//   as the harness presents him after, without team:x;
// - sam, a live grantee of one item, which he may see, whose lineage names
//   an item he may not (card RD1).
// Every probe actor may see only its `allowed` canaries; any other one found
// in an answer, by its nonce or its id, is a leak. The nonce of fred's
// erased person item may be seen by nobody, so it is checked against every
// actor; its id stays in the audit trail by design (ADR 0010).
// Lee, a member of team:x, is the positive control: the scanner must find the
// team's canaries in his answers, or a clean count would mean nothing.
//
// When ENGRAM_LEAKAGE_OUT names a folder, each suite writes the probes it ran
// there as one JSON file (`recordProbes`), which research/scripts/leakage.py
// counts into research/results/h1-leakage.json.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type Actor,
  type Adapter,
  acceptedClosures,
  adoptStoreItems,
  createPlane,
  type Db,
  itemById,
  type MemoryItem,
  offboard,
  type Policy,
  planSupersession,
  servedImport,
  writeClosures,
} from "@engram/core";

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
export const CONFIG_PATH = join(REPO, "research/configs/leakage.json");
const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as { seed: number };
export const SEED = config.seed;

/** When the canaries are written. */
export const T0 = "2026-10-20T00:00:00.000Z";
/** When eve's grants end: after T0, before NOW. */
export const EXPIRED = "2026-10-25T00:00:00.000Z";
/** When sam's grant ends: after NOW. */
export const LIVE = "2026-12-31T00:00:00.000Z";
/** When every surface is probed. */
export const NOW = "2026-10-29T12:00:00.000Z";

const hex = (text: string) => createHash("sha256").update(text).digest("hex");

/** A seeded UUIDv7 for `label`. */
export function seededId(label: string): string {
  const h = hex(`${SEED}:id:${label}`);
  return `0197${h.slice(0, 4)}-${h.slice(4, 8)}-7${h.slice(8, 11)}-8${h.slice(11, 14)}-${h.slice(14, 26)}`;
}

/** The seeded nonce of `label`. */
export const nonce = (label: string) => `canary-${hex(`${SEED}:nonce:${label}`).slice(0, 20)}`;

export const DANA: Actor = {
  id: "person:dana",
  level: "person",
  memberships: ["person:dana", "team:x"],
  source: "user",
};
export const LEE: Actor = {
  id: "person:lee",
  level: "person",
  memberships: ["person:lee", "team:x"],
  source: "user",
};
export const SAM: Actor = { id: "person:sam", level: "person", memberships: ["person:sam"] };
export const EVE: Actor = { id: "person:eve", level: "person", memberships: ["person:eve"] };
export const MALLORY: Actor = {
  id: "person:mallory",
  level: "person",
  memberships: ["person:mallory"],
};
/** Fred while a member of team:x. */
const FRED_MEMBER: Actor = {
  id: "person:fred",
  level: "person",
  memberships: ["person:fred", "team:x"],
  source: "user",
};
/** Fred after offboarding, as the harness presents him. */
export const FRED: Actor = { id: "person:fred", level: "person", memberships: ["person:fred"] };
/** Who offboards fred: a user-sourced member of his person scope. */
export const HR: Actor = {
  id: "person:hr",
  level: "person",
  memberships: ["person:hr", "person:fred"],
  source: "user",
};

/** The write paths a canary enters by. */
export type WritePath =
  | "write"
  | "write-denied"
  | "grants"
  | "import-promote"
  | "supersede"
  | "adoption"
  | "offboard-erased";

export interface Canary {
  label: string;
  path: WritePath;
  scope: string;
  /** The nonce in the item's content. */
  nonce: string;
  /** The item's id. */
  id: string;
}

const canary = (label: string, path: WritePath, scope: string): Canary => ({
  label,
  path,
  scope,
  nonce: nonce(label),
  id: seededId(label),
});

/** Every canary, in the order the seed writes them. */
export const CANARIES: readonly Canary[] = [
  canary("dana-person", "write", "person:dana"),
  canary("dana-team", "write", "team:x"),
  canary("granted-sam", "write", "person:dana"),
  canary("expired-eve-write", "write", "person:dana"),
  canary("expired-eve-grant", "grants", "person:dana"),
  canary("imported", "import-promote", "person:dana"),
  canary("superseded-old", "supersede", "person:dana"),
  canary("superseded-new", "supersede", "person:dana"),
  canary("adopted", "adoption", "person:dana"),
  canary("denied-team", "write-denied", "team:x"),
  canary("fred-team", "write", "team:x"),
  canary("fred-person", "offboard-erased", "person:fred"),
  canary("lee-team", "write", "team:x"),
];

export const byLabel = (label: string) => {
  const found = CANARIES.find((c) => c.label === label);
  if (found === undefined) throw new Error(`no canary ${label}`);
  return found;
};

/** An id no log of the suite ever holds, for the denied-and-missing probes. */
export const MISSING_ID = seededId("missing");
/** A read id no log of the suite ever holds. */
export const MISSING_READ = seededId("missing-read");

export interface ProbeActor {
  name: string;
  actor: Actor;
  /** The labels of the canaries it may see. */
  allowed: readonly string[];
}

export const PROBE_ACTORS: readonly ProbeActor[] = [
  { name: "non-member", actor: MALLORY, allowed: [] },
  { name: "expired-grantee", actor: EVE, allowed: [] },
  { name: "former-member", actor: FRED, allowed: [] },
  { name: "partial-grantee", actor: SAM, allowed: ["granted-sam"] },
];

/** The positive control: lee may see the team's canaries and must be shown some. */
export const CONTROL: ProbeActor = {
  name: "member",
  actor: LEE,
  allowed: ["dana-team", "fred-team", "lee-team", "denied-team"],
};

/** The canaries leaked in `text` to `probe`: those outside its allowed set, by nonce or by id. */
export function leaksIn(text: string, probe: ProbeActor, asked: readonly string[] = []): string[] {
  // An id the probe itself sent is echoed legitimately (a read by id names it).
  const shown = asked.reduce((t, id) => t.replaceAll(id, "<asked>"), text);
  return CANARIES.filter((c) => {
    // Erasure removes content, never the audit trail (ADR 0010): the erased
    // item's id stays in its scope's events, which its members still see, so
    // for it only the nonce is a leak, and to anyone.
    if (c.path === "offboard-erased") return shown.includes(c.nonce);
    return !probe.allowed.includes(c.label) && (shown.includes(c.nonce) || shown.includes(c.id));
  }).map((c) => c.label);
}

/** The labels whose nonce `text` carries (the positive control's check). */
export const noncesIn = (text: string) =>
  CANARIES.filter((c) => text.includes(c.nonce)).map((c) => c.label);

const ZERO_HASH = `sha256:${"0".repeat(64)}`;

/** A user-written item of `owner`'s carrying `c`'s nonce. */
export function canaryItem(c: Canary, owner: string, over: Partial<MemoryItem> = {}): MemoryItem {
  return {
    id: c.id,
    class: "semantic",
    scope: c.scope,
    owner,
    content: `${c.nonce} is the ${c.label} canary`,
    provenance: { kind: "user", ref: "e8.16", hash: ZERO_HASH, actor: owner },
    confidence: 0.9,
    valid_from: "2026-10-01T00:00:00.000Z",
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

const grant = (to: string, expires: string) => ({
  to,
  class: "semantic" as const,
  mode: "read" as const,
  expires,
});

export interface Seeded {
  /** Dana's read at T0, whose id the probes ask another actor's explanation of. */
  danaReadId: string;
  /** How many events the seed appended. */
  events: number;
}

/**
 * Writes every canary through its write path over `deps`, at T0, as the
 * module comment says, and fails if any path did not land as planned.
 */
export async function seedCanaries(deps: {
  db: Db;
  adapter: Adapter;
  policy: Policy;
  newId: () => string;
}): Promise<Seeded> {
  const plane = createPlane(deps);
  const must = (what: string, decision: string, want = "allow") => {
    if (decision !== want) throw new Error(`seed: ${what} was ${decision}, not ${want}`);
  };
  const write = async (actor: Actor, item: MemoryItem, want = "allow") => {
    const { event } = await plane.write(actor, item, T0);
    must(`${item.id} (${item.content})`, event.decision, want);
  };
  const c = byLabel;
  // The write route.
  await write(DANA, canaryItem(c("dana-person"), DANA.id));
  await write(DANA, canaryItem(c("dana-team"), DANA.id));
  await write(
    DANA,
    canaryItem(c("granted-sam"), DANA.id, {
      grants: [grant(SAM.id, LIVE)],
      lineage: [c("dana-person").id],
    }),
  );
  await write(
    DANA,
    canaryItem(c("expired-eve-write"), DANA.id, { grants: [grant(EVE.id, EXPIRED)] }),
  );
  // A grant change.
  await write(DANA, canaryItem(c("expired-eve-grant"), DANA.id));
  const changed = await plane.changeGrants(
    DANA,
    c("expired-eve-grant").id,
    { add: [grant(EVE.id, EXPIRED)], remove: [] },
    T0,
  );
  must("the grant change", changed.event.decision);
  // An import, as the server maps one (servedImport), then the owner's promotion of the candidate.
  const imported = servedImport(
    { ...DANA, source: "import" },
    canaryItem(c("imported"), DANA.id),
    () => undefined,
  );
  await write(imported.actor, imported.item as MemoryItem);
  const promoted = await plane.promote(DANA, c("imported").id, "person:dana", T0, {
    review: true,
  });
  must("the promotion", promoted.decision);
  // A supersession: the old version closed by the plan's accepted close.
  await write(
    DANA,
    canaryItem(c("superseded-old"), DANA.id, { valid_from: "2026-09-01T00:00:00.000Z" }),
  );
  await write(
    DANA,
    canaryItem(c("superseded-new"), DANA.id, {
      valid_from: "2026-10-10T00:00:00.000Z",
      lineage: [c("superseded-old").id],
    }),
  );
  const plan = planSupersession(deps.db, deps.policy, DANA, c("superseded-new").id, T0);
  const closes = acceptedClosures(deps.db, plan, [c("superseded-old").id]);
  const closed = await writeClosures({ plane, db: deps.db, policy: deps.policy }, DANA, closes, T0);
  must("the close", closed.applied[0]?.event.decision ?? "none");
  // Adoption: a record placed in the store outside the plane, adopted as dana's.
  await deps.adapter.write(canaryItem(c("adopted"), DANA.id));
  const adoption = await adoptStoreItems(deps, DANA, "person:dana", T0);
  if (adoption.allowed !== 1 || itemById(deps.db, c("adopted").id) === undefined)
    throw new Error(`seed: the store record was not adopted: ${JSON.stringify(adoption)}`);
  // A write the gate denies: model content into team:x (medium allows no model source there).
  await write({ ...DANA, source: "model" }, canaryItem(c("denied-team"), DANA.id), "deny");
  // Fred's writes as a member, then his offboarding.
  await write(FRED_MEMBER, canaryItem(c("fred-team"), FRED.id));
  await write(FRED_MEMBER, canaryItem(c("fred-person"), FRED.id));
  const report = await offboard(
    { ...deps },
    HR,
    { person: "person:fred", roles: [] },
    "2026-10-20T01:00:00.000Z",
  );
  must("the offboarding", report.decision);
  if (!report.erased.items.includes(c("fred-person").id))
    throw new Error(`seed: fred's person item was not erased: ${JSON.stringify(report.erased)}`);
  // The control's own team write, and dana's read whose id the probes ask about.
  await write(LEE, canaryItem(c("lee-team"), LEE.id));
  const read = await plane.read(DANA, { text: "canary", at: T0 });
  return { danaReadId: read.event.id, events: plane.events().length };
}

/** One probe's record: which surface, which actor, what it asked, and what leaked. */
export interface ProbeRecord {
  surface: string;
  probe: string;
  actor: string;
  leaked: string[];
}

/** One denied-and-missing comparison: whether a hidden id and a never-held one answer alike. */
export interface OracleRecord {
  surface: string;
  probe: string;
  alike: boolean;
}

/** One parity comparison: an operation through one surface against the reference. */
export interface ParityRecord {
  surface: string;
  operation: string;
  same: boolean;
}

export interface SuiteRecords {
  suite: string;
  probes: ProbeRecord[];
  oracles: OracleRecord[];
  parity: ParityRecord[];
  controls: { surface: string; found: string[] }[];
}

/** Writes `records` to ENGRAM_LEAKAGE_OUT/<suite>.json when that folder is named; else nothing. */
export function recordProbes(records: SuiteRecords): void {
  const out = process.env.ENGRAM_LEAKAGE_OUT;
  if (out === undefined || out === "") return;
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, `${records.suite}.json`), `${JSON.stringify(records, null, 2)}\n`);
}

/**
 * The operations a model's tools can make, run in this order on one canary
 * workspace by MCP (packages/cli/test/parity.test.ts, beside the HTTP API)
 * and by the pi extension (packages/pi-extension/test/parity.test.ts). Each
 * is the tool's name and arguments; `{read}` in an argument is the read id
 * of the operation before it. Both suites match what each operation answered
 * and logged, normalised by `opRecord`, against one file snapshot,
 * MODEL_PARITY, so the two surfaces agree with each other through it.
 */
export const MODEL_OPS: readonly { name: string; tool: string; args: Record<string, unknown> }[] = [
  {
    name: "a write to the agent's person scope",
    tool: "memory_write",
    args: { scope: "person:dana", content: "parity: the agent's own note" },
  },
  {
    name: "a write under the person floor",
    tool: "memory_write",
    args: { scope: "person:dana", content: "parity: a guess", confidence: 0.1 },
  },
  {
    name: "a write to a team the preset closes to model content",
    tool: "memory_write",
    args: { scope: "team:x", content: "parity: the agent's team note" },
  },
  { name: "a read", tool: "memory_read", args: { query: "canary" } },
  { name: "the read explained", tool: "memory_explain", args: { read_id: "{read}" } },
];

/** The file snapshot both model surfaces match. */
export const MODEL_PARITY = join(REPO, "packages/server/test/__parity__/model-operations.json");

/** Every UUID in `text` named by its first appearance, the canaries' by label. */
export function blindIds(text: string, seen = new Map<string, string>()): string {
  for (const c of CANARIES) seen.set(c.id, `<${c.label}>`);
  return text.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/g,
    (u) => {
      if (!seen.has(u)) seen.set(u, `<id${seen.size - CANARIES.length}>`);
      return seen.get(u) as string;
    },
  );
}

/** An event's fields that a surface decides: what parity compares. */
const DECIDED = [
  "op",
  "item_id",
  "actor",
  "scope_from",
  "scope_to",
  "decision",
  "reason",
  "policy_id",
] as const;
/** An item's fields that are the plane's, not the surface's label (provenance ref and hash, store ref). */
const ITEM_FIELDS = [
  "class",
  "scope",
  "owner",
  "content",
  "confidence",
  "valid_from",
  "valid_to",
  "grants",
  "lineage",
  "status",
  "version",
] as const;

/**
 * One operation as a surface ran it: the text it answered and the events it
 * logged, each event's decided fields and its item's plane fields, every id
 * blind. The provenance ref and hash are each surface's own label (pi's tool
 * call id, MCP's request id) and the store ref is the store's; they are left
 * out, and nothing else is.
 */
export function opRecord(
  name: string,
  answer: string,
  events: readonly Record<string, unknown>[],
  seen: Map<string, string>,
) {
  const shown = events.map((e) => {
    const out: Record<string, unknown> = {};
    for (const k of DECIDED) out[k] = e[k];
    const item = e.item as Record<string, unknown> | undefined;
    if (item) {
      const kept: Record<string, unknown> = {};
      for (const k of ITEM_FIELDS) kept[k] = item[k];
      out.item = kept;
    }
    return out;
  });
  return {
    name,
    answer: blindIds(answer, seen),
    events: JSON.parse(blindIds(JSON.stringify(shown), seen)) as unknown[],
  };
}
