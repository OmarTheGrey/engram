// Card E9.5's acceptance: the twin dogfood's violation report (src/dogfood.ts,
// scripts/dogfood-report.ts) on synthetic logs. One realistic two-week log,
// made by driving the real Plane under the twin profile over the files
// adapter on a copy of a Claude Code memory folder, shows reads, grants
// added and removed, denials by rule, and zero violations. Each planted log
// is that log with one forbidden event written straight into it
// (appendEvent, as a buggy plane or another writer would), and the report
// must find exactly that violation. The printed report holds no content, id
// or name (AGENTS.md rule 12).
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createFilesAdapter } from "@engram/adapters";
import { afterAll, describe, expect, test } from "vitest";
import type { Actor } from "../../src/actor.ts";
import type { Db } from "../../src/db/db.ts";
import { migrate } from "../../src/db/migrate.ts";
import { openSqlite } from "../../src/db/sqlite.ts";
import { dogfoodReport, ENGRAM_RULES, formatReport, printableRules } from "../../src/dogfood.ts";
import { allEvents, appendEvent } from "../../src/events.ts";
import { adoptStoreItems } from "../../src/plane/adopt.ts";
import { createPlane } from "../../src/plane.ts";
import { parsePolicy } from "../../src/policy/load.ts";
import type { Grant, MemoryEvent, MemoryItem, Policy } from "../../src/schema.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../../../..");
const FIXTURE = join(REPO, "fixtures/stores/claude-code-memory");
const PROFILE = join(REPO, "packages/pi-package/profiles/twin.yaml");
const SCRIPT = join(REPO, "packages/core/scripts/dogfood-report.ts");

/** Day `d` of the two weeks, at hour `h`. */
const day = (d: number, h = 9) =>
  `2026-11-${String(10 + d).padStart(2, "0")}T${String(h).padStart(2, "0")}:00:00Z`;

const DANA: Actor = {
  id: "person:dana",
  level: "person",
  memberships: ["person:dana"],
  source: "user",
};
/** Claude Code through `engram mcp`: the same principal, source model. */
const AGENT: Actor = { ...DANA, source: "model" };
/** A teammate's principal, read as on the member's own machine (the CLI's default actor). */
const SAM: Actor = { id: "person:sam", level: "person", memberships: ["person:sam"] };
const HOOK: Actor = { id: "agent:claude-code", level: "person", memberships: [] };

const ID = (n: number) => `01990000-0000-7000-8000-${String(n).padStart(12, "0")}`;
/** The items Dana writes through Engram, and the agent's. */
const FACT = ID(1);
const PLAN = ID(2);
const NOTE = ID(3);
const EPISODE = ID(4);
const EPISODE2 = ID(5);

const toSam = (expires: string): Grant => ({
  to: "person:sam",
  class: "semantic",
  mode: "read",
  expires,
});

/** Words planted in content and names, none of which the printed report may hold. */
const SECRETS = [
  "Lantern",
  "Mira",
  "Kestrel",
  "dana",
  "sam",
  "lee",
  "claude-code",
  "person:",
  "agent:",
  "01990000",
];

function newItem(id: string, content: string, over: Partial<MemoryItem> = {}): MemoryItem {
  return {
    id,
    class: "semantic",
    scope: "person:dana",
    owner: "person:dana",
    content,
    provenance: { kind: "user", ref: "cli", hash: `sha256:${"0".repeat(64)}`, actor: DANA.id },
    confidence: 0.9,
    valid_from: day(0, 8),
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

const dirs: string[] = [];
const dbs: Db[] = [];
afterAll(async () => {
  for (const db of dbs) db.close();
  for (const dir of dirs) await rm(dir, { recursive: true, force: true });
});

interface Twin {
  db: Db;
  dbPath: string;
  policy: Policy;
  plane: ReturnType<typeof createPlane>;
  /** The next free id for a planted event. */
  nextId: () => string;
}

/**
 * Dana's two weeks, as the procedure in docs/dogfood.md has a member live
 * them: her Claude Code memory folder adopted; items written as user through
 * the CLI and as model through MCP; a write the twin profile refuses; grants
 * added in the inspector to a teammate's principal, one by pattern, one
 * removed, one left to expire; refused grant changes (model content, a
 * Claude Code file, the agent asking, no expiry); reads by Dana and by the
 * teammate; and a bypass the hook blocked.
 */
async function twoWeeks(): Promise<Twin> {
  const dir = await mkdtemp(join(tmpdir(), "engram-dogfood-"));
  dirs.push(dir);
  const root = join(dir, "memory");
  await cp(FIXTURE, root, { recursive: true });
  const adapter = createFilesAdapter({ root, owner: "dana", importValidFrom: day(0, 7) });
  const dbPath = join(dir, "engram.db");
  const db = openSqlite(dbPath);
  dbs.push(db);
  migrate(db);
  let n = 0;
  const newId = () => `01990000-0000-7000-8000-${String(900_000 + ++n).padStart(12, "0")}`;
  const policy = parsePolicy(await readFile(PROFILE, "utf8"), "twin.yaml");
  const deps = { db, adapter, policy, newId };
  const plane = createPlane(deps);
  const ok = (e: MemoryEvent) => expect(e.decision, e.reason).toBe("allow");
  const no = (e: MemoryEvent) => expect(e.decision, e.reason).toBe("deny");
  const read = async (actor: Actor, at: string) => {
    await adoptStoreItems(deps, DANA, "person:dana", at);
    return (await plane.read(actor, { at })).items.map((i) => i.id);
  };

  // Day 0: the folder adopted, Dana's own items and the agent's.
  expect((await adoptStoreItems(deps, DANA, "person:dana", day(0, 8))).allowed).toBe(4);
  const claudeFile = (await read(DANA, day(0, 8)))[0] as string;
  ok((await plane.write(DANA, newItem(FACT, "Mira visits in December."), day(0, 10))).event);
  ok((await plane.write(DANA, newItem(PLAN, "The Kestrel plan ships in Q1."), day(0, 11))).event);
  ok((await plane.write(DANA, newItem(NOTE, "Prefers short standups."), day(0, 12))).event);
  const episode = (id: string) =>
    newItem(id, "Debugged the Lantern deploy with Dana.", {
      class: "episodic",
      provenance: { kind: "model", ref: "mcp", hash: `sha256:${"0".repeat(64)}`, actor: DANA.id },
    });
  ok((await plane.write(AGENT, episode(EPISODE), day(0, 13))).event);
  // Model content carries no grants (ADR 0021, D4).
  const toSamEpisodic = (expires: string): Grant => ({ ...toSam(expires), class: "episodic" });
  no(
    (await plane.changeGrants(DANA, EPISODE, { add: [toSamEpisodic(day(12))] }, day(0, 14))).event,
  );
  ok((await plane.write(AGENT, episode(EPISODE2), day(1, 13))).event);
  // The agent may not put model content in a role scope.
  no(
    (
      await plane.write(
        { ...AGENT, memberships: ["person:dana", "role:oncall"] },
        newItem(ID(6), "Paged twice.", { scope: "role:oncall" }),
        day(1, 14),
      )
    ).event,
  );
  expect(await read(DANA, day(1, 15))).toHaveLength(9);

  // Day 2: grants in the inspector; the refusals the procedure warns about.
  ok((await plane.changeGrants(DANA, FACT, { add: [toSam(day(12))] }, day(2))).event);
  no((await plane.changeGrants(DANA, claudeFile, { add: [toSam(day(12))] }, day(2, 10))).event);
  no((await plane.changeGrants(AGENT, NOTE, { add: [toSam(day(12))] }, day(2, 11))).event);
  no(
    (
      await plane.changeGrants(
        DANA,
        NOTE,
        { add: [{ to: "person:sam", class: "semantic", mode: "read" }] },
        day(2, 12),
      )
    ).event,
  );
  // The agent's items stay model through every adoption (card RV4; before
  // it, the re-adoption on day 1 raised them to import), so a grant on one
  // is refused (see "the same grant through the real plane").
  expect(await read(SAM, day(2, 13))).toEqual([FACT]);

  // Day 4: a pattern grant on the plan, lasting to day 9.
  ok(
    (
      await plane.changeGrants(
        DANA,
        PLAN,
        { add: [{ ...toSam(day(9)), to: "person:sa*" }] },
        day(4),
      )
    ).event,
  );
  expect((await read(SAM, day(4, 10))).sort()).toEqual([FACT, PLAN]);

  // Day 7: the fact's grant removed; day 10: the plan's grant has expired.
  ok((await plane.changeGrants(DANA, FACT, { remove: [toSam(day(12))] }, day(7))).event);
  expect(await read(SAM, day(7, 10))).toEqual([PLAN]);
  expect(await read(SAM, day(10))).toEqual([]);

  // Day 11: a bypass the Claude Code hook blocked, and Dana reads on.
  await plane.recordBypass(
    HOOK,
    { command: `cat ${root}/user_role.md`, store: "files", route: "command" },
    day(11),
  );
  expect(await read(DANA, day(12))).toHaveLength(9);
  expect(await read(DANA, day(13))).toHaveLength(9);

  return { db, dbPath, policy, plane, nextId: () => newId() };
}

const report = (t: Twin) => dogfoodReport(allEvents(t.db), t.policy, [DANA]);

/** An allowed event written straight into the log, as the plane never would. */
function plant(t: Twin, e: Partial<MemoryEvent>): void {
  appendEvent(t.db, {
    id: t.nextId(),
    ts: day(13, 12),
    op: "read",
    item_id: null,
    actor: SAM.id,
    scope_from: null,
    scope_to: null,
    decision: "allow",
    reason: "planted",
    policy_id: "profile.twin/read/person",
    schema_version: 1,
    ...e,
  });
}

function itemOf(t: Twin, id: string): MemoryItem {
  const last = allEvents(t.db)
    .filter((e) => e.decision === "allow" && e.item?.id === id)
    .at(-1);
  return last?.item as MemoryItem;
}

describe("an export is no read (card E9.8, finding E9.8-9)", () => {
  test("Plane.export's event is not counted among reads.events, and judges no item", async () => {
    const t = await twoWeeks();
    const before = report(t).report;
    const { event } = await t.plane.export(DANA, day(13, 13));
    expect(event.op).toBe("read");
    expect(event.reason.startsWith("exported ")).toBe(true);
    const { report: r, details } = report(t);
    expect(r.reads.events).toBe(before.reads.events);
    expect(r.reads.as_declared).toBe(before.reads.as_declared);
    expect(r.reads.items_returned).toBe(before.reads.items_returned);
    expect(r.violations.total).toBe(0);
    expect(details).toEqual([]);
    // The event itself is still in the log's count of events.
    expect(r.events).toBe(before.events + 1);
  });
});

describe("the violation report on a realistic two weeks", () => {
  test("reads, writes, grants added and removed, denials by rule, and zero violations", async () => {
    const t = await twoWeeks();
    const { report: r, details } = report(t);
    expect(r.violations).toEqual({ grant_change: 0, read: 0, total: 0 });
    expect(details).toEqual([]);
    expect(r.reads.events).toBe(8);
    expect(r.reads.as_declared).toBe(4);
    expect(r.reads.as_others).toBe(4);
    // Day 0: the 4 Claude Code files; days 1, 12 and 13: those and Dana's 5;
    // the teammate: 1, 2, 1 and none, every one through a grant.
    expect(r.reads.items_returned).toBe(4 + 9 + 1 + 2 + 1 + 0 + 9 + 9);
    expect(r.reads.items_via_grant).toBe(4);
    expect(r.grants).toEqual({ added: 2, changes: 3, removed: 1 });
    // 4 files adopted, Dana's 3 and the agent's 2; adoption leaves a record
    // the plane wrote as it holds it, so none is adopted again (card RV4).
    expect(r.writes).toEqual({ allowed: 4 + 5, denied: 1 });
    // Adoption never raises trust (card RV4): the agent's items stay model.
    expect(r.watch).toEqual({ narrowed: 0, provenance_raised: 0 });
    expect(r.declared).toEqual({
      level: "person",
      memberships_by_level: { org: 0, person: 1, role: 0, team: 0 },
      own_scope_only: true,
    });
    expect(r.bypass_blocked).toBe(1);
    expect(r.denials).toEqual({
      "engram/bypass/store-command": 1,
      "engram/grant/source": 1,
      "engram/write/grant": 2,
      "engram/write/store-failure": 1,
      "profile.twin/write/role": 1,
    });
    expect(r.by_op.update).toEqual({ allow: 3, deny: 4 });
    expect(r.days_with_events).toBe(9);
    expect(r.span_days).toBe(13);
  });

  test("the printed report holds no content, id or name, only counts and fixed keys", async () => {
    const t = await twoWeeks();
    const text = formatReport(report(t).report);
    for (const s of SECRETS) expect(text.toLowerCase()).not.toContain(s.toLowerCase());
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    const keys = (v: unknown, path: string): string[] =>
      v !== null && typeof v === "object"
        ? Object.entries(v).flatMap(([k, x]) => [`${path}${k}`, ...keys(x, `${path}${k}.`)])
        : [];
    const parsed = JSON.parse(text) as Record<string, unknown>;
    for (const k of keys(parsed, "")) expect(k).toMatch(/^[a-z][a-z0-9_]*(\.[a-z0-9_./-]+)*$/);
    // Every leaf is a count, except the declared level, the policy's hash and the format tag.
    const leaves = (v: unknown): unknown[] =>
      v !== null && typeof v === "object" ? Object.values(v).flatMap(leaves) : [v];
    const strings = leaves(parsed).filter((x) => typeof x !== "number");
    expect(strings).toEqual([
      "person",
      true,
      expect.stringMatching(/^[0-9a-f]{64}$/),
      "engram-dogfood-report/2",
    ]);
    // Byte-stable: the same log prints the same bytes.
    expect(formatReport(report(t).report)).toBe(text);
  });

  test("a rule id outside the fixed list is counted as other", async () => {
    const t = await twoWeeks();
    plant(t, {
      op: "write",
      decision: "deny",
      item_id: ID(7),
      actor: DANA.id,
      policy_id: "omar.private/write/person",
    });
    const { report: r } = report(t);
    expect(r.denials.other).toBe(1);
    expect(formatReport(r)).not.toContain("omar");
  });
});

describe("the report finds each planted violation", () => {
  test("a read returning an item its reader has no scope or grant for", async () => {
    const t = await twoWeeks();
    plant(t, { item_ids: [NOTE] });
    const { report: r, details } = report(t);
    expect(r.violations).toEqual({ grant_change: 0, read: 1, total: 1 });
    expect(details).toHaveLength(1);
    expect(details[0]).toContain(NOTE);
  });

  test("a read returning an item after its grant was removed", async () => {
    const t = await twoWeeks();
    plant(t, { ts: day(8), item_ids: [FACT] });
    expect(report(t).report.violations).toEqual({ grant_change: 0, read: 1, total: 1 });
  });

  test("a read returning an item after its grant expired", async () => {
    const t = await twoWeeks();
    plant(t, { ts: day(9), item_ids: [PLAN] });
    expect(report(t).report.violations).toEqual({ grant_change: 0, read: 1, total: 1 });
  });

  test("a read returning a retired item, or one no allowed event left", async () => {
    const t = await twoWeeks();
    plant(t, {
      op: "retire",
      item_id: NOTE,
      actor: DANA.id,
      scope_from: "person:dana",
      reason: "planted retirement",
      policy_id: "engram/retention/item-ttl",
    });
    plant(t, { actor: DANA.id, item_ids: [NOTE, ID(99)] });
    expect(report(t).report.violations).toEqual({ grant_change: 0, read: 2, total: 2 });
  });

  test("a read by the declared member, judged under the memberships it declares", async () => {
    const t = await twoWeeks();
    plant(t, { actor: DANA.id, item_ids: [FACT] });
    expect(report(t).report.violations.total).toBe(0);
    const narrow: Actor = { ...DANA, memberships: [] };
    expect(
      dogfoodReport(allEvents(t.db), t.policy, [narrow]).report.violations.read,
    ).toBeGreaterThan(0);
  });

  test("a grant change event by someone other than the owner", async () => {
    const t = await twoWeeks();
    const note = itemOf(t, NOTE);
    plant(t, {
      op: "update",
      item_id: NOTE,
      actor: SAM.id,
      scope_from: "person:dana",
      scope_to: "person:dana",
      policy_id: "engram/grant/change",
      item: { ...note, version: note.version + 1, grants: [toSam(day(20))] },
    });
    expect(report(t).report.violations).toEqual({ grant_change: 1, read: 0, total: 1 });
  });

  test("a grant-changing write by the owner as model", async () => {
    const t = await twoWeeks();
    const note = itemOf(t, NOTE);
    plant(t, {
      op: "write",
      item_id: NOTE,
      actor: DANA.id,
      scope_from: "person:dana",
      scope_to: "person:dana",
      policy_id: "profile.twin/write/person",
      item: {
        ...note,
        version: note.version + 1,
        grants: [toSam(day(20))],
        provenance: { ...note.provenance, kind: "model" },
      },
    });
    expect(report(t).report.violations).toEqual({ grant_change: 1, read: 0, total: 1 });
  });

  test("a grant-changing write by another member, user-sourced", async () => {
    const t = await twoWeeks();
    const plan = itemOf(t, PLAN);
    plant(t, {
      op: "write",
      item_id: PLAN,
      actor: "person:lee",
      scope_from: "person:dana",
      scope_to: "person:dana",
      policy_id: "profile.twin/write/person",
      item: { ...plan, version: plan.version + 1, grants: [] },
    });
    expect(report(t).report.violations).toEqual({ grant_change: 1, read: 0, total: 1 });
  });

  test("a class change of an item carrying grants, by an update that is not a grant change", async () => {
    const t = await twoWeeks();
    const plan = itemOf(t, PLAN);
    plant(t, {
      op: "update",
      item_id: PLAN,
      actor: DANA.id,
      scope_from: "person:dana",
      scope_to: "person:dana",
      policy_id: "engram/offboard/handover",
      item: { ...plan, version: plan.version + 1, class: "episodic" },
    });
    expect(report(t).report.violations).toEqual({ grant_change: 1, read: 0, total: 1 });
  });

  test("an owner's grant change event is not a violation, and a denied one changes nothing", async () => {
    const t = await twoWeeks();
    const note = itemOf(t, NOTE);
    const changed = { ...note, version: note.version + 1, grants: [toSam(day(20))] };
    const base = {
      op: "update" as const,
      item_id: NOTE,
      actor: DANA.id,
      scope_from: "person:dana",
      scope_to: "person:dana",
      policy_id: "engram/grant/change",
    };
    plant(t, { ...base, item: changed });
    plant(t, { ...base, actor: SAM.id, decision: "deny", policy_id: "engram/grant/owner" });
    const { report: r } = report(t);
    expect(r.violations.total).toBe(0);
    expect(r.grants).toEqual({ added: 3, changes: 4, removed: 1 });
  });
});

// The review fix pass of PR #48 (findings E95-1 to E95-12): each of the
// reviewer's plants, as a test with the count it must give.
const sam = (over: Partial<Grant> = {}): Grant => ({ ...toSam(day(20)), ...over });
/** An owner's grant change written straight into the log, whatever the plane would decide. */
function ownerGrant(t: Twin, id: string, grants: Grant[], ts = day(13, 11)): void {
  const it = itemOf(t, id);
  plant(t, {
    ts,
    op: "update",
    item_id: id,
    actor: DANA.id,
    scope_from: it.scope,
    scope_to: it.scope,
    policy_id: "engram/grant/change",
    item: { ...it, version: it.version + 1, grants },
  });
}
/** An allowed write of `item`, as Dana unless the caller says otherwise. */
const written = (item: MemoryItem): Partial<MemoryEvent> => ({
  ts: day(12),
  op: "write",
  item_id: item.id,
  actor: DANA.id,
  scope_to: item.scope,
  policy_id: "profile.twin/write/person",
  item,
});
const modelItem = (id: string, over: Partial<MemoryItem> = {}) =>
  newItem(id, "an agent's note", {
    provenance: { kind: "model", ref: "mcp", hash: `sha256:${"0".repeat(64)}`, actor: DANA.id },
    ...over,
  });
const violations = (t: Twin) => report(t).report.violations;

describe("review fix pass: what a grant change adds (E95-1, E95-3, E95-6)", () => {
  test.each([
    ["a pattern for every person", "person:*"],
    ["everyone", "*"],
  ])("an owner's grant to %s", async (_, to) => {
    const t = await twoWeeks();
    ownerGrant(t, NOTE, [sam({ to })]);
    plant(t, { actor: "person:eve", item_ids: [NOTE] });
    expect(violations(t)).toEqual({ grant_change: 1, read: 0, total: 1 });
  });

  test("an owner's prefixed pattern is allowed, and admits only whom it covers", async () => {
    const t = await twoWeeks();
    ownerGrant(t, NOTE, [sam({ to: "person:s*" })]);
    plant(t, { actor: "person:sue", item_ids: [NOTE] });
    plant(t, { actor: "person:eve", item_ids: [NOTE] });
    expect(violations(t)).toEqual({ grant_change: 0, read: 1, total: 1 });
  });

  test("an owner's grant with no class and no expiry", async () => {
    const t = await twoWeeks();
    ownerGrant(t, NOTE, [{ to: "person:sam", mode: "read" } as Grant]);
    plant(t, { item_ids: [NOTE] });
    expect(violations(t)).toEqual({ grant_change: 1, read: 0, total: 1 });
  });

  test("an owner's grant of another class, and the read it does not admit", async () => {
    const t = await twoWeeks();
    ownerGrant(t, NOTE, [sam({ class: "episodic" })]);
    plant(t, { item_ids: [NOTE] });
    expect(violations(t)).toEqual({ grant_change: 1, read: 1, total: 2 });
  });

  test("an owner's grant on the agent's item", async () => {
    const t = await twoWeeks();
    expect(itemOf(t, EPISODE).provenance.kind).toBe("model");
    ownerGrant(t, EPISODE, [sam({ class: "episodic" })]);
    plant(t, { item_ids: [EPISODE] });
    expect(violations(t)).toEqual({ grant_change: 1, read: 0, total: 1 });
  });

  test("an owner's grant on an item whose provenance a planted event raised", async () => {
    const t = await twoWeeks();
    const it = itemOf(t, EPISODE);
    plant(t, {
      ...written({
        ...it,
        version: it.version + 1,
        provenance: { ...it.provenance, kind: "import" },
      }),
      ts: day(13, 10),
    });
    expect(report(t).report.watch.provenance_raised).toBe(1);
    ownerGrant(t, EPISODE, [sam({ class: "episodic" })]);
    plant(t, { item_ids: [EPISODE] });
    expect(violations(t)).toEqual({ grant_change: 1, read: 0, total: 1 });
  });

  test("the same grant through the real plane, which refuses it since adoption keeps model (E95-6, card RV4)", async () => {
    const t = await twoWeeks();
    const { event } = await t.plane.changeGrants(
      DANA,
      EPISODE2,
      { add: [sam({ class: "episodic" })] },
      day(13, 11),
    );
    expect(event).toMatchObject({ decision: "deny", policy_id: "engram/write/grant" });
    expect(violations(t)).toEqual({ grant_change: 0, read: 0, total: 0 });
  });

  test("an owner's grant on content still recorded as model", async () => {
    const t = await twoWeeks();
    plant(t, written(modelItem(ID(54))));
    ownerGrant(t, ID(54), [sam()]);
    plant(t, { item_ids: [ID(54)] });
    const { report: r } = report(t);
    expect(r.violations).toEqual({ grant_change: 1, read: 0, total: 1 });
  });

  test("a first write of model content carrying a grant", async () => {
    const t = await twoWeeks();
    plant(t, written(modelItem(ID(53), { grants: [sam()] })));
    expect(violations(t)).toEqual({ grant_change: 1, read: 0, total: 1 });
  });

  test("a grant change on a retired item, carrying it back as active", async () => {
    const t = await twoWeeks();
    const fact = itemOf(t, FACT);
    plant(t, {
      op: "retire",
      item_id: FACT,
      actor: DANA.id,
      scope_from: "person:dana",
      policy_id: "engram/retention/item-ttl",
    });
    plant(t, {
      op: "update",
      item_id: FACT,
      actor: DANA.id,
      scope_from: "person:dana",
      scope_to: "person:dana",
      policy_id: "engram/grant/change",
      item: { ...fact, version: fact.version + 2, grants: [sam()] },
    });
    expect(report(t).details.join("\n")).toMatch(/retired item/);
    expect(violations(t).grant_change).toBe(1);
  });

  test("a grant change that also changes the content", async () => {
    const t = await twoWeeks();
    const note = itemOf(t, NOTE);
    plant(t, {
      op: "update",
      item_id: NOTE,
      actor: DANA.id,
      scope_from: "person:dana",
      scope_to: "person:dana",
      policy_id: "engram/grant/change",
      item: {
        ...note,
        version: note.version + 1,
        grants: [sam()],
        content: "rewritten",
      } as MemoryItem,
    });
    expect(violations(t).grant_change).toBe(1);
  });

  test("a first write by a non-member naming itself the owner and granting itself", async () => {
    const t = await twoWeeks();
    const it = newItem(ID(70), "x", { owner: "person:sam", grants: [sam()] });
    plant(t, { ...written(it), actor: "person:sam" });
    plant(t, { item_ids: [ID(70)] });
    expect(violations(t)).toEqual({ grant_change: 1, read: 0, total: 1 });
  });

  test("a known blind spot: the owner's agent posting a grant change looks like the owner (E95-13)", async () => {
    const t = await twoWeeks();
    ownerGrant(t, NOTE, [sam()]);
    expect(violations(t).total).toBe(0);
  });
});

describe("review fix pass: a removed grant comes back (E95-4)", () => {
  const base = { actor: DANA.id, scope_from: "person:dana", scope_to: "person:dana" };
  test("by a promotion, or a handover: a violation", async () => {
    let t = await twoWeeks();
    let fact = itemOf(t, FACT);
    plant(t, {
      ...base,
      op: "promote",
      item_id: ID(60),
      policy_id: "profile.twin/promotion/review",
      item: { ...fact, id: ID(60), lineage: [FACT], grants: [sam()] },
    });
    expect(violations(t).grant_change).toBe(1);
    t = await twoWeeks();
    fact = itemOf(t, FACT);
    plant(t, {
      ...base,
      item_id: FACT,
      op: "update",
      policy_id: "engram/offboard/handover",
      item: { ...fact, version: fact.version + 1, grants: [sam()] },
    });
    expect(violations(t).grant_change).toBe(1);
  });

  test("by the owner's own import-sourced rewrite: permitted (ADR 0034, decision 6)", async () => {
    const t = await twoWeeks();
    const fact = itemOf(t, FACT);
    plant(t, {
      ...base,
      item_id: FACT,
      op: "write",
      policy_id: "profile.twin/write/person",
      item: {
        ...fact,
        version: fact.version + 1,
        grants: [sam()],
        provenance: { ...fact.provenance, kind: "import" },
      },
    });
    expect(violations(t).total).toBe(0);
  });
});

describe("review fix pass: reads outside the validity window or past the ttl (E95-2)", () => {
  test.each([
    ["past its ttl", { ttl: 3600, valid_from: day(12) }],
    ["after its valid_to", { valid_from: day(0), valid_to: day(3) }],
    ["before its valid_from", { valid_from: "2027-06-01T00:00:00Z" }],
  ])("a read of an item %s", async (_, over) => {
    const t = await twoWeeks();
    plant(t, written(newItem(ID(50), "x", over as Partial<MemoryItem>)));
    plant(t, { actor: DANA.id, item_ids: [ID(50)] });
    expect(violations(t)).toEqual({ grant_change: 0, read: 1, total: 1 });
  });
});

describe("review fix pass: the real plane's promotions, retention and offboarding (E95-4)", () => {
  test("a reviewer's promotion carrying a grant its class switches off is no violation", async () => {
    const dir = await mkdtemp(join(tmpdir(), "engram-dogfood-"));
    dirs.push(dir);
    const root = join(dir, "memory");
    await cp(FIXTURE, root, { recursive: true });
    const adapter = createFilesAdapter({ root, owner: "dana", importValidFrom: day(0, 7) });
    const db = openSqlite(join(dir, "e.db"));
    dbs.push(db);
    migrate(db);
    let n = 0;
    const newId = () => `01990000-0000-7000-8000-${String(800_000 + ++n).padStart(12, "0")}`;
    const policy = parsePolicy(await readFile(PROFILE, "utf8"), "twin.yaml");
    const deps = { db, adapter, policy, newId };
    const plane = createPlane(deps);
    const ROLEU: Actor = { ...DANA, memberships: ["person:dana", "role:oncall"] };
    const LEE: Actor = {
      id: "person:lee",
      level: "person",
      memberships: ["person:dana", "role:oncall"],
      source: "user",
    };
    const ADMIN: Actor = {
      id: "person:admin",
      level: "org",
      memberships: ["org", "person:dana", "role:oncall"],
      source: "user",
    };
    const allow = (e: MemoryEvent | null | undefined) =>
      expect(e?.decision, e?.reason).toBe("allow");
    await adoptStoreItems(deps, DANA, "person:dana", day(0, 8));
    allow(
      (await plane.write(DANA, newItem(ID(80), "ep one", { class: "episodic" }), day(1))).event,
    );
    allow(
      (
        await plane.changeGrants(
          DANA,
          ID(80),
          { add: [sam({ class: "episodic", expires: day(12) })] },
          day(1, 10),
        )
      ).event,
    );
    await adoptStoreItems(deps, DANA, "person:dana", day(1, 11));
    const promoted = await plane.promote(LEE, ID(80), "person:dana", day(1, 12), { review: true });
    allow(promoted.event);
    expect(promoted.item?.class).toBe("semantic");
    // Card RV7 (review finding RV7-R1 of PR #61): a new version Lee, not the
    // owner, makes carries none of Dana's grants; before, it kept the dormant one.
    expect(promoted.item?.grants).toEqual([]);
    allow((await plane.write(DANA, newItem(ID(81), "sem one"), day(2))).event);
    allow(
      (await plane.changeGrants(DANA, ID(81), { add: [sam({ expires: day(12) })] }, day(2, 10)))
        .event,
    );
    allow(
      (await plane.write(ROLEU, newItem(ID(82), "role fact", { scope: "role:oncall" }), day(3)))
        .event,
    );
    allow(
      (await plane.changeGrants(ROLEU, ID(82), { add: [sam({ expires: day(12) })] }, day(3, 10)))
        .event,
    );
    await plane.retain(DANA, "person:dana", day(5));
    await adoptStoreItems(deps, DANA, "person:dana", day(5, 10));
    for (const [a, h] of [
      [DANA, 11],
      [SAM, 12],
      [ROLEU, 13],
      [LEE, 14],
    ] as const)
      await plane.read(a, { at: day(5, h) });
    const { offboard } = await import("../../src/plane.ts");
    await offboard(
      deps,
      ADMIN,
      { person: "person:dana", roles: [{ scope: "role:oncall", successor: "person:lee" }] },
      day(6),
    );
    await plane.read(LEE, { at: day(6, 10) });
    await plane.read(SAM, { at: day(6, 11) });
    const res = dogfoodReport(allEvents(db), policy, [DANA, ROLEU, LEE, ADMIN]);
    expect(res.details).toEqual([]);
    expect(res.report.violations.total).toBe(0);
    expect(res.report.watch.narrowed).toBeGreaterThanOrEqual(1);
  });
});

describe("review fix pass: the declared actor's shape (E95-5)", () => {
  test("wider flags hide a read violation, and the report shows that they were wider", async () => {
    const t = await twoWeeks();
    plant(t, written(newItem(ID(90), "secret", { scope: "role:secret" })));
    plant(t, { actor: DANA.id, item_ids: [ID(90)] });
    expect(report(t).report.violations.read).toBe(1);
    const wide: Actor = { ...DANA, memberships: ["person:dana", "role:secret"] };
    const r = dogfoodReport(allEvents(t.db), t.policy, [wide]).report;
    expect(r.violations.read).toBe(0);
    expect(r.declared).toEqual({
      level: "person",
      memberships_by_level: { org: 0, person: 1, role: 1, team: 0 },
      own_scope_only: false,
    });
    expect(formatReport(r)).not.toContain("secret");
  });
});

describe("review fix pass: rule ids from a fixed list (E95-12)", () => {
  test("every engram/ rule id core names is on the list", async () => {
    const { readdirSync } = await import("node:fs");
    const src = join(REPO, "packages/core/src");
    const files = (readdirSync(src, { recursive: true }) as string[]).filter((f) =>
      f.endsWith(".ts"),
    );
    const named = new Set<string>();
    for (const f of files)
      for (const m of (await readFile(join(src, f), "utf8")).matchAll(/"(engram\/[a-z0-9/-]+)"/g))
        named.add(m[1] as string);
    expect([...named].filter((id) => !ENGRAM_RULES.includes(id))).toEqual([]);
  });

  test("a policy rule id outside the bundled policy's own list is other", async () => {
    const t = await twoWeeks();
    for (const policy_id of ["profile.twin/write/person:dana", "profile.twin/lint/not-enabled"])
      plant(t, { op: "write", decision: "deny", item_id: ID(7), actor: DANA.id, policy_id });
    expect(report(t).report.denials.other).toBe(2);
    expect(printableRules(t.policy).has("profile.twin/lint/orphan")).toBe(true);
  });
});

describe("the script", () => {
  const run = (args: string[]) =>
    spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8", cwd: REPO });

  test("prints the report of a member's log, exit 0 with no violation", async () => {
    const t = await twoWeeks();
    const out = run([
      "--db",
      t.dbPath,
      "--policy",
      PROFILE,
      "--as",
      "person:dana",
      "--member",
      "person:dana",
    ]);
    expect(out.stderr).not.toContain("Error");
    expect(out.status).toBe(0);
    expect(out.stdout).toBe(`${formatReport(report(t).report)}\n`);
  });

  test("exit 1 on a violation; --detail names it on stderr only", async () => {
    const t = await twoWeeks();
    plant(t, { item_ids: [NOTE] });
    const args = ["--db", t.dbPath, "--policy", PROFILE, "--as", "person:dana"];
    const plain = run(args);
    expect(plain.status).toBe(1);
    expect(JSON.parse(plain.stdout).violations.read).toBe(1);
    expect(plain.stderr).not.toContain(NOTE);
    const detailed = run([...args, "--detail"]);
    expect(detailed.status).toBe(1);
    expect(detailed.stdout).toBe(plain.stdout);
    expect(detailed.stderr).toContain(NOTE);
  });

  test("refuses a missing log, a missing actor and a Postgres URL, writing nothing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "engram-dogfood-"));
    dirs.push(dir);
    const missing = run(["--db", join(dir, "none.db"), "--policy", PROFILE, "--as", "person:dana"]);
    expect(missing.status).toBe(2);
    expect(missing.stderr).toContain("no event log");
    const t = await twoWeeks();
    expect(run(["--db", t.dbPath, "--policy", PROFILE]).status).toBe(2);
    const pg = run([
      "--db",
      "postgres://u:p@localhost/x",
      "--policy",
      PROFILE,
      "--as",
      "person:dana",
    ]);
    expect(pg.status).toBe(2);
    expect(pg.stderr).not.toContain("u:p");
  });
});

describe("review fix pass: the script (E95-8, E95-10, E95-11)", () => {
  const run = (args: string[]) =>
    spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8", cwd: REPO });
  const args = (t: Twin) => ["--db", t.dbPath, "--policy", PROFILE, "--as", "person:dana"];
  /** Overwrites one stored event's body, as a damaged or foreign log could hold it. */
  const damage = (t: Twin, seq: number, body: string) =>
    t.db.prepare("UPDATE events SET body = ? WHERE seq = ?").run(body, seq);

  test.each([
    ["item_ids is a string", (e: MemoryEvent) => JSON.stringify({ ...e, item_ids: "01990000-x" })],
    ["ts is not a time", (e: MemoryEvent) => JSON.stringify({ ...e, ts: "yesterday Kestrel" })],
    ["the body is not JSON", () => "{not json Kestrel"],
  ])("a stored event whose %s: named by seq only, nothing printed, exit 2", async (_, body) => {
    const t = await twoWeeks();
    const read = allEvents(t.db).find((e) => e.op === "read") as MemoryEvent;
    damage(t, read.seq, body(read));
    const out = run(args(t));
    expect(out.status).toBe(2);
    expect(out.stdout).toBe("");
    expect(out.stderr).toContain(`event ${read.seq} does not parse`);
    expect(out.stderr).not.toContain("Kestrel");
    expect(out.stderr).not.toContain("01990000");
  });

  test("a SQLite file that is not an Engram log is refused and left as it was", async () => {
    const { DatabaseSync } = await import("node:sqlite");
    const dir = await mkdtemp(join(tmpdir(), "engram-dogfood-"));
    dirs.push(dir);
    const path = join(dir, "other.db");
    const other = new DatabaseSync(path);
    other.exec("CREATE TABLE notes (body TEXT); INSERT INTO notes VALUES ('x')");
    other.close();
    const before = await readFile(path);
    const out = run(["--db", path, "--as", "person:dana"]);
    expect(out.status).toBe(2);
    expect(out.stderr).toContain("not an Engram event log");
    // Byte 18 of the header: 1 for a rollback journal, 2 for WAL.
    const after = await readFile(path);
    expect(after[18]).toBe(1);
    expect(after.equals(before)).toBe(true);
  });

  test("no error repeats a flag's value or a path", async () => {
    const t = await twoWeeks();
    const cases = [
      ["--db", join(t.dbPath, "..", "Kestrel-missing.db"), "--as", "person:dana"],
      [...args(t), "--member", "Kestrel:bad"],
      [...args(t), "--level", "Kestrel"],
      ["--db", t.dbPath, "--policy", "Kestrel-policy.yaml", "--as", "person:dana"],
      [...args(t), "--Kestrel"],
    ];
    for (const c of cases) {
      const out = run(c);
      expect(out.status, c.join(" ")).toBe(2);
      expect(out.stderr).not.toContain("Kestrel");
      expect(out.stderr).not.toContain(dirname(t.dbPath));
    }
  });
});
