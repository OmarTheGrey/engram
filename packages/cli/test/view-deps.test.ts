// The CLI's dependency graph gains no React (card E8.15c, docs/design/tui.md
// 6.3): packages/cli depends on @engram/view for the inspector's pure view
// logic, never on @engram/ui, so React, xyflow, dagre and tanstack stay out
// of everything `engram` installs. The graph is walked from the CLI's
// package.json through every runtime dependency, resolved as Node resolves
// it (each package's node_modules, then its parents'), down to the leaves.
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The folder `name` resolves to from `from`, as Node finds a package. */
function resolvePackage(name: string, from: string): string | undefined {
  for (let dir = from; ; dir = dirname(dir)) {
    const candidate = join(dir, "node_modules", name);
    if (existsSync(join(candidate, "package.json"))) return realpathSync(candidate);
    if (dirname(dir) === dir) return undefined;
  }
}

/** Every package in the runtime graph of the package at `root`: name to folder. */
function runtimeGraph(root: string): Map<string, string> {
  const seen = new Map<string, string>();
  const queue = [realpathSync(root)];
  while (queue.length > 0) {
    const dir = queue.shift() as string;
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    const deps = { ...pkg.dependencies, ...pkg.optionalDependencies } as Record<string, string>;
    for (const name of Object.keys(deps)) {
      const found = resolvePackage(name, dir);
      // An optional dependency for another platform is not installed here.
      if (found === undefined) {
        if (pkg.optionalDependencies?.[name] !== undefined) continue;
        throw new Error(`${pkg.name} depends on ${name}, which does not resolve from ${dir}`);
      }
      const key = `${name}@${found}`;
      if (seen.has(key)) continue;
      seen.set(key, found);
      queue.push(found);
    }
  }
  return seen;
}

const FORBIDDEN = /^(@engram\/ui|react|react-dom|@xyflow\/.*|@dagrejs\/.*|dagre|@tanstack\/.*)@/;

describe("the CLI's dependency graph", () => {
  const graph = runtimeGraph(CLI);
  const names = [...graph.keys()].map((k) => k.slice(0, k.indexOf("@", 1)));

  it("holds @engram/view and the generated client", () => {
    expect(names).toContain("@engram/view");
    expect(names).toContain("@engram/sdk");
    expect(names.length).toBeGreaterThan(20);
  });

  it("holds no @engram/ui, React, xyflow, dagre or tanstack", () => {
    const bad = [...graph.keys()].filter((k) => FORBIDDEN.test(k));
    expect(bad).toEqual([]);
  });

  it("is what packages/cli/package.json names: @engram/view, never @engram/ui", () => {
    const pkg = JSON.parse(readFileSync(join(CLI, "package.json"), "utf8"));
    expect(pkg.dependencies["@engram/view"]).toBe("workspace:*");
    expect({ ...pkg.dependencies, ...pkg.devDependencies }["@engram/ui"]).toBeUndefined();
  });
});
