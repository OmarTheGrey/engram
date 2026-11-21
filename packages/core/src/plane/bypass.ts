// Plane.recordBypass (card PX1, ADR 0014): a surface refused something that
// would have reached a store without the Plane, and the Plane records it as
// one bypass_blocked deny event. Three routes: a store's CLI in a shell
// command, a file tool on a path inside a store's root, and a memory tool
// result the Engram extension did not produce (decisions D10 and D11). The
// reason keeps what was attempted (finding R7-9), on one line, cut to a fixed
// length and with what looks like a secret replaced by `<redacted>`, so the
// log tells `mem0 delete --all` from `mem0 list` without holding a key.
// The secret patterns are the redactor's entries of the content guard's one
// table (policy/secrets.ts, card E2.9, ADR 0039), applied in its order.
import { z } from "zod";
import { type Actor, InvalidCallError } from "../actor.ts";
import { appendEvent } from "../events.ts";
import type { Bypass, PlaneDeps } from "../plane.ts";
import { REDACTION_LONG_TOKEN, REDACTIONS, SECRET_NAME } from "../policy/secrets.ts";
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

/** What replaces a secret the table matches. */
export const REDACTED_SECRET = "<redacted>";
/**
 * Secret patterns and what replaces each match; `$1` keeps the name or flag
 * before the value. They are the redactor's entries of the content guard's
 * one table (policy/secrets.ts, card E2.9, ADR 0039), in its order; the last,
 * any run of 32 or more key characters (every UUID, git SHA and long hash
 * matches it too), is kept apart.
 */
const SECRETS = REDACTIONS.filter(([p]) => p !== REDACTION_LONG_TOKEN[0]);
const LONG_TOKEN = REDACTION_LONG_TOKEN;

/**
 * `text` with every match of the secret table replaced by `<redacted>`, its
 * lines and length otherwise kept. The session recorder's scrub runs it too
 * (card D1, distill/scrub.ts). `longTokens: false` leaves out the last rule,
 * a run of 32 or more key characters, for names that are long by design
 * (an MCP tool name, a model id); the attempt always applies it.
 */
export function redactSecrets(text: string, options: { longTokens?: boolean } = {}): string {
  let kept = text;
  for (const [pattern, replacement] of SECRETS) kept = kept.replace(pattern, replacement);
  if (options.longTokens !== false) kept = kept.replace(LONG_TOKEN[0], LONG_TOKEN[1]);
  return kept;
}

/**
 * Whether a name (an environment variable's, an argument's) says it holds a
 * secret: the table's first rule reads it, a hyphen counts as an underscore,
 * and `pass`, `passphrase`, `pw` or `cookie` as a word of the name
 * (`pass`, `db_pass`, `dbPass`, `gpg_passphrase`, `pw`, `Cookie`) counts
 * too, as the flag rule counts `--pass`. Only the recorder's scrub reads it;
 * the attempt never does.
 */
const SECRET_WORDS = new Set(["pass", "passphrase", "pw", "cookie"]);

export function isSecretName(name: string): boolean {
  const snake = name.replaceAll("-", "_");
  if (new RegExp(`^${SECRET_NAME}$`, "i").test(snake)) return true;
  const words = snake
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .split("_");
  return words.some((w) => SECRET_WORDS.has(w));
}

/** What a bypass event's reason keeps of an attempt: one line, secrets removed, cut to MAX_ATTEMPT_LENGTH. */
export function bypassAttempt(command: string): string {
  const kept = redactSecrets(command.replace(/\s*[\r\n]+\s*/g, " ").trim());
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
    schema_version: 1,
  });
}
