// Acceptance for cards S0.11, A1, A3 and A4: every adapter in the registry passes
// the whole conformance suite on the fixture corpus, the fake with and without
// its optional methods, open-source Mem0 in-process, and the files adapter.
// No adapter reaches the network or Mem0's home folder: a guard refuses every
// fetch, socket connection and DNS lookup (network-guard.ts), and MEM0_DIR
// points at a temporary folder that must stay absent.
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import { installNetworkGuard, type NetworkGuard } from "./network-guard.ts";
import { ADAPTERS, cleanupAdapters } from "./registry.ts";
import { conformance, lexicalSearchRecall } from "./suite.ts";

let guard: NetworkGuard;
let scratch: string;
let mem0Home: string;
const savedMem0Dir = process.env.MEM0_DIR;
beforeAll(() => {
  guard = installNetworkGuard();
  scratch = mkdtempSync(join(tmpdir(), "engram-conformance-"));
  // Where Mem0 would write its config, telemetry id and notice state.
  mem0Home = join(scratch, "mem0-home");
  process.env.MEM0_DIR = mem0Home;
});
afterAll(() => {
  guard.restore();
  if (savedMem0Dir === undefined) delete process.env.MEM0_DIR;
  else process.env.MEM0_DIR = savedMem0Dir;
  cleanupAdapters();
  rmSync(scratch, { recursive: true, force: true });
});

test("the guard refuses a raw socket connection, not only fetch", () => {
  const before = guard.attempts.length;
  expect(() => net.connect(9, "127.0.0.1")).toThrow("network access refused");
  expect(guard.attempts.slice(before)).toHaveLength(1);
  guard.attempts.splice(before);
});

test("Mem0's home folder is redirected to a temporary folder for the run", () => {
  expect(process.env.MEM0_DIR).toBe(mem0Home);
  expect(mem0Home.startsWith(tmpdir())).toBe(true);
});

for (const { name, factory, lexical } of ADAPTERS) {
  conformance(name, factory);
  if (lexical) lexicalSearchRecall(name, factory);
}

test("no adapter attempted a network call during the suite", () => {
  expect(guard.attempts).toEqual([]);
});

test("no adapter wrote Mem0's home folder during the suite", () => {
  expect(existsSync(mem0Home)).toBe(false);
});
