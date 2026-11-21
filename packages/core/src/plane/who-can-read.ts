// Who can read this memory (card E2.13; decision item 53 of
// docs/tasks/lead-decisions.md). For one item, or one scope, the plane
// answers with a symbolic set of readers, each entry with the rule or grant
// that admits it, computed from the functions the read path decides with
// (policy/evaluate.ts): readableScope and readRuleId for the read matrix,
// liveGrants for grants, evaluateRead for status, ttl and validity. The set
// is symbolic because actors are not enumerated anywhere: the harness supplies
// an actor's memberships and level on every call (actor.ts), so "every member
// of team:x reading as team" is the exact answer, not a list of names. An
// actor is in the set exactly when evaluateRead admits the item to it at the
// same time (the brute-force property in
// test/property/who-can-read.test.ts). The query shapes are the idea of
// SpiceDB's LookupSubjects and OpenFGA's Expand (both Apache-2.0, idea only;
// docs/conventions/absorption.md): subjects grouped by the relation that
// admits them, rather than a flat list.
//
// What the answer reveals (item 53, answered (a)): the plane answers only an
// actor who may read the item now (the read filter admits it) or who may read
// its scope as a member, and so already sees the scope's events
// (visible.ts). Anyone else gets the refusal an unknown item id gets, word
// for word but for the id, so the answer never tells an outsider that an item
// exists. Grant holders are named to the item's owner only (the owner as
// Plane.changeGrants knows it: its id is the item's owner and it may read the
// item's scope as a member); any other reader is shown only the grants that
// name it, as the inspector's shownGrants does (ADR 0034, decision 9), and is
// told that grants are withheld whether or not there are any. A scope's
// answer names only the read matrix's rules: grants are on items, so it says
// nothing of them. Item 36's rule (a non-owner sees only the grants naming
// them on a read) is not built in core on main; this card does not build it.
//
// A query decides nothing and changes nothing, so it appends no event, as
// explain does not (a `decision` log entry of card E2.13). It is judged at the
// read's own access time (accessTime: never before the log's head).
import { z } from "zod";
import { type Actor, checkCall, InvalidCallError } from "../actor.ts";
import { itemById } from "../items.ts";
import type { PlaneDeps } from "../plane.ts";
import {
  evaluateRead,
  grantText,
  liveGrants,
  READ_VALIDITY_ID,
  readableScope,
  readRuleId,
  scopeLevel,
  withinValidity,
} from "../policy/evaluate.ts";
import {
  Grant,
  Id,
  type MemoryItem,
  type Policy,
  Scope,
  ScopeLevel,
  Timestamp,
} from "../schema.ts";
import { compareTimestamps } from "../time.ts";
import { accessTime } from "./read.ts";

/** One entry of the symbolic reader set: who it admits, and the rule or grant that admits them. */
export const ReaderEntry = z
  .discriminatedUnion("kind", [
    z.strictObject({
      kind: z.literal("members"),
      scope: Scope.meta({ description: "Every actor that is a member of this scope..." }),
      level: ScopeLevel.meta({ description: "...and reads as this level." }),
      policy_id: z.string(),
      reason: z.string(),
    }),
    z.strictObject({
      kind: z.literal("grant"),
      to: z
        .string()
        .meta({
          description:
            "Every actor whose id the grant's `to` matches (exactly, or by prefix before a final `*`).",
        }),
      grant: z
        .string()
        .meta({
          description:
            "The grant's place on the item, as a read's grants_used names it: `grants[<i>]:<to>`.",
        }),
      grant_detail: Grant,
      policy_id: z.string(),
      reason: z.string(),
    }),
  ])
  .meta({
    description:
      "One entry of a who-can-read answer: every member of a scope reading as a level (the read matrix row that admits them), or every actor a live grant on the item names (the grant that admits them).",
  });
export type ReaderEntry = z.infer<typeof ReaderEntry>;

export const WhoCanReadAnswer = z
  .strictObject({
    answered: z
      .boolean()
      .meta({
        description: "False when the plane refuses to answer; every other field is then empty.",
      }),
    target: z.string().meta({ description: "The item id or scope asked about, as given." }),
    at: Timestamp.meta({
      description:
        "The time the answer is judged at: the read's access time, never before the log's head.",
    }),
    reason: z
      .string()
      .meta({ description: "Why the plane answered as it did, or why it refused." }),
    readers: z
      .array(ReaderEntry)
      .meta({
        description:
          "The symbolic reader set: an actor may read the target exactly when an entry admits it.",
      }),
    grants_shown: z.enum(["all", "yours"]).nullable().meta({
      description:
        "Which grants an item's answer shows: all to its owner, yours (only those naming the asker) to anyone else; null for a scope (grants are on items) and for a refusal.",
    }),
    closed: z
      .strictObject({ policy_id: z.string(), reason: z.string() })
      .nullable()
      .meta({
        description:
          "Why nobody may read the item now (its status, ttl or validity window), or null.",
      }),
    dormant: z
      .array(z.strictObject({ grant: z.string(), reason: z.string() }))
      .meta({
        description: "To the owner only: the item's grants that admit nobody now, each with why.",
      }),
  })
  .meta({
    description:
      "Who can read an item or a scope (card E2.13): a symbolic set of readers, each entry with the rule or grant that admits it, from the rules that decide a read. Answered only for an actor who may read the item or its scope; grant holders named to the item's owner only (decision item 53).",
  });
export type WhoCanReadAnswer = z.infer<typeof WhoCanReadAnswer>;

/** An actor with only an id, a level and memberships: what the evaluator's access rules look at. */
const probe = (id: string, level: Actor["level"], memberships: string[]): Actor => ({
  id,
  level,
  memberships,
});

/**
 * The read matrix's entries for `scope`: for each level whose matrix row
 * lets it read the scope's level (the first row for a level, as
 * readableScope finds it), every member of the scope reading as that level.
 */
export function scopeReaders(policy: Policy, scope: string): ReaderEntry[] {
  return ScopeLevel.options.flatMap((level) => {
    const member = probe("", level, [scope]);
    if (!readableScope(policy, member, scope)) return [];
    return [
      {
        kind: "members" as const,
        scope,
        level,
        policy_id: readRuleId(policy, member),
        reason: `every member of ${scope} reading as ${level}: the read matrix lets ${level} read ${scopeLevel(scope)}`,
      },
    ];
  });
}

/** The id an actor matched only by the grant's `to` would have: the prefix of a pattern, else `to` itself. */
const grantee = (to: string) => (to.endsWith("*") ? to.slice(0, -1) : to);

/** Why a grant on `item` admits nobody at `at`, or null when it is live. */
function dormancy(policy: Policy, item: MemoryItem, g: Grant, at: string): string | null {
  if (!policy.read.honour_grants)
    return `policy ${policy.id} does not honour grants, so no grant admits a read under it`;
  if (g.class !== undefined && g.class !== item.class)
    return `it names class ${g.class}, but the item is ${item.class}`;
  if (g.expires !== undefined && compareTimestamps(g.expires, at) <= 0)
    return `it expired at ${g.expires}, at or before ${at}`;
  return null;
}

/** The full answer for an item, as its owner sees it: every reader entry, every grant. */
export function itemReaders(
  policy: Policy,
  item: MemoryItem,
  at: string,
): {
  readers: ReaderEntry[];
  closed: WhoCanReadAnswer["closed"];
  dormant: WhoCanReadAnswer["dormant"];
} {
  const members = scopeReaders(policy, item.scope);
  const granted: ReaderEntry[] = [];
  const dormant: WhoCanReadAnswer["dormant"] = [];
  for (const [i, g] of item.grants.entries()) {
    const label = `grants[${i}]:${g.to}`;
    // liveGrants decides, for an actor the grant's `to` matches; dormancy only words why not.
    if (liveGrants(policy, probe(grantee(g.to), "person", []), item, at).includes(label))
      granted.push({
        kind: "grant",
        to: g.to,
        grant: label,
        grant_detail: g,
        policy_id: `${policy.id}/read/grants`,
        reason: `every actor the ${grantText(g)} names: admitted by ${label}`,
      });
    else
      dormant.push({
        grant: label,
        reason: `the ${grantText(g)} admits nobody: ${dormancy(policy, item, g, at) ?? "it is not live"}`,
      });
  }
  // Status, ttl and validity close an item to everyone alike: evaluateRead
  // on an actor some entry admits says whether, and why (its access check is
  // passed by construction); with no entry, status and ttl are judged before
  // access, and the validity window is judged here as the filter would.
  const entry = members[0] ?? granted[0];
  const someone =
    entry === undefined
      ? probe("", "person", [])
      : entry.kind === "members"
        ? probe("", entry.level, [entry.scope])
        : probe(grantee(entry.to), "person", []);
  const decision = evaluateRead(policy, someone, item, at);
  const closed =
    decision.check === "not-active" ||
    decision.check === "expired" ||
    decision.check === "outside-validity"
      ? { policy_id: decision.policy_id, reason: decision.reason }
      : !withinValidity(item, at)
        ? {
            policy_id: READ_VALIDITY_ID,
            reason: `outside its validity window [${item.valid_from}, ${item.valid_to ?? "open"}) at ${at}`,
          }
        : null;
  return { readers: closed ? [] : [...members, ...granted], closed, dormant };
}

const refusal = (target: string, at: string, reason: string): WhoCanReadAnswer => ({
  answered: false,
  target,
  at,
  reason,
  readers: [],
  grants_shown: null,
  closed: null,
  dormant: [],
});

/** The words of an item refusal: the same for an unknown id and an item the asker may not read. */
export const itemRefusal = (actor: Actor, itemId: string) =>
  `${actor.id} cannot ask who reads item ${itemId}: the plane answers only for an item its asker may read now, or whose scope its asker may read as a member`;

/**
 * Who can read `item` (undefined when the id names nothing), as `actor` may
 * be told at `at` (see the module comment): a refusal for an actor who may
 * neither read the item nor read its scope as a member, the same words as
 * for an unknown id; else every reader entry, grants naming others withheld
 * unless the actor is the owner.
 */
export function whoCanReadItemAs(
  policy: Policy,
  actor: Actor,
  itemId: string,
  item: MemoryItem | undefined,
  at: string,
): WhoCanReadAnswer {
  const member = item !== undefined && readableScope(policy, actor, item.scope);
  if (item === undefined || !(member || evaluateRead(policy, actor, item, at).admitted))
    return refusal(itemId, at, itemRefusal(actor, itemId));
  const full = itemReaders(policy, item, at);
  const owner = member && actor.id === item.owner;
  // A reader who is not the owner is shown the read matrix's entries and the
  // live grants that name it, never a grant naming anyone else.
  const own = new Set(liveGrants(policy, actor, item, at));
  const names = (r: ReaderEntry) => r.kind === "members" || own.has(r.grant);
  return {
    answered: true,
    target: itemId,
    at,
    reason: owner
      ? `answered for ${actor.id}, the item's owner: every reader and every grant`
      : `answered for ${actor.id}, who may read the item${member ? "'s scope" : ""}: only the grants naming ${actor.id} are shown; its owner ${item.owner} sees all of them`,
    readers: owner ? full.readers : full.readers.filter(names),
    grants_shown: owner ? "all" : "yours",
    closed: full.closed,
    dormant: owner ? full.dormant : [],
  };
}

/**
 * Who can read items of `scope` by the read matrix, as `actor` may be told:
 * answered only for an actor who may read the scope as a member, refused in
 * the same words for every other scope, holding items or not.
 */
export function whoCanReadAs(
  policy: Policy,
  actor: Actor,
  scope: string,
  at: string,
): WhoCanReadAnswer {
  if (!readableScope(policy, actor, scope))
    return refusal(
      scope,
      at,
      `${actor.id} cannot ask who reads ${scope}: the plane answers only for a scope its asker may read as a member`,
    );
  return {
    answered: true,
    target: scope,
    at,
    reason: `answered for ${actor.id}, who may read ${scope}: the read matrix's readers of every item in it; grants on single items admit more, which whoCanReadItem answers`,
    readers: scopeReaders(policy, scope),
    grants_shown: null,
    closed: null,
    dormant: [],
  };
}

/** Plane.whoCanReadItem: the call checked, the item looked up, judged at the read's access time. */
export async function whoCanReadItem(
  deps: PlaneDeps,
  actor: Actor,
  itemId: string,
  at: string,
): Promise<WhoCanReadAnswer> {
  checkCall(actor, at, "whoCanReadItem");
  if (!Id.safeParse(itemId).success)
    throw new InvalidCallError(
      `Plane.whoCanReadItem: invalid item id ${JSON.stringify(itemId)}; expected a UUIDv7`,
    );
  const when = accessTime(deps.db, at);
  return whoCanReadItemAs(deps.policy, actor, itemId, itemById(deps.db, itemId), when);
}

/** Plane.whoCanRead: the call checked, judged at the read's access time. */
export async function whoCanRead(
  deps: PlaneDeps,
  actor: Actor,
  scope: string,
  at: string,
): Promise<WhoCanReadAnswer> {
  checkCall(actor, at, "whoCanRead");
  if (!Scope.safeParse(scope).success)
    throw new InvalidCallError(
      `Plane.whoCanRead: invalid scope ${JSON.stringify(scope)}; expected person:<id>, role:<id>, team:<id> or org`,
    );
  return whoCanReadAs(deps.policy, actor, scope, accessTime(deps.db, at));
}
