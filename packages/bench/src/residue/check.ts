// The erasure-residue check (card X19, proposal U7 of the pre-registration,
// "Proposed amendments, not yet registered"): an engineering check of Twin's
// offboarding claim (ADRs 0010 and 0021), run once per log backend and store.
//
// The workspace, under packages/pi-package/profiles/twin.yaml: 20 person
// scopes, each holding 10 canary facts (canaries.ts), one item each, written
// through Plane.write; 200 further canaries from the same generator are never
// written. Per person, the derived tiers U7 names:
// - a summary item in the person scope, written as the person's agent (source
//   model) from a scripted model's reply replayed from committed cassettes,
//   quoting the canaries of slots 0 and 1;
// - a candidate procedure distilled from a session of the person's (card D2's
//   rule-based induction, which calls no model) whose tool call quotes the
//   canary of slot 2, written into the person scope as the distiller writes;
// - the fact of slot 3 promoted into the team by a reviewer the harness makes
//   a member of every person scope (under twin a widening out of a person
//   scope needs a user-sourced reviewer other than the owner who belongs to
//   both scopes);
// - a team item holding the store ref of slot 4's fact, appended to the log
//   as a fixture event (`x19/fixture/shared-ref`), as
//   packages/core/test/unit/plane/offboard-edges.test.ts builds one: no plane
//   path writes two items at one ref, which adoption alone makes;
// - lint events naming items: slot 6's fact is written twice, and the
//   person's deterministic lints (twin's list) record the duplicate;
// - an explanation row: slot 7's fact is granted to a reader, who reads it.
// Two of the store paths card E1.7 names, each once: person 1's slot-5 record
// sits in a store that refuses the plane's delete for good (NotDeletableError:
// left_in_store), and person 2's slot-5 record has moved, so the store holds
// no record at its ref when the erasure reads it (not_found_in_store; the
// end state E1.7's put-back leftover also reaches, pinned by
// packages/core/test/unit/plane/erasure-gaps.test.ts, "known limit"). Both are
// fault-injecting wrappers over the real store, not mocks: the record's bytes
// stay in the store.
//
// Each person is then offboarded, and every canary, with its fact's strict
// and merging content hashes, is searched for in every tier: core's
// findResidue over the log's tables and the store's records, then the bytes
// the log and store tiers cannot see (bytes.ts). Nothing here reads a clock
// or draws randomness: ids are sequential, times fixed, the canaries drawn
// from the seed.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type Actor,
  type Adapter,
  appendEvent,
  createPlane,
  currentItems,
  type Db,
  findResidue,
  induceByRule,
  type MemoryItem,
  type ModelCall,
  type ModelRequest,
  mergingContentHash,
  migrate,
  NotDeletableError,
  offboard,
  parsePolicy,
  type ResidueHit,
  type ResidueNeedle,
  requestHash,
  type Session,
  type StoreRef,
  scanBytes,
  strictContentHash,
} from "@engram/core";
import { cached, fileCache, scriptedModelCall } from "@engram/model";
import { type BackendHandle, openBackend } from "./backend.ts";
import { drawCanaries } from "./canaries.ts";
import { openStore, type StoreHandle } from "./stores.ts";

/** The policy every write and erasure is judged under: Twin's profile (ADR 0021). */
const TWIN = new URL("../../../pi-package/profiles/twin.yaml", import.meta.url);

export const BACKENDS = ["sqlite", "postgres"] as const;
export type BackendName = (typeof BACKENDS)[number];
export const STORES = ["files", "mem0", "letta", "mcp-memory"] as const;
export type StoreName = (typeof STORES)[number];

export const PERSONS = 20;
export const SLOTS = 10;
export const TEAM = "team:residue";
export const AT = "2026-11-28T12:00:00.000Z";
export const LATER = "2026-11-29T12:00:00.000Z";
export const SUMMARY_MODEL = "scripted/x19-summary";
export const SHARED_REF_FIXTURE_ID = "x19/fixture/shared-ref";

/** What each slot's fact is put through before the offboarding. */
export const SLOT_ROLES = [
  "summary",
  "summary",
  "candidate",
  "promoted",
  "shared-ref",
  "plain",
  "duplicate",
  "explained",
  "plain",
  "agent",
] as const;
export type SlotRole = (typeof SLOT_ROLES)[number] | "left-in-store" | "not-found";

/** The person and slot of each designed store case (card E1.7's paths). */
export const LEFT_IN_STORE = { person: 1, slot: 5 } as const;
export const NOT_FOUND = { person: 2, slot: 5 } as const;

export const BYTE_TIERS = ["db-file", "db-wal", "store-files", "store-history"] as const;
export type ByteTier = (typeof BYTE_TIERS)[number];
export const TIERS = [
  "projection",
  "explanations",
  "events",
  "log-other",
  "store-records",
  ...BYTE_TIERS,
] as const;
export type Tier = (typeof TIERS)[number];

export interface CheckOptions {
  backend: BackendName;
  store: StoreName;
  seed: number;
  /** The committed cassettes of the scripted summaries. */
  cassettes: string;
  /** Record the cassettes from the scripted model instead of replaying them. */
  record?: boolean;
  /** The first this many persons only (tests); default PERSONS. The canaries drawn are the same. */
  persons?: number;
}

const pad = (n: number, width: number) => String(n).padStart(width, "0");
export const personScope = (p: number) => `person:p${pad(p, 2)}`;
const itemId = (p: number, n: number) => `01930000-0000-7000-8000-${pad(p * 1000 + n, 12)}`;
const sequentialIds = () => {
  let n = 0;
  return () => `01930000-0000-7000-9000-${pad(++n, 12)}`;
};

const person = (p: number, source: "user" | "model"): Actor => ({
  id: personScope(p),
  level: "person",
  memberships: [personScope(p), TEAM],
  source,
});
const READER: Actor = {
  id: "person:reader",
  level: "person",
  memberships: ["person:reader", TEAM],
  source: "user",
};
const REVIEWER: Actor = {
  id: "person:reviewer",
  level: "person",
  memberships: [
    "person:reviewer",
    TEAM,
    ...Array.from({ length: PERSONS }, (_, i) => personScope(i + 1)),
  ],
  source: "user",
};

/** A fact's content: the canary in a sentence of the person's. */
export const factContent = (p: number, canary: string) =>
  `${personScope(p)} wrote down ${canary} as a note.`;

/** The canaries of a run: `exposed[p - 1][slot]`, and as many never written. */
export function runCanaries(seed: number) {
  const all = drawCanaries(seed, 2 * PERSONS * SLOTS);
  const grid = (offset: number) =>
    Array.from({ length: PERSONS }, (_, p) =>
      all.slice(offset + p * SLOTS, offset + (p + 1) * SLOTS),
    );
  return { exposed: grid(0), never: grid(PERSONS * SLOTS) };
}

export const slotRole = (p: number, slot: number): SlotRole =>
  p === LEFT_IN_STORE.person && slot === LEFT_IN_STORE.slot
    ? "left-in-store"
    : p === NOT_FOUND.person && slot === NOT_FOUND.slot
      ? "not-found"
      : (SLOT_ROLES[slot] as SlotRole);

const fact = (p: number, slot: number, content: string, n = slot): MemoryItem => {
  const role = slotRole(p, slot);
  return {
    id: itemId(p, n),
    class: "semantic",
    scope: personScope(p),
    owner: personScope(p),
    content,
    provenance: {
      kind: role === "agent" ? "model" : "user",
      ref: `x19/${personScope(p)}/note-${n}`,
      hash: `sha256:${strictContentHash(content).slice(7)}`,
      actor: personScope(p),
    },
    confidence: role === "agent" ? 0.5 : 0.9,
    valid_from: AT,
    valid_to: null,
    ttl: null,
    grants:
      role === "explained"
        ? [{ to: READER.id, class: "semantic", mode: "read", expires: LATER }]
        : [],
    version: 1,
    lineage: [],
    status: "active",
    store_ref: null,
    schema_version: 1,
  } as MemoryItem;
};

/** The summary request for person `p`: their ten facts, as the agent would send them. */
export function summaryRequest(p: number, facts: readonly string[], seed: number): ModelRequest {
  return {
    model: SUMMARY_MODEL,
    system: "You summarise a person's notes in one sentence for their own memory.",
    messages: [
      {
        role: "user",
        content: `Notes of ${personScope(p)}:\n${facts.map((f) => `- ${f}`).join("\n")}`,
      },
    ],
    seed,
    temperature: 0,
    maxTokens: 256,
  };
}

/** The scripted model's reply for person `p`: a sentence quoting slots 0 and 1. */
export const summaryReply = (p: number, canaries: readonly string[]) =>
  `${personScope(p)} keeps ${canaries[0]} and ${canaries[1]} among their notes.`;

/** The summary call: replayed from the cassettes, a miss an error; or recorded from the script. */
function summaryCall(options: CheckOptions, p: number, script: Record<string, string>): ModelCall {
  const context = {
    item: `x19/${personScope(p)}`,
    condition: "summary",
    preset: "twin",
    store: "none",
  };
  const inner: ModelCall = options.record
    ? scriptedModelCall(script)
    : async () => {
        throw new Error("x19: a summary call missed its cassette");
      };
  return cached(inner, { cache: fileCache(options.cassettes), context, offline: !options.record });
}

/** A recorded pi session of person `p` whose one tool call quotes `canary`, with its verdict. */
export function candidateSession(p: number, canary: string): Session {
  const ts = (s: number) => `2026-11-27T09:00:${pad(s, 2)}.000Z`;
  const ids = ["a1", "a2", "a3", "a4", "a5", "a6"].map((x) => `${x}${pad(p, 6)}`);
  const entries = [
    { type: "custom", customType: "engram.task", data: { task_id: `x19/file-note-${pad(p, 2)}` } },
    { type: "message", message: { role: "user", content: "File today's note in the notebook." } },
    {
      type: "message",
      message: {
        role: "assistant",
        content: [
          { type: "text", text: "Filing the note." },
          {
            type: "toolCall",
            id: "call_1",
            name: "bash",
            arguments: { command: `notebook add ${canary}` },
          },
        ],
        stopReason: "toolUse",
      },
    },
    {
      type: "message",
      message: {
        role: "toolResult",
        toolCallId: "call_1",
        toolName: "bash",
        content: [{ type: "text", text: "added" }],
        isError: false,
      },
    },
    {
      type: "message",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "Done." }],
        stopReason: "stop",
      },
    },
    { type: "custom", customType: "engram.outcome", data: { verdict: "success", reward: 1 } },
  ];
  return {
    id: `x19-session-${pad(p, 2)}`,
    entries: entries.map((e, i) => ({
      ...e,
      id: ids[i] as string,
      parentId: i === 0 ? null : (ids[i - 1] as string),
      timestamp: ts(i),
    })),
  };
}

/** A store whose delete of one ref is refused for good: a record the plane may not delete. */
function refusingDelete(adapter: Adapter, refused: () => StoreRef | undefined): Adapter {
  return {
    ...adapter,
    write: (i) => adapter.write(i),
    read: (r) => adapter.read(r),
    list: (s) => adapter.list(s),
    search: (q, s) => adapter.search(q, s),
    async delete(ref) {
      const r = refused();
      if (r && r.adapter === ref.adapter && r.key === ref.key)
        throw new NotDeletableError(`${ref.key} is read-only to the plane`);
      return adapter.delete(ref);
    },
  };
}

/**
 * A store in which one record has moved once `moved` names it: a read at its
 * ref finds nothing and a delete there removes nothing, while the record's
 * bytes stay where they are (a files folder renamed under the plane's root).
 */
function movedRecord(adapter: Adapter, moved: () => StoreRef | undefined): Adapter {
  const at = (ref: StoreRef) => {
    const m = moved();
    return m !== undefined && m.adapter === ref.adapter && m.key === ref.key;
  };
  return {
    ...adapter,
    write: (i) => adapter.write(i),
    list: (s) => adapter.list(s),
    search: (q, s) => adapter.search(q, s),
    read: async (ref) => (at(ref) ? undefined : adapter.read(ref)),
    delete: async (ref) => (at(ref) ? undefined : adapter.delete(ref)),
  };
}

/** One needle's hits in one tier, reduced: residue, or the first retained kind, or absent. */
export type Outcome = "residue" | (ResidueHit["retained"] & string);

export interface CanaryRow {
  person: number;
  slot: number;
  role: SlotRole | "never";
  /** Per tier: what the canary's text was found as, if at all. */
  text: Partial<Record<Tier, Outcome>>;
  /** Per tier: what one of its fact's content hashes was found as, if at all. */
  hash: Partial<Record<Tier, Outcome>>;
  /** Before the offboarding (exposed canaries only): the tiers its text was found in. */
  before?: Tier[];
}

export interface CheckOutcome {
  backend: BackendName;
  store: StoreName;
  seed: number;
  canaries: CanaryRow[];
  /** The deletion reports, summed over the persons. */
  reports: {
    erased_items: number;
    store_refs_deleted: number;
    left_in_store: number;
    not_found_in_store: number;
    store_failures: number;
    events_redacted: number;
    explanation_rows: number;
  };
  /** Rows and records the log and store tiers searched, after the offboardings. */
  searched: Record<string, number>;
  /** Whether each byte tier exists for this backend and store. */
  byte_tiers: Record<ByteTier, boolean>;
  /** The summary calls: replayed from cassettes (hits) or recorded. */
  summary_calls: { hits: number; recorded: number };
}

const RANK: Outcome[] = [
  "residue",
  "promoted",
  "outside-person-scope",
  "shared-store-ref",
  "erased-content-hash",
  "surviving-hash",
];
const worst = (a: Outcome | undefined, b: Outcome): Outcome =>
  a === undefined || RANK.indexOf(b) < RANK.indexOf(a) ? b : a;

/** Runs the check on one backend and store and returns its outcome; everything it made is removed. */
export async function runResidueCheck(options: CheckOptions): Promise<CheckOutcome> {
  const work = mkdtempSync(join(tmpdir(), "engram-x19-"));
  let backend: BackendHandle | undefined;
  let store: StoreHandle | undefined;
  try {
    backend = await openBackend(options.backend, join(work, "log"));
    store = await openStore(options.store, join(work, "store"));
    return await check(options, backend.db, backend, store);
  } finally {
    await store?.close();
    await backend?.close();
    rmSync(work, { recursive: true, force: true });
  }
}

async function check(
  options: CheckOptions,
  db: Db,
  backend: BackendHandle,
  store: StoreHandle,
): Promise<CheckOutcome> {
  migrate(db);
  const { exposed, never } = runCanaries(options.seed);
  const persons = options.persons ?? PERSONS;
  if (!Number.isInteger(persons) || persons < NOT_FOUND.person || persons > PERSONS)
    throw new Error(`x19: persons must be an integer from ${NOT_FOUND.person} to ${PERSONS}`);
  const policy = parsePolicy(readFileSync(TWIN, "utf8"), "twin.yaml");
  const refs = new Map<string, StoreRef>();
  const refOf = (p: number, slot: number) => refs.get(`${p}/${slot}`);
  const raw = store.adapter;
  let offboarding = false;
  const adapter = movedRecord(
    refusingDelete(raw, () => refOf(LEFT_IN_STORE.person, LEFT_IN_STORE.slot)),
    () => (offboarding ? refOf(NOT_FOUND.person, NOT_FOUND.slot) : undefined),
  );
  const newId = sequentialIds();
  const deps = { db, adapter, policy, newId };
  const plane = createPlane(deps);
  const summaryCalls = { hits: 0, recorded: 0 };
  const allow = (what: string, e: { decision: string; reason: string }) => {
    if (e.decision !== "allow") throw new Error(`x19: ${what} was ${e.decision}: ${e.reason}`);
  };

  for (let p = 1; p <= persons; p++) {
    const canaries = exposed[p - 1] as string[];
    const user = person(p, "user");
    const agent = person(p, "model");
    for (let slot = 0; slot < SLOTS; slot++) {
      const item = fact(p, slot, factContent(p, canaries[slot] as string));
      const w = await plane.write(SLOT_ROLES[slot] === "agent" ? agent : user, item, AT);
      allow(`the write of ${item.id}`, w.event);
      if (w.item?.store_ref) refs.set(`${p}/${slot}`, w.item.store_ref);
    }
    // Slot 6 written twice: the duplicate lint names both items.
    const dup = await plane.write(user, fact(p, 6, factContent(p, canaries[6] as string), 60), AT);
    allow("the duplicate write", dup.event);
    // The summary, written by the person's agent.
    const request = summaryRequest(
      p,
      canaries.map((c) => factContent(p, c)),
      options.seed,
    );
    const script = { [requestHash(request)]: summaryReply(p, canaries) };
    const reply = await summaryCall(options, p, script)(request);
    if (options.record) summaryCalls.recorded++;
    else summaryCalls.hits++;
    const summary = await plane.write(
      agent,
      {
        ...fact(p, 0, reply.text, 50),
        provenance: {
          kind: "model",
          ref: `x19/${personScope(p)}/summary`,
          hash: `sha256:${strictContentHash(reply.text).slice(7)}`,
          actor: personScope(p),
          model: SUMMARY_MODEL,
        },
        confidence: 0.5,
      },
      AT,
    );
    allow("the summary write", summary.event);
    // The candidate procedure, distilled from the person's session.
    const induced = induceByRule([candidateSession(p, canaries[2] as string)], {
      scope: personScope(p),
      owner: personScope(p),
      actor: personScope(p),
      at: AT,
      newId: () => itemId(p, 70),
    });
    if (induced.items.length !== 1)
      throw new Error(
        `x19: the induction gave ${induced.items.length} candidates: ${JSON.stringify(induced.skipped)}`,
      );
    allow(
      "the candidate write",
      (await plane.write(agent, induced.items[0] as MemoryItem, AT)).event,
    );
    // Slot 7 read through its grant, so an explanation row names it.
    const read = await plane.read(READER, { at: AT });
    if (!read.items.some((i) => i.id === itemId(p, 7)))
      throw new Error(`x19: the reader did not read ${itemId(p, 7)}`);
    // Slot 3 promoted into the team by the reviewer.
    allow(
      "the promotion",
      (await plane.promote(REVIEWER, itemId(p, 3), TEAM, AT, { review: true })).event,
    );
    // A team item at slot 4's store ref (see the header).
    const holder = currentItems(db).find((i) => i.id === itemId(p, 4)) as MemoryItem;
    const team = {
      ...holder,
      id: itemId(p, 80),
      scope: TEAM,
      lineage: [holder.id],
      version: holder.version + 1,
    } as MemoryItem;
    appendEvent(db, {
      id: newId(),
      ts: AT,
      op: "write",
      item_id: team.id,
      actor: user.id,
      scope_from: null,
      scope_to: TEAM,
      decision: "allow",
      reason: "a version of a person's record shared into the team (card X19's fixture)",
      policy_id: SHARED_REF_FIXTURE_ID,
      item: team,
      schema_version: 1,
    });
    // The person's deterministic lints.
    const lint = await plane.lint(user, AT, personScope(p));
    if (!lint.findings.some((f) => f.lint_id === "duplicate"))
      throw new Error(`x19: no duplicate finding in ${personScope(p)}`);
  }

  const needlesOf = (p: number, canary: string): ResidueNeedle[] => {
    const content = factContent(p, canary);
    return [
      { key: `${canary}#text`, text: canary },
      { key: `${canary}#strict`, text: strictContentHash(content).slice(7) },
      { key: `${canary}#merging`, text: mergingContentHash(content).slice(7) },
    ];
  };
  const rows: CanaryRow[] = [];
  const rowOf = new Map<string, CanaryRow>();
  for (let p = 1; p <= persons; p++)
    for (const [kind, grid] of [
      ["exposed", exposed],
      ["never", never],
    ] as const)
      for (let slot = 0; slot < SLOTS; slot++) {
        const canary = (grid[p - 1] as string[])[slot] as string;
        const row: CanaryRow = {
          person: p,
          slot,
          role: kind === "never" ? "never" : slotRole(p, slot),
          text: {},
          hash: {},
          ...(kind === "exposed" ? { before: [] } : {}),
        };
        rows.push(row);
        rowOf.set(canary, row);
      }
  const needles = (p: number) =>
    [...(exposed[p - 1] as string[]), ...(never[p - 1] as string[])].flatMap((c) =>
      needlesOf(p, c),
    );
  const split = (key: string) => {
    const [canary, part] = key.split("#") as [string, string];
    return {
      row: rowOf.get(canary) as CanaryRow,
      part: part === "text" ? "text" : "hash",
    } as const;
  };

  // The positive control: before any offboarding, where each exposed canary is.
  for (let p = 1; p <= persons; p++) {
    const scan = await findResidue(
      { db, adapter: raw },
      { person: personScope(p), needles: needles(p) },
    );
    for (const hit of scan.hits) {
      const { row, part } = split(hit.needle);
      if (part === "text" && row.before && !row.before.includes(hit.tier))
        row.before.push(hit.tier);
    }
  }
  for (const row of rows) row.before?.sort((a, b) => TIERS.indexOf(a) - TIERS.indexOf(b));

  offboarding = true;
  const reports: CheckOutcome["reports"] = {
    erased_items: 0,
    store_refs_deleted: 0,
    left_in_store: 0,
    not_found_in_store: 0,
    store_failures: 0,
    events_redacted: 0,
    explanation_rows: 0,
  };
  for (let p = 1; p <= persons; p++) {
    const report = await offboard(
      deps,
      person(p, "user"),
      { person: personScope(p), roles: [] },
      LATER,
    );
    if (report.decision !== "allow")
      throw new Error(`x19: offboarding ${personScope(p)}: ${report.reason}`);
    reports.erased_items += report.erased.items.length;
    reports.store_refs_deleted += report.erased.store_refs.length;
    reports.left_in_store += report.erased.left_in_store.length;
    reports.not_found_in_store += report.erased.not_found_in_store.length;
    reports.store_failures += report.erased.store_failures.length;
    reports.events_redacted += report.erased.events_redacted;
    reports.explanation_rows += report.erased.explanation_rows;
  }

  // After: the log and store tiers, through core, against the store as it is.
  const searched: Record<string, number> = {};
  const live = new Map<string, Outcome>();
  for (let p = 1; p <= persons; p++) {
    const scan = await findResidue(
      { db, adapter: raw },
      { person: personScope(p), needles: needles(p) },
    );
    for (const [tier, n] of Object.entries(scan.searched))
      searched[tier] = (searched[tier] ?? 0) + n;
    for (const hit of scan.hits) {
      const { row, part } = split(hit.needle);
      const outcome: Outcome = hit.retained ?? "residue";
      row[part][hit.tier] = worst(row[part][hit.tier], outcome);
      live.set(hit.needle, worst(live.get(hit.needle), outcome));
    }
  }
  // The bytes the log and store tiers cannot see. A byte hit cannot be
  // attributed to an item: it counts as retained when the same needle is
  // retained by decision in a live tier and has no residue there, else as
  // residue (the result's limits say so).
  const sources: { tier: ByteTier; bytes: () => Promise<Uint8Array[]> }[] = [
    { tier: "db-file", bytes: () => backend.fileBytes() },
    { tier: "db-wal", bytes: () => backend.walBytes() },
    { tier: "store-files", bytes: () => store.fileBytes() },
    { tier: "store-history", bytes: () => store.historyBytes() },
  ];
  const byteTiers = {} as Record<ByteTier, boolean>;
  const allNeedles = Array.from({ length: persons }, (_, i) => needles(i + 1)).flat();
  for (const { tier, bytes } of sources) {
    const chunks = await bytes();
    byteTiers[tier] = chunks.length > 0;
    const found = new Set(chunks.flatMap((c) => scanBytes(c, allNeedles)));
    for (const key of [...found].sort()) {
      const { row, part } = split(key);
      const known = live.get(key);
      const outcome: Outcome = known === undefined || known === "residue" ? "residue" : known;
      row[part][tier] = worst(row[part][tier], outcome);
    }
  }
  return {
    backend: options.backend,
    store: options.store,
    seed: options.seed,
    canaries: rows,
    reports,
    searched: Object.fromEntries(Object.entries(searched).sort(([a], [b]) => (a < b ? -1 : 1))),
    byte_tiers: byteTiers,
    summary_calls: summaryCalls,
  };
}
