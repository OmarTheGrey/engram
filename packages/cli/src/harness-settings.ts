// Claude Code's `autoMemoryDirectory` setting (card E9.10): "To store auto
// memory in a different location, set autoMemoryDirectory in your
// settings.json" (code.claude.com/docs/en/memory). The user settings file
// is configuration, not memory: this reads that one file and keeps its one
// key, a folder path, and nothing else of it. Project and managed settings
// files are not read; a folder they set is not walked (a stated limit).
import { lstatSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

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
