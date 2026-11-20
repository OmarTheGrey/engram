// Card RV4 through the plane, over the files adapter the twin dogfood runs
// on: three adoption defects the reviews deferred until card E2.6 merged.
//
// 1. Adoption never raises trust (backlog row "Adoption raises trust"). An
//    agent-written item stays `model` through every adoption, so the owner's
//    grant on it is refused (ADR 0021, D4); a record the store holds as the
//    plane wrote it adopts with no event (backlog row "Re-adoption of plane
//    writes"); a record edited by hand adopts as `import` at most, never as
//    more trusted than it was.
// 2. Adoption never widens grants (RV-ADP-4). A file written into the folder
//    with Engram metadata and a grant the plane never recorded adopts
//    without that grant, and the reason names it (the reviewer's forge
//    probe). The owner's grant change, written through the plane and re-read
//    from the store, keeps its grants.
// 3. Adoption after a folder move (backlog row of card RV3). The moved files
//    are adopted under their new ids and the old ids retired; moving back
//    recovers the same way. Erased content stays refused across the move,
//    and an item retired by anything but adoption is not brought back under
//    its new id while it holds the same content.
import { cp, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ADOPT_ERASED_ID,
  ADOPT_REKEYED_ID,
  ADOPT_RETRACT_ID,
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
const person = (id: string) => ({
  id: `person:${id}`,
  level: "person" as const,
  memberships: [`person:${id}`],
  source: "user" as const,
});
const dana = person("dana");
/** Claude Code through `engram mcp`: Dana's principal, source model. */
const agent = { ...dana, source: "model" as const };
const sam = { id: "person:sam", level: "person" as const, memberships: ["person:sam"] };
const mallory = { id: "person:mallory", level: "person" as const, memberships: [] };
const grantTo = (to: string, cls: "semantic" | "episodic" = "semantic") => ({
  to,
  class: cls,
  mode: "read" as const,
  expires: "2026-12-19T00:00:00Z",
});
const ID = (n: number) => `01920000-0000-7000-8000-${String(n).padStart(12, "0")}`;

const dirs: string[] = [];
const tempDir = async (prefix = "engram-rv4-") => {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
};
afterAll(async () => {
  for (const dir of dirs) await rm(dir, { recursive: true, force: true });
});

const twin = async (): Promise<Policy> => parsePolicy(await readFile(PROFILE, "utf8"), "twin.yaml");

/** A fresh log under the twin profile over Dana's files folder at `root`; `depsAt` names the folder elsewhere. */
async function logOver(root: string) {
  const db = openSqlite(":memory:");
  migrate(db);
  let n = 0;
  const newId = () => `01920000-0000-7000-8000-${String(900_000 + ++n).padStart(12, "0")}`;
  const policy: Policy = await twin();
  const depsAt = (at: string) => ({
    db,
    newId,
    policy,
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

describe("defect 1: adoption never raises trust", () => {
  test("an agent-written item re-adopted keeps model, and the owner's grant on it is refused", async () => {
    const root = await tempDir();
    const { db, deps } = await logOver(root);
    const plane = createPlane(deps);
    const w = await plane.write(agent, note(1, { content: "Debugged the deploy with Dana." }), AT);
    expect(w.event.decision).toBe("allow");
    expect(itemById(db, ID(1))?.provenance.kind).toBe("model");

    const before = allEvents(db).length;
    const again = await adoptStoreItems(deps, dana, "person:dana", AT);
    expect(again).toMatchObject({ allowed: 0, denied: 0, retired: 0, unchanged: 1 });
    expect(allEvents(db)).toHaveLength(before);
    expect(itemById(db, ID(1))?.provenance).toMatchObject({ kind: "model", actor: dana.id });

    const grant = await plane.changeGrants(dana, ID(1), { add: [grantTo(sam.id)] }, LATER);
    expect(grant.event).toMatchObject({ decision: "deny", policy_id: "engram/write/grant" });
    expect((await plane.read(sam, { at: LATER })).items).toEqual([]);
  });

  test("an unchanged plane-written record adopts with no event, whatever the folder's history", async () => {
    const root = await tempDir();
    await cp(FIXTURE, root, { recursive: true });
    const { db, deps } = await logOver(root);
    const plane = createPlane(deps);
    expect((await adoptStoreItems(deps, dana, "person:dana", AT)).allowed).toBe(4);
    expect((await plane.write(dana, note(2), AT)).event.decision).toBe("allow");
    const before = allEvents(db).length;
    for (let k = 0; k < 3; k++) {
      const r = await adoptStoreItems(deps, dana, "person:dana", LATER);
      expect(r).toMatchObject({ allowed: 0, denied: 0, retired: 0, unchanged: 5 });
    }
    expect(allEvents(db)).toHaveLength(before);
    expect(itemById(db, ID(2))?.provenance).toMatchObject({ kind: "user", actor: dana.id });
  });

  test("a record edited by hand adopts as import at most, never as more trusted than it was", async () => {
    const root = await tempDir();
    const { db, deps } = await logOver(root);
    const plane = createPlane(deps);
    expect((await plane.write(dana, note(3), AT)).event.decision).toBe("allow");
    expect((await plane.write(agent, note(4), AT)).event.decision).toBe("allow");
    await editBody(root, `${ID(3)}.md`, "Note 3, edited by hand.");
    // The agent's file edited, and its frontmatter claiming the user wrote it.
    await editBody(root, `${ID(4)}.md`, "Note 4, edited.");
    const path = join(root, `${ID(4)}.md`);
    await writeFile(path, (await readFile(path, "utf8")).replace("kind: model", "kind: user"));
    const r = await adoptStoreItems(deps, dana, "person:dana", LATER);
    expect(r).toMatchObject({ allowed: 2, denied: 0 });
    expect(itemById(db, ID(3))).toMatchObject({
      content: "Note 3, edited by hand.",
      provenance: { kind: "import", actor: dana.id },
    });
    expect(itemById(db, ID(4))).toMatchObject({
      content: "Note 4, edited.",
      provenance: { kind: "model", actor: dana.id },
    });
    const reasons = allEvents(db)
      .slice(-2)
      .map((e) => e.reason);
    expect(reasons.join("\n")).toMatch(/provenance set by adoption: kind import/);
    expect(reasons.join("\n")).toMatch(/provenance set by adoption: kind model/);
    // A grant on the edited agent item is still model content's: refused.
    const grant = await plane.changeGrants(dana, ID(4), { add: [grantTo(sam.id)] }, LATER);
    expect(grant.event).toMatchObject({ decision: "deny", policy_id: "engram/write/grant" });
  });
});

describe("defect 2: adoption never widens grants (RV-ADP-4)", () => {
  test("a file dropped into the folder with a grant to Mallory adopts without it, and Mallory reads nothing", async () => {
    const root = await tempDir();
    const { db, deps } = await logOver(root);
    const plane = createPlane(deps);
    const secret = note(1, { content: "Dana's bank PIN hint is the dog's birthday." });
    expect((await plane.write(dana, secret, AT)).event.decision).toBe("allow");
    // The probe: Dana's own file copied under a new id, with a grant added by hand.
    const text = (await readFile(join(root, `${ID(1)}.md`), "utf8"))
      .replace(
        "grants: []",
        "grants:\n    - to: person:mallory\n      class: semantic\n      mode: read\n      expires: 2026-12-19T00:00:00Z",
      )
      .replaceAll("000000000001", "000000000777");
    expect(text).toContain("person:mallory");
    await writeFile(join(root, `${ID(777)}.md`), text);

    const r = await adoptStoreItems(deps, dana, "person:dana", AT);
    expect(r).toMatchObject({ allowed: 1, denied: 0 });
    const adopted = itemById(db, ID(777));
    expect(adopted).toMatchObject({ grants: [], provenance: { kind: "import" } });
    const event = eventsByItem(db, ID(777)).at(-1);
    expect(event?.decision).toBe("allow");
    expect(event?.reason).toMatch(/adoption dropped the grant to person:mallory/);
    expect(event?.reason).toMatch(/holds no item of that id/);
    expect((await plane.read(mallory, { at: AT })).items).toEqual([]);
    // Adopting again appends nothing: the store's grant is never taken up,
    // and the record as adoption records it is what the plane holds.
    const n = allEvents(db).length;
    expect(await adoptStoreItems(deps, dana, "person:dana", LATER)).toMatchObject({
      allowed: 0,
      unchanged: 2,
    });
    expect(allEvents(db)).toHaveLength(n);
    expect(itemById(db, ID(777))?.grants).toEqual([]);
    expect((await plane.read(mallory, { at: LATER })).items).toEqual([]);
  });

  test("a grant added by hand to a plane-written file is dropped; the content edit lands", async () => {
    const root = await tempDir();
    const { db, deps } = await logOver(root);
    const plane = createPlane(deps);
    expect((await plane.write(dana, note(5), AT)).event.decision).toBe("allow");
    await editBody(root, `${ID(5)}.md`, "Note 5, edited.");
    const path = join(root, `${ID(5)}.md`);
    await writeFile(
      path,
      (await readFile(path, "utf8")).replace(
        "grants: []",
        "grants:\n    - to: person:mallory\n      class: semantic\n      mode: read\n      expires: 2026-12-19T00:00:00Z",
      ),
    );
    await adoptStoreItems(deps, dana, "person:dana", AT);
    expect(itemById(db, ID(5))).toMatchObject({ content: "Note 5, edited.", grants: [] });
    expect(eventsByItem(db, ID(5)).at(-1)?.reason).toMatch(
      /adoption dropped the grant to person:mallory, which the plane never recorded for item .* \(its item there does not carry it\)/,
    );
    expect((await plane.read(mallory, { at: AT })).items).toEqual([]);
  });

  test("the owner's grant change through the plane, re-read from the store, keeps its grants", async () => {
    const root = await tempDir();
    const { db, deps } = await logOver(root);
    const plane = createPlane(deps);
    expect((await plane.write(dana, note(6), AT)).event.decision).toBe("allow");
    const g = await plane.changeGrants(dana, ID(6), { add: [grantTo(sam.id)] }, AT);
    expect(g.event.decision).toBe("allow");
    expect(await readFile(join(root, `${ID(6)}.md`), "utf8")).toContain("person:sam");
    // Re-read unchanged: no event, the grant stands.
    const n = allEvents(db).length;
    expect(await adoptStoreItems(deps, dana, "person:dana", LATER)).toMatchObject({
      allowed: 0,
      unchanged: 1,
    });
    expect(allEvents(db)).toHaveLength(n);
    // Re-read after the person edits the body: the edit lands, the grant stays.
    await editBody(root, `${ID(6)}.md`, "Note 6, edited by hand.");
    expect(await adoptStoreItems(deps, dana, "person:dana", LATER)).toMatchObject({ allowed: 1 });
    expect(itemById(db, ID(6))).toMatchObject({
      content: "Note 6, edited by hand.",
      grants: [grantTo(sam.id)],
    });
    expect(eventsByItem(db, ID(6)).at(-1)?.reason).not.toMatch(/dropped/);
    expect((await plane.read(sam, { at: LATER })).items.map((i) => i.id)).toEqual([ID(6)]);
  });

  test("a revoked grant does not come back when the old file is restored", async () => {
    const root = await tempDir();
    const { db, deps } = await logOver(root);
    const plane = createPlane(deps);
    expect((await plane.write(dana, note(7), AT)).event.decision).toBe("allow");
    expect(
      (await plane.changeGrants(dana, ID(7), { add: [grantTo(sam.id)] }, AT)).event.decision,
    ).toBe("allow");
    const granted = await readFile(join(root, `${ID(7)}.md`), "utf8");
    expect(
      (await plane.changeGrants(dana, ID(7), { remove: [grantTo(sam.id)] }, AT)).event.decision,
    ).toBe("allow");
    // A backup of the granted version is copied back over the file.
    await writeFile(join(root, `${ID(7)}.md`), granted);
    await adoptStoreItems(deps, dana, "person:dana", LATER);
    expect(itemById(db, ID(7))?.grants).toEqual([]);
    expect((await plane.read(sam, { at: LATER })).items).toEqual([]);
  });
});

describe("defect 3: adoption after a folder move", () => {
  test("the moved files adopt under their new ids, the old ids retire, and moving back recovers", async () => {
    const parent = await tempDir("engram-rv4-move-");
    const before = join(parent, "a");
    const after = join(parent, "b");
    await cp(FIXTURE, before, { recursive: true });
    const { db, deps, depsAt } = await logOver(before);
    const plane = createPlane(deps);
    expect((await adoptStoreItems(deps, dana, "person:dana", AT)).allowed).toBe(4);
    expect((await plane.write(dana, note(8), AT)).event.decision).toBe("allow");
    const old = currentItems(db)
      .filter((i) => i.provenance.kind === "import")
      .map((i) => i.id)
      .sort();
    expect(old).toHaveLength(4);

    await rename(before, after);
    const moved = depsAt(after);
    const r = await adoptStoreItems(moved, dana, "person:dana", LATER);
    expect(r).toMatchObject({ allowed: 4, denied: 0, retired: 4, unchanged: 1 });
    for (const id of old) {
      expect(itemById(db, id)?.status).toBe("retired");
      const last = eventsByItem(db, id).at(-1);
      expect(last).toMatchObject({ op: "retire", decision: "allow", policy_id: ADOPT_RETRACT_ID });
      expect(last?.reason).toMatch(/gave its record a new id/);
    }
    const active = currentItems(db).filter((i) => i.status === "active");
    expect(active).toHaveLength(5);
    expect(active.filter((i) => old.includes(i.id))).toEqual([]);
    // Every retirement comes before the adoption at its ref, in one transaction.
    const read = await createPlane(moved).read(dana, { at: LATER });
    expect(read.items).toHaveLength(5);
    // A second adoption of the moved folder is quiet.
    const n = allEvents(db).length;
    expect(await adoptStoreItems(moved, dana, "person:dana", LATER)).toMatchObject({
      allowed: 0,
      retired: 0,
      unchanged: 5,
    });
    expect(allEvents(db)).toHaveLength(n);

    // Moving it back: the old ids return, the new ones retire.
    const fresh = active.filter((i) => i.provenance.kind === "import").map((i) => i.id);
    await rename(after, before);
    const back = await adoptStoreItems(depsAt(before), dana, "person:dana", LATER);
    expect(back).toMatchObject({ allowed: 4, retired: 4, unchanged: 1 });
    for (const id of old) expect(itemById(db, id)?.status).toBe("active");
    for (const id of fresh) expect(itemById(db, id)?.status).toBe("retired");
  });

  test("an erased file stays refused across the move", async () => {
    const parent = await tempDir("engram-rv4-erase-");
    const before = join(parent, "a");
    const after = join(parent, "b");
    await cp(FIXTURE, before, { recursive: true });
    const { db, deps, depsAt } = await logOver(before);
    expect((await adoptStoreItems(deps, dana, "person:dana", AT)).allowed).toBe(4);
    const report = await offboard(deps, dana, { person: "person:dana", roles: [] }, AT);
    expect(report.erased.left_in_store).toHaveLength(4);
    expect(currentItems(db)).toEqual([]);

    await rename(before, after);
    const moved = depsAt(after);
    const r = await adoptStoreItems(moved, dana, "person:dana", LATER);
    expect(r).toMatchObject({ allowed: 0, denied: 4 });
    expect(r.denials.every((d) => d.policy_id === ADOPT_ERASED_ID)).toBe(true);
    for (const d of r.denials) expect(d.reason).toMatch(/left in the store under another id/);
    expect(currentItems(db)).toEqual([]);
    expect((await createPlane(moved).read(dana, { at: LATER })).items).toEqual([]);
    // Refused once: the next adoption appends nothing.
    const n = allEvents(db).length;
    expect((await adoptStoreItems(moved, dana, "person:dana", LATER)).unchanged).toBe(4);
    expect(allEvents(db)).toHaveLength(n);
    // An edited file is new content, and adopts.
    await writeFile(
      join(after, "user_role.md"),
      "---\nname: role\ndescription: role\nmetadata:\n  type: user\n---\nA new role, written after.\n",
    );
    const edited = await adoptStoreItems(moved, dana, "person:dana", LATER);
    expect(edited).toMatchObject({ allowed: 1 });
    expect(currentItems(db).map((i) => i.content)).toEqual(["A new role, written after."]);
  });

  test("an item retired by anything but adoption is not brought back under its new id", async () => {
    const parent = await tempDir("engram-rv4-retired-");
    const before = join(parent, "a");
    const after = join(parent, "b");
    await cp(FIXTURE, before, { recursive: true });
    const { db, deps, depsAt } = await logOver(before);
    expect((await adoptStoreItems(deps, dana, "person:dana", AT)).allowed).toBe(4);
    const role = currentItems(db).find((i) => i.store_ref?.key === "user_role.md") as MemoryItem;
    // The owner retires it (as a ttl or an eviction would).
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
    const moved = depsAt(after);
    const r = await adoptStoreItems(moved, dana, "person:dana", LATER);
    expect(r).toMatchObject({ allowed: 3, denied: 1, retired: 3 });
    expect(r.denials).toHaveLength(1);
    expect(r.denials[0]?.policy_id).toBe(ADOPT_REKEYED_ID);
    expect(r.denials[0]?.reason).toMatch(/test\/owner-retire/);
    expect(
      currentItems(db).filter((i) => i.content === role.content && i.status === "active"),
    ).toEqual([]);
    // Refused once; and an edit adopts it as new content.
    const n = allEvents(db).length;
    expect((await adoptStoreItems(moved, dana, "person:dana", LATER)).unchanged).toBe(4);
    expect(allEvents(db)).toHaveLength(n);
    await writeFile(
      join(after, "user_role.md"),
      "---\nname: role\ndescription: role\nmetadata:\n  type: user\n---\nDana leads the platform team now.\n",
    );
    expect(await adoptStoreItems(moved, dana, "person:dana", LATER)).toMatchObject({ allowed: 1 });
  });
});
