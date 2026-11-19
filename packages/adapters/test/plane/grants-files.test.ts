// Grant changes over the files adapter (card E9.4, ADR 0034, proposed), the
// store the twin dogfood runs on (card E9.5). An item the plane wrote into
// the folder carries every field in its frontmatter, so a grant change
// rewrites its file, and adopting the folder again finds the store holding
// what the projection holds: no event, and the grant stands. A memory file
// Claude Code wrote carries no Engram metadata and the adapter holds it
// read-only (ReadOnlyItemError, a NotDeletableError), so a grant change on
// it is one deny event (engram/write/store-failure) returned as a decision,
// with the file and the item unchanged.
//
// A finding on the way (not caused by grants): an item the plane wrote with
// source user is re-adopted once by the next adoption of the folder, as
// import; see twinFolder.
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  adoptStoreItems,
  createPlane,
  currentItems,
  GRANT_CHANGE_ID,
  itemById,
  migrate,
  openSqlite,
  parsePolicy,
  STORE_FAILURE_ID,
} from "@engram/core";
import { afterAll, describe, expect, test } from "vitest";
import { createFilesAdapter } from "../../src/files/index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(HERE, "../../../../fixtures/stores/claude-code-memory");
const PROFILE = resolve(HERE, "../../../pi-package/profiles/twin.yaml");
const AT = "2026-11-19T10:00:00Z";
const LATER = "2026-11-19T11:00:00Z";
const dana = {
  id: "person:dana",
  level: "person" as const,
  memberships: ["person:dana"],
  source: "user" as const,
};
const sam = { id: "person:sam", level: "person" as const, memberships: ["person:sam"] };
const toSam = {
  to: "person:sam",
  class: "semantic" as const,
  mode: "read" as const,
  expires: "2026-12-19T00:00:00Z",
};
const OWN = "01920000-0000-7000-8000-000000000001";

const dirs: string[] = [];
afterAll(async () => {
  for (const dir of dirs) await rm(dir, { recursive: true, force: true });
});

/** Dana's Claude Code memory folder, adopted, and one item the plane wrote into it, under the twin profile. */
async function twinFolder() {
  const root = await mkdtemp(join(tmpdir(), "engram-grants-"));
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
    policy: parsePolicy(await readFile(PROFILE, "utf8"), "twin.yaml"),
    newId: () => `01920000-0000-7000-8000-${String(900_000 + ++n).padStart(12, "0")}`,
  };
  const plane = createPlane(deps);
  expect((await adoptStoreItems(deps, dana, "person:dana", AT)).allowed).toBe(4);
  const imported = currentItems(db);
  const { event } = await plane.write(
    dana,
    {
      id: OWN,
      class: "semantic",
      scope: "person:dana",
      owner: "person:dana",
      content: "Dana's sister Mira visits in December.",
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
    },
    AT,
  );
  expect(event.decision).toBe("allow");
  // The first adoption after a plane write re-adopts that item once, its
  // provenance kind becoming import (adoption compares provenance as the
  // adopter would set it); this predates grant changes and is logged as a
  // finding of card E9.4. Settled here, so the tests see only the grants.
  expect((await adoptStoreItems(deps, dana, "person:dana", AT)).allowed).toBe(1);
  return { root, db, deps, plane, imported };
}

describe("grant changes on a twin over the files adapter", () => {
  test("an item the plane wrote: its file carries the grant, and adoption leaves it standing", async () => {
    const { root, db, deps, plane } = await twinFolder();
    const result = await plane.changeGrants(dana, OWN, { add: [toSam] }, AT);
    expect(result.event).toMatchObject({ decision: "allow", policy_id: GRANT_CHANGE_ID });
    expect(await readFile(join(root, `${OWN}.md`), "utf8")).toContain("person:sam");

    const before = plane.events().length;
    const again = await adoptStoreItems(deps, dana, "person:dana", LATER);
    expect(again).toMatchObject({ allowed: 0, denied: 0, retired: 0 });
    expect(plane.events()).toHaveLength(before);
    expect(itemById(db, OWN)).toMatchObject({ version: 2, grants: [toSam] });
    expect((await plane.read(sam, { at: LATER })).items.map((i) => i.id)).toEqual([OWN]);
  });

  test("a memory Claude Code wrote: one deny event, returned as a decision, nothing changed", async () => {
    const { root, db, plane, imported } = await twinFolder();
    const target = imported[0];
    if (!target?.store_ref) throw new Error("the fixture adopted nothing");
    const file = await readFile(join(root, target.store_ref.key), "utf8");
    const before = plane.events().length;

    const result = await plane.changeGrants(dana, target.id, { add: [toSam] }, AT);

    expect(result).toMatchObject({ decision: "deny", item: null });
    expect(result.event).toMatchObject({ op: "update", policy_id: STORE_FAILURE_ID });
    expect(result.event.reason).toMatch(/refuses to rewrite the record.*read-only/);
    expect(plane.events()).toHaveLength(before + 1);
    expect(itemById(db, target.id)).toEqual(target);
    expect(await readFile(join(root, target.store_ref.key), "utf8")).toBe(file);
  });
});
