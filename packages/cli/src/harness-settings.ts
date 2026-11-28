// Claude Code's `autoMemoryDirectory` setting (card E9.10): "To store auto
// memory in a different location, set autoMemoryDirectory in your
// settings.json" (code.claude.com/docs/en/memory). The user settings file
// is configuration, not memory: this reads that one file and keeps its one
// key, a folder path, and nothing else of it. Project and managed settings
// files are not read; a folder they set is not walked (a stated limit).
//
// Card E8.17 adds the hooks' harnesses and the Codex home here, so the hook,
// its installer and the TUI's confirmation share them without loading the
// MCP package.
import { lstatSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { codexHomeOf } from "@engram/core";
import type { Io } from "./run.ts";

/** The harnesses a hook exists for (packages/mcp's HookHarness). */
export const HARNESSES = ["claude-code", "codex"] as const;

/** The actor each harness's block events are recorded as when no --as is given. */
export const HOOK_AGENT: Readonly<Record<(typeof HARNESSES)[number], string>> = {
  "claude-code": "agent:claude-code",
  codex: "agent:codex",
};

/** The Codex home: $CODEX_HOME against the cwd, else <home>/.codex (core's codexHomeOf). */
export const codexHome = (io: Pick<Io, "cwd" | "home" | "env">): string =>
  resolve(
    codexHomeOf(
      io.home,
      io.env.CODEX_HOME ? { codexHome: resolve(io.cwd, io.env.CODEX_HOME) } : {},
    ),
  );

/** The user settings file whose `autoMemoryDirectory` discover honours. */
export const userSettingsPath = (home: string) => join(home, ".claude", "settings.json");

/**
 * The folder the user settings name for auto memory, `~/` expanded and a
 * relative path taken from the home; undefined when the file or the key is
 * missing, is not a regular file, or does not parse.
 */
export function autoMemoryDirectory(home: string): string | undefined {
  const file = userSettingsPath(home);
  try {
    if (!lstatSync(file).isFile()) return undefined;
    const value = (JSON.parse(readFileSync(file, "utf8")) as { autoMemoryDirectory?: unknown })
      .autoMemoryDirectory;
    if (typeof value !== "string" || value.trim() === "") return undefined;
    const path = value.replace(/^~(?=$|[\\/])/, home);
    return resolve(home, path);
  } catch {
    return undefined;
  }
}
