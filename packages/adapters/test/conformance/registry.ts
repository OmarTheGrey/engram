// Every adapter the conformance suite runs on, in one place (card A4). A new
// adapter is one entry here; conformance.test.ts runs the whole suite on every
// entry. There is no per-adapter skip list: the contract is the same for every
// store (AGENTS.md, "What not to do"). `lexical` opts an adapter whose search
// is exact term matching into full recall on the corpus; a semantic store may
// rank or miss items, so it runs the main suite only.
import type { Adapter } from "../../src/contract.ts";
import { createFakeAdapter } from "../../src/fake/index.ts";

export interface RegisteredAdapter {
  name: string;
  /** A fresh, empty store for each test. */
  factory: () => Adapter | Promise<Adapter>;
  lexical: boolean;
}

export const ADAPTERS: RegisteredAdapter[] = [
  { name: "fake", factory: () => createFakeAdapter(), lexical: true },
  {
    name: "fake without search or history",
    factory: () => createFakeAdapter({ search: false, history: false }),
    lexical: false,
  },
];
