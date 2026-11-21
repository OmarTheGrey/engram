// A stateful model-based test of the Plane (card E1.4). fast-check's command
// model (fc.commands, fc.asyncModelRun) generates sequences of every Plane
// operation two twins see, on the real Plane over one log and the fake store,
// with the injected clock: write (by Dana, by her agent with source model, by
// Lee, who holds the role with her and has a person scope of his own), read
// (by Dana, her agent, Lee, HR and Sam, a grantee), grant change (by an
// item's owner or a co-holder, RV7's rule), promote, retain, offboard
// (Dana's), adopt, handle reopen and clock advance. Every command that names
// an item draws it from the live projection when the command runs, so the
// sequence acts on items that exist. Writes, grant changes and offboardings
// may stop at a crash window (test/helpers/failpoint.ts): the handle dies
// there and only a reopen follows, as a restarted process.
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
// erasure was left open, then adoption of each scope until a pass appends
// nothing, after which the store holds no record the log never allowed.
// Guards require each default run to reach what the checks judge (allowed
// promotions, evictions, granted reads, allowed grant changes and more).
//
// A failure prints the seed, the path and the replay path, and fast-check's
// report with the shrunk command list. ENGRAM_STATEFUL_SEED,
// ENGRAM_STATEFUL_PATH and ENGRAM_STATEFUL_REPLAY replay it (the replay path
// is the `/*replayPath="..."*/` fast-check prints, which fc.commands needs
// to skip the same commands). ENGRAM_STATEFUL_RUNS sets the run count (a
// deep run: 2000); ENGRAM_STATEFUL_STRICT=1 judges the pinned gaps too;
// ENGRAM_STATEFUL_SEEN=1 prints what the runs met. The default keeps the file
// well under the 30 s timeout. A vacuity check runs the same model on two
// deliberately broken planes and requires it to catch both.
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
  UNTRUSTED_KINDS,
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
const LEES = "person:lee";
const ROLE = "role:release";
const SCOPES = [PERSON, ROLE, LEES] as const;

const DANA: Actor = {
  id: "person:dana",
  level: "person",
  memberships: [PERSON, ROLE],
  source: "user",
};
/** Dana's agent: her principal, with the harness's source model. */
const AGENT: Actor = { ...DANA, source: "model" };
/** Lee holds the role with Dana (a co-holder of her role items) and has his own person scope. */
const LEE: Actor = { id: "person:lee", level: "person", memberships: [LEES, ROLE], source: "user" };
/** HR reviews promotions in both person scopes and offboards Dana. */
const HR: Actor = {
  id: "person:hr",
  level: "person",
  memberships: ["person:hr", PERSON, ROLE, LEES],
  source: "user",
};
const SAM: Actor = { id: "person:sam", level: "person", memberships: ["person:sam"] };
const ACTORS = { dana: DANA, agent: AGENT, lee: LEE, hr: HR, sam: SAM } as const;
type Who = keyof typeof ACTORS;
/** The actors the dogfood report judges reads as, by id. */
const DECLARED = [DANA, HR, SAM, LEE];
const LEAVE: OffboardRequest = { person: PERSON, roles: [{ scope: ROLE, successor: LEE.id }] };
/** Who adopts each scope: its person, and Dana for the role. */
const ADOPTER: Record<string, Actor> = { [PERSON]: DANA, [ROLE]: DANA, [LEES]: LEE };

/** Ids for new items, per scope. */
const POOL: Record<string, string[]> = {
  [PERSON]: [1, 2, 3, 4].map((n) => itemId(n)),
  [ROLE]: [5, 6, 7].map((n) => itemId(n)),
  [LEES]: [8, 9].map((n) => itemId(n)),
};
function itemId(n: number) {
  return `01960000-0000-7000-8000-${String(n).padStart(12, "0")}`;
}
/** The scopes each writer writes new items into. */
const HOME: Record<"dana" | "agent" | "lee", readonly string[]> = {
  dana: [PERSON, ROLE],
  agent: [PERSON, ROLE],
  lee: [LEES, ROLE],
};

// ------------------------------------------------------------------ model and system

/** What a run saw, summed over every run, for the guards. */
interface Seen {
  commands: Record<string, number>;
  /** Denied events by op and rule, printed with ENGRAM_STATEFUL_SEEN for sizing the model. */
  refusals: Record<string, number>;
  crashes: number;
  reopens: number;
  erased: number;
  offboardReruns: number;
  grantedReads: number;
  grantChanges: number;
  coholderRefusals: number;
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
  /** Owners' items a co-holder's adoption retired over the owner's crashed bytes (E14-F6). */
  coholderRetractions: number;
}
const newSeen = (): Seen => ({
  commands: {},
  refusals: {},
  crashes: 0,
  reopens: 0,
  erased: 0,
  offboardReruns: 0,
  grantedReads: 0,
  grantChanges: 0,
  coholderRefusals: 0,
  adopted: 0,
  evicted: 0,
  promoted: 0,
  denied: 0,
  frozenRefusals: 0,
  storeGrantsLeft: 0,
  heldUntrustedGrants: 0,
  adoptionPasses: 0,
  coholderRetractions: 0,
});

/** The pinned gaps the main property relaxes; `strict` judges them too. */
type Gap = "F1" | "F3" | "F4" | "F6";
const GAPS: readonly Gap[] = ["F1", "F3", "F4", "F6"];
/** true for every gap, false for none, or the gaps to judge. */
type Strict = boolean | readonly Gap[];
const gapsOf = (strict: Strict): ReadonlySet<Gap> =>
  new Set(strict === true ? GAPS : strict === false ? [] : strict);
/** ENGRAM_STATEFUL_STRICT: 1 for every gap, or a list such as F1,F3. */
const strictFromEnv = (): Strict => {
  const v = env("ENGRAM_STATEFUL_STRICT");
  if (v === undefined || v === "" || v === "0") return false;
  if (v === "1") return true;
  return v.split(",").map((g) => g.trim()) as Gap[];
};

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
   * Judge the known gaps too. Off by default, each pinned by its own test
   * below: finding E14-F1 (a write or grant change that added a grant,
   * killed or failing after its store write, leaves that grant in the
   * store's record for good; adoption drops it from the projection only),
   * finding E14-F3 (the plane lets the owner grant an item that once held
   * her agent's content, which the oracle's replay counts as a violation)
   * finding E14-F4 (recovery may need a second adoption) and finding E14-F6
   * (after the owner's crashed rewrite of an item carrying grants, a
   * co-holder's adoption denies the record and retires the owner's item for
   * good).
   */
  strict: ReadonlySet<Gap>;
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

/** The live items, in id order, that `keep` admits: what a command names. */
function live(r: Real, keep: (i: MemoryItem) => boolean = () => true): MemoryItem[] {
  return currentItems(r.base).filter((i) => i.status !== "retired" && keep(i));
}
const nth = <T>(xs: readonly T[], k: number): T | undefined =>
  xs.length === 0 ? undefined : xs[k % xs.length];

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

/**
 * Whether an oracle detail is finding E14-F3 as pinned: a grant on an item
 * whose provenance was raised from an untrusted kind only by its owner's own
 * user-sourced write of that id (not an adoption, not anyone else's event),
 * or on a promotion's new version of such an item (the oracle carries the
 * taint along the promotion's lineage, as `priorVersion` does). Any other
 * route to the same message stays a violation.
 */
function ownersLaundering(log: readonly MemoryEvent[], detail: string): boolean {
  const m = /^\w+ event (\d+) .* on (\S+): grants on an item that held untrusted content$/.exec(
    detail,
  );
  if (!m) return false;
  const seq = Number(m[1]);
  const before = log.filter((e) => e.seq <= seq && e.decision === "allow" && e.item);
  // The item, and the sources its promotions were made from.
  const chain = new Set([m[2] as string]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const e of before)
      if (e.op === "promote" && chain.has(e.item?.id as string)) {
        const source = e.item?.lineage[0];
        if (source !== undefined && !chain.has(source)) {
          chain.add(source);
          grew = true;
        }
      }
  }
  const kinds = new Map<string, MemoryItem["provenance"]["kind"]>();
  const raisers: MemoryEvent[] = [];
  for (const e of before) {
    const id = e.item?.id as string;
    if (!chain.has(id)) continue;
    const was = kinds.get(id);
    const now = (e.item as MemoryItem).provenance.kind;
    if (was !== undefined && UNTRUSTED_KINDS.includes(was) && !UNTRUSTED_KINDS.includes(now))
      raisers.push(e);
    kinds.set(id, now);
  }
  return (
    raisers.length > 0 &&
    raisers.every(
      (r) =>
        r.op === "write" &&
        r.item?.provenance.kind === "user" &&
        r.actor === r.item.owner &&
        !r.reason.startsWith(ADOPTED),
    )
  );
}

/**
 * Finding E14-F6 as pinned: `held` is retired, and the last adoption of its
 * store record, by someone other than its owner, denied it under the owner
 * rule (only the owner rewrites an item carrying grants), followed by
 * nothing but adoption's retraction. The retraction is absent when the item
 * was retired already (an eviction), so the record stays denied either way.
 */
function retractedOverCoholder(log: readonly MemoryEvent[], held: MemoryItem): boolean {
  const mine = log.filter((e) => e.item_id === held.id && e.policy_id !== "engram/adopt/retract");
  const deny = mine.at(-1);
  return (
    held.status === "retired" &&
    deny?.decision === "deny" &&
    deny.policy_id === "engram/grant/owner" &&
    deny.reason.startsWith(ADOPTED) &&
    deny.actor !== held.owner
  );
}

/** Every check that holds after any command; `start` is the log's head before it. */
async function judge(m: Model, r: Real, what: string, start: number, frozen: boolean) {
  const log = allEvents(r.base);
  const fresh = log.filter((e) => e.seq > start);
  const at = (k: string) => `${what}: ${k}`;

  // Invariant 1 over every read in the log, and every grant change (the dogfood report's replay).
  const { details } = dogfoodReport(log, r.policy, DECLARED);
  const judged = m.strict.has("F3")
    ? details
    : details.filter((d) => !(d.endsWith(E14_F3) && ownersLaundering(log, d)));
  m.seen.heldUntrustedGrants = Math.max(m.seen.heldUntrustedGrants, details.length - judged.length);
  expect(
    judged,
    at(`the oracle's replay of the log finds a violation: ${judged.join("; ")}`),
  ).toEqual([]);

  // Invariant 3: every event the command appended has a reason and a policy id.
  for (const e of fresh) {
    expect(e.reason.length, at(`event ${e.seq} has a reason`)).toBeGreaterThan(0);
    expect(e.policy_id.length, at(`event ${e.seq} has a policy id`)).toBeGreaterThan(0);
    if (e.decision === "deny") {
      m.seen.denied++;
      const k = `${e.op} ${e.policy_id}`;
      m.seen.refusals[k] = (m.seen.refusals[k] ?? 0) + 1;
    }
    if (e.op === "evict" && e.decision === "allow") m.seen.evicted++;
    if (e.op === "promote" && e.decision === "allow") m.seen.promoted++;
    if (e.policy_id === "engram/grant/change" && e.decision === "allow") m.seen.grantChanges++;
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
  // until a crash, in no store record. Content any version of an item not
  // erased also held is not the erased item's alone (a promotion's copy,
  // rewritten since or not).
  const erased = erasedIds(log);
  for (const id of erased.keys())
    expect(itemById(r.base, id), at(`erased ${id} is projected`)).toBeUndefined();
  const surviving = JSON.stringify(
    log
      .filter((e) => e.decision === "allow" && e.item && !erased.has(e.item.id))
      .map((e) => e.item?.content),
  );
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
    const lax = m.crashed && !m.strict.has("F1");
    for (const held of items) {
      if (!held.store_ref) continue;
      if (m.crashed && !m.strict.has("F6") && retractedOverCoholder(log, held)) {
        m.seen.coholderRetractions++;
        continue;
      }
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
      const shown = (i: MemoryItem | undefined) =>
        lax && i ? { ...unsourced(i), grants: null } : unsourced(i);
      expect(shown(record), at(`the store's record of ${held.id}`)).toEqual(shown(held));
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

interface WriteArgs {
  who: "dana" | "agent" | "lee";
  /** A new item in one of the writer's home scopes, or a rewrite of a live item. */
  target: "new" | "live";
  /** Which home scope (new), and which item of the pool or of the live ones. */
  scope: number;
  pick: number;
  grant: boolean;
  episodic: boolean;
  /** Keep the item's content as it stands (the same words, saved again). */
  resave: boolean;
  /** Write the version the projection holds instead of the next one. */
  stale: boolean;
  crash: WriteCrash;
}

class Write extends Step {
  readonly name = "write";
  readonly a: WriteArgs;
  constructor(a: Partial<WriteArgs> & Pick<WriteArgs, "who">) {
    super();
    this.a = {
      target: "new",
      scope: 0,
      pick: 0,
      grant: false,
      episodic: false,
      resave: false,
      stale: false,
      crash: "none",
      ...a,
    };
  }
  async act(m: Model, r: Real) {
    const a = this.a;
    const actor = ACTORS[a.who];
    const target = a.target === "live" ? nth(live(r), a.pick) : undefined;
    const home = HOME[a.who][a.scope % HOME[a.who].length] as string;
    const id = target?.id ?? (nth(POOL[home] as string[], a.pick) as string);
    const held = itemById(r.base, id);
    const scope = held?.scope ?? home;
    const cls =
      held?.class ?? (a.episodic && scope.startsWith("person:") ? "episodic" : "semantic");
    let content = held?.content;
    if (!(a.resave && held)) {
      const token = `zq${++m.next}x`;
      m.tokens.set(id, (m.tokens.get(id) ?? new Set()).add(token));
      content = `${actor.id}'s note ${token}`;
    }
    const it = {
      id,
      class: cls,
      scope,
      owner: held?.owner ?? actor.id,
      content,
      provenance: { kind: "user", ref: "doc/1", hash: `sha256:${"0".repeat(64)}`, actor: actor.id },
      confidence: 0.9,
      // From the clock: a ttl counts from here (ADR 0025).
      valid_from: held?.valid_from ?? m.at,
      valid_to: null,
      ttl: null,
      grants: a.grant
        ? [{ to: SAM.id, class: cls, mode: "read", expires: UNTIL }]
        : (held?.grants ?? []),
      version: a.stale ? (held?.version ?? 1) : (held?.version ?? 0) + 1,
      lineage: [],
      status: "active",
      store_ref: null,
      schema_version: 1,
    } as MemoryItem;
    const retired = retiredByEvent(r.base);
    const start = logHead(r.base);
    armWrite(r.handle.fp, a.crash);
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
      if (held && held.owner !== actor.id && /grant|owner|move/.test(res.event.policy_id))
        m.seen.coholderRefusals++;
    }
  }
  toString() {
    const a = this.a;
    const where =
      a.target === "live" ? `live #${a.pick}` : `new ${HOME[a.who][a.scope % 2]} #${a.pick}`;
    const flags = [
      a.grant && "grant",
      a.episodic && "episodic",
      a.resave && "resave",
      a.stale && "stale",
      a.crash !== "none" && `crash ${a.crash}`,
    ].filter(Boolean);
    return `write(${a.who}, ${where}${flags.map((f) => `, ${f}`).join("")})`;
  }
}

class Read extends Step {
  readonly name = "read";
  readonly reader: Who;
  readonly text: boolean;
  constructor(reader: Who, text = false) {
    super();
    this.reader = reader;
    this.text = text;
  }
  async act(m: Model, r: Real) {
    const reader = ACTORS[this.reader];
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
  readonly who: "dana" | "lee";
  /** Name one of the grantor's own live items, or any live item (a co-holder's change). */
  readonly own: boolean;
  readonly pick: number;
  readonly add: boolean;
  /** The grantee: Sam, or the other of Dana and Lee. */
  readonly toSam: boolean;
  readonly crash: boolean;
  constructor(
    who: "dana" | "lee",
    own: boolean,
    pick: number,
    add: boolean,
    toSam = true,
    crash = false,
  ) {
    super();
    this.who = who;
    this.own = own;
    this.pick = pick;
    this.add = add;
    this.toSam = toSam;
    this.crash = crash;
  }
  async act(m: Model, r: Real) {
    const actor = ACTORS[this.who];
    // A removal names an item carrying a grant, when there is one.
    const named = live(r, (i) => i.status === "active" && (!this.own || i.owner === actor.id));
    const carrying = named.filter((i) => i.grants.length > 0);
    const held =
      nth(!this.add && carrying.length > 0 ? carrying : named, this.pick) ??
      itemById(r.base, POOL[PERSON]?.[0] as string);
    const id = held?.id ?? (POOL[PERSON]?.[0] as string);
    const grant: Grant = {
      to: this.toSam ? SAM.id : this.who === "dana" ? LEE.id : DANA.id,
      class: held?.class ?? "semantic",
      mode: "read",
      expires: UNTIL,
    };
    if (this.crash) r.handle.fp.arm("store.write:after", "crash");
    const res = await surviving(m, r, () =>
      r.handle.plane.changeGrants(
        actor,
        id,
        this.add ? { add: [grant] } : { remove: [held?.grants[0] ?? grant] },
        m.at,
      ),
    );
    if (res?.decision === "deny" && held && held.owner !== actor.id) m.seen.coholderRefusals++;
  }
  toString() {
    return `grant(${this.who}, ${this.own ? "own" : "any"} #${this.pick}, ${this.add ? "add" : "remove"} ${this.toSam ? "sam" : "other"}${this.crash ? ", crash store-after" : ""})`;
  }
}

class Promote extends Step {
  readonly name = "promote";
  readonly by: "hr" | "dana" | "lee";
  readonly pick: number;
  readonly widen: boolean;
  readonly review: boolean;
  constructor(by: "hr" | "dana" | "lee", pick: number, widen: boolean, review: boolean) {
    super();
    this.by = by;
    this.pick = pick;
    this.widen = widen;
    this.review = review;
  }
  async act(m: Model, r: Real) {
    const actor = ACTORS[this.by];
    // A promoter names an active item in a person scope it is a member of:
    // the role is the widest scope here, so only a person item has a promotion.
    const held = nth(
      live(
        r,
        (i) =>
          i.status === "active" &&
          i.scope.startsWith("person:") &&
          actor.memberships.includes(i.scope),
      ),
      this.pick,
    );
    const id = held?.id ?? (POOL[PERSON]?.[0] as string);
    // In place for an episodic item (to semantic), unless widened; a
    // semantic item has nothing to promote in place, so it is widened.
    const to = held?.class === "episodic" && !this.widen ? held.scope : ROLE;
    await r.handle.plane.promote(actor, id, to, m.at, { review: this.review });
  }
  toString() {
    return `promote(${this.by}, #${this.pick}${this.widen ? `, to ${ROLE}` : ""}${this.review ? ", review" : ""})`;
  }
}

class Retain extends Step {
  readonly name = "retain";
  readonly scope: number;
  readonly who: "dana" | "agent" | "lee";
  constructor(scope: number, who: "dana" | "agent" | "lee") {
    super();
    this.scope = scope;
    this.who = who;
  }
  async act(m: Model, r: Real) {
    await r.handle.plane.retain(ACTORS[this.who], SCOPES[this.scope] as string, m.at);
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
  /** For the role, which co-holder adopts it; a person scope is adopted by its person. */
  readonly byLee: boolean;
  constructor(scope: number, byLee = false) {
    super();
    this.scope = scope;
    this.byLee = byLee;
  }
  private adopter() {
    const scope = SCOPES[this.scope] as string;
    return scope === ROLE && this.byLee ? LEE : (ADOPTER[scope] as Actor);
  }
  async act(m: Model, r: Real) {
    await adoptStoreItems(r.handle.deps, this.adopter(), SCOPES[this.scope] as string, m.at);
  }
  toString() {
    return `adopt(${SCOPES[this.scope]}, by ${this.adopter().id})`;
  }
}

class Reopen extends Step {
  readonly name = "reopen";
  /** Reopen a live handle too; otherwise only after a crash (and skipped while alive). */
  readonly always: boolean;
  constructor(always = true) {
    super();
    this.always = always;
  }
  override check(m: Readonly<Model>) {
    return this.always || !m.alive;
  }
  async act(m: Model, r: Real) {
    r.handle = r.open();
    m.alive = true;
    m.seen.reopens++;
  }
  toString() {
    return this.always ? "reopen()" : "reopen(after crash)";
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

/** `values`, each with its weight. */
const weighted = <T>(...values: [T, number][]) =>
  fc.oneof(...values.map(([v, weight]) => ({ arbitrary: fc.constant(v), weight })));

const arbWrite = fc
  .record({
    who: weighted<"dana" | "agent" | "lee">(["dana", 4], ["agent", 2], ["lee", 2]),
    target: weighted<"new" | "live">(["new", 1], ["live", 1]),
    scope: fc.nat(1),
    pick: fc.nat(3),
    grant: weighted([false, 2], [true, 1]),
    episodic: weighted([false, 2], [true, 1]),
    resave: weighted([false, 5], [true, 1]),
    stale: weighted([false, 9], [true, 1]),
    crash: weighted<WriteCrash>(
      ["none", 24],
      ["store-after", 1],
      ["commit-before", 1],
      ["commit-after", 1],
    ),
  })
  .map((a) => new Write(a));

const arbCommand: fc.Arbitrary<Step> = fc.oneof(
  { arbitrary: arbWrite, weight: 8 },
  {
    arbitrary: fc
      .tuple(
        weighted<Who>(["sam", 4], ["dana", 3], ["lee", 2], ["agent", 1], ["hr", 1]),
        fc.boolean(),
      )
      .map(([w, t]) => new Read(w, t)),
    weight: 6,
  },
  {
    arbitrary: fc
      .tuple(
        weighted<"dana" | "lee">(["dana", 3], ["lee", 2]),
        weighted([true, 5], [false, 1]),
        fc.nat(3),
        weighted([true, 2], [false, 1]),
        weighted([true, 3], [false, 1]),
        weighted([false, 12], [true, 1]),
      )
      .map(([w, own, p, add, sam, c]) => new ChangeGrant(w, own, p, add, sam, c)),
    weight: 4,
  },
  {
    arbitrary: fc
      .tuple(
        weighted<"hr" | "dana" | "lee">(["hr", 4], ["dana", 1], ["lee", 1]),
        fc.nat(3),
        fc.boolean(),
        weighted([true, 3], [false, 1]),
      )
      .map(([by, p, w, rv]) => new Promote(by, p, w, rv)),
    weight: 4,
  },
  {
    arbitrary: fc
      .tuple(fc.nat(2), weighted<"dana" | "agent" | "lee">(["dana", 2], ["agent", 1], ["lee", 1]))
      .map(([s, w]) => new Retain(s, w)),
    weight: 2,
  },
  {
    arbitrary: weighted<OffboardCrash>(
      ["none", 3],
      ["mark", 1],
      ["handover", 1],
      ["delete", 1],
      ["erase", 1],
      ["report", 1],
    ).map((c) => new Offboard(c)),
    weight: 1,
  },
  {
    arbitrary: fc.tuple(fc.nat(2), fc.boolean()).map(([s, l]) => new Adopt(s, l)),
    weight: 2,
  },
  { arbitrary: fc.constant(new Reopen(false)), weight: 4 },
  { arbitrary: fc.constant(new Reopen(true)), weight: 1 },
  {
    arbitrary: weighted([1, 3], [3600, 3], [86_400, 2], [31 * 86_400, 1], [100 * 86_400, 1]).map(
      (s) => new Advance(s),
    ),
    weight: 2,
  },
);

/** The command lists; `replayPath` is fast-check's, printed with a counterexample. */
const arbCommands = (replayPath?: string) =>
  fc.commands([arbCommand], {
    maxCommands: MAX_COMMANDS,
    size: "max",
    ...(replayPath === undefined ? {} : { replayPath }),
  });

const arbRun = (replayPath?: string) =>
  fc.tuple(weighted<"twin" | "tight">(["twin", 1], ["tight", 2]), arbCommands(replayPath));

/**
 * One run: the commands, then recovery on a fresh handle. Recovery completes:
 * no erasure left open, adoption of each scope reaches a pass that appends
 * nothing, the store holds no record the log never allowed, and nothing
 * erased survives.
 */
async function runModel(
  policyName: "twin" | "tight",
  cmds: Iterable<fc.AsyncCommand<Model, Real>>,
  seen: Seen,
  broken?: Breakage,
  strict: Strict = false,
) {
  const policy = policyName === "twin" ? twin() : tight();
  const real = system(policy, broken);
  const model: Model = {
    alive: true,
    at: START,
    crashed: false,
    recovered: false,
    strict: gapsOf(strict),
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
  const limit = gapsOf(strict).has("F4") ? 2 : 3;
  let appended: string[] = [];
  let passes = 0;
  do {
    const mid = logHead(real.base);
    for (const scope of SCOPES)
      await adoptStoreItems(real.handle.deps, ADOPTER[scope] as Actor, scope, at);
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

type RunOut = fc.RunDetails<[["twin" | "tight", Iterable<fc.AsyncCommand<Model, Real>>]]>;

/** The commands of a counterexample that ran (fast-check's wrappers mark them). */
const ran = (out: RunOut) =>
  [...((out.counterexample?.[0]?.[1] ?? []) as Iterable<{ hasRan?: boolean }>)]
    .filter((c) => c.hasRan !== false)
    .map(String);

/** The three values that replay a failure: seed, path and fc.commands' replay path. */
function replayOf(out: RunOut) {
  const printed = String(out.counterexample?.[0]?.[1] ?? "");
  return {
    seed: out.seed,
    path: out.counterexamplePath ?? "",
    replayPath: /replayPath="([^"]*)"/.exec(printed)?.[1] ?? "",
  };
}

/** Runs the model as a property; on failure throws the replay values and fast-check's report. */
async function checkModel(
  options: {
    runs: number;
    seed: number;
    path?: string | undefined;
    replayPath?: string | undefined;
  },
  seen: Seen,
  broken?: Breakage,
  strict: Strict = false,
): Promise<RunOut> {
  const out = (await fc.check(
    fc.asyncProperty(arbRun(options.replayPath), ([policy, cmds]) =>
      runModel(policy, cmds, seen, broken, strict),
    ),
    {
      numRuns: options.runs,
      seed: options.seed,
      ...(options.path === undefined ? {} : { path: options.path, endOnFailure: true }),
    },
  )) as RunOut;
  return out;
}

const replayLine = (out: RunOut) => {
  const r = replayOf(out);
  return `replay with ENGRAM_STATEFUL_SEED=${r.seed} ENGRAM_STATEFUL_PATH=${r.path} ENGRAM_STATEFUL_REPLAY=${r.replayPath}`;
};

describe("the Plane as a state machine", () => {
  const NAME =
    "every sequence of Plane operations, crashes and reopens keeps the invariants after each step, and recovery completes";
  test(
    NAME,
    async () => {
      const seen = newSeen();
      const seed = env("ENGRAM_STATEFUL_SEED");
      const out = await checkModel(
        {
          runs: RUNS,
          seed: seed === undefined ? seedFor(NAME) : Number(seed),
          path: env("ENGRAM_STATEFUL_PATH"),
          replayPath: env("ENGRAM_STATEFUL_REPLAY"),
        },
        seen,
        undefined,
        strictFromEnv(),
      );
      if (out.failed)
        throw new Error(`${replayLine(out)}\n${fc.defaultReportMessage(out)}`, {
          cause: out.errorInstance,
        });
      if (env("ENGRAM_STATEFUL_SEEN")) process.stderr.write(`${JSON.stringify(seen)}\n`);
      // The guards hold for the default run only: a replay or a single path runs too little.
      if (env("ENGRAM_STATEFUL_PATH") !== undefined) return;
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
      const floor = Math.max(1, Math.floor((20 * RUNS) / 200));
      expect(
        kinds.every((k) => (seen.commands[k] ?? 0) > 0) &&
          seen.crashes > 0 &&
          seen.reopens > 0 &&
          seen.erased > 0 &&
          seen.offboardReruns > 0 &&
          seen.adopted > 0 &&
          seen.denied > 0 &&
          seen.frozenRefusals > 0 &&
          seen.coholderRefusals > 0 &&
          seen.promoted >= floor &&
          seen.evicted >= floor &&
          seen.grantedReads >= floor &&
          seen.grantChanges >= floor,
        `the model needs every command, crashes and reopens, erasures, offboardings run again, adoptions, denials, refusals in a frozen scope and of a co-holder, and at least ${floor} each of allowed promotions, evictions, granted reads and allowed grant changes; it saw ${JSON.stringify(seen)}`,
      ).toBe(true);
    },
    Math.max(120_000, RUNS * 200),
  );

  // The model's counterexample for this gap, today: ENGRAM_STATEFUL_STRICT=F1
  // at the default seed fails at ENGRAM_STATEFUL_SEED=-19116893
  // ENGRAM_STATEFUL_PATH=20:2:6:8:0:0:0:0
  // ENGRAM_STATEFUL_REPLAY=BABAEAEABJIAZAD:VVF, shrunk seven times, with
  // [tight, write(dana, new person:dana #0, grant, crash store-after)]; this
  // test runs that list and its sibling killed before the commit, the first
  // counterexample of the model before the review fix pass. Pinned as it
  // stands today; the main property judges the store's grants laxly after a
  // crash until it is resolved.
  test("E14-F1: a crashed first write carrying a grant, then recovery: the store's record keeps the grant the log never recorded", async () => {
    for (const crash of ["store-after", "commit-before"] as const) {
      const cmds = [new Write({ who: "dana", grant: true, crash })];
      await expect(runModel("tight", cmds, newSeen(), undefined, ["F1"]), crash).rejects.toThrow(
        /recovery: the store's record of 01960000-0000-7000-8000-000000000001/,
      );
      // And no reader is let in by it: the lax run passes every other check.
      await runModel("tight", [...cmds, new Reopen(false), new Read("sam")], newSeen());
    }
  });

  test("E14-F1 (the first counterexample of the earlier model): a write killed inside its commit", async () => {
    const cmds = [
      new Write({ who: "dana", grant: true, crash: "commit-before" }),
      new Reopen(false),
    ];
    await expect(runModel("twin", cmds, newSeen(), undefined, ["F1"])).rejects.toThrow(
      /recovery: the store's record of 01960000-0000-7000-8000-000000000001/,
    );
    // And no reader is let in by it: the lax run passes every other check.
    await runModel("twin", [...cmds, new Read("sam")], newSeen());
  });

  // The deep run's first counterexample before the review fix pass
  // (ENGRAM_STATEFUL_RUNS=3000, seed -19116893, path "1179:0:2:1:2:2"):
  // [twin, write(agent, 0), write(dana, 0, grant)]; today,
  // ENGRAM_STATEFUL_STRICT=F3 (or 1) fails first at ENGRAM_STATEFUL_PATH=
  // 12:2:1:1:1:1:5 ENGRAM_STATEFUL_REPLAY=LAAABBCAa:VF with [twin,
  // write(agent, new person:dana #3, episodic), write(dana, new
  // person:dana #3, grant, episodic)]. Her agent writes a person
  // item (model content, allowed in person scope); Dana rewrites it, or saves
  // the agent's very words again, as a user-sourced write, and the gate
  // allows a grant on it, in that write or in a grant change after: the
  // item's kind is now user. The oracle forbids grants on an item any allowed
  // version of which held untrusted content (grantChangeProblem; the lead's
  // decision of card E9.5, ADR 0021's RV4 amendment), so the dogfood report
  // counts each as a violation; Sam reads the agent's text verbatim in the
  // re-save. The main property filters only this route (ownersLaundering).
  test("E14-F3: the owner grants an item that once held her agent's content, its words changed or not; the plane allows it, the oracle counts a violation", async () => {
    const agentWrites = new Write({ who: "agent" });
    const cases: [string, Step[]][] = [
      [
        "a rewrite carrying the grant",
        [agentWrites, new Write({ who: "dana", target: "live", grant: true })],
      ],
      [
        "a rewrite, then a grant change",
        [
          agentWrites,
          new Write({ who: "dana", target: "live" }),
          new ChangeGrant("dana", true, 0, true),
        ],
      ],
      [
        "a rewrite, a promotion into the role, then a grant change on the new version",
        [
          agentWrites,
          new Write({ who: "dana", target: "live" }),
          new Promote("hr", 0, true, true),
          new ChangeGrant("dana", true, 0, true),
        ],
      ],
      [
        "the agent's words saved again, then a grant change",
        [
          agentWrites,
          new Write({ who: "dana", target: "live", resave: true }),
          new ChangeGrant("dana", true, 0, true),
        ],
      ],
    ];
    for (const [what, cmds] of cases) {
      await expect(runModel("twin", cmds, newSeen(), undefined, ["F3"]), what).rejects.toThrow(
        /grants on an item that held untrusted content/,
      );
      // The grant is honoured: Sam reads the item.
      const seen = newSeen();
      await runModel("twin", [...cmds, new Read("sam")], seen);
      expect(seen.grantedReads, what).toBe(1);
      expect(seen.heldUntrustedGrants, what).toBe(1);
    }
    // The re-save: what Sam reads is the agent's text, word for word.
    const real = system(twin());
    const m: Model = {
      alive: true,
      at: START,
      crashed: false,
      recovered: false,
      strict: new Set(),
      tokens: new Map(),
      next: 0,
      seen: newSeen(),
    };
    const resave = cases[3]?.[1] as Step[];
    await fc.asyncModelRun(() => ({ model: m, real }), resave);
    const agentText = allEvents(real.base).find((e) => e.op === "write")?.item?.content;
    const read = await real.handle.plane.read(SAM, { at: m.at });
    expect(read.items.map((i) => i.content)).toEqual([agentText]);
    expect(read.items[0]?.provenance.kind).toBe("user");
    real.base.close();
  });

  test("E14-F3's relaxation is narrow: a grant reached any other way still fails the model", () => {
    const log = (raiser: Partial<MemoryEvent>): MemoryEvent[] => {
      const base = {
        ts: START,
        item_id: itemId(1),
        scope_from: null,
        scope_to: PERSON,
        decision: "allow",
        schema_version: 1,
      };
      const item = (kind: MemoryItem["provenance"]["kind"]) =>
        ({
          id: itemId(1),
          owner: DANA.id,
          provenance: { kind },
        }) as MemoryItem;
      return [
        {
          ...base,
          id: "e0",
          seq: 0,
          op: "write",
          actor: DANA.id,
          reason: "x",
          policy_id: "p",
          item: item("model"),
        },
        {
          ...base,
          id: "e1",
          seq: 1,
          op: "write",
          actor: DANA.id,
          reason: "x",
          policy_id: "p",
          item: item("user"),
          ...raiser,
        },
      ] as MemoryEvent[];
    };
    const detail = `write event 1 at ${START} by person:dana (p) on ${itemId(1)}: ${E14_F3}`;
    expect(ownersLaundering(log({}), detail)).toBe(true);
    expect(ownersLaundering(log({ actor: LEE.id }), detail)).toBe(false);
    expect(ownersLaundering(log({ reason: `${ADOPTED}fake: x` }), detail)).toBe(false);
    expect(ownersLaundering(log({ op: "update" }), detail)).toBe(false);
    expect(
      ownersLaundering(
        log({
          item: { id: itemId(1), owner: DANA.id, provenance: { kind: "import" } } as MemoryItem,
        }),
        detail,
      ),
    ).toBe(false);
  });

  // Today ENGRAM_STATEFUL_STRICT=F4 (2,000 runs) fails first at
  // ENGRAM_STATEFUL_PATH=1448:4:14:14:19:17:15:16:16:16:17
  // ENGRAM_STATEFUL_REPLAY=CFHBDB/e:VD, a seven-command list with two
  // crashes. The deep run's second counterexample before the review fix pass
  // (ENGRAM_STATEFUL_RUNS=4000, seed -19116893, path "3410:3:2:9:9:8"): under
  // the tight budgets (one active semantic item in the role), a role write
  // killed before its commit leaves item 5's bytes; a write of item 6 with a
  // grant lands; a grant removal on item 6 is killed after its store write.
  // The first adoption records item 5 and its budget check evicts item 6, so
  // the listing of item 6 is stale and deferred (P50-7); the second adopts
  // item 6's narrowed record, which evicts item 5; the third appends
  // nothing. Pinned as it stands today: recovery converges, in two
  // adoptions, not one.
  test("E14-F4: recovery after two crashed role writes under a budget of one needs a second adoption", async () => {
    const cmds = [
      new Write({ who: "dana", scope: 1, crash: "commit-before" }),
      new Reopen(false),
      new Write({ who: "dana", scope: 1, pick: 1, grant: true }),
      new ChangeGrant("dana", true, 0, false, true, true),
    ];
    await expect(runModel("tight", cmds, newSeen(), undefined, ["F4"])).rejects.toThrow(
      /recovery: adoption pass 2 still appends/,
    );
    const seen = newSeen();
    await runModel("tight", cmds, seen);
    expect(seen.adoptionPasses).toBe(3);
  });

  // Found by the reworked model's first default run (seed -19116893, path
  // "179:2:1:4:4:4:4", replay path "JACACAa:VB", shrunk six times): [tight,
  // write(lee, new role:release #0), grant(lee, own #0, add sam),
  // write(lee, live #0, stale, crash commit-before)], then recovery, which
  // adopts the role as Dana. Lee's granted item is committed; his rewrite of
  // it is killed after its store write. Dana's adoption of the shared role
  // denies the record (engram/grant/owner: only the owner rewrites an item
  // carrying grants) and retracts Lee's committed item; Lee's own adoption
  // after it changes nothing. The item stays retired, Sam loses the read, and
  // the store keeps bytes the log denied. A grant removal works the same:
  // ENGRAM_STATEFUL_STRICT=F6 fails first at ENGRAM_STATEFUL_PATH=
  // 43:3:3:3:9:8:12:12:12 ENGRAM_STATEFUL_REPLAY=GLDADBCD/L:VN, where Lee's
  // removal of Sam's grant from the role item he was handed is killed after
  // its store write. And so does an owner's item evicted before the
  // adoption: the 2,000-run deep run of the fix pass fails at
  // ENGRAM_STATEFUL_PATH=1794:4:2:3:4:8:1:3:5:5:9:10:10:10:10
  // ENGRAM_STATEFUL_REPLAY=DARAEBCA//h:Vd, where Lee's killed rewrite of his
  // granted role item is followed by his write of another, whose budget check
  // evicts the first; Dana's adoption denies the crashed record and nothing
  // retracts or reconciles it. Pinned as it stands today.
  test("E14-F6: after the owner's crashed rewrite of a granted role item, a co-holder's adoption retires the owner's item for good", async () => {
    const cmds = [
      new Write({ who: "lee", scope: 1 }),
      new ChangeGrant("lee", true, 0, true),
      new Read("sam"),
      new Write({ who: "lee", target: "live", crash: "commit-before" }),
      new Reopen(false),
      new Adopt(1),
      new Adopt(1, true),
      new Read("sam"),
    ];
    await expect(runModel("twin", cmds, newSeen(), undefined, ["F6"])).rejects.toThrow(
      /recovery: the store's record of 01960000-0000-7000-8000-000000000005/,
    );
    const seen = newSeen();
    await runModel("twin", cmds, seen);
    expect(seen.grantedReads).toBe(1); // before the crash only
    expect(seen.coholderRetractions).toBeGreaterThan(0);
  });

  /** The model must fail on a broken plane, and shrink the failure to a short sequence. */
  async function caught(broken: Breakage, name: string) {
    const out = await checkModel({ runs: 200, seed: seedFor(name) }, newSeen(), broken);
    expect(out.failed, `${name}: the model did not catch the broken plane`).toBe(true);
    return { out, shrunk: ran(out) };
  }

  const leaky: Breakage = (plane, deps) => ({
    ...plane,
    read: async (actor, query) => {
      const res = await plane.read(actor, query);
      const extra = currentItems(deps.db).filter(
        (i) => i.scope === PERSON && i.status === "active" && !res.items.some((x) => x.id === i.id),
      );
      return { ...res, items: [...res.items, ...extra] };
    },
  });

  test("vacuity: a plane whose read also hands back the owner's person items is caught, and the failure shrinks and replays", async () => {
    const { out, shrunk } = await caught(leaky, "vacuity: a leaky read");
    // Shrunk to a write into the person scope and a read by someone who is not its member.
    expect(shrunk.length, shrunk.join(" ")).toBeLessThanOrEqual(3);
    expect(shrunk.some((c) => c.startsWith("write(") || c.startsWith("promote("))).toBe(true);
    expect(shrunk.at(-1)).toMatch(/^read\((sam|lee)/);
    // The printed seed, path and replay path give the same shrunk list back (review finding E1.4-1).
    const r = replayOf(out);
    expect(r.replayPath.length).toBeGreaterThan(0);
    const again = await checkModel(
      { runs: 1, seed: r.seed, path: r.path, replayPath: r.replayPath },
      newSeen(),
      leaky,
    );
    expect(again.failed, replayLine(out)).toBe(true);
    expect(ran(again)).toEqual(shrunk);
  }, 120_000);

  test("vacuity: a plane whose agent writes into the role reach the store without the gate is caught", async () => {
    const bypass: Breakage = (plane, _deps, store) => ({
      ...plane,
      write: async (actor, it, at) => {
        if (actor.source === "model" && it.scope === ROLE) await store.write(it);
        return plane.write(actor, it, at);
      },
    });
    const { shrunk } = await caught(bypass, "vacuity: a gate bypass");
    expect(shrunk.length, shrunk.join(" ")).toBeLessThanOrEqual(2);
    expect(
      shrunk.some((c) => c.startsWith("write(agent, ")),
      shrunk.join(" "),
    ).toBe(true);
  }, 120_000);
});
