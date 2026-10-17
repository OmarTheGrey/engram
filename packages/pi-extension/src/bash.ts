// No-bypass (ADR 0014): a shell command that invokes a memory store's CLI is a
// write the gate never saw. The same check runs for the user's `!` commands
// (user_bash) and the model's bash tool (tool_call).

/** Store CLIs blocked by default. */
export const STORE_COMMANDS: readonly string[] = ["mem0", "letta"];

/** The store command `command` invokes, if any, in any segment of a chain or pipe. */
export function blockedStoreCommand(
  command: string,
  stores: readonly string[],
): string | undefined {
  for (const segment of command.split(/&&|\|\||[;|\n]/)) {
    const words = segment.trim().split(/\s+/);
    const program = words.find((w) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(w)) ?? "";
    const name = program.split(/[/]/).pop() ?? "";
    if (stores.includes(name)) return name;
  }
  return undefined;
}
