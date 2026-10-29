// Plane.recordBypass (card PX1, ADR 0014): a surface refused something that
// would have reached a store without the Plane, and the Plane records it as
// one bypass_blocked deny event. Three routes: a store's CLI in a shell
// command, a file tool on a path inside a store's root, and a memory tool
// result the Engram extension did not produce (decisions D10 and D11). The
// reason keeps what was attempted (finding R7-9), on one line, cut to a fixed
// length and with what looks like a secret replaced by `<redacted>`, so the
// log tells `mem0 delete --all` from `mem0 list` without holding a key.
import { z } from "zod";
import { type Actor, InvalidCallError } from "../actor.ts";
import { appendEvent } from "../events.ts";
import type { Bypass, PlaneDeps } from "../plane.ts";
import type { MemoryEvent } from "../schema.ts";
import { checkCall } from "./write.ts";

/** The rule id of a blocked store command (ADR 0014). */
export const BYPASS_ID = "engram/bypass/store-command";
/** The rule id of a file tool blocked on a path inside a store's root (decision D10). */
export const BYPASS_PATH_ID = "engram/bypass/store-path";
/** The rule id of a memory result withheld because the extension did not produce it (decision D11). */
export const BYPASS_RESULT_ID = "engram/bypass/foreign-result";

/** How long the attempt kept in a reason may be, marker included. */
export const MAX_ATTEMPT_LENGTH = 160;

const REDACTED = "<redacted>";
const SECRET_NAME =
  "[A-Za-z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|PWD|AUTH|CREDENTIALS?)[A-Za-z0-9_]*";
const VALUE = `(?:'[^']*'|"[^"]*"|\\S+)`;

/** Secret patterns and what replaces each match; `$1` keeps the name or flag before the value. */
const SECRETS: [RegExp, string][] = [
  // NAME=value where the name says it holds a secret.
  [new RegExp(`(\\b${SECRET_NAME}=)${VALUE}`, "gi"), `$1${REDACTED}`],
  // --api-key value, --token=value, --password value.
  [
    new RegExp(
      `(--?(?:api[-_]?key|key|token|secret|password|passwd|pass|auth)(?:=|\\s+))${VALUE}`,
      "gi",
    ),
    `$1${REDACTED}`,
  ],
  // Authorization: Bearer value.
  [/(\bBearer\s+)[^\s'"]+/gi, `$1${REDACTED}`],
  // Credentials in a URL.
  [/(:\/\/)[^\s/@'"]+@/g, `$1${REDACTED}@`],
  // Strings that look like a key whatever stands before them.
  [/\bsk-[A-Za-z0-9_-]{8,}/g, REDACTED],
  [/\b[A-Za-z0-9_-]{32,}\b/g, REDACTED],
];

/** What a bypass event's reason keeps of an attempt: one line, secrets removed, cut to MAX_ATTEMPT_LENGTH. */
export function bypassAttempt(command: string): string {
  let kept = command.replace(/\s*[\r\n]+\s*/g, " ").trim();
  for (const [pattern, replacement] of SECRETS) kept = kept.replace(pattern, replacement);
  return kept.length <= MAX_ATTEMPT_LENGTH ? kept : `${kept.slice(0, MAX_ATTEMPT_LENGTH - 3)}...`;
}

const BypassShape = z.object({
  command: z.string().min(1),
  store: z.string().min(1),
  route: z.enum(["command", "path", "result"]).optional(),
});

const RULE = { command: BYPASS_ID, path: BYPASS_PATH_ID, result: BYPASS_RESULT_ID } as const;

function why(bypass: Bypass): string {
  switch (bypass.route ?? "command") {
    case "command":
      return `${bypass.store} is a memory store command; use the Engram memory tools`;
    case "path":
      return `the path is inside the root of store ${bypass.store}; use the Engram memory tools`;
    case "result":
      return "a memory tool result the Engram extension did not produce was withheld from the model";
  }
}

export function recordBypass(
  deps: PlaneDeps,
  actor: Actor,
  bypass: Bypass,
  at: string,
): MemoryEvent {
  checkCall(actor, at, "recordBypass");
  const shape = BypassShape.safeParse(bypass);
  if (!shape.success)
    throw new InvalidCallError(
      `Plane.recordBypass: invalid bypass: ${shape.error.issues.map((i) => `${i.path.join(".") || "bypass"}: ${i.message}`).join("; ")}`,
    );
  return appendEvent(deps.db, {
    id: deps.newId(),
    ts: at,
    op: "bypass_blocked",
    item_id: null,
    actor: actor.id,
    scope_from: null,
    scope_to: null,
    decision: "deny",
    reason: `${why(bypass)}; attempted: ${bypassAttempt(bypass.command)}`,
    policy_id: RULE[bypass.route ?? "command"],
    schema_version: 0,
  });
}
