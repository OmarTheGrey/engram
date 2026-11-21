// The cassette proxy reserves the runner's item prefixes as harness names
// (card B10, review B10-6 and verification V-2), so no proxy key is a runner
// key. This test builds every cache context the runner keys its own calls by
// and checks each item's prefix is reserved: a runner benchmark that adds a
// prefix without reserving it fails here.
import type { Policy } from "@engram/core";
import { type CallContext, RESERVED_HARNESSES } from "@engram/model";
import { describe, expect, test } from "vitest";
import { probeContext } from "../src/gatemem-probe.ts";
import { faultSetContext } from "../src/lint-fault-set.ts";
import { type LoadedFixture, lintContext } from "../src/lint-faults.ts";
import { longMemEvalContext, longMemEvalJudgeContext } from "../src/longmemeval-probe.ts";
import { memInvContext, noteContext } from "../src/mem-inv-probe.ts";

const prefix = (context: CallContext) => context.item.split("/")[0];

describe("the runner's item prefixes", () => {
  test("are every one reserved as a cassette proxy harness name", () => {
    const fixture = { name: "f1", fixture: { policy: { id: "p" } } } as unknown as LoadedFixture;
    const lme = { questionId: "q1", condition: "C5", preset: "medium", store: "fake" } as const;
    const contexts: Record<string, CallContext> = {
      probeContext: probeContext({
        checkpointId: "c1",
        condition: "C5",
        preset: "medium",
        store: "fake",
      }),
      longMemEvalContext: longMemEvalContext(lme),
      longMemEvalJudgeContext: longMemEvalJudgeContext(lme),
      memInvContext: memInvContext({
        caseId: "k1",
        condition: "C5",
        preset: "medium",
        store: "fake",
      }),
      noteContext: noteContext("k1"),
      lintContext: lintContext(fixture),
      faultSetContext: faultSetContext("q1", { id: "p" } as unknown as Policy),
    };
    for (const [name, context] of Object.entries(contexts)) {
      expect(context.item, name).toContain("/");
      expect(RESERVED_HARNESSES, `${name} keys item ${context.item}`).toContain(prefix(context));
    }
    // Every reserved name is one the runner uses, so the list holds nothing stale.
    expect([...new Set(Object.values(contexts).map(prefix))].sort()).toEqual(
      [...RESERVED_HARNESSES].sort(),
    );
  });
});
