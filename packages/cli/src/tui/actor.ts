// Whom an answer was made for (card E8.15c review fix pass, findings 1 and 2;
// the lead's decision): the actor the workspace names now, and the actor a
// run's call was made as, which its request carries. A screen draws an
// answer only when the two are the same; after a change of actor (the
// reviewer handoff, Switch back, the workspace panel applied) it says whom
// the answer was made as and that r runs it again as the actor now. Nothing
// here decides anything: it compares two principals' ids.
import type { Actor } from "@engram/sdk";
import { buildActor } from "../setup.ts";
import type { RunResult } from "./runner.ts";
import type { Workspace } from "./workspace.ts";

/** The actor the workspace names now, built as every command builds it; undefined when none. */
export function actorNow(ws: Workspace): Actor | undefined {
  try {
    return buildActor(
      { as: ws.get("as"), level: ws.get("level"), member: [...ws.list("member")] },
      ws.get("owner"),
    ) as Actor;
  } catch {
    return undefined;
  }
}

/** The actor a run's calls were made as: the first request that names one; undefined for none (policy). */
export function actorOfResult(r: RunResult | undefined): string | undefined {
  for (const c of r?.calls ?? []) {
    const id = (c.request as { actor?: { id?: unknown } } | undefined)?.actor?.id;
    if (typeof id === "string") return id;
  }
  return undefined;
}

/** The actor a run was made as, when it is not the actor now; undefined when the answer is this actor's (or no one's). */
export function madeAsOther(ws: Workspace, r: RunResult | undefined): string | undefined {
  const made = actorOfResult(r);
  if (made === undefined) return undefined;
  return made === actorNow(ws)?.id ? undefined : made;
}

/** What a screen says in place of an answer made as another actor. */
export const madeAsLines = (made: string, now: string | undefined): string[] => [
  `This answer was made as ${made}.`,
  `You act as ${now ?? "no one"} now, so it is not shown; r runs it again as you.`,
];
