// Core review finding RV-CORE-10 (card RV7), reproduced: a store record
// written before schema version 1 is never migrated. The log's migration
// (packages/core/src/db/migrate.ts) bumps the events and the projection, but
// a files-adapter record still says `schema_version: 0`, which the schema
// refuses. This pins what happens today, so the fix (backlog row "Version 0
// workspaces") changes this test on purpose: the adapter skips the file as
// unreadable, and the next adoption retracts the projected item (one retire
// event whose reason quotes the schema error), so the person's memory
// disappears from reads. The review guessed a schema deny per record with
// the projection still serving it; the retraction is what happens.
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  adoptStoreItems,
  allEvents,
  createPlane,
  itemById,
  migrate,
  openSqlite,
  parsePolicy,
} from "@engram/core";
import { afterAll, describe, expect, test } from "vitest";
import { createFilesAdapter } from "../../src/files/index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = resolve(HERE, "../../../pi-package/profiles/twin.yaml");
const AT = "2026-11-20T10:00:00Z";
const LATER = "2026-11-20T11:00:00Z";
const ID = "01920000-0000-7000-8000-000000000001";
const dana = {
  id: "person:dana",
  level: "person" as const,
  memberships: ["person:dana"],
  source: "user" as const,
};

const dirs: string[] = [];
afterAll(async () => {
  for (const dir of dirs) await rm(dir, { recursive: true, force: true });
});

describe("a store record at schema version 0 (RV-CORE-10, reproduced)", () => {
  test("is skipped as unreadable, and adoption retracts the item the projection still served", async () => {
    const root = await mkdtemp(join(tmpdir(), "engram-v0-"));
    dirs.push(root);
    const adapter = createFilesAdapter({ root, owner: "dana" });
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
    const { event } = await plane.write(
      dana,
      {
        id: ID,
        class: "semantic",
        scope: "person:dana",
        owner: "person:dana",
        content: "Dana's sister visits in December.",
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
    // The record as a version 0 workspace left it.
    const [file] = (await readdir(root)).filter((f) => f.endsWith(".md") && f !== "MEMORY.md");
    const path = join(root, file as string);
    const text = await readFile(path, "utf8");
    expect(text).toContain("schema_version: 1");
    await writeFile(path, text.replace("schema_version: 1", "schema_version: 0"));

    expect(await adapter.list("person:dana")).toEqual([]);
    expect(adapter.diagnostics?.().map((d) => d.key)).toEqual([file]);
    const before = allEvents(db).length;
    await adoptStoreItems(deps, dana, "person:dana", LATER);
    const added = allEvents(db).slice(before);
    expect(added.map((e) => [e.op, e.decision, e.policy_id])).toEqual([
      ["retire", "allow", "engram/adopt/retract"],
    ]);
    expect(added[0]?.reason).toContain("can no longer read item");
    expect(added[0]?.reason).toContain("schema_version");
    expect(itemById(db, ID)?.status).toBe("retired");
    expect((await plane.read(dana, { at: LATER })).items).toEqual([]);
  });
});
