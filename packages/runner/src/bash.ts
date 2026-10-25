// A user `!` command in a runner session. `session.executeBash` never emits
// user_bash; only pi's interactive and RPC hosts do (S0.5 finding,
// docs/log/2026-10-17-s0-5-pi-interception.md). The runner is the host here,
// so it emits user_bash itself, the way pi's RPC host does
// (modes/rpc/rpc-mode.ts, case "bash"): an extension's replacement result is
// recorded instead of running the command, so C5 blocks store commands.
import type { AgentSession } from "@earendil-works/pi-coding-agent";

export async function userBash(session: AgentSession, command: string) {
  const handled = await session.extensionRunner.emitUserBash({
    type: "user_bash",
    command,
    excludeFromContext: false,
    cwd: session.sessionManager.getCwd(),
  });
  if (handled?.result) {
    session.recordBashResult(command, handled.result);
    return handled.result;
  }
  return session.executeBash(command, undefined, { operations: handled?.operations });
}
