// Offboarding over the files adapter (review of PR #41): the memory files
// Claude Code wrote carry no Engram metadata, so the store refuses the plane's
// delete on every attempt (ReadOnlyItemError, a NotDeletableError). Such a
// refusal is permanent: the items are still erased from the projection and
// the log, the deletion report names the files left in the folder for the
// person to delete, and adopting the folder again does not bring them back.
// A transient store failure still keeps the item back with a deny event.
//
// Adoption refuses a store record only while it holds the very content that
// was erased and left in the store (recheck of PR #41): one deny event under
// engram/adopt/erased, decided in the write queue. A successor adopting the
// folder unchanged is refused; edited files, a person rewriting a file after
// erasure, and another person's own folder with the same file names adopt
// normally. The refusal belongs to the erased item's own record: another
// person's file holding the same text under another name adopts, while a
// case, width or invisible-character edit of the erased file is still the
// erased content (the merging hash). A read racing the offboarding and a
// re-adoption under the same id never serves the erased version (second
// recheck of PR #41).
import { cp, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  adoptStoreItems,
  allEvents,
  createPlane,
  currentItems,
  ERASURE_ID,
  eventsByItem,
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
const erin = {
  id: "person:erin",
  level: "person" as const,
  memberships: ["person:erin"],
  source: "user" as const,
};
const ADOPT_ERASED = "engram/adopt/erased";

/** Rewrites the body of memory file `name` under `root`, keeping its frontmatter. */
async function rewrite(root: string, name: string, body: string) {
  const path = join(root, name);
  const text = await readFile(path, "utf8");
  const end = text.indexOf("\n---", 4) + "\n---\n".length;
  await writeFile(path, `${text.slice(0, end)}\n${body}\n`);
}
const MEMORY_FILES = [
  "feedback_review_style.md",
  "project_release_freeze.md",
  "reference_runbook.md",
  "user_role.md",
];

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
    expect(again.denied).toBe(4);
    expect(again.denials.every((d) => d.policy_id === ADOPT_ERASED)).toBe(true);
    expect(currentItems(db)).toEqual([]);
    // A second adoption appends nothing: the same records were denied already.
    const n = allEvents(db).length;
    const third = await adoptStoreItems(deps, dana, "person:dana", LATER);
    expect(third.unchanged).toBe(4);
    expect(allEvents(db)).toHaveLength(n);
    rebuild(db);
    expect(currentItems(db)).toEqual([]);
    expect(adapter.name).toBe("files");
  });

  test("a successor adopting the folder unchanged is refused, with one deny event per file", async () => {
    const { root, db, deps } = await adopted();
    await offboard(deps, dana, LEAVE, LATER);
    const hers = { ...deps, adapter: createFilesAdapter({ root, owner: "erin" }) };
    const report = await adoptStoreItems(hers, erin, "person:erin", LATER);
    expect(report).toMatchObject({ allowed: 0, denied: 4 });
    const denials = allEvents(db).filter((e) => e.policy_id === ADOPT_ERASED);
    expect(denials).toHaveLength(4);
    for (const e of denials) {
      expect(e).toMatchObject({ decision: "deny", actor: erin.id, scope_to: "person:erin" });
      expect(e.reason).not.toMatch(/Lantern|Dana is/);
    }
    expect(currentItems(db)).toEqual([]);
  });

  test("a successor adopting the folder after editing its files adopts them", async () => {
    const { root, db, deps } = await adopted();
    await offboard(deps, dana, LEAVE, LATER);
    for (const name of MEMORY_FILES) await rewrite(root, name, `Erin's own note in ${name}.`);
    const hers = { ...deps, adapter: createFilesAdapter({ root, owner: "erin" }) };
    const report = await adoptStoreItems(hers, erin, "person:erin", LATER);
    expect(report).toMatchObject({ allowed: 4, denied: 0 });
    expect(currentItems(db).filter((i) => i.scope === "person:erin")).toHaveLength(4);
  });

  test("another person's own folder with the same file names adopts fully after the offboarding", async () => {
    const { db, deps } = await adopted();
    await offboard(deps, dana, LEAVE, LATER);
    const other = await mkdtemp(join(tmpdir(), "engram-offboard-erin-"));
    dirs.push(other);
    await cp(FIXTURE, other, { recursive: true });
    for (const name of MEMORY_FILES) await rewrite(other, name, `Erin wrote this in ${name}.`);
    const hers = { ...deps, adapter: createFilesAdapter({ root: other, owner: "erin" }) };
    const report = await adoptStoreItems(hers, erin, "person:erin", LATER);
    expect(report).toMatchObject({ allowed: 4, denied: 0 });
    expect(currentItems(db).filter((i) => i.scope === "person:erin")).toHaveLength(4);
  });

  test("a file the person rewrites after the erasure is adopted; the untouched ones stay refused", async () => {
    const { root, db, deps } = await adopted();
    await offboard(deps, dana, LEAVE, LATER);
    await rewrite(root, "user_role.md", "Dana moved to the data platform team.");
    const report = await adoptStoreItems(deps, dana, "person:dana", LATER);
    expect(report).toMatchObject({ allowed: 1, denied: 3 });
    expect(currentItems(db).map((i) => i.content)).toEqual([
      "Dana moved to the data platform team.",
    ]);
  });

  test("an adoption queued before the offboarding does not bring the erased bytes back", async () => {
    const { root, db, deps, items } = await adopted();
    // Dana edits a file; the adoption that would pick up the edit is queued
    // behind the offboarding, which erases the item and leaves the edited
    // file in the folder.
    await rewrite(root, "user_role.md", "Dana now leads the frontend rewrite.");
    const role = items.find((i) => i.store_ref?.key === "user_role.md");
    const adoption = adoptStoreItems(deps, dana, "person:dana", LATER);
    const report = await offboard(deps, dana, LEAVE, LATER);
    const adopted2 = await adoption;
    expect(report.erased.items).toContain(role?.id);
    expect(adopted2.allowed).toBe(0);
    expect(currentItems(db)).toEqual([]);
    const after = eventsByItem(db, role?.id as string);
    const erasedAt = after.findIndex((e) => e.policy_id === ERASURE_ID);
    expect(erasedAt).toBeGreaterThanOrEqual(0);
    expect(
      after.slice(erasedAt + 1).filter((e) => e.op === "write" && e.decision === "allow"),
    ).toEqual([]);
    expect(JSON.stringify(allEvents(db))).not.toContain("frontend rewrite");
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

  test("another person's file whose text equals an erased file's, under another name, adopts", async () => {
    const { root, db, deps } = await adopted();
    await offboard(deps, dana, LEAVE, LATER);
    const other = await mkdtemp(join(tmpdir(), "engram-offboard-erin-"));
    dirs.push(other);
    await cp(join(root, "project_release_freeze.md"), join(other, "lantern_freeze.md"));
    const hers = { ...deps, adapter: createFilesAdapter({ root: other, owner: "erin" }) };
    const report = await adoptStoreItems(hers, erin, "person:erin", LATER);
    expect(report).toMatchObject({ allowed: 1, denied: 0 });
    expect(allEvents(db).filter((e) => e.policy_id === ADOPT_ERASED)).toEqual([]);
    expect(currentItems(db).filter((i) => i.scope === "person:erin")).toHaveLength(1);
  });

  test("a case, width or invisible-character edit of an erased file is still refused", async () => {
    const { root, db, deps, items } = await adopted();
    await offboard(deps, dana, LEAVE, LATER);
    const body = (key: string) => String(items.find((i) => i.store_ref?.key === key)?.content);
    await rewrite(root, "user_role.md", body("user_role.md").replace(" ", "​ "));
    await rewrite(
      root,
      "project_release_freeze.md",
      body("project_release_freeze.md").toLowerCase(),
    );
    await rewrite(
      root,
      "reference_runbook.md",
      body("reference_runbook.md").normalize("NFKD").replace("a", "ａ"),
    );
    const hers = { ...deps, adapter: createFilesAdapter({ root, owner: "erin" }) };
    const report = await adoptStoreItems(hers, erin, "person:erin", LATER);
    expect(report).toMatchObject({ allowed: 0, denied: 4 });
    expect(currentItems(db)).toEqual([]);
  });

  test("a read racing the offboarding and a re-adoption under the same id never serves the erased version", async () => {
    const { root, adapter, db, deps, items } = await adopted();
    const role = items.find((i) => i.store_ref?.key === "user_role.md");
    const erased = String(role?.content);
    const search = adapter.search?.bind(adapter);
    if (!search) throw new Error("the files adapter searches");
    let raced = false;
    adapter.search = async (query, scopes) => {
      const hits = await search(query, scopes);
      if (!raced) {
        raced = true;
        await offboard(deps, dana, LEAVE, LATER);
        await rewrite(root, "user_role.md", "Dana moved to the data platform team.");
        const back = await adoptStoreItems(deps, dana, "person:dana", LATER);
        expect(back.allowed).toBe(1);
      }
      return hits;
    };
    const { items: got, event } = await createPlane(deps).read(dana, { at: LATER, text: "Dana" });
    const contents = got.map((i) => String(i.content));
    expect(contents).not.toContain(erased);
    expect(contents).toEqual(["Dana moved to the data platform team."]);
    expect(event.item_ids).toEqual([role?.id]);
    expect(JSON.stringify(allEvents(db))).not.toContain(erased.slice(0, 40));
  });
});
