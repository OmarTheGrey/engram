// MCP server exposing governed read, write, explain, simulate (card E8.4), and
// the Claude Code PreToolUse hook that blocks store bypasses (ADR 0022).
export {
  claudeCodeHook,
  type HookDeny,
  type HookOptions,
  hookBypass,
  type PreToolUseInput,
} from "./hook.ts";
export { createMcpServer, type McpOptions, SERVER_INFO, toolList } from "./server.ts";
export {
  type HttpListening,
  MCP_PATH,
  mcpHttpApp,
  serveHttp,
  serveStdio,
} from "./transports.ts";
