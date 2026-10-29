// Adoption on the files adapter: the read-only memories Claude Code wrote
// cross the write gate and become readable through Plane.read, without a
// ReadOnlyItemError and without a byte of the folder changing.
import { cp, mkdtemp, readdir, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  adoptStoreItems,
  allEvents,
  createPlane,
  loadPreset,
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
const dana = { id: "person:dana", level: "person" as const, memberships: ["person:dana"] };

const dirs: string[] = [];
afterAll(async () => {
  for (const dir of dirs) await rm(dir, { recursive: true, force: true });
});

async function snapshot(dir: string) {
  const names = (await readdir(dir)).sort();
  return Promise.all(names.map(async (n) => [n, await readFile(join(dir, n), "utf8")]));
}

describe("adopting a Claude Code memory folder", () => {
  test("imported memories are adopted, readable, and the folder is untouched", async () => {
    const root = await mkdtemp(join(tmpdir(), "engram-adopt-"));
    dirs.push(root);
    await cp(FIXTURE, root, { recursive: true });
    const before = await snapshot(root);

    const adapter = createFilesAdapter({
      root,
      owner: "dana",
      importValidFrom: "2026-10-01T00:00:00Z",
    });
    const db = openSqlite(":memory:");
    migrate(db);
    let n = 0;
    const deps = {
      db,
      adapter,
      policy: loadPreset("medium"),
      newId: () => `01920000-0000-7000-8000-${String(900_000 + ++n).padStart(12, "0")}`,
    };

    const report = await adoptStoreItems(deps, dana, "person:dana", AT);
    expect(report).toEqual({
      listed: 4,
      allowed: 4,
      denied: 0,
      unchanged: 0,
      retired: 0,
      denials: [],
      retirements: [],
      evictions: [],
    });

    const { items, filtered } = await createPlane(deps).read(dana, { at: AT });
    expect(items).toHaveLength(4);
    expect(filtered).toBe(0);
    expect(items.every((i) => i.provenance.kind === "import")).toBe(true);
    expect(await snapshot(root)).toEqual(before);
  });

  test("a deleted memory file is retired and an edited one is read as the folder now has it", async () => {
    const root = await mkdtemp(join(tmpdir(), "engram-adopt-"));
    dirs.push(root);
    await cp(FIXTURE, root, { recursive: true });
    const adapter = createFilesAdapter({
      root,
      owner: "dana",
      importValidFrom: "2026-10-01T00:00:00Z",
    });
    const db = openSqlite(":memory:");
    migrate(db);
    let n = 0;
    const deps = {
      db,
      adapter,
      policy: loadPreset("medium"),
      newId: () => `01920000-0000-7000-8000-${String(900_000 + ++n).padStart(12, "0")}`,
    };
    await adoptStoreItems(deps, dana, "person:dana", AT);

    await rm(join(root, "reference_runbook.md"));
    const runbook = await readFile(join(root, "user_role.md"), "utf8");
    await writeFile(
      join(root, "user_role.md"),
      runbook.replace(/\n*$/, "\nEdited after adoption.\n"),
    );
    const report = await adoptStoreItems(deps, dana, "person:dana", AT);

    expect(report).toMatchObject({ listed: 3, allowed: 1, unchanged: 2, retired: 1 });
    const { items } = await createPlane(deps).read(dana, { at: AT });
    expect(items).toHaveLength(3);
    expect(items.some((i) => i.provenance.ref.endsWith("/reference_runbook.md"))).toBe(false);
    const edited = items.find((i) => i.provenance.ref.endsWith("/user_role.md"));
    expect(String(edited?.content)).toContain("Edited after adoption.");
  });

  test("touching a file, its content unchanged, adds no event and gates nothing again", async () => {
    const root = await mkdtemp(join(tmpdir(), "engram-adopt-"));
    dirs.push(root);
    await cp(FIXTURE, root, { recursive: true });
    const first = new Date("2026-10-01T00:00:00.000Z");
    for (const name of await readdir(root)) await utimes(join(root, name), first, first);
    // valid_from comes from each file's modification time: no importValidFrom.
    const adapter = createFilesAdapter({ root, owner: "dana" });
    const db = openSqlite(":memory:");
    migrate(db);
    let n = 0;
    const deps = {
      db,
      adapter,
      policy: loadPreset("medium"),
      newId: () => `01920000-0000-7000-8000-${String(900_000 + ++n).padStart(12, "0")}`,
    };
    await adoptStoreItems(deps, dana, "person:dana", AT);
    const before = allEvents(db);

    const touched = new Date("2026-10-20T00:00:00.000Z");
    await utimes(join(root, "user_role.md"), touched, touched);
    const report = await adoptStoreItems(deps, dana, "person:dana", AT);

    expect(report).toMatchObject({ listed: 4, allowed: 0, denied: 0, unchanged: 4, retired: 0 });
    expect(allEvents(db)).toEqual(before);
    const { items } = await createPlane(deps).read(dana, { at: AT });
    const role = items.find((i) => i.provenance.ref.endsWith("/user_role.md"));
    expect(role?.valid_from).toBe("2026-10-01T00:00:00.000Z");
  });

  test("a file the adapter can no longer parse is retired with the store's diagnostic", async () => {
    const root = await mkdtemp(join(tmpdir(), "engram-adopt-"));
    dirs.push(root);
    await cp(FIXTURE, root, { recursive: true });
    const adapter = createFilesAdapter({
      root,
      owner: "dana",
      importValidFrom: "2026-10-01T00:00:00Z",
    });
    const db = openSqlite(":memory:");
    migrate(db);
    let n = 0;
    const deps = {
      db,
      adapter,
      policy: loadPreset("medium"),
      newId: () => `01920000-0000-7000-8000-${String(900_000 + ++n).padStart(12, "0")}`,
    };
    await adoptStoreItems(deps, dana, "person:dana", AT);

    await writeFile(join(root, "user_role.md"), "---\nname: [unclosed\n---\nThe body.\n");
    const report = await adoptStoreItems(deps, dana, "person:dana", AT);

    expect(report).toMatchObject({ listed: 3, retired: 1 });
    const reason = report.retirements[0]?.reason ?? "";
    expect(reason).toMatch(
      /^adopted from store files: store files can no longer read item [0-9a-f-]{36} \(user_role\.md\): files adapter: user_role\.md has unreadable frontmatter: /,
    );
    expect(reason).not.toContain("no longer in store");
    const { items } = await createPlane(deps).read(dana, { at: AT });
    expect(items.some((i) => i.provenance.ref.endsWith("/user_role.md"))).toBe(false);
  });
});
