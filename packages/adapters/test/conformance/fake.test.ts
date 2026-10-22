// Acceptance for step-0 task S0.11: the in-memory fake passes the whole
// conformance suite, with and without its optional methods.
import { createFakeAdapter } from "../../src/fake/index.ts";
import { conformance, lexicalSearchRecall } from "./suite.ts";

conformance("fake", () => createFakeAdapter());
conformance("fake without search or history", () =>
  createFakeAdapter({ search: false, history: false }),
);
lexicalSearchRecall("fake", () => createFakeAdapter());
