// The Letta adapter for a caller that builds its store synchronously, such
// as the server's workspace opener (packages/server/src/workspace.ts), which
// reports a bad flag before anything else runs. The folder is checked at once
// with the file-system rules `createLettaAdapter` applies before it runs git
// (a folder, not a symlink; a repository's top level or empty); the
// repository is then opened in the background, and every adapter call waits
// for it, so an error git reports (a nested folder, a bare repository, git
// missing) is the first call's error.
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
export function checkMemfsRoot(root: string): void {
  let info: ReturnType<typeof lstatSync>;
  try {
    info = lstatSync(root);
  } catch (e) {
    if (codeOf(e) === "ENOENT") return;
    throw e;
  }
  if (!info.isDirectory())
    throw new NotMemfsRepositoryError(
      root,
      "is not a folder (a symlink or junction is never followed)",
    );
  const entries = readdirSync(root);
  if (entries.length > 0 && !entries.includes(".git"))
    throw new NotMemfsRepositoryError(
      root,
      "is neither a git repository's top level nor an empty folder; the Letta adapter opens a MemFS repository or initialises one in an empty folder",
    );
}

/** A Letta adapter built now and opened in the background; see the header. */
export function deferLettaAdapter(options: LettaAdapterOptions): Adapter {
  const root = resolve(options.root);
  checkMemfsRoot(root);
  let opened: LettaAdapter | undefined;
  const opening = createLettaAdapter({ ...options, root }).then((a) => {
    opened = a;
    return a;
  });
  // Reported by the first call that needs the store, never as an unhandled rejection.
  opening.catch(() => undefined);
  const call = <T>(fn: (a: LettaAdapter) => Promise<T>) => opening.then(fn);
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
