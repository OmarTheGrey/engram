// Card RV3 through the plane: the repository review's probes on the files
// adapter, as the dogfood would meet them. RV-ADP-1: a copy of an Engram
// file neither makes adoption append events forever nor retires the governed
// version after a rewrite. RV-ADP-2: two members' folders with a file of one
// name, adopted into one log, never retire each other's items. RV-ADP-3: an
// item the plane retired leaves no line in the folder's MEMORY.md, which
// Claude Code loads into every session outside the plane's read filter.
import { copyFile, cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  adoptStoreItems,
  allEvents,
  createPlane,
  currentItems,
  loadPreset,
  type MemoryItem,
  migrate,
  openSqlite,
} from "@engram/core";
import { afterAll, describe, expect, test } from "vitest";
import { createFilesAdapter } from "../../src/files/index.ts";

const FIXTURE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../fixtures/stores/claude-code-memory",
);
const AT = "2026-10-25T12:00:00Z";
const person = (id: string) => ({
  id: `person:${id}`,
  level: "person" as const,
  memberships: [`person:${id}`],
  source: "user" as const,
});
const dana = person("dana");
const erin = person("erin");

const dirs: string[] = [];
const tempDir = async (prefix = "engram-rv3-plane-") => {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
};
afterAll(async () => {
  for (const dir of dirs) await rm(dir, { recursive: true, force: true });
});

const item = (n: number, patch: Partial<MemoryItem> = {}): MemoryItem =>
  ({
    id: `01920000-0000-7000-8000-${String(n).padStart(12, "0")}`,
    class: "semantic",
    scope: "person:dana",
    owner: "person:dana",
    content: "Dana's bank PIN hint is the dog's birthday.",
    provenance: {
      kind: "user",
      ref: "note/1",
      hash: `sha256:${"ab".repeat(32)}`,
      actor: "person:dana",
    },
    confidence: 0.9,
    valid_from: "2026-10-01T00:00:00Z",
    valid_to: null,
    ttl: null,
    grants: [],
    version: 1,
    lineage: [],
    status: "active",
    store_ref: null,
    schema_version: 1,
    ...patch,
  }) as MemoryItem;

function logOf() {
  const db = openSqlite(":memory:");
  migrate(db);
  let n = 0;
  const newId = () => `01920000-0000-7000-8000-${String(900_000 + ++n).padStart(12, "0")}`;
  return { db, newId, policy: loadPreset("medium") };
}

describe("RV-ADP-1 through the plane: a copy of an Engram file", () => {
  test("adopting an unchanged folder that holds a copy appends nothing", async () => {
    const root = await tempDir();
    const deps = { ...logOf(), adapter: createFilesAdapter({ root, owner: "dana" }) };
    const w = await createPlane(deps).write(dana, item(1), AT);
    expect(w.event.decision).toBe("allow");
    await copyFile(join(root, `${item(1).id}.md`), join(root, "copy.md"));
    // The first adoption may take the plane's own write once (backlog row
    // "Re-adoption of plane writes"); after that, an unchanged folder adds nothing.
    await adoptStoreItems(deps, dana, "person:dana", AT);
    const before = allEvents(deps.db).length;
    for (let k = 0; k < 3; k++) await adoptStoreItems(deps, dana, "person:dana", AT);
    expect(allEvents(deps.db)).toHaveLength(before);
    expect(currentItems(deps.db).map((i) => i.store_ref?.key)).toEqual([`${item(1).id}.md`]);
  });

  test("after the owner rewrites the item, adopting the stale copy keeps the governed version", async () => {
    const root = await tempDir();
    const deps = { ...logOf(), adapter: createFilesAdapter({ root, owner: "dana" }) };
    const plane = createPlane(deps);
    await plane.write(dana, item(1), AT);
    await copyFile(join(root, `${item(1).id}.md`), join(root, "copy.md"));
    const v2 = item(1, { version: 2, content: "v2: the PIN hint was removed." });
    expect((await plane.write(dana, v2, AT)).event.decision).toBe("allow");
    await adoptStoreItems(deps, dana, "person:dana", AT);
    const read = await plane.read(dana, { at: AT });
    expect(read.items.map((i) => i.content)).toEqual(["v2: the PIN hint was removed."]);
    expect(currentItems(deps.db).filter((i) => i.status === "active")).toHaveLength(1);
  });
});

describe("RV-ADP-2 through the plane: two members' folders in one log", () => {
  const folder = async (text: string) => {
    const root = await tempDir("engram-rv3-cc-");
    await writeFile(
      join(root, "user_role.md"),
      `---\nname: role\ndescription: role\nmetadata:\n  type: user\n---\n${text}\n`,
    );
    return root;
  };

  // One log holding two folders needs two adapter names, since core keys a
  // ref by adapter name and file name; the surfaces name every folder
  // `files` (finding entry of card RV3).
  test("each adopts its own user_role.md, and adopting again retires neither", async () => {
    const shared = logOf();
    const dDeps = {
      ...shared,
      adapter: createFilesAdapter({
        root: await folder("Dana is a backend engineer."),
        owner: "dana",
        name: "files-dana",
        importValidFrom: "2026-10-01T00:00:00Z",
      }),
    };
    const eDeps = {
      ...shared,
      adapter: createFilesAdapter({
        root: await folder("Erin is a designer."),
        owner: "erin",
        name: "files-erin",
        importValidFrom: "2026-10-01T00:00:00Z",
      }),
    };
    expect((await adoptStoreItems(dDeps, dana, "person:dana", AT)).allowed).toBe(1);
    const e = await adoptStoreItems(eDeps, erin, "person:erin", AT);
    expect(e).toMatchObject({ allowed: 1, denied: 0, retired: 0 });
    const again = await adoptStoreItems(dDeps, dana, "person:dana", AT);
    expect(again).toMatchObject({ allowed: 0, denied: 0, retired: 0, unchanged: 1 });
    const reads = async (deps: typeof dDeps, who: typeof dana) =>
      (await createPlane(deps).read(who, { at: AT })).items.map((i) => i.content);
    expect(await reads(dDeps, dana)).toEqual(["Dana is a backend engineer."]);
    expect(await reads(eDeps, erin)).toEqual(["Erin is a designer."]);
    expect(
      currentItems(shared.db)
        .map((i) => [i.scope, i.status])
        .sort(),
    ).toEqual([
      ["person:dana", "active"],
      ["person:erin", "active"],
    ]);
  });

  test("under one adapter name, the second folder's adoption is refused and retires nothing", async () => {
    const shared = logOf();
    const dDeps = {
      ...shared,
      adapter: createFilesAdapter({
        root: await folder("Dana is a backend engineer."),
        owner: "dana",
      }),
    };
    const eDeps = {
      ...shared,
      adapter: createFilesAdapter({ root: await folder("Erin is a designer."), owner: "erin" }),
    };
    await adoptStoreItems(dDeps, dana, "person:dana", AT);
    await expect(adoptStoreItems(eDeps, erin, "person:erin", AT)).rejects.toThrow(
      "two item ids get two refs",
    );
    expect(currentItems(shared.db).map((i) => [i.scope, i.status, i.content])).toEqual([
      ["person:dana", "active", "Dana is a backend engineer."],
    ]);
  });
});

describe("RV-ADP-3 through the plane: MEMORY.md never names an Engram item", () => {
  test("after a ttl retirement, Claude Code's index holds no line naming the item", async () => {
    const root = await tempDir();
    await cp(FIXTURE, root, { recursive: true });
    const index = await readFile(join(root, "MEMORY.md"), "utf8");
    const deps = {
      ...logOf(),
      adapter: createFilesAdapter({ root, owner: "dana", importValidFrom: AT }),
    };
    const plane = createPlane(deps);
    const door = item(2, { content: "Temporary door code is 4417 until Friday.", ttl: 60 });
    expect((await plane.write(dana, door, "2026-10-01T00:00:10Z")).event.decision).toBe("allow");
    await plane.retain(dana, "person:dana", "2026-10-02T00:00:00Z");
    const read = await plane.read(dana, { at: "2026-10-02T00:00:00Z" });
    expect(read.items.map((i) => i.id)).not.toContain(door.id);
    const after = await readFile(join(root, "MEMORY.md"), "utf8");
    expect(after).toBe(index);
    expect(after).not.toContain(door.id);
    expect(after).not.toContain("4417");
  });
});
