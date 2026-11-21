// A stateful model-based test of the Plane (card E1.4). fast-check's command
// model (fc.commands, fc.asyncModelRun) generates sequences of every Plane
// operation a member's twin sees, on the real Plane over one log and the fake
// store, with the injected clock: write (by the owner, or by her agent with
// source model), read (by the owner, a grantee, the role's successor, HR),
// grant change, promote, retain, offboard, adopt, handle reopen and clock
// advance. Writes, grant changes and offboardings may stop at a crash window
// (test/helpers/failpoint.ts): the handle dies there and only a reopen
// follows, as a restarted process.
//
// After every command the log and the state are judged by the invariants'
// oracle (src/oracle.ts, the lead's), never by the evaluator:
//
// - every read, in its result and in the log, returned only items the
//   reader could read at its time (invariant 1; the dogfood report's replay,
//   src/dogfood.ts, judges every read event and every grant change);
// - every write the plane allowed is one writeForbidden permits (invariant 2);
// - every event carries a reason and a policy id, and a denied write is one
//   event (invariant 3);
// - rebuilding the projection from the log changes nothing (invariant 4);
// - no scope holds more active items of a class, not past their ttl, than
//   its recency or utility budget (invariant 5);
// - every adoption event records no kind more trusted, and no grant, than
//   the plane held for its id (invariants 6 and 7);
// - nothing an offboarding erased is projected, read or left in any event's
//   text, and while an erasure is open nothing in the person scope changes
//   (card E2.6);
// - until a crash, the store holds exactly what the projection holds.
//
// Each run ends with recovery on a fresh handle: offboarding again if an
// erasure was left open, then an adoption of each scope, after which a second
// adoption appends nothing and the store holds no record the log never
// allowed. A failure prints the seed, the path and the shrunk command list
// (fast-check's report); ENGRAM_STATEFUL_SEED and ENGRAM_STATEFUL_PATH replay
// it. ENGRAM_STATEFUL_RUNS sets the run count (a deep run: 2000); the default
// keeps the file well under the 30 s timeout. A vacuity check runs the same
// model on two deliberately broken planes and requires it to catch both.
//
// It complements the two-handle walk of invariants.test.ts (card E2.6),
// which interleaves two handles' operations at the store's calls: this file
// runs one handle at a time, over longer sequences and every operation.
import { readFileSync } from "node:fs";
import { createFakeAdapter } from "@engram/adapters";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import type { Adapter } from "../../src/adapter.ts";
import type { Db } from "../../src/db/db.ts";
import { migrate } from "../../src/db/migrate.ts";
import { openSqlite } from "../../src/db/sqlite.ts";
import { dogfoodReport } from "../../src/dogfood.ts";
import { allEvents, currentItems, erases, rebuild } from "../../src/events.ts";
import { itemById } from "../../src/items.ts";
import { canonical, erasureOpen, logHead } from "../../src/plane/commit.ts";
import {
  type Actor,
  adoptStoreItems,
  createPlane,
  type OffboardRequest,
  offboard,
  type Plane,
  type PlaneDeps,
} from "../../src/plane.ts";
import { parsePolicy } from "../../src/policy/load.ts";
import type { Grant, MemoryEvent, MemoryItem, Policy } from "../../src/schema.ts";
import { addSeconds } from "../../src/time.ts";
import { seedFor } from "../generators.ts";
import { Crashed, type Failpoints, failpoints } from "../helpers/failpoint.ts";
import {
  grantsAlike,
  pastTtl,
  readable,
  replayEvent,
  sameContent,
  TRUST,
  withinValidity,
  writeForbidden,
} from "./oracle.ts";

const env = (name: string) => process.env[name];
const RUNS = Number(env("ENGRAM_STATEFUL_RUNS") ?? 200);
const MAX_COMMANDS = 40;

const TWIN = new URL("../../../pi-package/profiles/twin.yaml", import.meta.url);
const twin = (): Policy => parsePolicy(readFileSync(TWIN, "utf8"), "twin.yaml");
/** The twin profile with budgets small enough to be met in a run, and a ttl a clock advance passes. */
const tight = (): Policy => {
  const p = twin();
  return {
    ...p,
    id: "profile.twin.tight",
    retention: p.retention.map((r) =>
      r.scope === "person" && r.class === "semantic"
        ? { ...r, budget: 2, eviction: "recency" as const }
        : r.scope === "person" && r.class === "episodic"
          ? { ...r, budget: 1, ttl: 30 * 86_400 }
          : r.scope === "role" && r.class === "semantic"
            ? { ...r, budget: 1 }
            : r,
    ),
  };
};

const START = "2026-11-19T10:00:00Z";
const UNTIL = "2026-12-19T00:00:00Z";
const PERSON = "person:dana";
const ROLE = "role:release";
const SCOPES = [PERSON, ROLE] as const;

const DANA: Actor = {
  id: "person:dana",
  level: "person",
  memberships: [PERSON, ROLE],
  source: "user",
};
/** Dana's agent: her principal, with the harness's source model. */
const AGENT: Actor = { ...DANA, source: "model" };
const HR: Actor = {
  id: "person:hr",
  level: "person",
  memberships: ["person:hr", PERSON, ROLE],
  source: "user",
};
const SAM: Actor = { id: "person:sam", level: "person", memberships: ["person:sam"] };
const LEE: Actor = { id: "person:lee", level: "person", memberships: ["person:lee", ROLE] };
const READERS = { dana: DANA, agent: AGENT, hr: HR, sam: SAM, lee: LEE } as const;
/** The actors the dogfood report judges reads as, by id. */
const DECLARED = [DANA, HR, SAM, LEE];
const LEAVE: OffboardRequest = { person: PERSON, roles: [{ scope: ROLE, successor: LEE.id }] };

/** Items 1 to 3 in Dana's person scope, 4 and 5 in the role. */
const POOL = [1, 2, 3, 4, 5].map((n) => `01960000-0000-7000-8000-${String(n).padStart(12, "0")}`);
const scopeOf = (pick: number) => (pick < 3 ? PERSON : ROLE);

// ------------------------------------------------------------------ model and system

/** What a run saw, summed over every run, for the guards. */
interface Seen {
  commands: Record<string, number>;
  crashes: number;
  reopens: number;
  erased: number;
  offboardReruns: number;
  grantedReads: number;
  adopted: number;
  evicted: number;
  promoted: number;
  denied: number;
  frozenRefusals: number;
  /** Recovered records whose grants the projection dropped and the store kept (E14-F1). */
  storeGrantsLeft: number;
  /** The most oracle violations of finding E14-F3 one log held. */
  heldUntrustedGrants: number;
  /** The most adoption passes one recovery needed until a pass appended nothing (E14-F4). */
  adoptionPasses: number;
}
const newSeen = (): Seen => ({
  commands: {},
  crashes: 0,
  reopens: 0,
  erased: 0,
  offboardReruns: 0,
  grantedReads: 0,
  adopted: 0,
  evicted: 0,
  promoted: 0,
  denied: 0,
  frozenRefusals: 0,
  storeGrantsLeft: 0,
  heldUntrustedGrants: 0,
  adoptionPasses: 0,
});

interface Model {
  /** The handle is alive; after a crash only a reopen may follow. */
  alive: boolean;
  /** The injected clock. */
  at: string;
  /** A crash happened in this run: the store may hold bytes the log never recorded. */
  crashed: boolean;
  /** Recovery ran (adoption of every scope on a fresh handle): the store is judged again. */
  recovered: boolean;
  /**
   * Judge the two known gaps too. Off by default, each pinned by its own
   * test below: finding E14-F1 (a crashed write or grant change that added a
   * grant leaves that grant in the store's record for good; adoption drops
   * it from the projection only), and finding E14-F3 (the plane lets the
   * owner grant an item that once held her agent's content, which the
   * oracle's replay counts as a violation).
   */
  strict: boolean;
  /** Every content token written under each item id. */
  tokens: Map<string, Set<string>>;
  next: number;
  seen: Seen;
}

interface Handle {
  fp: Failpoints;
  deps: PlaneDeps;
  plane: Plane;
}

/** A broken plane for the vacuity check: the model must catch it. */
type Breakage = (plane: Plane, deps: PlaneDeps, store: Adapter) => Plane;

interface Real {
  base: Db;
  store: Adapter;
  policy: Policy;
  handle: Handle;
  open(): Handle;
}

function system(policy: Policy, broken?: Breakage): Real {
  const base = openSqlite(":memory:");
  migrate(base);
  const store = createFakeAdapter({ history: false });
  let n = 0;
  const open = (): Handle => {
    const fp = failpoints();
    const deps: PlaneDeps = {
      db: fp.db(base),
      adapter: fp.adapter(store),
      policy,
      newId: () => `01970000-0000-7000-8000-${String(++n).padStart(12, "0")}`,
    };
    const plane = createPlane(deps);
    return { fp, deps, plane: broken ? broken(plane, deps, store) : plane };
  };
  const real: Real = { base, store, policy, handle: open(), open };
  return real;
}

const count = (m: Model, name: string) => {
  m.seen.commands[name] = (m.seen.commands[name] ?? 0) + 1;
};

/** Runs `call`; a Crashed handle ends it, anything else fails the run. */
async function surviving<T>(m: Model, r: Real, call: () => Promise<T>): Promise<T | undefined> {
  try {
    return await call();
  } catch (e) {
    if (!(e instanceof Crashed)) throw e;
    m.alive = false;
    m.crashed = true;
    m.seen.crashes++;
    return undefined;
  } finally {
    r.handle.fp.clear();
  }
}

// ------------------------------------------------------------------ the judge

/**
 * The projected items whose last allowed changing event retired them, as
 * invariant 2 of invariants.test.ts reads them (retiredByEvent there): what
 * a model, compaction or tool write may not restate in their scope.
 */
function retiredByEvent(db: Db): MemoryItem[] {
  const changing = ["write", "update", "promote", "retire", "evict"];
  const last = new Map<string, MemoryEvent>();
  for (const e of allEvents(db))
    if (e.decision === "allow" && e.item_id !== null && changing.includes(e.op))
      last.set(e.item_id, e);
  const items = currentItems(db);
  return items.filter((i) => {
    const e = last.get(i.id);
    if (!e || !["retire", "evict"].includes(e.op)) return false;
    if (e.policy_id === "engram/retention/item-ttl") return false;
    if (e.policy_id.endsWith("/promotion/superseded")) return false;
    return !items.some(
      (a) => a.status === "active" && a.scope === i.scope && sameContent(a.content, i.content),
    );
  });
}

/** As adoption compares a record with the projection: status and the provenance's kind and actor aside. */
const unsourced = (i: MemoryItem | undefined) =>
  i && { ...i, status: null, provenance: { ...i.provenance, kind: null, actor: null } };

/** The ids an offboarding erased, with the seq of the erasure. */
const erasedIds = (log: readonly MemoryEvent[]) =>
  new Map(log.filter(erases).map((e) => [e.item_id as string, e.seq]));

const ADOPTED = "adopted from store ";
/** The oracle's words for finding E14-F3 (grantChangeProblem, src/oracle.ts). */
const E14_F3 = "grants on an item that held untrusted content";

/** Every check that holds after any command; `start` is the log's head before it. */
async function judge(m: Model, r: Real, what: string, start: number, frozen: boolean) {
  const log = allEvents(r.base);
  const fresh = log.filter((e) => e.seq > start);
  const at = (k: string) => `${what}: ${k}`;

  // Invariant 1 over every read in the log, and every grant change (the dogfood report's replay).
  const { details } = dogfoodReport(log, r.policy, DECLARED);
  const judged = m.strict ? details : details.filter((d) => !d.endsWith(E14_F3));
  m.seen.heldUntrustedGrants = Math.max(m.seen.heldUntrustedGrants, details.length - judged.length);
  expect(
    judged,
    at(`the oracle's replay of the log finds a violation: ${judged.join("; ")}`),
  ).toEqual([]);

  // Invariant 3: every event the command appended has a reason and a policy id.
  for (const e of fresh) {
    expect(e.reason.length, at(`event ${e.seq} has a reason`)).toBeGreaterThan(0);
    expect(e.policy_id.length, at(`event ${e.seq} has a policy id`)).toBeGreaterThan(0);
    if (e.decision === "deny") m.seen.denied++;
    if (e.op === "evict" && e.decision === "allow") m.seen.evicted++;
    if (e.op === "promote" && e.decision === "allow") m.seen.promoted++;
  }

  // Invariant 4: the projection is what the log replays to.
  const before = canonical(currentItems(r.base));
  rebuild(r.base);
  expect(canonical(currentItems(r.base)), at("a rebuild changes the projection")).toBe(before);

  // Invariant 5: no budget exceeded by active items not past their ttl.
  const items = currentItems(r.base);
  for (const rule of r.policy.retention) {
    if (rule.budget === null || rule.eviction === "manual") continue;
    for (const scope of SCOPES) {
      if (!scope.startsWith(`${rule.scope}:`)) continue;
      const active = items.filter(
        (i) =>
          i.scope === scope &&
          i.class === rule.class &&
          i.status === "active" &&
          !pastTtl(r.policy, i, m.at),
      );
      expect(
        active.length,
        at(
          `${scope} holds ${active.length} active ${rule.class} items, over its budget ${rule.budget}`,
        ),
      ).toBeLessThanOrEqual(rule.budget);
    }
  }

  // Invariants 6 and 7: adoption raises no kind and adds no grant, against the oracle's own replay.
  const state = new Map<string, MemoryItem>();
  for (const e of log) {
    if (
      e.seq > start &&
      e.op === "write" &&
      e.decision === "allow" &&
      e.item &&
      e.reason.startsWith(ADOPTED)
    ) {
      m.seen.adopted++;
      const held = state.get(e.item.id);
      const ceiling = held ? TRUST.indexOf(held.provenance.kind) : TRUST.indexOf("import");
      expect(
        TRUST.indexOf(e.item.provenance.kind),
        at(`adoption ${e.seq} recorded kind ${e.item.provenance.kind} for ${e.item.id}`),
      ).toBeGreaterThanOrEqual(ceiling);
      for (const g of e.item.grants)
        expect(
          held?.grants.some((h) => grantsAlike(g, h)) ?? false,
          at(`adoption ${e.seq} recorded a grant to ${g.to} the plane did not hold`),
        ).toBe(true);
    }
    replayEvent(state, e);
  }

  // Erasure: nothing erased projected; its content in no event's text and,
  // until a crash, in no store record. Content a surviving item also holds is
  // not the erased item's alone (a promotion's copy).
  const erased = erasedIds(log);
  for (const id of erased.keys())
    expect(itemById(r.base, id), at(`erased ${id} is projected`)).toBeUndefined();
  const surviving = JSON.stringify(items.map((i) => i.content));
  const erasedOnly = [...erased.keys()]
    .flatMap((id) => [...(m.tokens.get(id) ?? [])])
    .filter((t) => !surviving.includes(t));
  const listed = (await Promise.all(SCOPES.map((s) => r.store.list(s)))).flat();
  const settled = !m.crashed || m.recovered;
  const text = JSON.stringify([log, settled ? listed : []]);
  for (const t of erasedOnly) expect(text, at(`erased content ${t} survives`)).not.toContain(t);

  // An open erasure freezes the person scope.
  if (frozen)
    for (const e of fresh)
      if (
        e.decision === "allow" &&
        ["write", "update", "promote"].includes(e.op) &&
        (e.scope_to === PERSON || e.scope_from === PERSON)
      )
        expect.fail(
          at(`event ${e.seq} (${e.policy_id}) changed ${PERSON} while it was being erased`),
        );

  // Until a crash, and after recovery, the store holds what the projection holds.
  if (settled) {
    const lax = m.crashed && !m.strict;
    for (const held of items) {
      if (!held.store_ref) continue;
      const record = await r.store.read(held.store_ref);
      if (lax && record) {
        // E14-F1: the record may keep grants the projection dropped, never lack one it holds.
        for (const g of held.grants)
          expect(
            record.grants.some((h) => grantsAlike(g, h)),
            at(`the store's record of ${held.id} lacks the grant to ${g.to} the log holds`),
          ).toBe(true);
        if (record.grants.length > held.grants.length) m.seen.storeGrantsLeft++;
      }
      const judged = (i: MemoryItem | undefined) =>
        lax && i ? { ...unsourced(i), grants: null } : unsourced(i);
      expect(judged(record), at(`the store's record of ${held.id}`)).toEqual(judged(held));
    }
    for (const record of listed)
      expect(
        itemById(r.base, record.id),
        at(`the store holds ${record.id}, which the projection does not`),
      ).toBeDefined();
  }
}

/** The common shape of a command: alive handles only, judged after it runs. */
abstract class Step implements fc.AsyncCommand<Model, Real> {
  abstract readonly name: string;
  check(m: Readonly<Model>): boolean {
    return m.alive;
  }
  abstract act(m: Model, r: Real): Promise<void>;
  async run(m: Model, r: Real): Promise<void> {
    count(m, this.name);
    const start = logHead(r.base);
    const frozen = erasureOpen(r.base, PERSON);
    await this.act(m, r);
    await judge(m, r, this.toString(), start, frozen && this.name !== "offboard");
  }
  abstract toString(): string;
}

// ------------------------------------------------------------------ the commands

type WriteCrash = "none" | "store-after" | "commit-before" | "commit-after";

function armWrite(fp: Failpoints, crash: WriteCrash) {
  const committing = (hit: { appended: MemoryEvent[] }) =>
    hit.appended.some((e) => e.decision === "allow" && ["write", "update"].includes(e.op));
  if (crash === "store-after") fp.arm("store.write:after", "crash");
  if (crash === "commit-before") fp.arm("commit:before", "crash", committing);
  if (crash === "commit-after") fp.arm("commit:after", "crash", committing);
}

class Write extends Step {
  readonly name = "write";
  readonly who: "dana" | "agent";
  readonly pick: number;
  readonly grant: boolean;
  readonly episodic: boolean;
  readonly stale: boolean;
  readonly crash: WriteCrash;
  constructor(
    who: "dana" | "agent",
    pick: number,
    grant: boolean,
    episodic: boolean,
    stale: boolean,
    crash: WriteCrash,
  ) {
    super();
    this.who = who;
    this.pick = pick;
    this.grant = grant;
    this.episodic = episodic;
    this.stale = stale;
    this.crash = crash;
  }
  async act(m: Model, r: Real) {
    const actor = this.who === "dana" ? DANA : AGENT;
    const id = POOL[this.pick] as string;
    const scope = scopeOf(this.pick);
    const held = itemById(r.base, id);
    const cls = held?.class ?? (this.episodic && scope === PERSON ? "episodic" : "semantic");
    const token = `zq${++m.next}x`;
    m.tokens.set(id, (m.tokens.get(id) ?? new Set()).add(token));
    const it = {
      id,
      class: cls,
      scope,
      owner: held?.owner ?? DANA.id,
      content: `Dana's note ${token}`,
      provenance: { kind: "user", ref: "doc/1", hash: `sha256:${"0".repeat(64)}`, actor: DANA.id },
      confidence: 0.9,
      valid_from: "2026-10-01T00:00:00Z",
      valid_to: null,
      ttl: null,
      grants: this.grant
        ? [{ to: SAM.id, class: cls, mode: "read", expires: UNTIL }]
        : (held?.grants ?? []),
      version: this.stale ? (held?.version ?? 1) : (held?.version ?? 0) + 1,
      lineage: [],
      status: "active",
      store_ref: null,
      schema_version: 1,
    } as MemoryItem;
    const retired = retiredByEvent(r.base);
    const start = logHead(r.base);
    armWrite(r.handle.fp, this.crash);
    const res = await surviving(m, r, () => r.handle.plane.write(actor, it, m.at));
    if (!res) return;
    const fresh = allEvents(r.base).filter((e) => e.seq > start);
    if (res.event.decision === "allow") {
      // Invariant 2: what landed is a write the policy permits.
      expect(
        writeForbidden(r.policy, actor, res.event.item as MemoryItem, retired),
        `${this}: the plane allowed a write the oracle forbids (${res.event.policy_id})`,
      ).toBe(false);
    } else {
      // Invariant 3: a denied write is one event.
      expect(
        fresh.map((e) => e.policy_id),
        `${this}: a denied write is one event`,
      ).toEqual([res.event.policy_id]);
      if (res.event.policy_id === "engram/offboard/erasing") m.seen.frozenRefusals++;
    }
  }
  toString() {
    return `write(${this.who}, ${this.pick}${this.grant ? ", grant" : ""}${this.episodic ? ", episodic" : ""}${this.stale ? ", stale" : ""}${this.crash === "none" ? "" : `, crash ${this.crash}`})`;
  }
}

class Read extends Step {
  readonly name = "read";
  readonly reader: keyof typeof READERS;
  readonly text: boolean;
  constructor(reader: keyof typeof READERS, text: boolean) {
    super();
    this.reader = reader;
    this.text = text;
  }
  async act(m: Model, r: Real) {
    const reader = READERS[this.reader];
    const res = await r.handle.plane.read(reader, {
      at: m.at,
      ...(this.text ? { text: "note" } : {}),
    });
    const erased = erasedIds(allEvents(r.base));
    for (const it of res.items) {
      // Invariant 1, on what the call handed back (the log is judged too).
      expect(
        readable(r.policy, reader, it, m.at) && it.status === "active" && withinValidity(it, m.at),
        `${this}: returned ${it.id} (${it.scope}, ${it.status}), which the reader may not read at ${m.at}`,
      ).toBe(true);
      expect(erased.has(it.id), `${this}: returned erased ${it.id}`).toBe(false);
    }
    if (this.reader === "sam" && res.items.length > 0) m.seen.grantedReads++;
  }
  toString() {
    return `read(${this.reader}${this.text ? ", text" : ""})`;
  }
}

class ChangeGrant extends Step {
  readonly name = "grant";
  readonly pick: number;
  readonly add: boolean;
  readonly to: "sam" | "lee";
  readonly crash: boolean;
  constructor(pick: number, add: boolean, to: "sam" | "lee", crash: boolean) {
    super();
    this.pick = pick;
    this.add = add;
    this.to = to;
    this.crash = crash;
  }
  async act(m: Model, r: Real) {
    const id = POOL[this.pick] as string;
    const held = itemById(r.base, id);
    const grant: Grant = {
      to: READERS[this.to].id,
      class: held?.class ?? "semantic",
      mode: "read",
      expires: UNTIL,
    };
    if (this.crash) r.handle.fp.arm("store.write:after", "crash");
    await surviving(m, r, () =>
      r.handle.plane.changeGrants(
        DANA,
        id,
        this.add ? { add: [grant] } : { remove: [held?.grants[0] ?? grant] },
        m.at,
      ),
    );
  }
  toString() {
    return `grant(${this.pick}, ${this.add ? "add" : "remove"} ${this.to}${this.crash ? ", crash store-after" : ""})`;
  }
}

class Promote extends Step {
  readonly name = "promote";
  readonly pick: number;
  readonly by: "hr" | "dana";
  readonly widen: boolean;
  readonly review: boolean;
  constructor(pick: number, by: "hr" | "dana", widen: boolean, review: boolean) {
    super();
    this.pick = pick;
    this.by = by;
    this.widen = widen;
    this.review = review;
  }
  async act(m: Model, r: Real) {
    const id = POOL[this.pick] as string;
    const to = this.widen ? ROLE : scopeOf(this.pick);
    await r.handle.plane.promote(READERS[this.by], id, to, m.at, { review: this.review });
  }
  toString() {
    return `promote(${this.pick}, by ${this.by}${this.widen ? `, to ${ROLE}` : ""}${this.review ? ", review" : ""})`;
  }
}

class Retain extends Step {
  readonly name = "retain";
  readonly scope: number;
  readonly who: "dana" | "agent";
  constructor(scope: number, who: "dana" | "agent") {
    super();
    this.scope = scope;
    this.who = who;
  }
  async act(m: Model, r: Real) {
    await r.handle.plane.retain(READERS[this.who], SCOPES[this.scope] as string, m.at);
  }
  toString() {
    return `retain(${SCOPES[this.scope]}, by ${this.who})`;
  }
}

type OffboardCrash = "none" | "mark" | "handover" | "delete" | "erase" | "report";

class Offboard extends Step {
  readonly name = "offboard";
  readonly crash: OffboardCrash;
  constructor(crash: OffboardCrash) {
    super();
    this.crash = crash;
  }
  async act(m: Model, r: Real) {
    const fp = r.handle.fp;
    const appends = (rule: string) => (hit: { appended: MemoryEvent[] }) =>
      hit.appended.some((e) => e.policy_id === rule);
    if (this.crash === "mark") fp.arm("commit:after", "crash", appends("engram/offboard/begin"));
    if (this.crash === "handover")
      fp.arm("store.write:after", "crash", (hit) => hit.item?.scope === ROLE);
    if (this.crash === "delete") fp.arm("store.delete:after", "crash");
    if (this.crash === "erase") fp.arm("commit:before", "crash", appends("engram/offboard/erase"));
    if (this.crash === "report")
      fp.arm("commit:before", "crash", appends("engram/offboard/report"));
    const rerun = erasureOpen(r.base, PERSON);
    const before = erasedIds(allEvents(r.base)).size;
    const report = await surviving(m, r, () => offboard(r.handle.deps, HR, LEAVE, m.at));
    if (!report) return;
    if (rerun) m.seen.offboardReruns++;
    m.seen.erased += erasedIds(allEvents(r.base)).size - before;
    expect(report.decision).toBe("allow");
    expect(
      erasureOpen(r.base, PERSON),
      `${this}: a completed offboarding leaves the scope frozen`,
    ).toBe(false);
  }
  toString() {
    return `offboard(${this.crash === "none" ? "" : `crash ${this.crash}`})`;
  }
}

class Adopt extends Step {
  readonly name = "adopt";
  readonly scope: number;
  constructor(scope: number) {
    super();
    this.scope = scope;
  }
  async act(m: Model, r: Real) {
    await adoptStoreItems(r.handle.deps, DANA, SCOPES[this.scope] as string, m.at);
  }
  toString() {
    return `adopt(${SCOPES[this.scope]})`;
  }
}

class Reopen extends Step {
  readonly name = "reopen";
  override check() {
    return true;
  }
  async act(m: Model, r: Real) {
    r.handle = r.open();
    m.alive = true;
    m.seen.reopens++;
  }
  toString() {
    return "reopen()";
  }
}

class Advance extends Step {
  readonly name = "advance";
  readonly seconds: number;
  constructor(seconds: number) {
    super();
    this.seconds = seconds;
  }
  async act(m: Model) {
    m.at = addSeconds(m.at, this.seconds) as string;
  }
  toString() {
    return `advance(${this.seconds} s)`;
  }
}

const pick = fc.nat(4);
const arbCommands = fc.commands(
  [
    fc
      .tuple(
        fc.constantFrom<"dana" | "agent">("dana", "dana", "agent"),
        pick,
        fc.boolean(),
        fc.boolean(),
        fc.constantFrom(false, false, false, true),
        fc.constantFrom<WriteCrash>(
          "none",
          "none",
          "none",
          "none",
          "none",
          "none",
          "store-after",
          "commit-before",
          "commit-after",
        ),
      )
      .map(([who, p, g, e, s, c]) => new Write(who, p, g, e, s, c)),
    fc
      .tuple(
        fc.constantFrom<keyof typeof READERS>("dana", "agent", "hr", "sam", "lee"),
        fc.boolean(),
      )
      .map(([who, t]) => new Read(who, t)),
    fc
      .tuple(
        pick,
        fc.boolean(),
        fc.constantFrom<"sam" | "lee">("sam", "sam", "lee"),
        fc.constantFrom(false, false, false, true),
      )
      .map(([p, a, to, c]) => new ChangeGrant(p, a, to, c)),
    fc
      .tuple(pick, fc.constantFrom<"hr" | "dana">("hr", "dana"), fc.boolean(), fc.boolean())
      .map(([p, by, w, rv]) => new Promote(p, by, w, rv)),
    fc
      .tuple(fc.nat(1), fc.constantFrom<"dana" | "agent">("dana", "agent"))
      .map(([s, w]) => new Retain(s, w)),
    fc
      .constantFrom<OffboardCrash>("none", "none", "mark", "handover", "delete", "erase", "report")
      .map((c) => new Offboard(c)),
    fc.nat(1).map((s) => new Adopt(s)),
    fc.constant(new Reopen()),
    fc.constant(new Reopen()),
    fc.constantFrom(1, 3600, 31 * 86_400, 100 * 86_400).map((s) => new Advance(s)),
  ],
  { maxCommands: MAX_COMMANDS, size: "max" },
);

/**
 * One run: the commands, then recovery on a fresh handle. Recovery completes:
 * no erasure left open, a second adoption of each scope appends nothing, the
 * store holds no record the log never allowed, and nothing erased survives.
 */
async function runModel(
  policyName: "twin" | "tight",
  cmds: Iterable<fc.AsyncCommand<Model, Real>>,
  seen: Seen,
  broken?: Breakage,
  strict = false,
) {
  const policy = policyName === "twin" ? twin() : tight();
  const real = system(policy, broken);
  const model: Model = {
    alive: true,
    at: START,
    crashed: false,
    recovered: false,
    strict,
    tokens: new Map(),
    next: 0,
    seen,
  };
  await fc.asyncModelRun(() => ({ model, real }), cmds);

  real.handle = real.open();
  const at = addSeconds(model.at, 1) as string;
  if (erasureOpen(real.base, PERSON)) {
    await offboard(real.handle.deps, HR, LEAVE, at);
    seen.offboardReruns++;
  }
  expect(erasureOpen(real.base, PERSON), "recovery: an erasure left open").toBe(false);
  const start = logHead(real.base);
  // Adoption until a pass appends nothing: strictly the second pass, else by
  // the third (finding E14-F4: a record one pass defers, because that pass's
  // own budget check changed its item, is adopted by the next).
  const limit = strict ? 2 : 3;
  let appended: string[] = [];
  let passes = 0;
  do {
    const mid = logHead(real.base);
    for (const scope of SCOPES) await adoptStoreItems(real.handle.deps, DANA, scope, at);
    passes++;
    appended = allEvents(real.base)
      .filter((e) => e.seq > mid)
      .map((e) => `${e.seq} ${e.policy_id}: ${e.reason}`);
  } while (appended.length > 0 && passes < limit);
  expect(appended, `recovery: adoption pass ${passes} still appends`).toEqual([]);
  seen.adoptionPasses = Math.max(seen.adoptionPasses, passes);
  for (const scope of SCOPES)
    for (const record of await real.store.list(scope))
      expect(
        allEvents(real.base).some((e) => e.item_id === record.id && e.decision === "allow"),
        `recovery: the store holds ${record.id}, which the log never allowed`,
      ).toBe(true);
  model.recovered = true;
  model.at = at;
  await judge(model, real, "recovery", start, false);
  real.base.close();
}

const arbRun = fc.tuple(fc.constantFrom<"twin" | "tight">("twin", "tight"), arbCommands);

describe("the Plane as a state machine", () => {
  const NAME =
    "every sequence of Plane operations, crashes and reopens keeps the invariants after each step, and recovery completes";
  test(
    NAME,
    async () => {
      const seen = newSeen();
      const seed = env("ENGRAM_STATEFUL_SEED");
      const path = env("ENGRAM_STATEFUL_PATH");
      await fc.assert(
        fc.asyncProperty(arbRun, ([policy, cmds]) => runModel(policy, cmds, seen)),
        {
          numRuns: RUNS,
          seed: seed === undefined ? seedFor(NAME) : Number(seed),
          ...(path === undefined ? {} : { path }),
          endOnFailure: false,
        },
      );
      // ENGRAM_STATEFUL_SEEN=1 prints what the runs met, for sizing a deep run.
      if (env("ENGRAM_STATEFUL_SEEN"))
        process.stderr.write(`${JSON.stringify(seen)}
`);
      const kinds = [
        "write",
        "read",
        "grant",
        "promote",
        "retain",
        "offboard",
        "adopt",
        "reopen",
        "advance",
      ];
      expect(
        kinds.every((k) => (seen.commands[k] ?? 0) > 0) &&
          seen.crashes > 0 &&
          seen.reopens > 0 &&
          seen.erased > 0 &&
          seen.offboardReruns > 0 &&
          seen.grantedReads > 0 &&
          seen.adopted > 0 &&
          seen.evicted > 0 &&
          seen.promoted > 0 &&
          seen.denied > 0 &&
          seen.frozenRefusals > 0,
        `the model needs every command, crashes and reopens, erasures, offboardings run again, granted reads, adoptions, evictions, promotions, denials and refusals in a frozen scope; it saw ${JSON.stringify(seen)}`,
      ).toBe(true);
    },
    Math.max(120_000, RUNS * 200),
  );

  // The model's first counterexample (seed -19116893, path "1:2:1:1:1",
  // shrunk four times): [twin, write(dana, 0, grant, crash commit-before),
  // reopen()]. Pinned as it stands today; the main property judges the
  // store's grants laxly after a crash until it is resolved.
  test("E14-F1: a crashed first write carrying a grant, then recovery: the store's record keeps the grant the log never recorded", async () => {
    const cmds = [new Write("dana", 0, true, false, false, "commit-before"), new Reopen()];
    await expect(runModel("twin", cmds, newSeen(), undefined, true)).rejects.toThrow(
      /recovery: the store's record of 01960000-0000-7000-8000-000000000001/,
    );
    // And no reader is let in by it: the lax run passes every other check.
    await runModel("twin", [...cmds, new Read("sam", false)], newSeen());
  });

  // The deep run's first counterexample (ENGRAM_STATEFUL_RUNS=3000, seed
  // -19116893, path "1179:0:2:1:2:2", shrunk five times): [twin,
  // write(agent, 0), write(dana, 0, grant)]. Her agent writes a person item
  // (model content, allowed in person scope); Dana rewrites it with her own
  // words and a grant to Sam, and the gate allows it, as it allows her grant
  // change on it: the item's kind is now user. The oracle forbids grants on an
  // item that ever held untrusted content (grantChangeProblem), so the
  // dogfood report counts each as a violation. Pinned as it stands today.
  test("E14-F3: the owner grants an item that once held her agent's content; the plane allows it, the oracle counts a violation", async () => {
    const viaWrite = [
      new Write("agent", 0, false, false, false, "none"),
      new Write("dana", 0, true, false, false, "none"),
    ];
    const viaGrant = [
      new Write("agent", 0, false, false, false, "none"),
      new Write("dana", 0, false, false, false, "none"),
      new ChangeGrant(0, true, "sam", false),
    ];
    for (const cmds of [viaWrite, viaGrant]) {
      await expect(runModel("twin", cmds, newSeen(), undefined, true)).rejects.toThrow(
        /grants on an item that held untrusted content/,
      );
      // The grant is honoured: Sam reads Dana's words.
      const seen = newSeen();
      await runModel("twin", [...cmds, new Read("sam", false)], seen);
      expect(seen.grantedReads).toBe(1);
      expect(seen.heldUntrustedGrants).toBe(1);
    }
  });

  // The deep run's second counterexample (ENGRAM_STATEFUL_RUNS=4000, seed
  // -19116893, path "3410:3:2:9:9:8", shrunk five times): under the tight
  // budgets (one active semantic item in the role), a role write killed
  // before its commit leaves item 4's bytes; a write of item 5 with a grant
  // lands; a grant removal on item 5 is killed after its store write. The
  // first adoption records item 4 and its budget check evicts item 5, so the
  // listing of item 5 is stale and deferred (P50-7); the second adopts item
  // 5's narrowed record, which evicts item 4; the third appends nothing.
  // Pinned as it stands today: recovery converges, in two adoptions, not one.
  test("E14-F4: recovery after two crashed role writes under a budget of one needs a second adoption", async () => {
    const cmds = [
      new Write("dana", 3, false, false, false, "commit-before"),
      new Reopen(),
      new Write("dana", 4, true, false, false, "none"),
      new ChangeGrant(4, false, "sam", true),
    ];
    await expect(runModel("tight", cmds, newSeen(), undefined, true)).rejects.toThrow(
      /recovery: adoption pass 2 still appends/,
    );
    const seen = newSeen();
    await runModel("tight", cmds, seen);
    expect(seen.adoptionPasses).toBe(3);
  });

  /** The model must fail on a broken plane, and shrink the failure to a short sequence. */
  async function caught(broken: Breakage, name: string) {
    const out = await fc.check(
      fc.asyncProperty(arbRun, ([policy, cmds]) => runModel(policy, cmds, newSeen(), broken)),
      { numRuns: 200, seed: seedFor(name) },
    );
    expect(out.failed, `${name}: the model did not catch the broken plane`).toBe(true);
    // The commands of the shrunk counterexample that ran (fast-check's wrappers mark them).
    const cmds = (out.counterexample?.[0]?.[1] ?? []) as Iterable<{ hasRan?: boolean }>;
    return [...cmds].filter((c) => c.hasRan !== false).map(String);
  }

  test("vacuity: a plane whose read also hands back the owner's person items is caught, and the failure shrinks", async () => {
    const leaky: Breakage = (plane, deps) => ({
      ...plane,
      read: async (actor, query) => {
        const res = await plane.read(actor, query);
        const extra = currentItems(deps.db).filter(
          (i) =>
            i.scope === PERSON && i.status === "active" && !res.items.some((x) => x.id === i.id),
        );
        return { ...res, items: [...res.items, ...extra] };
      },
    });
    const shrunk = await caught(leaky, "vacuity: a leaky read");
    // Shrunk to a write into the person scope and a read by someone who is not its member.
    expect(shrunk.length, shrunk.join(" ")).toBeLessThanOrEqual(3);
    expect(shrunk.some((c) => c.startsWith("write(") || c.startsWith("promote("))).toBe(true);
    expect(shrunk.at(-1)).toMatch(/^read\((sam|lee)/);
  }, 120_000);

  test("vacuity: a plane whose agent writes into the role reach the store without the gate is caught", async () => {
    const bypass: Breakage = (plane, _deps, store) => ({
      ...plane,
      write: async (actor, it, at) => {
        if (actor.source === "model" && it.scope === ROLE) await store.write(it);
        return plane.write(actor, it, at);
      },
    });
    const shrunk = await caught(bypass, "vacuity: a gate bypass");
    expect(shrunk.length, shrunk.join(" ")).toBeLessThanOrEqual(2);
    expect(shrunk[0]).toMatch(/^write\(agent, [34]/);
  }, 120_000);
});
