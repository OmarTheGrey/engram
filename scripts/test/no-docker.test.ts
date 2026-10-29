// The lead's instruction of 2026-10-29 (ADR 0019 and ADR 0024 amendments):
// nothing in a test, a gate, a Makefile target or CI needs Docker or any other
// container runtime. The docker-compose.yml at the root is for deployment only.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

/** A container runtime or tool, in a command or a source. */
// The file name docker-compose.yml is not a call: a test asserts it is deployment only.
const CONTAINER = /\b(?:docker(?:-compose)?(?![-.\w])|podman|testcontainers|compose\s+up)\b/i;
/** Workflow keys that run a job or a service in a container. */
const WORKFLOW_CONTAINER = /^\s*(?:services|container|image)\s*:/m;

/** Comments dropped, Makefile help text included: they may say Docker is not used. */
const commands = (text: string, comment: RegExp) =>
  text
    .split("\n")
    .map((line) => line.replace(comment, ""))
    .join("\n");
const hashComments = (text: string) => commands(text, /(^|\s)#.*$/);
const slashComments = (text: string) => commands(text, /(^|\s)\/\/.*$/);

/** Offending lines of a workflow file, or of a Makefile or package.json. */
function workflowFindings(text: string): string[] {
  const body = hashComments(text);
  return [
    ...(WORKFLOW_CONTAINER.test(body) ? ["a services:, container: or image: key"] : []),
    ...(CONTAINER.test(body) ? ["a container command"] : []),
  ];
}

const walk = (dir: string): string[] =>
  !existsSync(dir)
    ? []
    : readdirSync(dir).flatMap((name) => {
        if (name === "node_modules") return [];
        const path = join(dir, name);
        return statSync(path).isDirectory() ? walk(path) : [path];
      });

const packages = readdirSync("packages").map((p) => join("packages", p));
const isSource = (f: string) => /\.(?:[cm]?[jt]s|json)$/.test(f);

// This file names the runtimes it forbids, so it is the one source not scanned.
const SELF = join("scripts", "test", "no-docker.test.ts");

const configFiles = [
  "Makefile",
  "package.json",
  ...packages.map((p) => join(p, "package.json")).filter(existsSync),
];
const workflows = readdirSync(".github/workflows").map((f) => join(".github/workflows", f));
const sources = [
  ...walk("scripts"),
  ...walk("test"),
  ...packages.flatMap((p) => walk(join(p, "test"))),
  ...packages.map((p) => join(p, "vitest.config.ts")).filter(existsSync),
  ...["vitest.config.ts", "vitest.shared.ts"].filter(existsSync),
].filter((f) => isSource(f) && f !== SELF);

describe("no Docker anywhere a gate runs", () => {
  test("the finder catches services of any name, container:, podman, testcontainers and compose", () => {
    for (const yaml of [
      "jobs:\n  t:\n    services:\n      db:\n        image: postgres:17\n",
      "jobs:\n  t:\n    container: node:24\n",
      "jobs:\n  t:\n    steps:\n      - run: podman run postgres\n",
      "jobs:\n  t:\n    steps:\n      - run: npx testcontainers\n",
      "jobs:\n  t:\n    steps:\n      - run: docker-compose up -d\n",
      "jobs:\n  t:\n    steps:\n      - run: docker compose up -d postgres\n",
      "jobs:\n  t:\n    steps:\n      - run: docker run --rm postgres:17\n",
    ])
      expect(workflowFindings(yaml), yaml).not.toEqual([]);
    expect(
      workflowFindings("# no Docker here\njobs:\n  t:\n    steps:\n      - run: make test\n"),
    ).toEqual([]);
  });

  test("no workflow runs a container", () => {
    for (const file of workflows)
      expect(workflowFindings(readFileSync(file, "utf8")), file).toEqual([]);
  });

  test("no Makefile target or package script calls a container runtime", () => {
    for (const file of configFiles)
      expect(hashComments(readFileSync(file, "utf8")), file).not.toMatch(CONTAINER);
  });

  test("no test source, script or vitest config calls a container runtime", () => {
    expect(sources.length).toBeGreaterThan(20);
    for (const file of sources)
      expect(slashComments(readFileSync(file, "utf8")), file).not.toMatch(CONTAINER);
  });
});
