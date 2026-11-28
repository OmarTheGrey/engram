// MCP server exposing governed read, write, explain, simulate (card E8.4), and
// the Claude Code and Codex PreToolUse hooks that block store bypasses (ADR 0022).
export {
  claudeCodeHook,
  codexHook,
  codexHookBypass,
  type HookDeny,
  type HookHarness,
  type HookOptions,
  type HookScope,
  harnessBypass,
  harnessHook,
  hookBypass,
  hookDeny,
  isCodexHookInput,
  isEngramToolCall,
  isHarnessInput,
  isHookInput,
  type PreToolUseInput,
  patchPaths,
} from "./hook.ts";
export { createMcpServer, type McpOptions, SERVER_INFO, toolList } from "./server.ts";
export {
  type HttpListening,
  MCP_PATH,
  mcpHttpApp,
  serveHttp,
  serveStdio,
} from "./transports.ts";
