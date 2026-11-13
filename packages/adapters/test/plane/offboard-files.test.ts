// Offboarding over the files adapter (review of PR #41): the memory files
// Claude Code wrote carry no Engram metadata, so the store refuses the plane's
// delete on every attempt (ReadOnlyItemError, a NotDeletableError). Such a
// refusal is permanent: the items are still erased from the projection and
// the log, the deletion report names the files left in the folder for the
// person to delete, and adopting the folder again does not bring them back.
// A transient store failure still keeps the item back with a deny event.
import { cp, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  adoptStoreItems,
  allEvents,
  currentItems,
  ERASURE_ID,
  loadPreset,
  migrate,
  offboard,
  openSqlite,
  rebuild,
  STORE_FAILURE_ID,
} from "@engram/core";
import { afterAll, describe, expect, test } from "vitest";
import { createFilesAdapter } from "../../src/files/index.ts";

const FIXTURE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../fixtures/stores/claude-code-memory",
);
const AT = "2026-10-25T12:00:00Z";
const LATER = "2026-10-26T12:00:00Z";
const dana = {
  id: "person:dana",
  level: "person" as const,
  memberships: ["person:dana"],
  source: "user" as const,
};
const LEAVE = { person: "person:dana", roles: [] };

const dirs: string[] = [];
afterAll(async () => {
  for (const dir of dirs) await rm(dir, { recursive: true, force: true });
});

/** The fixture folder copied to a temporary root and adopted as Dana's. */
async function adopted() {
  const root = await mkdtemp(join(tmpdir(), "engram-offboard-"));
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
  const report = await adoptStoreItems(deps, dana, "person:dana", AT);
  expect(report.allowed).toBe(4);
  const items = currentItems(db);
  return { root, adapter, db, deps, items };
}

describe("offboarding a person whose memory is an adopted Claude Code folder", () => {
  test("erases the imported items, names the files left in the folder, and re-adoption brings none back", async () => {
    const { root, adapter, db, deps, items } = await adopted();
    const files = (await readdir(root)).sort();
    const report = await offboard(deps, dana, LEAVE, LATER);

    expect(report.erased.items).toEqual(items.map((i) => i.id).sort());
    expect(report.erased.store_failures).toEqual([]);
    expect(report.erased.left_in_store.map((l) => l.ref.key).sort()).toEqual(
      items.map((i) => i.store_ref?.key).sort(),
    );
    expect(report.erased.left_in_store.every((l) => /read-only/.test(l.error))).toBe(true);
    expect(report.not_reached.join(" ")).toMatch(/left in the store/);
    expect(currentItems(db)).toEqual([]);
    const log = JSON.stringify(allEvents(db));
    for (const it of items) expect(log).not.toContain(String(it.content).slice(0, 40));
    for (const e of report.events.filter((x) => x.policy_id === ERASURE_ID))
      expect(e.reason).toMatch(/left in the store/);
    // The plane did not touch the folder: the person deletes the files there.
    expect((await readdir(root)).sort()).toEqual(files);

    const again = await adoptStoreItems(deps, dana, "person:dana", LATER);
    expect(again.allowed).toBe(0);
    expect(again.unchanged).toBe(4);
    expect(currentItems(db)).toEqual([]);
    rebuild(db);
    expect(currentItems(db)).toEqual([]);
    expect(adapter.name).toBe("files");
  });

  test("a transient store failure still keeps the item back with a deny event", async () => {
    const { adapter, db, deps, items } = await adopted();
    const [first] = items;
    const remove = adapter.delete.bind(adapter);
    adapter.delete = async (ref) => {
      if (ref.key === first?.store_ref?.key) throw new Error("disk unavailable");
      return remove(ref);
    };
    const report = await offboard(deps, dana, LEAVE, LATER);
    expect(report.erased.items).not.toContain(first?.id);
    expect(report.erased.store_failures.map((f) => f.items)).toEqual([[first?.id]]);
    expect(currentItems(db).map((i) => i.id)).toEqual([first?.id]);
    const deny = report.events.find((e) => e.item_id === first?.id);
    expect(deny).toMatchObject({ decision: "deny", policy_id: STORE_FAILURE_ID });
  });
});
