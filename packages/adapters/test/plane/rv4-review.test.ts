// Review fix pass of PR #58 (card RV4), through the plane over the files
// adapter the twin dogfood runs on. Each test is one of the reviewer's
// probes (P1, P2, P4, P21, P23) or a finding's case:
//
// I-1. A folder moved before an offboarding: the erasure finds no record at
//      the old root's refs, so nothing is proven deleted; the erased
//      content's hashes are kept, and the new root's records are refused.
// I-3. A hand-edited record denied only for its `import` source leaves the
//      plane's approved item standing; the deny is recorded.
// I-4. A grant added by hand to an otherwise unchanged file is dropped with
//      one allow event naming the grantee, once per store content.
// I-5. Agent content re-filed under a new id, its kind edited, keeps the
//      lower kind of the item the same adoption retires.
// I-9. A case-only edit of a re-keyed retired record is still that record.
import { cp, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ADOPT_ERASED_ID,
  ADOPT_REKEYED_ID,
  adoptStoreItems,
  allEvents,
  appendEvent,
  createPlane,
  currentItems,
  eventsByItem,
  itemById,
  type MemoryItem,
  migrate,
  offboard,
  openSqlite,
  type Policy,
  parsePolicy,
} from "@engram/core";
import { afterAll, describe, expect, test } from "vitest";
import { createFilesAdapter } from "../../src/files/index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(HERE, "../../../../fixtures/stores/claude-code-memory");
const PROFILE = resolve(HERE, "../../../pi-package/profiles/twin.yaml");
const AT = "2026-11-19T10:00:00Z";
const LATER = "2026-11-19T11:00:00Z";
const person = (id: string, more: string[] = []) => ({
  id: `person:${id}`,
  level: "person" as const,
  memberships: [`person:${id}`, ...more],
  source: "user" as const,
});
const dana = person("dana");
/** Claude Code through `engram mcp`: Dana's principal, source model. */
const agent = { ...dana, source: "model" as const };
const sam = { id: "person:sam", level: "person" as const, memberships: ["person:sam"] };
const mallory = { id: "person:mallory", level: "person" as const, memberships: [] };
const ID = (n: number) => `01920000-0000-7000-8000-${String(n).padStart(12, "0")}`;
const MALLORY_GRANT =
  "grants:\n    - to: person:mallory\n      class: semantic\n      mode: read\n      expires: 2026-12-19T00:00:00Z";

const dirs: string[] = [];
const tempDir = async (prefix = "engram-rv4r-") => {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
};
afterAll(async () => {
  for (const dir of dirs) await rm(dir, { recursive: true, force: true });
});

const profileText = () => readFile(PROFILE, "utf8");

/** A fresh log under `policy` (the twin profile) over Dana's files folder at `root`; `depsAt` names the folder elsewhere. */
async function logOver(root: string, policy?: Policy) {
  const db = openSqlite(":memory:");
  migrate(db);
  let n = 0;
  const newId = () => `01920000-0000-7000-8000-${String(900_000 + ++n).padStart(12, "0")}`;
  const used = policy ?? parsePolicy(await profileText(), "twin.yaml");
  const depsAt = (at: string) => ({
    db,
    newId,
    policy: used,
    adapter: createFilesAdapter({
      root: at,
      owner: "dana",
      importValidFrom: "2026-10-01T00:00:00Z",
    }),
  });
  return { db, deps: depsAt(root), depsAt };
}

function note(n: number, patch: Partial<MemoryItem> = {}): MemoryItem {
  return {
    id: ID(n),
    class: "semantic",
    scope: "person:dana",
    owner: "person:dana",
    content: `Note ${n}: Dana prefers short standups.`,
    provenance: { kind: "user", ref: "cli", hash: `sha256:${"0".repeat(64)}`, actor: dana.id },
    confidence: 0.9,
    valid_from: "2026-11-01T00:00:00Z",
    valid_to: null,
    ttl: null,
    grants: [],
    version: 1,
    lineage: [],
    status: "active",
    store_ref: null,
    schema_version: 1,
    ...patch,
  } as MemoryItem;
}

/** Rewrites the body of an Engram file, keeping its frontmatter, as a person editing it by hand. */
async function editBody(root: string, key: string, body: string) {
  const path = join(root, key);
  const text = await readFile(path, "utf8");
  const end = text.indexOf("\n---", 4) + "\n---\n".length;
  await writeFile(path, `${text.slice(0, end)}${body}`);
}

describe("I-1: a folder moved before an offboarding", () => {
  test("the erasure proves nothing deleted, and every record of the new root is refused as erased", async () => {
    const parent = await tempDir("engram-rv4r-move-");
    const before = join(parent, "a");
    const after = join(parent, "b");
    await cp(FIXTURE, before, { recursive: true });
    const { db, deps, depsAt } = await logOver(before);
    expect((await adoptStoreItems(deps, dana, "person:dana", AT)).allowed).toBe(4);
    expect((await createPlane(deps).write(dana, note(9), AT)).event.decision).toBe("allow");

    await rename(before, after);
    // Offboarding still names the old root: no record is found at any ref.
    const report = await offboard(deps, dana, { person: "person:dana", roles: [] }, AT);
    expect(report.erased.items).toHaveLength(5);
    expect(report.erased.store_refs).toEqual([]);
    expect(report.erased.left_in_store).toEqual([]);
    expect(report.erased.not_found_in_store.flatMap((r) => r.items)).toHaveLength(5);
    expect(report.not_reached.join("\n")).toMatch(/not proven deleted/);
    for (const e of report.events.filter((x) => x.policy_id === "engram/offboard/erase"))
      expect(e.reason).toMatch(/adoption refuses a store record holding the erased content \(/);
    expect(currentItems(db)).toEqual([]);

    const moved = depsAt(after);
    const r = await adoptStoreItems(moved, dana, "person:dana", LATER);
    expect(r).toMatchObject({ allowed: 0, denied: 5 });
    expect(r.denials.map((d) => d.policy_id)).toEqual(Array(5).fill(ADOPT_ERASED_ID));
    expect(currentItems(db)).toEqual([]);
    expect((await createPlane(moved).read(dana, { at: LATER })).items).toEqual([]);
    // Nothing of the moved folder is deleted by the plane, and a second
    // adoption appends nothing.
    expect(await readFile(join(after, `${ID(9)}.md`), "utf8")).toContain("Note 9");
    const n = allEvents(db).length;
    expect((await adoptStoreItems(moved, dana, "person:dana", LATER)).unchanged).toBe(5);
    expect(allEvents(db)).toHaveLength(n);
    // The erased id itself, edited: refused only while it holds the erased
    // content, as a record left in a store that refuses the delete is
    // (review fix pass 2, N-3); the edit is new content, and adopts.
    await editBody(after, `${ID(9)}.md`, "Note 9, edited after the move.");
    const edited = await adoptStoreItems(moved, dana, "person:dana", LATER);
    expect(edited).toMatchObject({ allowed: 1, denied: 0 });
    expect(currentItems(db).map((i) => [i.id, i.content])).toEqual([
      [ID(9), "Note 9, edited after the move."],
    ]);
  });

  test("moved back after the erasure: a new file under an erased id adopts, as after an ordinary erasure (N-3)", async () => {
    const role =
      "---\nname: role\ndescription: role\nmetadata:\n  type: user\n---\nA brand new role, written later.\n";
    // P32: the erasure ran while the folder was elsewhere, then it moved back.
    const parent = await tempDir("engram-rv4r-back-");
    const before = join(parent, "a");
    const after = join(parent, "b");
    await cp(FIXTURE, before, { recursive: true });
    const moved = await logOver(before);
    await adoptStoreItems(moved.deps, dana, "person:dana", AT);
    await rename(before, after);
    const report = await offboard(moved.deps, dana, { person: "person:dana", roles: [] }, AT);
    expect(report.erased.not_found_in_store).toHaveLength(4);
    await rename(after, before);
    await writeFile(join(before, "user_role.md"), role);
    const back = await adoptStoreItems(moved.deps, dana, "person:dana", LATER);
    // P33: the same, with the erasure finding the folder where it was.
    const root = await tempDir();
    await cp(FIXTURE, root, { recursive: true });
    const stayed = await logOver(root);
    await adoptStoreItems(stayed.deps, dana, "person:dana", AT);
    const left = await offboard(stayed.deps, dana, { person: "person:dana", roles: [] }, AT);
    expect(left.erased.left_in_store).toHaveLength(4);
    await writeFile(join(root, "user_role.md"), role);
    const ordinary = await adoptStoreItems(stayed.deps, dana, "person:dana", LATER);

    expect(ordinary).toMatchObject({ allowed: 1, denied: 3 });
    expect(back).toMatchObject({ allowed: 1, denied: 3 });
    expect(back.denials.map((d) => d.policy_id)).toEqual(Array(3).fill(ADOPT_ERASED_ID));
    expect(moved.db && currentItems(moved.db).map((i) => i.content)).toEqual([
      "A brand new role, written later.",
    ]);
  });
});

describe("N-1: a kept item is never found by text the gate denied", () => {
  test("Lee's search for a word only Dana's denied edit holds returns nothing (P30b)", async () => {
    const root = await tempDir();
    const danaT = person("dana", ["team:x"]);
    const lee = person("lee", ["team:x"]);
    const policy = parsePolicy(
      (await profileText()).replace(
        "  - scope: team\n    allowed_sources: [user, document]\n    confidence_floor: 0.7\n    forbidden_classes: [episodic]\n    requires_review: true",
        "  - scope: team\n    allowed_sources: [user, document]\n    confidence_floor: 0.7\n    forbidden_classes: [episodic]\n    requires_review: false",
      ),
      "twin-team-open.yaml",
    );
    const { db, deps } = await logOver(root, policy);
    const plane = createPlane(deps);
    const w = await plane.write(
      danaT,
      note(40, { scope: "team:x", content: "Team deploys on Tuesdays." }),
      AT,
    );
    expect(w.event.decision).toBe("allow");
    expect(itemById(db, ID(40))?.status).toBe("active");
    await editBody(root, `${ID(40)}.md`, "Team deploys on Tuesdays. Prod password is hunter2.");
    const r = await adoptStoreItems(deps, danaT, "team:x", LATER);
    expect(r).toMatchObject({ denied: 1, retired: 0 });

    for (const who of [lee, danaT])
      expect((await plane.read(who, { at: LATER, text: "hunter2" })).items).toEqual([]);
    // Its own content still finds it.
    expect((await plane.read(lee, { at: LATER, text: "tuesdays" })).items.map((i) => i.id)).toEqual(
      [ID(40)],
    );
  });
});

describe("N-2: the kind floor holds across adoptions", () => {
  test("agent content deleted, adopted, then re-filed with kind user stays model (P4b)", async () => {
    const root = await tempDir();
    const { db, deps } = await logOver(root);
    const plane = createPlane(deps);
    expect(
      (await plane.write(agent, note(1, { content: "Agent episode." }), AT)).event.decision,
    ).toBe("allow");
    const text = (await readFile(join(root, `${ID(1)}.md`), "utf8"))
      .replace("kind: model", "kind: user")
      .replaceAll("000000000001", "000000000778");
    await rm(join(root, `${ID(1)}.md`));
    expect((await adoptStoreItems(deps, dana, "person:dana", AT)).retired).toBe(1);
    await writeFile(join(root, `${ID(778)}.md`), text);
    // The copy is the agent's content at kind model, so the gate's
    // retired-content rule refuses it: a model source cannot bring back
    // content retired in its scope (ADR 0025).
    const again = await adoptStoreItems(deps, dana, "person:dana", AT);
    expect(again).toMatchObject({ allowed: 0, denied: 1 });
    expect(again.denials[0]?.reason).toMatch(/a model source cannot bring it back/);
    expect(again.denials[0]?.reason).toMatch(/provenance set by adoption: kind model/);
    expect(itemById(db, ID(778))).toBeUndefined();
    const g = await plane.changeGrants(
      dana,
      ID(778),
      { add: [{ to: sam.id, class: "semantic", mode: "read", expires: "2026-12-19T00:00:00Z" }] },
      LATER,
    );
    expect(g.event.decision).toBe("deny");
    expect((await plane.read(sam, { at: LATER })).items).toEqual([]);
  });
});

describe("I-3: a record denied only for its import source", () => {
  test("in the twin profile's team scope, the plane's approved item stays and the deny is recorded", async () => {
    const root = await tempDir();
    const danaT = person("dana", ["team:x"]);
    const { db, deps } = await logOver(root);
    const plane = createPlane(deps);
    const w = await plane.write(danaT, note(20, { scope: "team:x" }), AT);
    expect(w.event.decision).toBe("allow");
    const held = itemById(db, ID(20)) as MemoryItem;
    await editBody(root, `${ID(20)}.md`, "Team uses trunk based development, edited.");

    const r = await adoptStoreItems(deps, danaT, "team:x", LATER);
    expect(r).toMatchObject({ allowed: 0, denied: 1, retired: 0 });
    expect(r.denials[0]?.reason).toMatch(/source import is not allowed in team scope/);
    expect(itemById(db, ID(20))).toEqual(held);
    expect(eventsByItem(db, ID(20)).some((e) => e.op === "retire")).toBe(false);
    // Denied once: the next adoption appends nothing.
    const n = allEvents(db).length;
    expect((await adoptStoreItems(deps, danaT, "team:x", LATER)).unchanged).toBe(1);
    expect(allEvents(db)).toHaveLength(n);
  });

  test("in a person scope whose policy refuses import, the user's item stays; an agent's edit lands as model", async () => {
    const root = await tempDir();
    const policy = parsePolicy(
      (await profileText()).replace(
        "allowed_sources: [user, document, tool, import, model, compaction]",
        "allowed_sources: [user, document, tool, model, compaction]",
      ),
      "twin-noimport.yaml",
    );
    const { db, deps } = await logOver(root, policy);
    const plane = createPlane(deps);
    expect((await plane.write(dana, note(30), AT)).event.decision).toBe("allow");
    expect(
      (await plane.write(agent, note(31, { content: "An agent note." }), AT)).event.decision,
    ).toBe("allow");
    const held = itemById(db, ID(30)) as MemoryItem;
    await editBody(root, `${ID(30)}.md`, "Note 30, edited.");
    await editBody(root, `${ID(31)}.md`, "An agent note, edited.");

    const r = await adoptStoreItems(deps, dana, "person:dana", LATER);
    expect(r).toMatchObject({ allowed: 1, denied: 1, retired: 0 });
    expect(r.denials.map((d) => d.item_id)).toEqual([ID(30)]);
    expect(itemById(db, ID(30))).toEqual(held);
    expect(itemById(db, ID(31))).toMatchObject({
      status: "active",
      content: "An agent note, edited.",
      provenance: { kind: "model" },
    });
  });

  test("a record denied for anything but its source is still retracted", async () => {
    const root = await tempDir();
    const { db, deps } = await logOver(root);
    const plane = createPlane(deps);
    expect((await plane.write(dana, note(32), AT)).event.decision).toBe("allow");
    // The person lowers the confidence below the person floor by hand.
    const path = join(root, `${ID(32)}.md`);
    const text = await readFile(path, "utf8");
    expect(text).toMatch(/confidence: 0\.9/);
    await writeFile(path, text.replace(/confidence: 0\.9/, "confidence: 0.01"));

    const r = await adoptStoreItems(deps, dana, "person:dana", LATER);
    expect(r).toMatchObject({ denied: 1, retired: 1 });
    expect(r.denials[0]?.reason).toMatch(/below the person floor/);
    expect(itemById(db, ID(32))?.status).toBe("retired");
  });
});

describe("I-4: a grant added by hand to an otherwise unchanged file", () => {
  test("is dropped with one allow event naming the grantee, once per store content", async () => {
    const root = await tempDir();
    const { db, deps } = await logOver(root);
    const plane = createPlane(deps);
    expect((await plane.write(dana, note(5), AT)).event.decision).toBe("allow");
    const held = itemById(db, ID(5)) as MemoryItem;
    const path = join(root, `${ID(5)}.md`);
    await writeFile(path, (await readFile(path, "utf8")).replace("grants: []", MALLORY_GRANT));

    const n = allEvents(db).length;
    const r = await adoptStoreItems(deps, dana, "person:dana", LATER);
    expect(r).toMatchObject({ allowed: 1, denied: 0, retired: 0, unchanged: 0 });
    const added = allEvents(db).slice(n);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ op: "write", decision: "allow", item_id: ID(5) });
    expect(added[0]?.reason).toMatch(/adoption dropped the grant to person:mallory/);
    expect(itemById(db, ID(5))).toMatchObject({
      content: held.content,
      grants: [],
      provenance: held.provenance,
      version: held.version,
    });
    expect((await plane.read(mallory, { at: LATER })).items).toEqual([]);
    // The same store content again: nothing more.
    const m = allEvents(db).length;
    expect(await adoptStoreItems(deps, dana, "person:dana", LATER)).toMatchObject({
      allowed: 0,
      unchanged: 1,
    });
    expect(allEvents(db)).toHaveLength(m);
  });
});

describe("I-5: agent content re-filed under a new id with its kind edited", () => {
  test("keeps the lower kind of the item the same adoption retires, so the owner's grant on it is refused", async () => {
    const root = await tempDir();
    const { db, deps } = await logOver(root);
    const plane = createPlane(deps);
    expect(
      (await plane.write(agent, note(1, { content: "Agent episode." }), AT)).event.decision,
    ).toBe("allow");
    const text = (await readFile(join(root, `${ID(1)}.md`), "utf8"))
      .replace("kind: model", "kind: user")
      .replaceAll("000000000001", "000000000778");
    await writeFile(join(root, `${ID(778)}.md`), text);
    await rm(join(root, `${ID(1)}.md`));

    const r = await adoptStoreItems(deps, dana, "person:dana", AT);
    expect(r).toMatchObject({ allowed: 1, retired: 1 });
    expect(itemById(db, ID(1))?.status).toBe("retired");
    expect(itemById(db, ID(778))?.provenance).toMatchObject({ kind: "model", actor: dana.id });
    expect(eventsByItem(db, ID(778)).at(-1)?.reason).toMatch(
      /the least trusted of the record's claim, an item of the same content the scope no longer holds and import/,
    );
    const g = await plane.changeGrants(
      dana,
      ID(778),
      {
        add: [{ to: sam.id, class: "semantic", mode: "read", expires: "2026-12-19T00:00:00Z" }],
      },
      LATER,
    );
    expect(g.event).toMatchObject({ decision: "deny", policy_id: "engram/write/grant" });
    expect((await plane.read(sam, { at: LATER })).items).toEqual([]);
  });
});

describe("I-9: a re-keyed retired record, edited in case only", () => {
  test("is still the retired record, and refused", async () => {
    const parent = await tempDir("engram-rv4r-case-");
    const before = join(parent, "a");
    const after = join(parent, "b");
    await cp(FIXTURE, before, { recursive: true });
    const { db, deps, depsAt } = await logOver(before);
    expect((await adoptStoreItems(deps, dana, "person:dana", AT)).allowed).toBe(4);
    const role = currentItems(db).find((i) => i.store_ref?.key === "user_role.md") as MemoryItem;
    appendEvent(db, {
      id: "01920000-0000-7000-8000-000000800001",
      ts: AT,
      op: "retire",
      item_id: role.id,
      actor: dana.id,
      scope_from: null,
      scope_to: role.scope,
      decision: "allow",
      reason: "retired by its owner",
      policy_id: "test/owner-retire",
      schema_version: 1,
    });
    await rename(before, after);
    const path = join(after, "user_role.md");
    const text = await readFile(path, "utf8");
    const end = text.indexOf("\n---", 4) + "\n---\n".length;
    await writeFile(path, `${text.slice(0, end)}${text.slice(end).toUpperCase()}`);

    const r = await adoptStoreItems(depsAt(after), dana, "person:dana", LATER);
    expect(r).toMatchObject({ allowed: 3, denied: 1 });
    expect(r.denials[0]?.policy_id).toBe(ADOPT_REKEYED_ID);
    expect(
      currentItems(db).filter(
        (i) =>
          i.status === "active" &&
          String(i.content).toLowerCase() === String(role.content).toLowerCase(),
      ),
    ).toEqual([]);
  });
});
