// A scripted NliScore for the NLI tier (card L7), in the manner of
// fakes/lint-model.ts: it answers from a function of the premise and the
// hypothesis, and records every request it received. Core's tests import no
// runtime and no @engram/model.
import type { NliRequest, NliResponse, NliScore } from "../../src/lint/nli.ts";

export interface ScriptedNliScorer {
  score: NliScore;
  requests: NliRequest[];
}

/** Three probabilities that sum to one, contradiction first. */
export const probs = (
  contradiction: number,
  entailment = (1 - contradiction) / 2,
): NliResponse => ({
  contradiction,
  entailment,
  neutral: 1 - contradiction - entailment,
});

export function scriptedNliScorer(
  answer: (premise: string, hypothesis: string) => NliResponse,
): ScriptedNliScorer {
  const requests: NliRequest[] = [];
  return {
    requests,
    score: async (request) => {
      requests.push(request);
      return answer(request.premise, request.hypothesis);
    },
  };
}

export const NLI_MODEL = "scripted/nli-1";
