// Card RV3 on the Letta adapter. RV-ADP-5 (backlog row "Letta delete
// refusals"): a permanent delete refusal (an unsafe key, a hard-linked item
// file, a folder that is not a MemFS repository) is a NotDeletableError, so
// offboarding reports the record as left in the store instead of keeping the
// item back on every rerun; a busy repository stays transient. Mutants M10
// and M11 of the review: the serialise round-trip check, and history's
// dropping of a version identical to the one before it.
import { link, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isNotDeletable, type MemoryItem } from "@engram/core";
import { describe, expect, test } from "vitest";
import { deferLettaAdapter } from "../../src/letta/deferred.ts";
import {
  createLettaAdapter,
  NotMemfsRepositoryError,
  RepositoryBusyError,
  UnsafeLettaPathError,
} from "../../src/letta/index.ts";
import { commits, freshLettaRepo, item, tempDir } from "./helpers.ts";

async function refusal(p: Promise<unknown>): Promise<unknown> {
  try {
    await p;
  } catch (e) {
    return e;
  }
  throw new Error("expected the promise to reject");
}

describe("RV-ADP-5: the Letta adapter's permanent delete refusals are NotDeletableError", () => {
  test("a hard-linked item file", async () => {
    const root = await freshLettaRepo();
    const outside = await tempDir();
    const adapter = await createLettaAdapter({ root });
    const ref = await adapter.write(item(1));
    await link(join(root, ref.key), join(outside, "linked.md"));
    const e = await refusal(adapter.delete(ref));
    expect(e).toBeInstanceOf(UnsafeLettaPathError);
    expect(isNotDeletable(e)).toBe(true);
    expect(await readdir(join(root, "engram"))).toContain(`${item(1).id}.md`);
  });

  test("a key that is not an Engram item key", async () => {
    const adapter = await createLettaAdapter({ root: await freshLettaRepo() });
    const e = await refusal(adapter.delete({ adapter: "letta", key: "engram/../x.md" }));
    expect(e).toBeInstanceOf(UnsafeLettaPathError);
    expect(isNotDeletable(e)).toBe(true);
  });

  test("a folder that is not a MemFS repository, through the deferred adapter a surface opens", async () => {
    const root = await tempDir();
    const adapter = deferLettaAdapter({ root });
    // The folder stops being openable after the surface checked it.
    await writeFile(join(root, "notes.txt"), "not a repository");
    const e = await refusal(adapter.delete({ adapter: "letta", key: `engram/${item(2).id}.md` }));
    expect(e).toBeInstanceOf(NotMemfsRepositoryError);
    expect(isNotDeletable(e)).toBe(true);
  });

  test("a busy repository stays a transient failure", () => {
    expect(isNotDeletable(new RepositoryBusyError("/r", "has a detached HEAD"))).toBe(false);
  });
});

describe("mutant M10: a write that would not read back exactly is refused", () => {
  test("a field the file cannot carry: nothing is written or committed", async () => {
    const root = await freshLettaRepo();
    const adapter = await createLettaAdapter({ root });
    const before = await commits(root);
    // Not a field of the schema: the file would hold it, the read would refuse it.
    const odd = { ...item(3), note: "not an item field" } as unknown as MemoryItem;
    await expect(adapter.write(odd)).rejects.toThrow("would not read back exactly");
    expect(await readdir(join(root, "engram"))).not.toContain(`${item(3).id}.md`);
    expect(await commits(root)).toEqual(before);
  });
});

describe("mutant M11: history keeps one version where identical ones follow each other", () => {
  test("write, delete, then rewrite the same content: one version", async () => {
    const root = await freshLettaRepo();
    const adapter = await createLettaAdapter({ root });
    const v1 = item(4);
    const ref = await adapter.write(v1);
    await adapter.delete(ref);
    expect(await adapter.write(v1)).toEqual(ref);
    expect(await adapter.history(ref)).toEqual([{ ...v1, store_ref: ref }]);
  });
});
