// Where a session's cache misses are answered from, for every benchmark the
// runner knows (cards RN1, B3, B4, X1): a scripted model's steps, or a live
// model through a model runtime (`make run ... LIVE=1`, src/live.ts). Without
// either, a miss is an error.
import type { Api, Model } from "@earendil-works/pi-ai";
import type { Condition } from "./config.ts";
import { readProbeScript } from "./gatemem-probe.ts";
import { type AnswerSource, runtimeAnswers, scriptedAnswers } from "./model/cassette.ts";
import type { CompletesSimple } from "./model/pi.ts";

/** Answers for a live (not scripted) model: a model runtime that resolves `provider/model-id`. */
export interface LiveModels extends CompletesSimple {
  getModel(provider: string, id: string): Model<Api> | undefined;
}

/**
 * The scripted steps of one session: the script's `<item>@<condition>`
 * entry when it has one (C1 has no memory tool, so its session differs),
 * else its `<item>` entry.
 */
export function scriptSteps(
  steps: Readonly<Record<string, unknown[]>>,
  item: string,
  condition: Condition,
): unknown[] | undefined {
  return steps[`${item}@${condition}`] ?? steps[item];
}

/** The answer source for one session's misses, chosen by the config's model. */
export function answersFor(
  config: { model: string; script?: string | undefined },
  item: string,
  condition: Condition,
  live?: LiveModels,
): () => AnswerSource {
  return sourceFor(config, item, live, (steps) => scriptSteps(steps, item, condition));
}

/**
 * The answer source for a MEM-INV-Bench case's agent note (mem-inv-probe.ts
 * `withNotes`): the script's `<case>@note` steps, or the live model.
 */
export function noteAnswersFor(
  config: { model: string; script?: string | undefined },
  caseId: string,
  live?: LiveModels,
): () => AnswerSource {
  return sourceFor(config, `${caseId}@note`, live, (steps) => steps[`${caseId}@note`]);
}

function sourceFor(
  config: { model: string; script?: string | undefined },
  item: string,
  live: LiveModels | undefined,
  pick: (steps: Readonly<Record<string, unknown[]>>) => unknown[] | undefined,
): () => AnswerSource {
  const [provider = "", ...rest] = config.model.split("/");
  const id = rest.join("/");
  if (provider === "scripted") {
    const script = readProbeScript(config.script as string);
    const steps = pick(script.steps) as Parameters<typeof scriptedAnswers>[0] | undefined;
    return () => {
      if (!steps) {
        return async () => {
          throw new Error(`the script has no steps for ${item}`);
        };
      }
      return scriptedAnswers(steps, { provider, model: id });
    };
  }
  return () => {
    const model = live?.getModel(provider, id);
    if (!live || !model) {
      return async () => {
        throw new Error(`no live model ${config.model} to answer a cache miss`);
      };
    }
    return runtimeAnswers(live, model);
  };
}
