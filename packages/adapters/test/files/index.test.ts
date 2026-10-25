// Card A3: the files adapter's own behaviour beyond the conformance suite.
// Claude Code memory files without Engram metadata list as read-only items
// with documented defaults; Engram items are Markdown files whose frontmatter
// keeps Claude Code's fields; MEMORY.md stays in step; paths stay inside root.
import { createHash } from "node:crypto";
import { cp, mkdtemp, readdir, readFile, rm, utimes, writeFile } from "node:fs/promises";
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
});
