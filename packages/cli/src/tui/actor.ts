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
      // No --member is the actor's own scope, as every command builds it: not an empty list (N3).
      {
        as: ws.get("as"),
        level: ws.get("level"),
        member: ws.list("member").length > 0 ? [...ws.list("member")] : undefined,
      },
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

/** An actor as a comparable key: its id, its level and its memberships, sorted (verification N3). */
export function actorKey(a: { id?: unknown; level?: unknown; memberships?: unknown } | undefined) {
  if (a === undefined || typeof a.id !== "string") return undefined;
  const members = Array.isArray(a.memberships) ? [...(a.memberships as string[])].sort() : [];
  return JSON.stringify([a.id, a.level ?? null, members]);
}

/** The actor a run's calls were made as, whole: the first request that names one. */
function requestActor(r: RunResult | undefined) {
  for (const c of r?.calls ?? []) {
    const a = (
      c.request as { actor?: { id?: unknown; level?: unknown; memberships?: unknown } } | undefined
    )?.actor;
    if (typeof a?.id === "string")
      return a as { id: string; level?: unknown; memberships?: unknown };
  }
  return undefined;
}

/** The key of the actor a run was made as; undefined for none (policy). */
export const actorKeyOfResult = (r: RunResult | undefined) => actorKey(requestActor(r));

/** The key of the actor the workspace names now. */
export const actorKeyNow = (ws: Workspace) => actorKey(actorNow(ws));

/**
 * The actor a run was made as, when it is not the actor now: another id, or
 * the same id at another level or with other memberships (verification N3),
 * which could read other scopes. Undefined when the answer is this actor's
 * (or no one's). Named with its memberships when only they differ.
 */
export function madeAsOther(ws: Workspace, r: RunResult | undefined): string | undefined {
  const made = requestActor(r);
  if (made === undefined || actorKey(made) === actorKeyNow(ws)) return undefined;
  if (made.id !== actorNow(ws)?.id) return made.id;
  const members = Array.isArray(made.memberships) ? (made.memberships as string[]).join(", ") : "";
  return `${made.id} as a member of ${members || "its own scope"}`;
}

/** What a screen says in place of an answer made as another actor. */
export const madeAsLines = (made: string, now: string | undefined): string[] => [
  `This answer was made as ${made}.`,
  `You act as ${now ?? "no one"} now, so it is not shown; r runs it again as you.`,
];
