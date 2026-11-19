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
import { dogfoodReport, formatReport } from "../../src/dogfood.ts";
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
  // The re-adoption on day 1 raised the agent's items to import (a finding of
  // card E9.5), so the gate now lets their owner grant one: no violation by
  // the report's two kinds, counted under watch.
  ok(
    (await plane.changeGrants(DANA, EPISODE2, { add: [toSamEpisodic(day(3))] }, day(2, 12))).event,
  );
  expect((await read(SAM, day(2, 13))).sort()).toEqual([FACT, EPISODE2]);

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

  return { db, dbPath, policy, nextId: () => newId() };
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
    // the teammate: 2, 2, 1 and none, every one through a grant.
    expect(r.reads.items_returned).toBe(4 + 9 + 2 + 2 + 1 + 0 + 9 + 9);
    expect(r.reads.items_via_grant).toBe(5);
    expect(r.grants).toEqual({ added: 3, changes: 4, removed: 1 });
    // 4 files adopted, Dana's 3 and the agent's 2, and each of those 5 re-adopted once as import.
    expect(r.writes).toEqual({ allowed: 4 + 5 + 5, denied: 1 });
    expect(r.watch).toEqual({ granted_after_raise: 1, provenance_raised: 2 });
    expect(r.bypass_blocked).toBe(1);
    expect(r.denials).toEqual({
      "engram/bypass/store-command": 1,
      "engram/grant/source": 1,
      "engram/write/grant": 2,
      "engram/write/store-failure": 1,
      "profile.twin/write/role": 1,
    });
    expect(r.by_op.update).toEqual({ allow: 4, deny: 4 });
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
    // Every leaf is a count, except the format tag and the policy's hash.
    const leaves = (v: unknown): unknown[] =>
      v !== null && typeof v === "object" ? Object.values(v).flatMap(leaves) : [v];
    const strings = leaves(parsed).filter((x) => typeof x !== "number");
    expect(strings).toEqual([expect.stringMatching(/^[0-9a-f]{64}$/), "engram-dogfood-report/1"]);
    // Byte-stable: the same log prints the same bytes.
    expect(formatReport(report(t).report)).toBe(text);
  });

  test("a rule id that does not have the shape of a bundled policy's is counted as other", async () => {
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
    expect(r.grants).toEqual({ added: 4, changes: 5, removed: 1 });
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
