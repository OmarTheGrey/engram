// Adoption on the files adapter: the read-only memories Claude Code wrote
// cross the write gate and become readable through Plane.read, without a
// ReadOnlyItemError and without a byte of the folder changing.
import { cp, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { adoptStoreItems, createPlane, loadPreset, migrate, openSqlite } from "@engram/core";
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
});
