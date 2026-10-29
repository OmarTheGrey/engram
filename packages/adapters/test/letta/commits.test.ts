// Card A2's second acceptance clause, "a commit per write": n allowed writes
// and m deletes give n plus m commits, each touching only the item's file
// and engram/MEMORY.md; rewriting identical bytes gives none; a write the
// plane denies reaches no store, so it makes no commit.
import {
  type Actor,
  createPlane,
  loadPreset,
  migrate,
  openSqlite,
  type StoreRef,
} from "@engram/core";
import { describe, expect, test } from "vitest";
import { createLettaAdapter } from "../../src/letta/index.ts";
import { commits, freshLettaRepo, id, item, status, touched } from "./helpers.ts";

describe("a commit per write (card A2)", () => {
  test("n writes and m deletes make n plus m commits, each touching only the item file and the index", async () => {
    const root = await freshLettaRepo();
    const adapter = await createLettaAdapter({ root });
    const before = await commits(root);
    const refs: StoreRef[] = [];
    // n = 5: three new items, a rewrite to version 2, and a status-only rewrite.
    for (const n of [1, 2, 3]) refs.push(await adapter.write(item(n)));
    await adapter.write(item(1, { version: 2, content: "Fact number 1, revised." }));
    await adapter.write(item(2, { status: "retired" }));
    // An identical rewrite stores nothing new and commits nothing.
    await adapter.write(item(3));
    // m = 2.
    await adapter.delete(refs[0] as StoreRef);
    await adapter.delete(refs[2] as StoreRef);
    // Deleting an unknown item commits nothing either.
    await adapter.delete(refs[0] as StoreRef);

    const added = (await commits(root)).slice(before.length);
    expect(added).toHaveLength(5 + 2);
    const keys = [1, 2, 3, 1, 2, 1, 3].map((n) => `engram/${id(n)}.md`);
    for (const [i, sha] of added.entries()) {
      const files = await touched(root, sha);
      // The item file always; the index too, unless its line did not change
      // (a status-only rewrite: the line names class, scope and version).
      expect(files).toContain(keys[i]);
      expect(files.filter((f) => f !== keys[i] && f !== "engram/MEMORY.md")).toEqual([]);
    }
    expect(await touched(root, added[4] as string)).toEqual([keys[4]]);
    expect(await status(root)).toEqual([]);
  });

  test("a write the plane denies makes no commit, and the allowed one after it makes one", async () => {
    const root = await freshLettaRepo();
    const adapter = await createLettaAdapter({ root });
    const db = openSqlite(":memory:");
    migrate(db);
    let n = 0;
    const plane = createPlane({
      db,
      adapter,
      policy: loadPreset("medium"),
      newId: () => id(900_000 + ++n),
    });
    const writer: Actor = { id: "person:omar", level: "team", memberships: ["team:platform"] };
    const before = await commits(root);
    const denied = await plane.write(
      writer,
      item(10, { class: "episodic" }),
      "2026-10-25T12:00:00Z",
    );
    expect(denied.event.decision).toBe("deny");
    expect(await commits(root)).toEqual(before);
    const allowed = await plane.write(writer, item(11), "2026-10-25T12:00:00Z");
    expect(allowed.event.decision).toBe("allow");
    const after = await commits(root);
    expect(after).toHaveLength(before.length + 1);
    expect(await touched(root, after.at(-1) as string)).toEqual(
      [`engram/${id(11)}.md`, "engram/MEMORY.md"].sort(),
    );
  });
});
