// Lands with card E8.4 in the next commit of this branch.
import type { Io } from "./run.ts";
import { UsageError } from "./setup.ts";

export async function mcpCommand(_args: string[], _io: Io): Promise<number> {
  throw new UsageError("not implemented yet (card E8.4)");
}
