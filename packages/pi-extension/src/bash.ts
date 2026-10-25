// No-bypass in the shell (ADR 0014, decision D10): a shell command that
// invokes a memory store's CLI is a write the gate never saw. The same check
// runs for the user's `!` commands (user_bash) and the model's bash and
// powershell tools (tool_call).
//
// Shell text cannot be parsed into a complete answer, so the check errs
// towards blocking: the command is cut into words at whitespace and at every
// shell operator (`;`, `&`, `|`, parentheses, braces, `$`, backticks,
// redirections), quotes are dropped, so a `bash -c "..."` argument, a
// subshell or a substitution is searched like the rest, and each word, and
// each side of an `=` in it, is compared after removing a leading path, an
// executable suffix and case. Any match anywhere blocks the command, behind
// any wrapper (env, sudo, npx, uvx, xargs, python -m, ...). It also blocks
// mentions that would not run the store (`echo mem0`), which is the cost of
// erring that way.
//
// Out of reach of any text check, and not claimed: a name assembled at run
// time (`$STORE`, `m""em0` is caught but `$(printf mem%s 0)` is not), an
// alias or function defined outside the command, and a script or program
// that calls the store itself.

/** Store CLIs blocked by default: the stores the adapters name. */
export const STORE_COMMANDS: readonly string[] = ["mem0", "letta"];

/** Suffixes an executable name may carry on Windows or as a script. */
const EXECUTABLE = /\.(exe|cmd|bat|com|ps1|sh|py|js|mjs|cjs)$/i;

/** The words of a shell command: split at whitespace and shell operators, quotes removed. */
export function commandWords(command: string): string[] {
  return command
    .replace(/["']/g, "")
    .split(/[\s;&|(){}<>$`!]+/)
    .filter((w) => w.length > 0);
}

/** The names a word may invoke: its last path segment, with and without backslash escapes. */
function names(word: string): string[] {
  const out = new Set<string>();
  for (const part of word.split("=")) {
    for (const variant of [part, part.replaceAll("\\", "")]) {
      const last = variant.split(/[\\/]/).pop() ?? "";
      out.add(last.replace(EXECUTABLE, "").toLowerCase());
    }
  }
  return [...out];
}

/** The store `command` names anywhere in it, if any (decision D10). */
export function blockedStoreCommand(
  command: string,
  stores: readonly string[],
): string | undefined {
  const byName = new Map(stores.map((s) => [s.toLowerCase(), s]));
  for (const word of commandWords(command)) {
    for (const name of names(word)) {
      const store = byName.get(name);
      if (store !== undefined) return store;
    }
  }
  return undefined;
}

/** Words of a shell command that may be paths, for the store-root check (decision D10). */
export function pathWords(command: string): string[] {
  return commandWords(command)
    .flatMap((w) => w.split("="))
    .filter((w) => /[\\/]|^~|^\./.test(w));
}
