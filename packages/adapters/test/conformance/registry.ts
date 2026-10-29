// Every adapter the conformance suite runs on, in one place (card A4). A new
// adapter is one entry here; conformance.test.ts runs the whole suite on every
// entry. There is no per-adapter skip list: the contract is the same for every
// store (AGENTS.md, "What not to do"). `lexical` opts an adapter whose search
// is exact term matching into full recall on the corpus; a semantic store may
// rank or miss items, so it runs the main suite only.
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Adapter } from "../../src/contract.ts";
import { createHashingEmbedder } from "../../src/fake/embedder.ts";
import { createFakeAdapter } from "../../src/fake/index.ts";
import { createFilesAdapter } from "../../src/files/index.ts";
import { createLettaAdapter } from "../../src/letta/index.ts";
import { createMem0Adapter } from "../../src/mem0/index.ts";

export interface RegisteredAdapter {
  name: string;
  /** A fresh, empty store for each test. */
  factory: () => Adapter | Promise<Adapter>;
  lexical: boolean;
  /**
   * One-time work before the suite runs on this adapter, such as loading a
   * large module, so that no case's budget pays it. conformance.test.ts runs
   * it once, after it installs the network guard and redirects MEM0_DIR.
   */
  setup?: () => Promise<void>;
}

/** Runs every registered adapter's `setup`, one after another. */
export async function setupAdapters(): Promise<void> {
  for (const { setup } of ADAPTERS) await setup?.();
}

const tempDirs: string[] = [];
/** A fresh temporary folder, removed by `cleanupAdapters`. */
function freshDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

/** Removes every temporary folder the registered factories created. */
export function cleanupAdapters(): void {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
}

let lettaTemplate: Promise<string> | undefined;
/**
 * A fresh MemFS repository: a copy of one template the Letta adapter
 * initialised (its init and setup commit) once per process, so each case
 * pays a folder copy and the adapter's open (two git calls), not an init.
 */
export async function freshLettaRepo(): Promise<string> {
  lettaTemplate ??= (async () => {
    const dir = freshDir("engram-letta-template-");
    await createLettaAdapter({ root: dir });
    return dir;
  })();
  const template = await lettaTemplate;
  const dir = freshDir("engram-letta-conformance-");
  cpSync(template, dir, { recursive: true });
  return dir;
}

export const ADAPTERS: RegisteredAdapter[] = [
  { name: "fake", factory: () => createFakeAdapter(), lexical: true },
  {
    name: "fake without search or history",
    factory: () => createFakeAdapter({ search: false, history: false }),
    lexical: false,
  },
  {
    // Open-source Mem0 in-process: its own SQLite vector store in memory,
    // `infer: false`, the hashing fake as its embedding model, a model slot
    // that refuses every call, and telemetry off, so nothing needs the
    // network. conformance.test.ts also refuses fetch, sockets and DNS for
    // the whole run (network-guard.ts); ENGRAM_OFFLINE, set in CI, governs
    // the runner's model cache, not adapters.
    name: "mem0",
    factory: () => createMem0Adapter({ embedder: createHashingEmbedder(), dbPath: ":memory:" }),
    lexical: false,
    // The first Mem0 instance in a process loads `mem0ai/oss`, about 3 s in a
    // full run and up to 6 s on a loaded machine; later instances take
    // milliseconds (docs/log/2026-10-25-a1-mem0-conformance-warm-load.md). One
    // throwaway instance pays it here.
    setup: async () => {
      await createMem0Adapter({ embedder: createHashingEmbedder(), dbPath: ":memory:" });
    },
  },
  {
    // A folder of Markdown in the Claude Code memory layout (card A3); its
    // search is exact term matching, so it opts into full recall.
    name: "files",
    factory: () =>
      createFilesAdapter({ root: freshDir("engram-files-conformance-"), owner: "omar" }),
    lexical: true,
  },
  {
    // A MemFS repository on local disk (card A2, ADR 0028), one commit per
    // write; its search is exact term matching over engram/, so it opts
    // into full recall.
    name: "letta",
    factory: async () => createLettaAdapter({ root: await freshLettaRepo() }),
    lexical: true,
  },
];
