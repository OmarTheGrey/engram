// The store a command governs. The CLI builds the adapter and hands it to the
// Plane; it never calls it (AGENTS.md rule 2). Memories already in the folder
// are brought under the plane by core's adoptStoreItems, which lists them,
// gates each one like a write and records it at its existing store_ref.
import { createFilesAdapter } from "@engram/adapters";
import type { Adapter } from "@engram/core";
import { UsageError } from "./setup.ts";

export interface Store {
  name: string;
  root: string;
  /** The adapter the Plane is built on. */
  adapter: Adapter;
  /** The scope the folder's own memories live in: `person:<owner>`. */
  scope: string;
}

export interface StoreFlags {
  store?: string;
  root?: string;
  owner?: string;
  importValidFrom?: string;
}

export function openStore(flags: StoreFlags, resolvePath: (p: string) => string): Store {
  const name = flags.store ?? "files";
  if (name !== "files")
    throw new UsageError(
      `--store ${name} is not available in the CLI yet; it opens files only (mem0 needs an embedding model wired at the surface; letta is card A2)`,
    );
  if (flags.root === undefined) throw new UsageError("the files store needs --root <folder>");
  if (flags.owner === undefined) throw new UsageError("the files store needs --owner <id>");
  const root = resolvePath(flags.root);
  const adapter = createFilesAdapter({
    root,
    owner: flags.owner,
    importValidFrom: flags.importValidFrom,
  });
  return { name, root, adapter, scope: `person:${flags.owner}` };
}
