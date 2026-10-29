// Review finding R2-1 (critical): writes from two processes racing the
// user's own `git add u.txt; git commit` loop. Before the fix a write the
// user's commit swallowed was reported stored: the user's commit carried
// Engram's staged files and Engram's own commit, finding nothing to commit,
// counted as success. Now:
// - no commit the user made adds or changes a file under engram/ (Engram
//   never stages an item's content where another client's commit picks it up);
// - every write resolved has its own Engram commit, and every refused write
//   left nothing in HEAD;
// - nothing under engram/ is left staged or modified, except where git's own
//   race reverted an Engram commit (below).
// One hazard is git's, not the adapter's, and the test names it rather than
// hiding it: a plain `git commit` reads HEAD, then the index file, and when
// another commit lands between the two (its ref updated, its index not yet
// renamed) it commits the older index on top, deleting what that commit
// added. Measured here about once in fifteen runs; ADR 0028 states it.
import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, test } from "vitest";
import { runGit } from "../../src/letta/git.ts";
import { commits, freshLettaRepo, gitOut } from "./helpers.ts";

const run = promisify(execFile);
const CHILD = fileURLToPath(new URL("./race.child.ts", import.meta.url));

/** A commit's subject and its changed paths with their status letters (A, M, D). */
async function changes(root: string, sha: string) {
  const [subject = "", ...lines] = (await gitOut(root, "show", "--format=%s", "--name-status", sha))
    .split("\n")
    .filter(Boolean);
  return {
    subject,
    files: lines.map((l) => {
      const [status, path] = l.split("\t") as [string, string];
      return { status, path };
    }),
  };
}

test("two writer processes and a user committing in a loop: no user commit carries Engram's content, and every write is stored or refused whole", async () => {
  const root = await freshLettaRepo();
  const children = [100, 200].map((first) =>
    run(process.execPath, [CHILD, root, String(first)], { timeout: 110_000 }),
  );
  let done = false;
  const writers = Promise.all(children).finally(() => {
    done = true;
  });
  // The user's loop: add one file and commit, ignoring the index lock it may meet.
  let n = 0;
  while (!done) {
    n++;
    await writeFile(join(root, "u.txt"), `user change ${n}\n`);
    await runGit(["add", "u.txt"], { cwd: root });
    await runGit(["commit", "--quiet", "-m", `user${n}`], { cwd: root });
  }
  const results = (await writers).map(
    (r) => JSON.parse(r.stdout) as { resolved: string[]; refused: string[] },
  );
  const resolved = results.flatMap((r) => r.resolved);
  const refused = results.flatMap((r) => r.refused);
  expect(resolved.length + refused.length).toBe(16);
  expect(resolved.length).toBeGreaterThan(0);

  /** Items a user's commit deleted: git's stale-index race reverting an Engram commit. */
  const reverted = new Set<string>();
  const writes: string[] = [];
  for (const sha of await commits(root)) {
    const { subject, files } = await changes(root, sha);
    if (subject.startsWith("engram:")) {
      expect(
        files.filter((f) => f.path !== "MEMORY.md" && !f.path.startsWith("engram/")),
        subject,
      ).toEqual([]);
      const written = /^engram: write (\S+)/.exec(subject)?.[1];
      if (written) writes.push(written);
      continue;
    }
    const engram = files.filter((f) => f.path.startsWith("engram/"));
    // Never Engram's content in a user's commit: no engram/ path added or changed,
    // except the index line removed together with a reverted item.
    const items = engram.filter((f) => f.path !== "engram/MEMORY.md");
    expect(
      items.filter((f) => f.status !== "D"),
      subject,
    ).toEqual([]);
    for (const f of items) reverted.add(f.path.slice("engram/".length, -".md".length));
    if (items.length === 0) expect(engram, subject).toEqual([]);
  }
  expect(writes.sort()).toEqual([...resolved].sort());
  for (const id of resolved) {
    const inHead = (await runGit(["cat-file", "-e", `HEAD:engram/${id}.md`], { cwd: root })).code;
    expect(inHead === 0 || reverted.has(id), id).toBe(true);
  }
  for (const id of refused) {
    expect(
      (await runGit(["cat-file", "-e", `HEAD:engram/${id}.md`], { cwd: root })).code,
      id,
    ).not.toBe(0);
  }
  const dirty = (await gitOut(root, "status", "--porcelain", "--untracked-files=all"))
    .split("\n")
    .filter((l) => l.includes("engram/"))
    .filter((l) => reverted.size === 0 || ![...reverted].some((id) => l.includes(id)))
    .filter((l) => reverted.size === 0 || !l.endsWith("engram/MEMORY.md"));
  expect(dirty).toEqual([]);
  if (reverted.size > 0)
    console.warn(`git's stale-index race reverted ${reverted.size} Engram commit(s) in this run`);
}, 120_000);
