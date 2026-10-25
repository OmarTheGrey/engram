// Card A3: the files adapter's own behaviour beyond the conformance suite.
// Claude Code memory files without Engram metadata list as read-only items
// with documented defaults; Engram items are Markdown files whose frontmatter
// keeps Claude Code's fields; MEMORY.md stays in step; paths stay inside root.
import { createHash } from "node:crypto";
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type MemoryItem, MemoryItem as MemoryItemSchema } from "@engram/core";
import { afterAll, describe, expect, test } from "vitest";
import { parse as parseYaml } from "yaml";
import {
  createFilesAdapter,
  importedItemId,
  ReadOnlyItemError,
  UnsafeKeyError,
} from "../../src/files/index.ts";

const FIXTURE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../fixtures/stores/claude-code-memory",
);
const FIXTURE_FILES = [
  "feedback_review_style.md",
  "project_release_freeze.md",
  "reference_runbook.md",
  "user_role.md",
];
const VALID_FROM = "2026-10-01T08:00:00.000Z";

const dirs: string[] = [];
const tempDir = async () => {
  const dir = await mkdtemp(join(tmpdir(), "engram-files-"));
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
    scope: "person:omar",
    owner: "person:omar",
    content: "Omar prefers deploy notes in Arabic.",
    provenance: {
      kind: "user",
      ref: "doc/1",
      hash: `sha256:${"ab".repeat(32)}`,
      actor: "person:omar",
    },
    confidence: 0.9,
    valid_from: "2026-10-22T09:00:00Z",
    valid_to: null,
    ttl: null,
    grants: [],
    version: 1,
    lineage: [],
    status: "active",
    store_ref: null,
    schema_version: 0,
    ...patch,
  }) as MemoryItem;

const sha256 = (bytes: Buffer) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const indexLines = async (root: string) =>
  (await readFile(join(root, "MEMORY.md"), "utf8")).split("\n").filter(Boolean);

describe("Claude Code memory files without Engram metadata", () => {
  test("the fixture folder lists as one valid item per memory file in the owner's person scope", async () => {
    const adapter = createFilesAdapter({
      root: FIXTURE,
      owner: "dana",
      importValidFrom: VALID_FROM,
    });
    const items = await adapter.list("person:dana");
    expect(items.map((i) => i.store_ref?.key).sort()).toEqual(FIXTURE_FILES);
    for (const i of items) expect(MemoryItemSchema.safeParse(i).success).toBe(true);
  });

  test("an imported item carries the documented defaults and the hash of its file", async () => {
    const adapter = createFilesAdapter({
      root: FIXTURE,
      owner: "dana",
      importValidFrom: VALID_FROM,
    });
    const items = await adapter.list("person:dana");
    const role = items.find((i) => i.store_ref?.key === "user_role.md");
    const bytes = await readFile(join(FIXTURE, "user_role.md"));
    expect(role).toEqual({
      id: importedItemId("user_role.md"),
      class: "semantic",
      scope: "person:dana",
      owner: "person:dana",
      content: expect.stringMatching(
        /^Dana is a backend engineer on the Lantern project\..*principles\.$/,
      ),
      provenance: {
        kind: "import",
        ref: "claude-code-memory/user/user_role.md",
        hash: sha256(bytes),
        actor: "agent:claude-code",
      },
      confidence: 0.5,
      valid_from: VALID_FROM,
      valid_to: null,
      ttl: null,
      grants: [],
      version: 1,
      lineage: [],
      status: "active",
      store_ref: { adapter: "files", key: "user_role.md" },
      schema_version: 0,
    });
  });

  test("ids are deterministic across adapters on the same folder", async () => {
    const opts = { root: FIXTURE, owner: "dana", importValidFrom: VALID_FROM };
    const a = (await createFilesAdapter(opts).list("person:dana")).map((i) => i.id).sort();
    const b = (await createFilesAdapter(opts).list("person:dana")).map((i) => i.id).sort();
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(FIXTURE_FILES.length);
  });

  test("an imported item keeps its id when Claude Code edits the file, and its hash follows", async () => {
    const root = await fixtureCopy();
    const adapter = createFilesAdapter({ root, owner: "dana", importValidFrom: VALID_FROM });
    const ref = { adapter: "files", key: "reference_runbook.md" };
    const before = await adapter.read(ref);
    const path = join(root, ref.key);
    await writeFile(
      path,
      `${await readFile(path, "utf8")}It also lists the escalation phone tree.\n`,
    );
    const after = await adapter.read(ref);
    expect(after?.id).toBe(before?.id);
    expect(after?.provenance.hash).toBe(sha256(await readFile(path)));
    expect(after?.provenance.hash).not.toBe(before?.provenance.hash);
  });

  test("read of an imported ref returns the listed item", async () => {
    const adapter = createFilesAdapter({
      root: FIXTURE,
      owner: "dana",
      importValidFrom: VALID_FROM,
    });
    const [first] = await adapter.list("person:dana");
    expect(first?.store_ref).not.toBeNull();
    expect(await adapter.read(first?.store_ref as never)).toEqual(first);
  });

  test("valid_from defaults to the file's modification time", async () => {
    const root = await fixtureCopy();
    const mtime = new Date("2026-09-15T12:30:00.000Z");
    await utimes(join(root, "user_role.md"), mtime, mtime);
    const adapter = createFilesAdapter({ root, owner: "dana" });
    const role = await adapter.read({ adapter: "files", key: "user_role.md" });
    expect(role?.valid_from).toBe("2026-09-15T12:30:00.000Z");
  });

  test("an imported item is read-only: delete and a write under its id are refused", async () => {
    const root = await fixtureCopy();
    const adapter = createFilesAdapter({ root, owner: "dana", importValidFrom: VALID_FROM });
    const ref = { adapter: "files", key: "user_role.md" };
    const role = (await adapter.read(ref)) as MemoryItem;
    await expect(adapter.delete(ref)).rejects.toBeInstanceOf(ReadOnlyItemError);
    await expect(
      adapter.write({ ...role, content: "changed" } as MemoryItem),
    ).rejects.toBeInstanceOf(ReadOnlyItemError);
    expect(await readFile(join(root, "user_role.md"))).toEqual(
      await readFile(join(FIXTURE, "user_role.md")),
    );
    expect(await readdir(root)).toHaveLength(FIXTURE_FILES.length + 1);
  });
});

describe("Engram items as Markdown files", () => {
  test("a written item is a Markdown file named by its id, body the content, Claude Code fields kept", async () => {
    const root = await tempDir();
    const adapter = createFilesAdapter({ root, owner: "omar" });
    const ref = await adapter.write(item(1));
    expect(ref).toEqual({ adapter: "files", key: "01920000-0000-7000-8000-000000000001.md" });
    const text = await readFile(join(root, ref.key), "utf8");
    const [, front, body] = text.split(/^---\n|\n---\n/m);
    expect(body).toBe("Omar prefers deploy notes in Arabic.");
    const meta = parseYaml(front as string);
    expect(meta).toMatchObject({
      name: "Omar prefers deploy notes in Arabic.",
      description: expect.any(String),
      metadata: { type: "user" },
      engram: { id: item(1).id, scope: "person:omar", content_format: "text" },
    });
  });

  test("a team item is filed under the Claude Code type project", async () => {
    const root = await tempDir();
    const adapter = createFilesAdapter({ root, owner: "omar" });
    const ref = await adapter.write(item(2, { scope: "team:platform" }));
    const text = await readFile(join(root, ref.key), "utf8");
    expect(text).toContain("metadata:\n  type: project\n");
  });

  test("text content with newlines, a delimiter line and trailing space round-trips exactly", async () => {
    const root = await tempDir();
    const adapter = createFilesAdapter({ root, owner: "omar" });
    const content = "\nline one\n---\nline three  \r\n\n";
    const ref = await adapter.write(item(3, { content }));
    expect((await adapter.read(ref))?.content).toBe(content);
  });

  test("an Engram file whose metadata no longer passes the schema is reported, not guessed", async () => {
    const root = await tempDir();
    const adapter = createFilesAdapter({ root, owner: "omar" });
    const ref = await adapter.write(item(4));
    const path = join(root, ref.key);
    await writeFile(
      path,
      (await readFile(path, "utf8")).replace("status: active", "status: bogus"),
    );
    await expect(adapter.read(ref)).rejects.toThrow(ref.key);
  });

  test("writes leave no temporary files behind", async () => {
    const root = await tempDir();
    const adapter = createFilesAdapter({ root, owner: "omar" });
    await adapter.write(item(5));
    await adapter.write(item(5, { version: 2, content: "v2" }));
    expect((await readdir(root)).sort()).toEqual([
      "01920000-0000-7000-8000-000000000005.md",
      "MEMORY.md",
    ]);
  });
});

describe("MEMORY.md index", () => {
  test("a write adds one index line linking the file, a rewrite replaces it", async () => {
    const root = await tempDir();
    const adapter = createFilesAdapter({ root, owner: "omar" });
    const ref = await adapter.write(item(1));
    await adapter.write(item(1, { version: 2, content: "Deploy notes go in English now." }));
    expect(await indexLines(root)).toEqual([
      `- [Deploy notes go in English now.](${ref.key}) - semantic memory in person:omar, version 2`,
    ]);
  });

  test("a delete removes the item's line and keeps the lines Claude Code wrote", async () => {
    const root = await fixtureCopy();
    const before = await indexLines(root);
    const adapter = createFilesAdapter({ root, owner: "dana", importValidFrom: VALID_FROM });
    const ref = await adapter.write(item(6, { scope: "person:dana" }));
    expect(await indexLines(root)).toHaveLength(before.length + 1);
    await adapter.delete(ref);
    expect(await indexLines(root)).toEqual(before);
  });

  test("concurrent writes each get exactly one index line", async () => {
    const root = await tempDir();
    const adapter = createFilesAdapter({ root, owner: "omar" });
    await Promise.all([1, 2, 3, 4, 5].map((n) => adapter.write(item(n))));
    expect(await indexLines(root)).toHaveLength(5);
  });
});

describe("store_ref keys", () => {
  test.each(["../outside.md", "nested/inside.md", "..\\outside.md", "MEMORY.md", "notes.txt"])(
    "the key %s is refused",
    async (key) => {
      const adapter = createFilesAdapter({ root: await tempDir(), owner: "omar" });
      await expect(adapter.read({ adapter: "files", key })).rejects.toBeInstanceOf(UnsafeKeyError);
    },
  );

  test.each([
    ["an unsafe key", { adapter: "files", key: "../outside.md" }],
    ["a foreign ref", { adapter: "mem0", key: "a.md" }],
  ])("delete of %s rejects its promise and never throws synchronously", async (_, ref) => {
    const adapter = createFilesAdapter({ root: await tempDir(), owner: "omar" });
    let pending: Promise<void> | undefined;
    expect(() => {
      pending = adapter.delete(ref);
    }).not.toThrow();
    await expect(pending).rejects.toThrow();
  });
});

/** U+2014, built at run time: repository text never contains the character itself. */
const EM_DASH = String.fromCodePoint(0x2014);

const isUnavailable = (e: unknown) =>
  ["EPERM", "EACCES", "ENOSYS", "ENOTSUP"].includes((e as NodeJS.ErrnoException).code ?? "");

describe("malformed and unsafe entries (review findings R4-3, R4-4)", () => {
  test("a file with unreadable frontmatter or bad Engram metadata is skipped by list and search, and reported", async () => {
    const root = await fixtureCopy();
    await writeFile(
      join(root, "bad_colon.md"),
      "---\nname: Deploys\ndescription: Use this: always\n---\nBody about the release freeze.\n",
    );
    await writeFile(
      join(root, "bad_engram.md"),
      "---\nname: x\nengram: true\n---\nBody about the release freeze.\n",
    );
    const adapter = createFilesAdapter({ root, owner: "dana", importValidFrom: VALID_FROM });
    const keys = (await adapter.list("person:dana")).map((i) => i.store_ref?.key).sort();
    expect(keys).toEqual(FIXTURE_FILES);
    expect(adapter.diagnostics().map((d) => d.key)).toEqual(["bad_colon.md", "bad_engram.md"]);
    expect(adapter.diagnostics()[0]?.reason).toContain("frontmatter");
    const hits = await adapter.search?.("release freeze", ["person:dana"]);
    expect(hits?.map((h) => h.store_ref?.key)).toEqual(["project_release_freeze.md"]);
    await expect(adapter.read({ adapter: "files", key: "bad_colon.md" })).rejects.toThrow(
      "bad_colon.md",
    );
  });

  test("diagnostics are cleared when the malformed file is fixed", async () => {
    const root = await tempDir();
    await writeFile(join(root, "note.md"), "---\nengram: true\n---\nx\n");
    const adapter = createFilesAdapter({ root, owner: "dana", importValidFrom: VALID_FROM });
    await adapter.list("person:dana");
    expect(adapter.diagnostics()).toHaveLength(1);
    await writeFile(join(root, "note.md"), "---\nname: note\n---\nx\n");
    expect(await adapter.list("person:dana")).toHaveLength(1);
    expect(adapter.diagnostics()).toEqual([]);
  });

  test("a directory named like a memory file is skipped and reported", async () => {
    const root = await fixtureCopy();
    await mkdir(join(root, "folder.md"));
    const adapter = createFilesAdapter({ root, owner: "dana", importValidFrom: VALID_FROM });
    expect(await adapter.list("person:dana")).toHaveLength(FIXTURE_FILES.length);
    expect(adapter.diagnostics()).toEqual([
      { key: "folder.md", reason: expect.stringContaining("not a regular file") },
    ]);
    await expect(adapter.read({ adapter: "files", key: "folder.md" })).rejects.toBeInstanceOf(
      UnsafeKeyError,
    );
  });

  test("a symlink to a file outside the root is never followed: not listed, not read, reported", async ({
    skip,
  }) => {
    const root = await tempDir();
    const outside = await tempDir();
    await writeFile(join(outside, "secret.md"), "---\nname: secret\n---\nOutside secret.\n");
    try {
      await symlink(join(outside, "secret.md"), join(root, "leak.md"), "file");
    } catch (e) {
      if (isUnavailable(e)) return skip("symlinks are unavailable here");
      throw e;
    }
    const adapter = createFilesAdapter({ root, owner: "dana", importValidFrom: VALID_FROM });
    expect(await adapter.list("person:dana")).toEqual([]);
    expect(await adapter.search?.("secret", ["person:dana"])).toEqual([]);
    expect(adapter.diagnostics()).toEqual([
      { key: "leak.md", reason: expect.stringContaining("not a regular file") },
    ]);
    await expect(adapter.read({ adapter: "files", key: "leak.md" })).rejects.toBeInstanceOf(
      UnsafeKeyError,
    );
  });

  test("a write never replaces a symlink at the item's file name", async ({ skip }) => {
    const root = await tempDir();
    const outside = await tempDir();
    const target = join(outside, "target.md");
    await writeFile(target, "outside");
    const key = `${item(7).id}.md`;
    try {
      await symlink(target, join(root, key), "file");
    } catch (e) {
      if (isUnavailable(e)) return skip("symlinks are unavailable here");
      throw e;
    }
    const adapter = createFilesAdapter({ root, owner: "omar" });
    await expect(adapter.write(item(7))).rejects.toBeInstanceOf(UnsafeKeyError);
    expect(await readFile(target, "utf8")).toBe("outside");
    expect((await lstat(join(root, key))).isSymbolicLink()).toBe(true);
  });
});

describe("case-insensitive file systems (review finding R4-5)", () => {
  const upper = "01920000-0000-7000-8000-00000000000A";

  test("an item id with uppercase letters is refused and nothing is written", async () => {
    const root = await tempDir();
    const adapter = createFilesAdapter({ root, owner: "omar" });
    await expect(adapter.write(item(10, { id: upper }))).rejects.toBeInstanceOf(UnsafeKeyError);
    expect(await readdir(root)).toEqual([]);
  });

  test("a write is refused when a file whose name differs only in case exists", async () => {
    const root = await tempDir();
    const theirs = "---\nname: theirs\n---\nA memory Claude Code wrote.\n";
    await writeFile(join(root, `${upper}.md`), theirs);
    const adapter = createFilesAdapter({ root, owner: "omar" });
    await expect(adapter.write(item(10, { id: upper.toLowerCase() }))).rejects.toThrow(
      `${upper}.md`,
    );
    expect(await readdir(root)).toEqual([`${upper}.md`]);
    expect(await readFile(join(root, `${upper}.md`), "utf8")).toBe(theirs);
  });

  test("a ref key that matches a file only up to case reads nothing, on every file system", async () => {
    const root = await fixtureCopy();
    const adapter = createFilesAdapter({ root, owner: "dana", importValidFrom: VALID_FROM });
    expect(await adapter.read({ adapter: "files", key: "USER_ROLE.md" })).toBeUndefined();
    expect(await adapter.read({ adapter: "files", key: "user_role.md" })).toBeDefined();
  });

  test("an index line linking the item's file in other case is replaced, not duplicated", async () => {
    const root = await tempDir();
    const id = item(11).id;
    await writeFile(join(root, "MEMORY.md"), `- [Old](${id.toUpperCase()}.MD) - stale\n`);
    const adapter = createFilesAdapter({ root, owner: "omar" });
    const ref = await adapter.write(item(11));
    expect(await indexLines(root)).toEqual([
      `- [Omar prefers deploy notes in Arabic.](${ref.key}) - semantic memory in person:omar, version 1`,
    ]);
  });
});

describe("two adapter instances on one folder (review finding R4-6)", () => {
  test("concurrent writes through two instances keep every index line and every file", async () => {
    const root = await tempDir();
    const a = createFilesAdapter({ root, owner: "omar" });
    const b = createFilesAdapter({ root, owner: "omar" });
    const ns = Array.from({ length: 12 }, (_, n) => n + 1);
    const refs = await Promise.all(ns.map((n) => (n % 2 ? a : b).write(item(n))));
    expect(await indexLines(root)).toHaveLength(ns.length);
    expect((await readdir(root)).sort()).toEqual([...refs.map((r) => r.key), "MEMORY.md"].sort());
  });

  test("concurrent deletes through two instances remove every index line", async () => {
    const root = await tempDir();
    const a = createFilesAdapter({ root, owner: "omar" });
    const b = createFilesAdapter({ root, owner: "omar" });
    const refs = [];
    for (const n of [1, 2, 3, 4, 5, 6]) refs.push(await a.write(item(n)));
    await Promise.all(refs.map((ref, n) => (n % 2 ? a : b).delete(ref)));
    expect(await indexLines(root)).toEqual([]);
    expect(await readdir(root)).toEqual(["MEMORY.md"]);
  });
});

describe("titles and the index format (review findings R4-10, R4-13, R4-15)", () => {
  test("a title cut at 60 characters never splits a surrogate pair", async () => {
    const root = await tempDir();
    const adapter = createFilesAdapter({ root, owner: "omar" });
    const content = `${"a".repeat(59)}\u{1F680}rest of the line`;
    const ref = await adapter.write(item(12, { content }));
    const [line] = await indexLines(root);
    expect(line).toBe(
      `- [${"a".repeat(59)}\u{1F680}...](${ref.key}) - semantic memory in person:omar, version 1`,
    );
    expect(await readFile(join(root, ref.key), "utf8")).not.toContain("�");
  });

  test("a lone surrogate in content round-trips; the title shows it as a replacement character", async () => {
    const root = await tempDir();
    const adapter = createFilesAdapter({ root, owner: "omar" });
    const content = "Broken \ud800 pair";
    const ref = await adapter.write(item(13, { content }));
    expect((await adapter.read(ref))?.content).toBe(content);
    expect(await indexLines(root)).toEqual([
      `- [Broken � pair](${ref.key}) - semantic memory in person:omar, version 1`,
    ]);
  });

  test("the folder offers search by scanning, without claiming native search", () => {
    const adapter = createFilesAdapter({ root: FIXTURE, owner: "dana" });
    expect(adapter.capabilities.native_search).toBe(false);
    expect(adapter.search).toBeTypeOf("function");
  });

  test("Engram's index lines use a hyphen separator; a Claude Code line with an em dash is kept as written", async () => {
    const root = await tempDir();
    const theirs = `- [Release freeze](project_release_freeze.md) ${EM_DASH} no deploys in December`;
    await writeFile(join(root, "MEMORY.md"), `${theirs}\n`);
    const adapter = createFilesAdapter({ root, owner: "omar" });
    const ref = await adapter.write(item(14));
    const lines = await indexLines(root);
    expect(lines[0]).toBe(theirs);
    expect(lines[1]).toBe(
      `- [Omar prefers deploy notes in Arabic.](${ref.key}) - semantic memory in person:omar, version 1`,
    );
    expect(lines[1]).not.toContain(EM_DASH);
    await adapter.delete(ref);
    expect(await indexLines(root)).toEqual([theirs]);
  });
});
