// The Letta adapter for a caller that builds its store synchronously, such
// as the server's workspace opener (packages/server/src/workspace.ts), which
// reports a bad flag before anything else runs. The folder is checked at once
// with the file-system rules `createLettaAdapter` applies before it runs git
// (a folder, not a symlink; a repository's top level or empty, or missing
// when the store may create it); the repository is opened by the first
// adapter call, never before, so a command refused for another flag leaves
// the folder untouched, and an error git reports (a nested folder, a bare
// repository, git missing) is the first call's error.
import { lstatSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import type { MemoryItem } from "@engram/core";
import type { Adapter, StoreDiagnostic, StoreRef } from "../contract.ts";
import { codeOf } from "../fs-safe.ts";
import {
  createLettaAdapter,
  type LettaAdapter,
  type LettaAdapterOptions,
  NotMemfsRepositoryError,
} from "./index.ts";

/** Refuses at once a folder the Letta adapter would refuse without asking git. */
export function checkMemfsRoot(root: string, create = true): void {
  let info: ReturnType<typeof lstatSync>;
  try {
    info = lstatSync(root);
  } catch (e) {
    if (codeOf(e) !== "ENOENT") throw e;
    if (create) return;
    throw new NotMemfsRepositoryError(
      root,
      "does not exist; only a command that writes initialises a MemFS repository there",
    );
  }
  if (!info.isDirectory())
    throw new NotMemfsRepositoryError(
      root,
      "is not a folder (a symlink or junction is never followed)",
    );
  const entries = readdirSync(root);
  if (entries.length === 0 && !create)
    throw new NotMemfsRepositoryError(
      root,
      "is an empty folder; only a command that writes initialises a MemFS repository there",
    );
  if (entries.length > 0 && !entries.includes(".git"))
    throw new NotMemfsRepositoryError(
      root,
      "is neither a git repository's top level nor an empty folder; the Letta adapter opens a MemFS repository or initialises one in an empty folder",
    );
}

/** A Letta adapter built now and opened in the background; see the header. */
export function deferLettaAdapter(options: LettaAdapterOptions): Adapter {
  const root = resolve(options.root);
  checkMemfsRoot(root, options.create ?? true);
  let opened: LettaAdapter | undefined;
  let opening: Promise<LettaAdapter> | undefined;
  // Opened by the first call, so nothing touches the folder before then.
  const call = <T>(fn: (a: LettaAdapter) => Promise<T>) => {
    opening ??= createLettaAdapter({ ...options, root }).then((a) => {
      opened = a;
      return a;
    });
    return opening.then(fn);
  };
  return {
    name: options.name ?? "letta",
    capabilities: {
      native_validity: false,
      native_history: true,
      native_search: false,
      native_graph: false,
    },
    write: (item: MemoryItem) => call((a) => a.write(item)),
    read: (ref: StoreRef) => call((a) => a.read(ref)),
    delete: (ref: StoreRef) => call((a) => a.delete(ref)),
    list: (scope: string) => call((a) => a.list(scope)),
    search: (query: string, scopes: readonly string[]) => call((a) => a.search(query, scopes)),
    history: (ref: StoreRef) => call((a) => a.history(ref)),
    diagnostics: (): StoreDiagnostic[] => opened?.diagnostics() ?? [],
  };
}
