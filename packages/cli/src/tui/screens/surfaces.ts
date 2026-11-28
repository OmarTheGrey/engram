// The hand-made screens of card E8.15d, by registry name (docs/design/tui.md
// 8.9 to 8.15 and 8.20 to 8.24): the router opens these in place of the
// generated form. Every other command keeps its generated form (./form.ts).
// There is no Procedures screen (8.25): the palette names it, with no action.
import type { CommandSpec, Values } from "../../registry.ts";
import type { Ctx, Screen } from "../screen.ts";
import {
  AuditVerifyScreen,
  ExportScreen,
  ImportScreen,
  KeyCreateScreen,
  KeyRevokeScreen,
  KeysScreen,
  LogVerifyScreen,
} from "./data.ts";
import { DiscoverScreen, DoctorScreen } from "./machine.ts";
import { LintScreen, RetainScreen, SimulateScreen } from "./policy.ts";
import { ServeScreen } from "./serve.ts";
import { HookScreen, McpScreen } from "./setup.ts";

type Make = (spec: CommandSpec, ctx: Ctx, values: Values, positionals: readonly string[]) => Screen;

export const SURFACE_SCREENS: Readonly<Record<string, Make>> = {
  retain: (s, c, v, p) => new RetainScreen(s, c, v, p),
  lint: (s, c, v, p) => new LintScreen(s, c, v, p),
  simulate: (s, c, v, p) => new SimulateScreen(s, c, v, p),
  doctor: (s, c, v, p) => new DoctorScreen(s, c, v, p),
  discover: (s, c, v, p) => new DiscoverScreen(s, c, v, p),
  serve: (s, c, v, p) => new ServeScreen(s, c, v, p),
  mcp: (s, c, v, p) => new McpScreen(s, c, v, p),
  "hook claude-code": (s, c, v, p) => new HookScreen(s, c, v, p),
  // Card E8.17: the same screen, setting up Codex's hook.
  "hook codex": (s, c, v, p) => new HookScreen(s, c, v, p),
  export: (s, c, v, p) => new ExportScreen(s, c, v, p),
  import: (s, c, v, p) => new ImportScreen(s, c, v, p),
  "key list": (s, c, v, p) => new KeysScreen(s, c, v, p),
  "key create": (s, c, v) => new KeyCreateScreen(c, v, undefined, s),
  "key revoke": (s, c, v, p) => new KeyRevokeScreen(s, c, v, p),
  "log verify": (s, c, v, p) => new LogVerifyScreen(s, c, v, p),
  // Card E9.15: reached from the log verify screen and the palette.
  "audit verify": (s, c, v, p) => new AuditVerifyScreen(s, c, v, p),
};

/** A command's hand-made screen, or undefined for its generated form. */
export function surfaceScreen(
  spec: CommandSpec,
  ctx: Ctx,
  values: Values,
  positionals: readonly string[],
): Screen | undefined {
  return SURFACE_SCREENS[spec.name]?.(spec, ctx, values, positionals);
}
