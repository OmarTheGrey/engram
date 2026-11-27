// The memory and audit screens by registry entry (card E8.15c): the router
// opens one of these for its command, else the generated form (./form.ts).
// Each is the same registry entry, the same argument vector and the same
// `run`; only the layout and the result's drawing are the screen's own.
import type { CommandSpec, Values } from "../../registry.ts";
import type { Ctx, Screen } from "../screen.ts";
import { EventsScreen, PolicyScreen } from "./events.ts";
import { GrantsScreen } from "./grants.ts";
import { ItemScreen } from "./item.ts";
import { ExplainScreen, ReadScreen } from "./read.ts";
import { SupersedeScreen, WhoScreen } from "./who.ts";
import { PromoteScreen, WriteScreen } from "./write.ts";

type Make = (spec: CommandSpec, ctx: Ctx, values: Values, positionals: readonly string[]) => Screen;

const SCREENS: Readonly<Record<string, Make>> = {
  read: (s, c, v, p) => new ReadScreen(s, c, v, p),
  "read --item": (s, c, v, p) => new ItemScreen(s, c, v, p),
  explain: (s, c, v, p) => new ExplainScreen(s, c, v, p),
  write: (s, c, v, p) => new WriteScreen(s, c, v, p),
  promote: (s, c, v, p) => new PromoteScreen(s, c, v, p),
  grants: (s, c, v, p) => new GrantsScreen(s, c, v, p),
  events: (s, c, v, p) => new EventsScreen(s, c, v, p),
  policy: (s, c, v, p) => new PolicyScreen(s, c, v, p),
  "who-can-read": (s, c, v, p) => new WhoScreen(s, c, v, p),
  supersede: (s, c, v, p) => new SupersedeScreen(s, c, v, p),
};

/** The commands with a screen of their own here. */
export const MEMORY_SCREENS: readonly string[] = Object.keys(SCREENS);

/** The screen for a registry command, if this part has one. */
export function memoryScreen(
  spec: CommandSpec,
  ctx: Ctx,
  values: Values = {},
  positionals: readonly string[] = [],
): Screen | undefined {
  return SCREENS[spec.name]?.(spec, ctx, values, positionals);
}
