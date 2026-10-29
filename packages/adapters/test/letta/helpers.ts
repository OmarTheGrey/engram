// Shared fixtures for the Letta adapter's own tests (card A2): temporary
// folders, a fresh MemFS repository copied from the conformance template,
// an item builder and git queries run through the adapter's own runner.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { MemoryItem } from "@engram/core";
import { afterAll } from "vitest";
import { runGit } from "../../src/letta/git.ts";
import { cleanupAdapters, freshLettaRepo } from "../conformance/registry.ts";

const dirs: string[] = [];
export async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "engram-letta-"));
  dirs.push(dir);
  return dir;
}
afterAll(async () => {
  for (const dir of dirs) await rm(dir, { recursive: true, force: true });
  cleanupAdapters();
});

export { freshLettaRepo };

export const id = (n: number) => `01920000-0000-7000-8000-${String(n).padStart(12, "0")}`;

export const item = (n: number, patch: Partial<MemoryItem> = {}): MemoryItem =>
  ({
    id: id(n),
    class: "semantic",
    scope: "team:platform",
    owner: "person:omar",
    content: `Fact number ${n}.`,
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

/** Runs git in `cwd` and returns its standard output; fails the test on a non-zero exit. */
export async function gitOut(cwd: string, ...args: string[]): Promise<string> {
  const r = await runGit(args, { cwd });
  if (r.code !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.toString("utf8");
}

/** Commit shas, oldest first. */
export const commits = async (root: string) =>
  (await gitOut(root, "log", "--reverse", "--format=%H")).split("\n").filter(Boolean);

/** The paths a commit touched, sorted. */
export const touched = async (root: string, sha: string) =>
  (await gitOut(root, "show", "--name-only", "--format=", sha)).split("\n").filter(Boolean).sort();

/** `git status --porcelain`, every line: empty when the tree and the index match HEAD. */
export const status = async (root: string) =>
  (await gitOut(root, "status", "--porcelain", "--untracked-files=all"))
    .split("\n")
    .filter(Boolean);
