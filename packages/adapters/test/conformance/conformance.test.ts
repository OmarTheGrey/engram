// Acceptance for cards S0.11, A1 and A4: every adapter in the registry passes
// the whole conformance suite on the fixture corpus, the fake with and without
// its optional methods, and open-source Mem0 in-process. No adapter reaches
// the network: fetch is replaced by a recorder that refuses every call.
import { afterAll, beforeAll, expect, test } from "vitest";
import { ADAPTERS } from "./registry.ts";
import { conformance, lexicalSearchRecall } from "./suite.ts";

const fetchCalls: string[] = [];
const realFetch = globalThis.fetch;
beforeAll(() => {
  globalThis.fetch = (async (input: string | URL | Request) => {
    fetchCalls.push(String(input instanceof Request ? input.url : input));
    throw new Error("conformance: network access refused");
  }) as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = realFetch;
});

for (const { name, factory, lexical } of ADAPTERS) {
  conformance(name, factory);
  if (lexical) lexicalSearchRecall(name, factory);
}

test("no adapter attempted a network call during the suite", () => {
  expect(fetchCalls).toEqual([]);
});
