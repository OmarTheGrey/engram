// Card RV3: the repository review's findings on the files adapter, each as
// the scenario the reviewer's probe staged. RV-ADP-1: an Engram file is tied
// to its name, so a copy is refused, not listed twice. RV-ADP-2: an imported
// file's id comes from its folder and its name, so two folders' files of one
// name are two items. RV-ADP-3: MEMORY.md is Claude Code's, never touched.
// RV-ADP-5: every permanent delete refusal is a NotDeletableError.
// RV-ADP-10: a crashed writer's temporary files are removed. Mutant M1: a
// write never replaces a Claude Code file named `<uuid>.md`.
import {
  copyFile,
  cp,
  link,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isNotDeletable, type MemoryItem } from "@engram/core";
import { afterAll, describe, expect, test } from "vitest";
import {
  createFilesAdapter,
  importedItemId,
  ReadOnlyItemError,
  UnreadableItemError,
  UnsafeKeyError,
} from "../../src/files/index.ts";

const FIXTURE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../fixtures/stores/claude-code-memory",
);
const VALID_FROM = "2026-10-01T08:00:00.000Z";

const dirs: string[] = [];
const tempDir = async () => {
  const dir = await mkdtemp(join(tmpdir(), "engram-rv3-"));
  dirs.push(dir);
  return dir;
};
const fixtureCopy = async () => {
  const dir = await tempDir();
  await cp(FIXTURE, dir, { recursive: true });
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
    content: "Dana's deploy notes go in the team channel.",
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

/** The rejection a promise ends in. */
async function refusal(p: Promise<unknown>): Promise<unknown> {
  try {
    await p;
  } catch (e) {
    return e;
  }
  throw new Error("expected the promise to reject");
}

describe("RV-ADP-1: an Engram file is tied to its file name", () => {
  test("a copy of an Engram file is not listed, searched or read, and is reported", async () => {
    const root = await tempDir();
    const adapter = createFilesAdapter({ root, owner: "dana" });
    const ref = await adapter.write(item(1));
    await copyFile(join(root, ref.key), join(root, "copy.md"));

    const listed = await adapter.list("person:dana");
    expect(listed.map((i) => [i.id, i.store_ref?.key])).toEqual([[item(1).id, ref.key]]);
    expect(adapter.diagnostics()).toEqual([
      { key: "copy.md", reason: expect.stringContaining(item(1).id) },
    ]);
    const hits = await adapter.search?.("deploy notes", ["person:dana"]);
    expect(hits?.map((h) => h.store_ref?.key)).toEqual([ref.key]);
    await expect(adapter.read({ adapter: "files", key: "copy.md" })).rejects.toBeInstanceOf(
      UnreadableItemError,
    );
  });

  test("an item file renamed to another id's name is refused for both ids", async () => {
    const root = await tempDir();
    const adapter = createFilesAdapter({ root, owner: "dana" });
    const ref = await adapter.write(item(2));
    const other = `${item(3).id}.md`;
    await copyFile(join(root, ref.key), join(root, other));
    await expect(adapter.read({ adapter: "files", key: other })).rejects.toThrow(item(2).id);
    // A write of item 3 does not replace a file it cannot read as its own.
    await expect(adapter.write(item(3))).rejects.toBeInstanceOf(UnreadableItemError);
    expect((await adapter.list("person:dana")).map((i) => i.id)).toEqual([item(2).id]);
  });
});

describe("RV-ADP-2: an imported file's id names its folder and its file", () => {
  test("two folders' files of one name are two items; one folder's ids are stable", async () => {
    const a = await fixtureCopy();
    const b = await fixtureCopy();
    const ids = async (root: string, owner: string) =>
      (
        await createFilesAdapter({ root, owner, importValidFrom: VALID_FROM }).list(
          `person:${owner}`,
        )
      )
        .map((i) => i.id)
        .sort();
    const dana = await ids(a, "dana");
    const erin = await ids(b, "erin");
    expect(dana).toHaveLength(4);
    expect(dana.filter((id) => erin.includes(id))).toEqual([]);
    expect(await ids(a, "dana")).toEqual(dana);
    expect(dana).toContain(importedItemId(a, "user_role.md"));
    expect(importedItemId(a, "user_role.md")).not.toBe(importedItemId(b, "user_role.md"));
  });

  test("two spellings of one folder give one id", async () => {
    const root = await fixtureCopy();
    expect(importedItemId(`${root}/`, "user_role.md")).toBe(importedItemId(root, "user_role.md"));
    expect(importedItemId(join(root, "x", ".."), "user_role.md")).toBe(
      importedItemId(root, "user_role.md"),
    );
  });
});

describe("review fix pass, RV3-6: the folder's identity is its real path once it exists", () => {
  test("an adapter opened on a folder that does not exist yet, through a junction, ids by the real folder", async ({
    skip,
  }) => {
    const real = await tempDir();
    const parent = await tempDir();
    const junction = join(parent, "via");
    try {
      await symlink(real, junction, "junction");
    } catch (e) {
      if (
        ["EPERM", "EACCES", "ENOSYS", "ENOTSUP"].includes((e as NodeJS.ErrnoException).code ?? "")
      )
        return skip("junctions and symlinks are unavailable here");
      throw e;
    }
    const root = join(junction, "memory");
    const adapter = createFilesAdapter({ root, owner: "dana", importValidFrom: VALID_FROM });
    // Used before the folder exists: nothing listed, nothing to name.
    expect(await adapter.list("person:dana")).toEqual([]);
    expect(importedItemId(root, "user_role.md")).toBe(importedItemId(root, "user_role.md"));
    await adapter.write(item(20));
    await writeFile(
      join(root, "user_role.md"),
      "---\nname: role\n---\nDana is a backend engineer.\n",
    );
    const [role] = (await adapter.list("person:dana")).filter(
      (i) => i.store_ref?.key === "user_role.md",
    );
    expect(role?.id).toBe(importedItemId(join(real, "memory"), "user_role.md"));
    expect(role?.id).toBe(importedItemId(await realpath(root), "user_role.md"));
  });
});

describe("review fix pass, RV3-4: a case-only rename of an item file", () => {
  test("blocks rewrites of the item until the file is renamed back", async () => {
    const root = await tempDir();
    const adapter = createFilesAdapter({ root, owner: "dana" });
    const hex = { id: "01920000-0000-7000-8000-00000000abcd" };
    const ref = await adapter.write(item(21, hex));
    const upper = ref.key.toUpperCase().replace(/\.MD$/, ".md");
    await rename(join(root, ref.key), join(root, `${ref.key}.tmp`));
    await rename(join(root, `${ref.key}.tmp`), join(root, upper));
    await expect(
      adapter.write(item(21, { ...hex, version: 2, content: "v2" })),
    ).rejects.toBeInstanceOf(UnsafeKeyError);
    // The renamed file is not read as the item: its name says another id.
    expect(await adapter.list("person:dana")).toEqual([]);
    expect(adapter.diagnostics().map((d) => d.key)).toEqual([upper]);
    await rename(join(root, upper), join(root, `${ref.key}.tmp`));
    await rename(join(root, `${ref.key}.tmp`), join(root, ref.key));
    await adapter.write(item(21, { ...hex, version: 2, content: "v2" }));
    expect((await adapter.read(ref))?.content).toBe("v2");
  });
});

describe("RV-ADP-3: MEMORY.md is Claude Code's, never touched", () => {
  test("a write, a rewrite, a retirement and a delete leave Claude Code's MEMORY.md byte for byte", async () => {
    const root = await fixtureCopy();
    const before = await readFile(join(root, "MEMORY.md"));
    const adapter = createFilesAdapter({ root, owner: "dana", importValidFrom: VALID_FROM });
    const ref = await adapter.write(item(4));
    expect(await readFile(join(root, "MEMORY.md"))).toEqual(before);
    await adapter.write(item(4, { version: 2, content: "Rewritten." }));
    await adapter.write(item(4, { version: 3, status: "retired" }));
    expect(await readFile(join(root, "MEMORY.md"))).toEqual(before);
    expect(await readFile(join(root, "MEMORY.md"), "utf8")).not.toContain(item(4).id);
    await adapter.delete(ref);
    expect(await readFile(join(root, "MEMORY.md"))).toEqual(before);
  });

  test("a folder without MEMORY.md never gains one", async () => {
    const root = await tempDir();
    const adapter = createFilesAdapter({ root, owner: "dana" });
    const ref = await adapter.write(item(5));
    expect(await readdir(root)).toEqual([ref.key]);
    await adapter.delete(ref);
    expect(await readdir(root)).toEqual([]);
  });

  test("a MEMORY.md that is a directory or a hard link no longer stops a write, and is untouched", async () => {
    const dirRoot = await tempDir();
    await mkdir(join(dirRoot, "MEMORY.md"));
    const ref = await createFilesAdapter({ root: dirRoot, owner: "dana" }).write(item(6));
    expect((await readdir(dirRoot)).sort()).toEqual(["MEMORY.md", ref.key].sort());

    const root = await tempDir();
    const outside = await tempDir();
    await writeFile(join(outside, "index.md"), "- [Outside](outside.md) - theirs\n");
    await link(join(outside, "index.md"), join(root, "MEMORY.md"));
    await createFilesAdapter({ root, owner: "dana" }).write(item(7));
    expect(await readFile(join(outside, "index.md"), "utf8")).toBe(
      "- [Outside](outside.md) - theirs\n",
    );
  });
});

describe("RV-ADP-5: every permanent delete refusal is a NotDeletableError", () => {
  test("an Engram file whose frontmatter no longer parses", async () => {
    const root = await tempDir();
    const adapter = createFilesAdapter({ root, owner: "dana" });
    const ref = await adapter.write(item(8));
    const path = join(root, ref.key);
    await writeFile(path, (await readFile(path, "utf8")).replace("engram:", "engram: [unclosed"));
    const e = await refusal(adapter.delete(ref));
    expect(isNotDeletable(e)).toBe(true);
    expect(await readdir(root)).toEqual([ref.key]);
  });

  test("an Engram file that is a hard link", async () => {
    const root = await tempDir();
    const outside = await tempDir();
    const adapter = createFilesAdapter({ root, owner: "dana" });
    const ref = await adapter.write(item(9));
    await link(join(root, ref.key), join(outside, "linked.md"));
    const e = await refusal(adapter.delete(ref));
    expect(e).toBeInstanceOf(UnsafeKeyError);
    expect(isNotDeletable(e)).toBe(true);
    expect(await readdir(root)).toEqual([ref.key]);
  });

  test("a key that is not a memory file name", async () => {
    const adapter = createFilesAdapter({ root: await tempDir(), owner: "dana" });
    const e = await refusal(adapter.delete({ adapter: "files", key: "../x.md" }));
    expect(e).toBeInstanceOf(UnsafeKeyError);
    expect(isNotDeletable(e)).toBe(true);
  });

  test("a copy of an Engram file under another name", async () => {
    const root = await tempDir();
    const adapter = createFilesAdapter({ root, owner: "dana" });
    const ref = await adapter.write(item(10));
    await copyFile(join(root, ref.key), join(root, "copy.md"));
    const e = await refusal(adapter.delete({ adapter: "files", key: "copy.md" }));
    expect(isNotDeletable(e)).toBe(true);
    expect((await readdir(root)).sort()).toEqual([ref.key, "copy.md"].sort());
  });

  test("a memory Claude Code wrote (the control)", async () => {
    const root = await tempDir();
    await writeFile(join(root, "claude.md"), "a Claude Code memory");
    const adapter = createFilesAdapter({ root, owner: "dana" });
    const e = await refusal(adapter.delete({ adapter: "files", key: "claude.md" }));
    expect(e).toBeInstanceOf(ReadOnlyItemError);
    expect(isNotDeletable(e)).toBe(true);
  });
});

describe("RV-ADP-10: a crashed writer's temporary files are removed", () => {
  test("the first write of an instance removes them and keeps every other file", async () => {
    const root = await fixtureCopy();
    const stale = [`.${item(11).id}.md.4242.1.engram-tmp`, ".MEMORY.md.4242.2.engram-tmp"];
    for (const name of stale) await writeFile(join(root, name), "half a write");
    await writeFile(join(root, ".notes.engram-tmp.md"), "not ours");
    const before = (await readdir(root)).filter((n) => !stale.includes(n)).sort();
    const adapter = createFilesAdapter({ root, owner: "dana", importValidFrom: VALID_FROM });
    // A read changes nothing.
    await adapter.list("person:dana");
    expect((await readdir(root)).filter((n) => stale.includes(n))).toHaveLength(2);
    const ref = await adapter.write(item(11));
    expect((await readdir(root)).sort()).toEqual([...before, ref.key].sort());
  });
});

describe("mutant M1: a write never replaces a Claude Code file named <uuid>.md", () => {
  test("the write under that id is refused as read-only and the file keeps its bytes", async () => {
    const root = await tempDir();
    const key = `${item(12).id}.md`;
    const theirs = "---\nname: theirs\nmetadata:\n  type: user\n---\nA memory Claude Code wrote.\n";
    await writeFile(join(root, key), theirs);
    const adapter = createFilesAdapter({ root, owner: "dana" });
    await expect(adapter.write(item(12))).rejects.toBeInstanceOf(ReadOnlyItemError);
    expect(await readFile(join(root, key), "utf8")).toBe(theirs);
    expect(await readdir(root)).toEqual([key]);
  });
});
