// The stores of the erasure-residue check (card X19): every store adapter
// Engram ships with bytes of its own on disk, each in a fresh folder, with
// what the check searches beside the records the adapter lists:
// - files: the Markdown folder (card A3), every file under it;
// - mem0: open-source Mem0 in-process on its file vector store (SQLite, with
//   its `_entities.db` sibling), the hashing embedder, no model (card A1);
// - letta: a MemFS repository (card A2), one commit per write: its working
//   tree, and its history as `git cat-file --batch-all-objects --batch`
//   prints it (every object, reachable or not, decompressed);
// - mcp-memory: the MCP reference memory server's JSONL file (card A6).
// The fake adapter keeps nothing on disk and is not a store here.
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  type Adapter,
  createFilesAdapter,
  createHashingEmbedder,
  createLettaAdapter,
  createMcpMemoryAdapter,
  createMem0Adapter,
} from "@engram/adapters";
import { filesUnder } from "./backend.ts";

export interface StoreHandle {
  adapter: Adapter;
  /** The store's files on disk, outside any history it keeps. */
  fileBytes(): Promise<Uint8Array[]>;
  /** The store's own history (Letta's git objects); none for a store that keeps none. */
  historyBytes(): Promise<Uint8Array[]>;
  close(): Promise<void>;
}

const OWNER = "x19";

export async function openStore(
  name: "files" | "mem0" | "letta" | "mcp-memory",
  dir: string,
): Promise<StoreHandle> {
  mkdirSync(dir, { recursive: true });
  const none = async () => [] as Uint8Array[];
  const done = async () => {};
  if (name === "files") {
    const root = join(dir, "memory");
    return {
      adapter: createFilesAdapter({ root, owner: OWNER }),
      fileBytes: async () => filesUnder(root),
      historyBytes: none,
      close: done,
    };
  }
  if (name === "mem0") {
    // Mem0's home folder, should anything reach for it, inside the check's folder.
    process.env.MEM0_DIR = join(dir, "mem0-home");
    const root = join(dir, "mem0");
    mkdirSync(root, { recursive: true });
    const adapter = await createMem0Adapter({
      embedder: createHashingEmbedder(),
      dbPath: join(root, "vectors.db"),
    });
    return { adapter, fileBytes: async () => filesUnder(root), historyBytes: none, close: done };
  }
  if (name === "letta") {
    const root = join(dir, "memfs");
    const adapter = await createLettaAdapter({ root });
    return {
      adapter,
      fileBytes: async () => filesUnderExcept(root, ".git"),
      historyBytes: async () => [
        execFileSync("git", ["cat-file", "--batch-all-objects", "--batch"], {
          cwd: root,
          maxBuffer: 1 << 30,
          windowsHide: true,
        }),
      ],
      close: done,
    };
  }
  const file = join(dir, "mcp", "memory.jsonl");
  mkdirSync(join(dir, "mcp"), { recursive: true });
  return {
    adapter: createMcpMemoryAdapter({ file, owner: OWNER }),
    fileBytes: async () => filesUnder(join(dir, "mcp")),
    historyBytes: none,
    close: done,
  };
}

/** Every file under `root` but those inside its top-level folder `skip`. */
function filesUnderExcept(root: string, skip: string): Uint8Array[] {
  const out: Uint8Array[] = [];
  for (const name of readdirSync(root).sort()) {
    if (name === skip) continue;
    const path = join(root, name);
    if (statSync(path).isDirectory()) out.push(...filesUnder(path));
    else out.push(readFileSync(path));
  }
  return out;
}
