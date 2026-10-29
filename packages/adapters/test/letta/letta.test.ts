// Card A2: the Letta adapter's own behaviour beyond the conformance suite.
// It opens a MemFS repository or initialises one in an empty folder and
// refuses anything else; items are engram/<id>.md with Letta's frontmatter
// and Engram's fields, LF only, listed in engram/MEMORY.md; the root
// MEMORY.md gains one line; keys, symlinks, hard links and .git are refused;
// a failed commit leaves the repository as it was; writers in two instances
// are serialised by the lock in the git directory.
import { spawnSync } from "node:child_process";
import { link, mkdir, readdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { hostname } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { parse as parseYaml } from "yaml";
import {
  createLettaAdapter,
  NotMemfsRepositoryError,
  UnsafeLettaPathError,
} from "../../src/letta/index.ts";
import { commits, freshLettaRepo, gitOut, id, item, status, tempDir, touched } from "./helpers.ts";

const SETUP = ["MEMORY.md", "engram/MEMORY.md"];
/** An id with hex letters, so its upper-case form differs. */
const HEX_ID = "01920000-0000-7000-8000-0000000000ab";

describe("opening a MemFS repository", () => {
  test("an empty folder becomes a repository with one setup commit naming engram/ in MEMORY.md", async () => {
    const root = await tempDir();
    const adapter = await createLettaAdapter({ root });
    const log = await commits(root);
    expect(log).toHaveLength(1);
    expect(await touched(root, log[0] as string)).toEqual(SETUP);
    expect(await readFile(join(root, "MEMORY.md"), "utf8")).toMatch(
      /^- \[engram\/\]\(engram\/MEMORY\.md\) - /,
    );
    expect(await status(root)).toEqual([]);
    expect(await adapter.list("team:platform")).toEqual([]);
  });

  test("a missing folder is created and initialised", async () => {
    const root = join(await tempDir(), "memory");
    await createLettaAdapter({ root });
    expect(await commits(root)).toHaveLength(1);
  });

  test("an existing repository keeps its root MEMORY.md lines and gains one; reopening adds nothing", async () => {
    const root = await tempDir();
    await gitOut(root, "init", "--quiet");
    const own = "- [persona](persona.md) - who I am\r\n";
    await writeFile(join(root, "MEMORY.md"), own);
    await writeFile(join(root, "persona.md"), "---\nname: persona\ndescription: me\n---\nI am.\n");
    await gitOut(root, "add", "--all");
    await gitOut(root, "commit", "--quiet", "-m", "letta: initial memory");
    await createLettaAdapter({ root });
    const text = await readFile(join(root, "MEMORY.md"), "utf8");
    expect(text.startsWith(own)).toBe(true);
    expect(text.slice(own.length)).toMatch(/^- \[engram\/\]\(engram\/MEMORY\.md\) - [^\n]*\r\n$/);
    expect(await commits(root)).toHaveLength(2);
    await createLettaAdapter({ root });
    expect(await commits(root)).toHaveLength(2);
    expect(await readFile(join(root, "persona.md"), "utf8")).toContain("I am.");
  });

  test("a folder that is neither empty nor a repository's top level is refused and left untouched", async () => {
    const root = await tempDir();
    await writeFile(join(root, "notes.txt"), "mine");
    await expect(createLettaAdapter({ root })).rejects.toThrow(NotMemfsRepositoryError);
    expect(await readdir(root)).toEqual(["notes.txt"]);
  });

  test("a folder inside a repository that is not its top level is refused", async () => {
    const root = await freshLettaRepo();
    const inner = join(root, "reference");
    await mkdir(inner);
    await writeFile(join(inner, "notes.md"), "x");
    await expect(createLettaAdapter({ root: inner })).rejects.toThrow(NotMemfsRepositoryError);
  });
});

describe("item files", () => {
  test("an item is engram/<id>.md: Letta's name and description, Engram's fields, the content as the body", async () => {
    const root = await freshLettaRepo();
    const adapter = await createLettaAdapter({ root });
    const it = item(1, { content: "# Deploys\nDeploys happen on Tuesdays.\n" });
    const ref = await adapter.write(it);
    expect(ref).toEqual({ adapter: "letta", key: `engram/${id(1)}.md` });
    const text = await readFile(join(root, ref.key), "utf8");
    expect(text).not.toContain("\r");
    const [, front, body] = text.split(/^---\n|\n---\n/m);
    expect(body).toBe(it.content);
    const meta = parseYaml(front as string);
    expect(meta.name).toBe(`engram/${id(1)}`);
    expect(meta.description).toBe("Deploys; semantic memory in team:platform, version 1");
    expect(meta.engram).toMatchObject({
      id: id(1),
      scope: "team:platform",
      content_format: "text",
    });
    expect(await readFile(join(root, "engram", "MEMORY.md"), "utf8")).toContain(
      `- [${id(1)}.md](${id(1)}.md) - Deploys; semantic memory in team:platform, version 1\n`,
    );
  });

  test("CRLF content is stored escaped, so the file stays LF only, and round-trips exactly", async () => {
    const root = await freshLettaRepo();
    const adapter = await createLettaAdapter({ root });
    const it = item(2, { content: "line one\r\n---\r\nline two \r\n" });
    const ref = await adapter.write(it);
    const text = await readFile(join(root, ref.key), "utf8");
    expect(text).not.toContain("\r");
    expect(await adapter.read(ref)).toEqual({ ...it, store_ref: ref });
    // The committed blob holds the same bytes, whatever core.autocrlf says.
    expect(await gitOut(root, "cat-file", "blob", `HEAD:${ref.key}`)).toBe(text);
  });

  test("a file a CRLF checkout rewrote reads as the item written", async () => {
    const root = await freshLettaRepo();
    const adapter = await createLettaAdapter({ root });
    const it = item(3, { content: "two\nlines\n" });
    const ref = await adapter.write(it);
    const path = join(root, ref.key);
    await writeFile(path, (await readFile(path, "utf8")).replace(/\n/g, "\r\n"));
    expect(await adapter.read(ref)).toEqual({ ...it, store_ref: ref });
    expect(await adapter.list("team:platform")).toEqual([{ ...it, store_ref: ref }]);
  });

  test("a file that no longer parses is skipped by list and search and reported", async () => {
    const root = await freshLettaRepo();
    const adapter = await createLettaAdapter({ root });
    const good = await adapter.write(item(4));
    const bad = await adapter.write(item(5));
    await writeFile(join(root, bad.key), "---\nname: [unclosed\n---\nbody");
    expect((await adapter.list("team:platform")).map((i) => i.id)).toEqual([id(4)]);
    expect(adapter.diagnostics()).toEqual([
      { key: bad.key, reason: expect.stringContaining("unreadable frontmatter") },
    ]);
    await expect(adapter.read(bad)).rejects.toThrow("unreadable frontmatter");
    expect(await adapter.read(good)).toEqual({ ...item(4), store_ref: good });
  });

  test("a file whose metadata names another id is not taken for the item its name says", async () => {
    const root = await freshLettaRepo();
    const adapter = await createLettaAdapter({ root });
    const ref = await adapter.write(item(6));
    const text = await readFile(join(root, ref.key), "utf8");
    await writeFile(join(root, "engram", `${id(7)}.md`), text);
    await expect(adapter.read({ adapter: "letta", key: `engram/${id(7)}.md` })).rejects.toThrow(
      `holds item ${id(6)}`,
    );
  });

  test("history reads every committed version from git, oldest first, and survives a delete", async () => {
    const root = await freshLettaRepo();
    const adapter = await createLettaAdapter({ root });
    const v1 = item(8);
    const v2 = item(8, { version: 2, content: "Fact number 8, revised." });
    const ref = await adapter.write(v1);
    await adapter.write(v2);
    await adapter.delete(ref);
    expect(await adapter.history(ref)).toEqual([
      { ...v1, store_ref: ref },
      { ...v2, store_ref: ref },
    ]);
  });
});

describe("keys and paths (security: path validation)", () => {
  const unsafe = [
    "engram/../MEMORY.md",
    "engram/../.git/config",
    ".git/config",
    "../outside.md",
    "MEMORY.md",
    "engram/MEMORY.md",
    `engram/${HEX_ID.toUpperCase()}.md`,
    `engram/${id(1)}.md/../../MEMORY.md`,
    `engram\\${id(1)}.md`,
    `persona.md`,
    `engram/sub/${id(1)}.md`,
  ];

  test.each(unsafe)("a ref with key %j is refused by read, delete and history", async (key) => {
    const root = await freshLettaRepo();
    const adapter = await createLettaAdapter({ root });
    const ref = { adapter: "letta", key };
    await expect(adapter.read(ref)).rejects.toThrow(UnsafeLettaPathError);
    await expect(adapter.delete(ref)).rejects.toThrow(UnsafeLettaPathError);
    await expect(adapter.history(ref)).rejects.toThrow(UnsafeLettaPathError);
    expect(await commits(root)).toHaveLength(1);
    expect(await status(root)).toEqual([]);
  });

  test("an item id that is not a lowercase UUID is refused and nothing is written", async () => {
    const root = await freshLettaRepo();
    const adapter = await createLettaAdapter({ root });
    for (const bad of [HEX_ID.toUpperCase(), `../${id(1)}`, `${id(1)}/x`]) {
      await expect(adapter.write(item(1, { id: bad }))).rejects.toThrow(UnsafeLettaPathError);
    }
    expect(await readdir(join(root, "engram"))).toEqual(["MEMORY.md"]);
    expect(await commits(root)).toHaveLength(1);
  });

  test("engram/ as a junction or symlink to a folder outside is never followed", async ({
    skip,
  }) => {
    const root = await freshLettaRepo();
    const outside = await tempDir();
    await writeFile(join(outside, `${id(9)}.md`), "outside");
    await rm(join(root, "engram"), { recursive: true });
    try {
      await symlink(outside, join(root, "engram"), "junction");
    } catch {
      return skip("this file system cannot make a directory link");
    }
    await expect(createLettaAdapter({ root })).rejects.toThrow(UnsafeLettaPathError);
    expect(await readdir(outside)).toEqual([`${id(9)}.md`]);
  });

  test("an item file that is a symlink is never read, listed or replaced", async ({ skip }) => {
    const root = await freshLettaRepo();
    const adapter = await createLettaAdapter({ root });
    const outside = join(await tempDir(), "secret.md");
    await writeFile(outside, "secret");
    try {
      await symlink(outside, join(root, "engram", `${id(10)}.md`), "file");
    } catch {
      return skip("this machine cannot make a file symlink without privileges");
    }
    const ref = { adapter: "letta", key: `engram/${id(10)}.md` };
    await expect(adapter.read(ref)).rejects.toThrow(UnsafeLettaPathError);
    expect(await adapter.list("team:platform")).toEqual([]);
    expect(adapter.diagnostics().map((d) => d.key)).toEqual([ref.key]);
    await expect(adapter.write(item(10))).rejects.toThrow(UnsafeLettaPathError);
    expect(await readFile(outside, "utf8")).toBe("secret");
  });

  test("a hard-linked item file is never read, listed or replaced", async () => {
    const root = await freshLettaRepo();
    const adapter = await createLettaAdapter({ root });
    const outside = join(await tempDir(), "secret.md");
    await writeFile(outside, "secret");
    await link(outside, join(root, "engram", `${id(11)}.md`));
    const ref = { adapter: "letta", key: `engram/${id(11)}.md` };
    await expect(adapter.read(ref)).rejects.toThrow("hard link");
    expect(await adapter.list("team:platform")).toEqual([]);
    expect(adapter.diagnostics()[0]?.reason).toContain("hard link");
    await expect(adapter.write(item(11))).rejects.toThrow("hard link");
    await expect(adapter.delete(ref)).rejects.toThrow("hard link");
    expect(await readFile(outside, "utf8")).toBe("secret");
  });

  test("a hard-linked engram/MEMORY.md refuses the write and nothing is committed", async () => {
    const root = await freshLettaRepo();
    const adapter = await createLettaAdapter({ root });
    const outside = join(await tempDir(), "index.md");
    await writeFile(outside, "# not ours\n");
    await rm(join(root, "engram", "MEMORY.md"));
    await link(outside, join(root, "engram", "MEMORY.md"));
    await expect(adapter.write(item(12))).rejects.toThrow("hard link");
    expect(await readdir(join(root, "engram"))).toEqual(["MEMORY.md"]);
    expect(await readFile(outside, "utf8")).toBe("# not ours\n");
    expect(await commits(root)).toHaveLength(1);
  });
});

describe("a write or delete is all or nothing (a failed commit restores the tree)", () => {
  /** A pre-commit hook that refuses every commit, set in the repository's own config. */
  async function refuseCommits(root: string) {
    const hooks = await tempDir();
    await writeFile(join(hooks, "pre-commit"), "#!/bin/sh\necho refused by hook >&2\nexit 1\n", {
      mode: 0o755,
    });
    await gitOut(root, "config", "core.hooksPath", hooks.replace(/\\/g, "/"));
  }

  test("a new item refused by a hook leaves no file, no index line, nothing staged", async () => {
    const root = await freshLettaRepo();
    const adapter = await createLettaAdapter({ root });
    const index = await readFile(join(root, "engram", "MEMORY.md"), "utf8");
    await refuseCommits(root);
    await expect(adapter.write(item(20))).rejects.toThrow("refused by hook");
    expect(await readdir(join(root, "engram"))).toEqual(["MEMORY.md"]);
    expect(await readFile(join(root, "engram", "MEMORY.md"), "utf8")).toBe(index);
    expect(await status(root)).toEqual([]);
    expect(await commits(root)).toHaveLength(1);
  });

  test("a rewrite and a delete refused by a hook keep the committed item and index", async () => {
    const root = await freshLettaRepo();
    const adapter = await createLettaAdapter({ root });
    const ref = await adapter.write(item(21));
    const before = await readFile(join(root, ref.key), "utf8");
    const index = await readFile(join(root, "engram", "MEMORY.md"), "utf8");
    await refuseCommits(root);
    await expect(adapter.write(item(21, { version: 2, content: "changed" }))).rejects.toThrow(
      "refused by hook",
    );
    await expect(adapter.delete(ref)).rejects.toThrow("refused by hook");
    expect(await readFile(join(root, ref.key), "utf8")).toBe(before);
    expect(await readFile(join(root, "engram", "MEMORY.md"), "utf8")).toBe(index);
    expect(await status(root)).toEqual([]);
    expect(await adapter.read(ref)).toEqual({ ...item(21), store_ref: ref });
    expect(await commits(root)).toHaveLength(2);
  });

  test("the repository's own hooks run on every commit", async () => {
    const root = await freshLettaRepo();
    const adapter = await createLettaAdapter({ root });
    const hooks = await tempDir();
    const mark = join(hooks, "ran").replace(/\\/g, "/");
    await writeFile(join(hooks, "post-commit"), `#!/bin/sh\necho x >> "${mark}"\n`, {
      mode: 0o755,
    });
    await gitOut(root, "config", "core.hooksPath", hooks.replace(/\\/g, "/"));
    await adapter.write(item(22));
    await adapter.write(item(23));
    expect((await readFile(mark, "utf8")).trim().split("\n")).toHaveLength(2);
  });
});

describe("identity", () => {
  test("a commit carries the repository's configured identity", async () => {
    const root = await freshLettaRepo();
    await gitOut(root, "config", "user.name", "Letta Agent");
    await gitOut(root, "config", "user.email", "agent@letta.invalid");
    const adapter = await createLettaAdapter({ root });
    await adapter.write(item(30));
    expect((await gitOut(root, "log", "-1", "--format=%an <%ae>|%cn <%ce>")).trim()).toBe(
      "Letta Agent <agent@letta.invalid>|Letta Agent <agent@letta.invalid>",
    );
  });

  test("with no identity configured anywhere, commits are made as Engram <engram@localhost>", async () => {
    const root = await freshLettaRepo();
    const empty = join(await tempDir(), "gitconfig");
    await writeFile(empty, "");
    const saved = { ...process.env };
    process.env.GIT_CONFIG_GLOBAL = empty;
    process.env.GIT_CONFIG_NOSYSTEM = "1";
    for (const v of ["NAME", "EMAIL"])
      for (const who of ["AUTHOR", "COMMITTER"]) delete process.env[`GIT_${who}_${v}`];
    try {
      const adapter = await createLettaAdapter({ root });
      await adapter.write(item(31));
      expect((await gitOut(root, "log", "-1", "--format=%an <%ae>|%cn <%ce>")).trim()).toBe(
        "Engram <engram@localhost>|Engram <engram@localhost>",
      );
    } finally {
      process.env = saved;
    }
  });
});

describe("two adapter instances on one repository (the lock)", () => {
  test("concurrent writes and deletes through two instances each make their own commit and index line", async () => {
    const root = await freshLettaRepo();
    const a = await createLettaAdapter({ root });
    const b = await createLettaAdapter({ root });
    const refs = await Promise.all(
      [40, 41, 42, 43, 44, 45].map((n) => (n % 2 ? a : b).write(item(n))),
    );
    await Promise.all([a.delete(refs[0] as never), b.delete(refs[1] as never)]);
    expect(await commits(root)).toHaveLength(1 + 6 + 2);
    const lines = (await readFile(join(root, "engram", "MEMORY.md"), "utf8"))
      .split("\n")
      .filter((l) => l.startsWith("- ["));
    expect(lines.map((l) => /\((.*)\.md\)/.exec(l)?.[1]).sort()).toEqual([42, 43, 44, 45].map(id));
    expect(await status(root)).toEqual([]);
    expect(await readdir(join(root, ".git"))).not.toContain("engram.lock");
  });

  test("a lock left in the git directory by a crashed writer is broken at once", async () => {
    const root = await freshLettaRepo();
    const deadPid = spawnSync(process.execPath, ["-e", ""]).pid as number;
    await writeFile(
      join(root, ".git", "engram.lock"),
      JSON.stringify({
        pid: deadPid,
        host: hostname(),
        token: "crashed",
        started: new Date().toISOString(),
      }),
    );
    const adapter = await createLettaAdapter({ root, lockWaitMs: 2_000 });
    await adapter.write(item(46));
    expect(await readdir(join(root, ".git"))).not.toContain("engram.lock");
  });

  test("a lock held by a live writer is waited for, then refused, naming its holder", async () => {
    const root = await freshLettaRepo();
    const adapter = await createLettaAdapter({ root, lockWaitMs: 300 });
    await writeFile(
      join(root, ".git", "engram.lock"),
      JSON.stringify({
        pid: process.pid,
        host: hostname(),
        token: "another-instance",
        started: new Date().toISOString(),
      }),
    );
    await expect(adapter.write(item(47))).rejects.toThrow(`pid ${process.pid}`);
    expect(await commits(root)).toHaveLength(1);
    expect((await stat(join(root, ".git", "engram.lock"))).isFile()).toBe(true);
  });
});
