// Card A2, review fix pass of PR #20: the Letta adapter against the states and
// settings a real repository can be in. Each test names its finding.
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { deferLettaAdapter } from "../../src/letta/deferred.ts";
import { type GitOptions, runGit } from "../../src/letta/git.ts";
import {
  createLettaAdapter,
  NotMemfsRepositoryError,
  RepositoryBusyError,
} from "../../src/letta/index.ts";
import { commits, freshLettaRepo, gitOut, id, item, status, tempDir, touched } from "./helpers.ts";

const head = async (root: string) => (await gitOut(root, "rev-parse", "HEAD")).trim();
const inHead = async (root: string, key: string) =>
  (await runGit(["cat-file", "-e", `HEAD:${key}`], { cwd: root })).code === 0;

describe("R2-2: nothing is committed while HEAD is detached or an operation is in progress", () => {
  const states: [string, (root: string) => Promise<void>][] = [
    ["a detached HEAD", (root) => gitOut(root, "checkout", "--quiet", "--detach").then(() => {})],
    ["a rebase (rebase-merge/)", (root) => mkdir(join(root, ".git", "rebase-merge"))],
    ["a rebase (rebase-apply/)", (root) => mkdir(join(root, ".git", "rebase-apply"))],
    ...["CHERRY_PICK_HEAD", "REVERT_HEAD", "MERGE_HEAD", "BISECT_LOG"].map(
      (file): [string, (root: string) => Promise<void>] => [
        file,
        async (root) => writeFile(join(root, ".git", file), `${await head(root)}\n`),
      ],
    ),
  ];

  test.each(states)(
    "with %s, a write and a delete are refused and nothing changes",
    async (_, enter) => {
      const root = await freshLettaRepo();
      const adapter = await createLettaAdapter({ root });
      const ref = await adapter.write(item(1));
      const before = await commits(root);
      const index = await readFile(join(root, "engram", "MEMORY.md"), "utf8");
      await enter(root);
      await expect(adapter.write(item(2))).rejects.toThrow(RepositoryBusyError);
      await expect(adapter.write(item(1, { version: 2, content: "changed" }))).rejects.toThrow(
        RepositoryBusyError,
      );
      await expect(adapter.delete(ref)).rejects.toThrow(RepositoryBusyError);
      expect(await commits(root)).toEqual(before);
      expect(await status(root)).toEqual([]);
      expect(await readFile(join(root, "engram", "MEMORY.md"), "utf8")).toBe(index);
      expect(await adapter.read(ref)).toEqual({ ...item(1), store_ref: ref });
      expect(await readdir(join(root, "engram"))).not.toContain(`${id(2)}.md`);
    },
  );

  test("the setup commit is refused on a detached HEAD, and opening leaves the folder as it was", async () => {
    const root = await tempDir();
    await gitOut(root, "init", "--quiet");
    await writeFile(join(root, "persona.md"), "me\n");
    await gitOut(root, "add", "persona.md");
    await gitOut(root, "commit", "--quiet", "-m", "letta");
    await gitOut(root, "checkout", "--quiet", "--detach");
    await expect(createLettaAdapter({ root })).rejects.toThrow(RepositoryBusyError);
    expect((await readdir(root)).sort()).toEqual([".git", "persona.md"]);
    expect(await status(root)).toEqual([]);
  });
});

describe("R2-3: a restore that fails is reported, with both errors", () => {
  /** git as usual, except that `reset` fails, as when another client holds index.lock. */
  const resetFails = (args: readonly string[], options: GitOptions) =>
    args.includes("reset")
      ? Promise.resolve({ code: 128, stdout: Buffer.alloc(0), stderr: "simulated index.lock" })
      : runGit(args, options);

  async function refuseCommits(root: string) {
    const hooks = await tempDir();
    await writeFile(join(hooks, "pre-commit"), "#!/bin/sh\necho refused by hook >&2\nexit 1\n", {
      mode: 0o755,
    });
    await gitOut(root, "config", "core.hooksPath", hooks.replace(/\\/g, "/"));
  }

  test("a refused write whose unstaging fails names the restore failure", async () => {
    const root = await freshLettaRepo();
    const adapter = await createLettaAdapter({ root, gitRunner: resetFails });
    await refuseCommits(root);
    const error = await adapter.write(item(3)).catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(
      /refused by hook.*restoring .* failed too.*simulated index\.lock/s,
    );
  });

  test("a refused setup commit whose unstaging fails names the restore failure", async () => {
    const root = await tempDir();
    const fail = (args: readonly string[], options: GitOptions) =>
      args.includes("commit")
        ? Promise.resolve({ code: 1, stdout: Buffer.alloc(0), stderr: "simulated commit failure" })
        : resetFails(args, options);
    await expect(createLettaAdapter({ root, gitRunner: fail })).rejects.toThrow(
      /simulated commit failure.*failed too.*simulated index\.lock/s,
    );
  });
});

describe("R2-4: git variables inherited from the environment never redirect the adapter", () => {
  const VARIABLES = [
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_INDEX_FILE",
    "GIT_COMMON_DIR",
    "GIT_OBJECT_DIRECTORY",
    "GIT_ALTERNATE_OBJECT_DIRECTORIES",
    "GIT_NAMESPACE",
    "GIT_PREFIX",
    "GIT_CEILING_DIRECTORIES",
  ];

  test.each(VARIABLES)(
    "with %s pointing elsewhere, a write lands here and nothing there changes",
    async (variable) => {
      const root = await freshLettaRepo();
      const adapter = await createLettaAdapter({ root });
      const foreign = await freshLettaRepo();
      const foreignGit = join(foreign, ".git");
      const values: Record<string, string> = {
        GIT_DIR: foreignGit,
        GIT_WORK_TREE: foreign,
        GIT_INDEX_FILE: join(foreignGit, "index"),
        GIT_COMMON_DIR: foreignGit,
        GIT_OBJECT_DIRECTORY: join(foreignGit, "objects"),
        GIT_ALTERNATE_OBJECT_DIRECTORIES: join(foreignGit, "objects"),
        GIT_NAMESPACE: "elsewhere",
        GIT_PREFIX: "engram/",
        GIT_CEILING_DIRECTORIES: root,
      };
      const foreignIndex = await readFile(join(foreignGit, "index"));
      const foreignHead = await head(foreign);
      const before = await commits(root);
      const saved = process.env[variable];
      process.env[variable] = values[variable];
      try {
        const ref = await adapter.write(item(4));
        expect(await adapter.read(ref)).toEqual({ ...item(4), store_ref: ref });
      } finally {
        if (saved === undefined) delete process.env[variable];
        else process.env[variable] = saved;
      }
      expect(await commits(root)).toHaveLength(before.length + 1);
      expect(await inHead(root, `engram/${id(4)}.md`)).toBe(true);
      expect(await status(root)).toEqual([]);
      expect(await readFile(join(foreignGit, "index"))).toEqual(foreignIndex);
      expect(await head(foreign)).toBe(foreignHead);
      expect(await status(foreign)).toEqual([]);
    },
  );
});

describe("R2-6: the repository's own settings and the user's staged work", () => {
  test("a file the user staged stays staged and out of Engram's commit", async () => {
    const root = await freshLettaRepo();
    const adapter = await createLettaAdapter({ root });
    await writeFile(join(root, "u.txt"), "the user's work\n");
    await gitOut(root, "add", "u.txt");
    await adapter.write(item(5));
    expect(await touched(root, await head(root))).toEqual(
      ["engram/MEMORY.md", `engram/${id(5)}.md`].sort(),
    );
    expect((await gitOut(root, "diff", "--cached", "--name-only")).trim()).toBe("u.txt");
    expect(await status(root)).toEqual(["A  u.txt"]);
  });

  test("engram/ listed in .gitignore still gets every item committed", async () => {
    const root = await freshLettaRepo();
    await writeFile(join(root, ".gitignore"), "engram/\n");
    await gitOut(root, "add", ".gitignore");
    await gitOut(root, "commit", "--quiet", "-m", "user: ignore engram");
    const adapter = await createLettaAdapter({ root });
    const ref = await adapter.write(item(6));
    expect(await inHead(root, ref.key)).toBe(true);
    expect(await status(root)).toEqual([]);
  });

  test("core.autocrlf=true with core.safecrlf=true in the repository's config: writes and deletes commit exact bytes", async () => {
    const root = await freshLettaRepo();
    await gitOut(root, "config", "core.autocrlf", "true");
    await gitOut(root, "config", "core.safecrlf", "true");
    const adapter = await createLettaAdapter({ root });
    const ref = await adapter.write(item(7, { content: "two\nlines\n" }));
    expect(await gitOut(root, "cat-file", "blob", `HEAD:${ref.key}`)).toBe(
      await readFile(join(root, ref.key), "utf8"),
    );
    await adapter.delete(ref);
    expect(await inHead(root, ref.key)).toBe(false);
  });

  test("commit.gpgsign with a signer that fails refuses the open cleanly", async () => {
    const root = await tempDir();
    await gitOut(root, "init", "--quiet");
    await gitOut(root, "config", "commit.gpgsign", "true");
    await gitOut(root, "config", "gpg.program", "engram-no-such-signer");
    await expect(createLettaAdapter({ root })).rejects.toThrow(/git commit failed/);
    expect(await readdir(root)).toEqual([".git"]);
    expect(await status(root)).toEqual([]);
    expect(
      (await runGit(["rev-parse", "--verify", "--quiet", "HEAD"], { cwd: root })).code,
    ).not.toBe(0);
  });
});

describe("R2-8: an empty folder inside another repository is refused", () => {
  test("an empty subfolder is refused and no nested repository is made", async () => {
    const root = await freshLettaRepo();
    const inner = join(root, "reference");
    await mkdir(inner);
    await expect(createLettaAdapter({ root: inner })).rejects.toThrow(NotMemfsRepositoryError);
    expect(await readdir(inner)).toEqual([]);
  });

  test("a missing subfolder is refused and not created", async () => {
    const root = await freshLettaRepo();
    await expect(createLettaAdapter({ root: join(root, "notes") })).rejects.toThrow(
      NotMemfsRepositoryError,
    );
    expect(await readdir(root)).not.toContain("notes");
  });
});

describe("R2-11: an item file that was never committed", () => {
  test("is deleted cleanly, with no pathspec error and no commit for it", async () => {
    const root = await freshLettaRepo();
    const adapter = await createLettaAdapter({ root });
    const written = await adapter.write(item(8));
    const text = await readFile(join(root, written.key), "utf8");
    const stray = `engram/${id(9)}.md`;
    await writeFile(join(root, stray), text.replaceAll(id(8), id(9)));
    const before = await commits(root);
    await adapter.delete({ adapter: "letta", key: stray });
    expect(await readdir(join(root, "engram"))).not.toContain(`${id(9)}.md`);
    expect(await commits(root)).toEqual(before);
    expect(await status(root)).toEqual([]);
  });

  test("whose index line was committed is deleted with one commit of the index alone", async () => {
    const root = await freshLettaRepo();
    const adapter = await createLettaAdapter({ root });
    const written = await adapter.write(item(10));
    const text = await readFile(join(root, written.key), "utf8");
    const stray = `engram/${id(11)}.md`;
    await writeFile(join(root, stray), text.replaceAll(id(10), id(11)));
    // Someone committed the index line, never the file.
    const indexPath = join(root, "engram", "MEMORY.md");
    const index = await readFile(indexPath, "utf8");
    await writeFile(
      indexPath,
      index.replaceAll(id(10), id(11)) +
        index
          .split("\n")
          .filter((l) => l.includes(id(10)))
          .join("\n") +
        "\n",
    );
    await gitOut(
      root,
      "commit",
      "--quiet",
      "-m",
      "user: index line only",
      "--",
      "engram/MEMORY.md",
    );
    const before = await commits(root);
    await adapter.delete({ adapter: "letta", key: stray });
    const after = await commits(root);
    expect(after).toHaveLength(before.length + 1);
    expect(await touched(root, after.at(-1) as string)).toEqual(["engram/MEMORY.md"]);
    expect(await readFile(indexPath, "utf8")).not.toContain(id(11));
    expect(await readdir(join(root, "engram"))).not.toContain(`${id(11)}.md`);
    expect(await status(root)).toEqual([]);
  });
});

describe("N3: a commit refused by the ref compare-and-swap is retried only while its paths are unchanged", () => {
  const CAS = "fatal: cannot lock ref 'HEAD': is at 1111111 but expected 2222222";
  const refusal = { code: 128, stdout: Buffer.alloc(0), stderr: CAS };

  test("a refusal with nothing changed is retried, and the write lands in one commit", async () => {
    const root = await freshLettaRepo();
    let refusals = 2;
    const adapter = await createLettaAdapter({
      root,
      gitRunner: (args, options) =>
        args.includes("commit") && refusals-- > 0
          ? Promise.resolve(refusal)
          : runGit(args, options),
    });
    const before = await commits(root);
    const ref = await adapter.write(item(12));
    expect(refusals).toBeLessThan(0);
    expect(await commits(root)).toHaveLength(before.length + 1);
    expect(await inHead(root, ref.key)).toBe(true);
    expect(await status(root)).toEqual([]);
  });

  test("a refusal after another commit changed one of its paths is not retried, and nothing is left", async () => {
    const root = await freshLettaRepo();
    let first = true;
    const adapter = await createLettaAdapter({
      root,
      gitRunner: async (args, options) => {
        if (!args.includes("commit") || !first) return runGit(args, options);
        first = false;
        // Another client commits a change to engram/MEMORY.md, then this commit's swap fails.
        const theirs = join(await tempDir(), "index.md");
        await writeFile(theirs, "# changed by another client\n");
        const blob = (await gitOut(root, "hash-object", "-w", theirs)).trim();
        await gitOut(root, "update-index", "--cacheinfo", `100644,${blob},engram/MEMORY.md`);
        await gitOut(root, "commit", "--quiet", "-m", "another client", "--", "engram/MEMORY.md");
        return refusal;
      },
    });
    const before = await commits(root);
    await expect(adapter.write(item(13))).rejects.toThrow("cannot lock ref");
    const after = await commits(root);
    expect(after).toHaveLength(before.length + 1);
    expect((await gitOut(root, "log", "-1", "--format=%s")).trim()).toBe("another client");
    expect(await inHead(root, `engram/${id(13)}.md`)).toBe(false);
    expect(await readdir(join(root, "engram"))).not.toContain(`${id(13)}.md`);
  });
});

describe("M-2: concurrent first opens of one empty folder", () => {
  test("four openers race to initialise it; every one opens and every write lands", async () => {
    const root = join(await tempDir(), "memory");
    const adapters = await Promise.all([1, 2, 3, 4].map(() => createLettaAdapter({ root })));
    const refs = await Promise.all(
      adapters.flatMap((a, k) => [0, 1, 2, 3, 4].map((n) => a.write(item(100 + k * 10 + n)))),
    );
    expect(refs).toHaveLength(20);
    const log = await commits(root);
    // One setup commit, then one per write.
    expect(log).toHaveLength(1 + 20);
    expect((await gitOut(root, "log", "--format=%s", "--grep=^engram: list")).trim()).toBe(
      "engram: list engram/ in MEMORY.md",
    );
    expect(await status(root)).toEqual([]);
  }, 120_000);
});

describe("I-1: the deferred adapter touches nothing before its first call", () => {
  test("a missing folder stays missing until the first call creates the repository", async () => {
    const root = join(await tempDir(), "memory");
    const adapter = deferLettaAdapter({ root });
    await new Promise((r) => setTimeout(r, 300));
    await expect(readdir(root)).rejects.toThrow();
    expect(await adapter.list("person:omar")).toEqual([]);
    expect(await commits(root)).toHaveLength(1);
  });
});

describe("M-1: create: false never creates, initialises or commits", () => {
  test("a missing folder is refused, naming it, and is not created", async () => {
    const root = join(await tempDir(), "memory");
    await expect(createLettaAdapter({ root, create: false })).rejects.toThrow(
      `${root} does not exist; only a command that writes initialises a MemFS repository there`,
    );
    await expect(readdir(root)).rejects.toThrow();
  });

  test("an empty folder is refused and stays empty", async () => {
    const root = await tempDir();
    await expect(createLettaAdapter({ root, create: false })).rejects.toThrow(
      NotMemfsRepositoryError,
    );
    expect(await readdir(root)).toEqual([]);
  });

  test("a repository without engram/ is read as empty, with no setup commit", async () => {
    const root = await tempDir();
    await gitOut(root, "init", "--quiet");
    await writeFile(join(root, "persona.md"), "me\n");
    await gitOut(root, "add", "persona.md");
    await gitOut(root, "commit", "--quiet", "-m", "letta");
    const adapter = await createLettaAdapter({ root, create: false });
    expect(await adapter.list("person:omar")).toEqual([]);
    expect(await commits(root)).toHaveLength(1);
    expect((await readdir(root)).sort()).toEqual([".git", "persona.md"]);
  });
});
