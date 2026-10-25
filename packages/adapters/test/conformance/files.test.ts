// Card A3: the files adapter passes the whole conformance suite on a fresh
// temporary directory per test, and opts into lexical recall because its
// search is exact term matching.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "vitest";
import { createFilesAdapter } from "../../src/files/index.ts";
import { conformance, lexicalSearchRecall } from "./suite.ts";

const dirs: string[] = [];
const fresh = async () => {
  const root = await mkdtemp(join(tmpdir(), "engram-files-conformance-"));
  dirs.push(root);
  return createFilesAdapter({ root, owner: "omar" });
};

afterAll(async () => {
  for (const dir of dirs) await rm(dir, { recursive: true, force: true });
});

conformance("files", fresh);
lexicalSearchRecall("files", fresh);
