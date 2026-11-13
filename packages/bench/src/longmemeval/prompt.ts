// LongMemEval's reader and judge prompts, ported from upstream at commit
// 9e0b455 (card B5): the reader's answer template from
// src/generation/run_generation.py `prepare_prompt` (retrieval on, no key
// expansion, no chain of thought: the template of line 57), and the judge's
// templates from src/evaluation/evaluate_qa.py `get_anscheck_prompt`.
// Derived from LongMemEval, MIT licence, Copyright (c) 2024 Di Wu; see
// fixtures/bench/longmemeval/UPSTREAM-LICENSE. The strings are upstream's
// byte for byte; prompt.test.ts holds them to the vendored upstream sources.
import { isAbstention, type Question, type QuestionType } from "./schema.ts";
import type { VisibleQuestion } from "./strip.ts";

/** The reader's answer template, three positional fields: history, current date, question. */
export const READER_TEMPLATE =
  "I will give you several history chats between you and a user. Please answer the question based on the relevant chat history.\n\n\nHistory Chats:\n\n{}\n\nCurrent Date: {}\nQuestion: {}\nAnswer:";

/**
 * Upstream sends the reader prompt as the only message, with no system
 * prompt. pi substitutes its own coding-agent preamble for an empty one, so
 * the session's system prompt is this one neutral sentence instead (decision
 * entry docs/log/2026-11-07-b5-decision-system-prompt.md).
 */
export const READER_SYSTEM = "You are a helpful assistant.";

const JUDGE_STANDARD =
  "I will give you a question, a correct answer, and a response from a model. Please answer yes if the response contains the correct answer. Otherwise, answer no. If the response is equivalent to the correct answer or contains all the intermediate steps to get the correct answer, you should also answer yes. If the response only contains a subset of the information required by the answer, answer no. \n\nQuestion: {}\n\nCorrect Answer: {}\n\nModel Response: {}\n\nIs the model response correct? Answer yes or no only.";
const JUDGE_TEMPORAL =
  "I will give you a question, a correct answer, and a response from a model. Please answer yes if the response contains the correct answer. Otherwise, answer no. If the response is equivalent to the correct answer or contains all the intermediate steps to get the correct answer, you should also answer yes. If the response only contains a subset of the information required by the answer, answer no. In addition, do not penalize off-by-one errors for the number of days. If the question asks for the number of days/weeks/months, etc., and the model makes off-by-one errors (e.g., predicting 19 days when the answer is 18), the model's response is still correct. \n\nQuestion: {}\n\nCorrect Answer: {}\n\nModel Response: {}\n\nIs the model response correct? Answer yes or no only.";
const JUDGE_KNOWLEDGE_UPDATE =
  "I will give you a question, a correct answer, and a response from a model. Please answer yes if the response contains the correct answer. Otherwise, answer no. If the response contains some previous information along with an updated answer, the response should be considered as correct as long as the updated answer is the required answer.\n\nQuestion: {}\n\nCorrect Answer: {}\n\nModel Response: {}\n\nIs the model response correct? Answer yes or no only.";
const JUDGE_PREFERENCE =
  "I will give you a question, a rubric for desired personalized response, and a response from a model. Please answer yes if the response satisfies the desired response. Otherwise, answer no. The model does not need to reflect all the points in the rubric. The response is correct as long as it recalls and utilizes the user's personal information correctly.\n\nQuestion: {}\n\nRubric: {}\n\nModel Response: {}\n\nIs the model response correct? Answer yes or no only.";
const JUDGE_ABSTENTION =
  "I will give you an unanswerable question, an explanation, and a response from a model. Please answer yes if the model correctly identifies the question as unanswerable. The model could say that the information is incomplete, or some other information is given but the asked information is not.\n\nQuestion: {}\n\nExplanation: {}\n\nModel Response: {}\n\nDoes the model correctly identify the question as unanswerable? Answer yes or no only.";

/** Every judge template by the branch of get_anscheck_prompt that uses it. */
export const JUDGE_TEMPLATES = {
  standard: JUDGE_STANDARD,
  "temporal-reasoning": JUDGE_TEMPORAL,
  "knowledge-update": JUDGE_KNOWLEDGE_UPDATE,
  "single-session-preference": JUDGE_PREFERENCE,
  abstention: JUDGE_ABSTENTION,
} as const;

/**
 * Python's str.format with positional `{}` fields only, filled in one pass,
 * so a `{}` inside a value is never substituted.
 */
export function pyFormat(template: string, values: readonly string[]): string {
  let i = 0;
  const out = template.replace(/\{\}/g, () => {
    if (i >= values.length) throw new Error("IndexError: Replacement index out of range");
    return values[i++] as string;
  });
  if (i !== values.length) throw new Error(`the template has ${i} fields, given ${values.length}`);
  return out;
}

/**
 * Python's str() of an answer. Every numeric answer in the pinned release is
 * an integer literal, for which str() and String() agree; a fractional one is
 * refused rather than guessed (Python prints 2.0 where String gives 2).
 */
export function pyStrAnswer(answer: Question["answer"]): string {
  if (typeof answer === "string") return answer;
  if (!Number.isInteger(answer)) throw new Error(`LongMemEval answer ${answer} is not an integer`);
  return String(answer);
}

/**
 * The reader's prompt for one question. `history` stands where upstream puts
 * the retrieved sessions; in a session it says to read memory with the tool,
 * since the conditions differ only in what that read returns.
 */
export function renderReaderPrompt(
  view: Pick<VisibleQuestion, "question" | "question_date">,
  history: string,
): { system: string; user: string } {
  return {
    system: READER_SYSTEM,
    user: pyFormat(READER_TEMPLATE, [history, view.question_date, view.question]),
  };
}

/** The judge template get_anscheck_prompt picks for a question. */
export function judgeTemplate(q: Pick<Question, "question_id" | "question_type">): string {
  if (isAbstention(q)) return JUDGE_ABSTENTION;
  const t: QuestionType = q.question_type;
  if (t === "single-session-user" || t === "single-session-assistant" || t === "multi-session")
    return JUDGE_STANDARD;
  return JUDGE_TEMPLATES[t];
}

/** get_anscheck_prompt(task, question, answer, response, abstention='_abs' in question_id). */
export function renderJudgePrompt(
  q: Pick<Question, "question_id" | "question_type" | "question" | "answer">,
  response: string,
): string {
  return pyFormat(judgeTemplate(q), [q.question, pyStrAnswer(q.answer), response]);
}
