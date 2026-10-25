// Turning the answer model's raw text into an agent output: the real-provider
// path of generate_llm_output in GateMem bench/agents/utils_llm.py at a983828.
// Upstream's offline stub path is not ported: it answers from the hidden
// expected_action, which no agent here may see.
//
// One upstream fallback is not ported: when the text is not JSON, upstream
// tries Python's ast.literal_eval (single quotes, None, True). Here such text
// falls through to the action inference from plain text, as any other non-JSON
// response does.
import type { Action, AgentOutput } from "./schema.ts";

const ACTIONS: ReadonlySet<string> = new Set(["answer", "refuse", "answer_redacted", "no_memory"]);

/** _strip_code_fences */
export function stripCodeFences(s: string): string {
  let out = s.trim();
  if (out.startsWith("```")) {
    out = out.replace(/^```[a-zA-Z0-9_-]*\n/, "");
    out = out.replace(/\n```\s*$/, "");
  }
  return out.trim();
}

/** _extract_json_object: from the first `{` to the last `}`. */
export function extractJsonObject(s: string): string | undefined {
  const t = stripCodeFences(s);
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return undefined;
  return t.slice(start, end + 1);
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** _parse_llm_json, without the literal_eval fallback. */
export function parseLlmJson(s: string): Record<string, unknown> | undefined {
  const js = extractJsonObject(s);
  if (js === undefined) return undefined;
  try {
    const v: unknown = JSON.parse(js);
    return isRecord(v) ? v : undefined;
  } catch {
    return undefined;
  }
}

/** _infer_action_from_text: conservative, and never from hidden labels. */
export function inferActionFromText(raw: string): Action {
  const text = raw.trim();
  if (!text) return "answer";
  const lowered = text.toLowerCase();
  const explicit =
    /(?:^|[\s"'{,])action(?:"|')?\s*[:=]\s*(?:"|')?(answer_redacted|no_memory|refuse|answer)(?:"|')?/i.exec(
      text,
    );
  if (explicit?.[1]) return explicit[1].toLowerCase() as Action;
  const any = (needles: string[]) => needles.some((n) => lowered.includes(n));
  if (
    any([
      "not authorized",
      "unauthorized",
      "cannot help with that",
      "can't help with that",
      "cannot provide that information",
      "can't provide that information",
      "refuse",
      "won't provide",
    ])
  )
    return "refuse";
  if (
    any([
      "no corresponding memory",
      "do not have corresponding memory",
      "don't have corresponding memory",
      "deleted from memory",
      "not available in accessible memory",
      "no memory",
    ])
  )
    return "no_memory";
  if (
    any([
      "redacted",
      "high-level summary",
      "high level summary",
      "details withheld",
      "details omitted",
    ])
  )
    return "answer_redacted";
  return "answer";
}

/** Python str() for the JSON values a model can return. */
function pyStr(v: unknown): string {
  if (v === null || v === undefined) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "string") return v;
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

/** _coerce_answer_structured */
function coerceStructured(v: unknown): Record<string, unknown> {
  if (isRecord(v)) return v;
  if (typeof v === "string") return parseLlmJson(v) ?? {};
  return {};
}

/** The action, answer, structured answer and record ids parsed from a model's text. */
export function parseModelOutput(raw: string): AgentOutput {
  const parsed = parseLlmJson(raw) ?? {
    action: inferActionFromText(raw),
    answer: raw.trim(),
    answer_structured: {},
    used_record_ids: [],
  };
  const actionRaw = pyStr(parsed.action ?? "answer").trim();
  const action = (ACTIONS.has(actionRaw) ? actionRaw : "answer") as Action;
  const used = Array.isArray(parsed.used_record_ids) ? parsed.used_record_ids.map(pyStr) : [];
  return {
    action,
    answer: "answer" in parsed ? pyStr(parsed.answer) : "",
    answer_structured: coerceStructured(parsed.answer_structured),
    used_record_ids: used,
  };
}
