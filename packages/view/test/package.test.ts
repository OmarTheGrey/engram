// @engram/view (card E8.15c, docs/design/tui.md 6.3): the inspector's pure
// view logic, moved out of packages/ui so the TUI can import it with no
// React. The functions' own tests stay where log entries cite them
// (packages/ui/test/view.test.ts, provenance.test.ts, twin.test.ts and
// who-can-read.test.ts), importing through packages/ui/src/view.ts and
// provenance.ts, now one-line re-exports of this package. This file holds
// the package's shape: what it depends on, what it imports, that the old
// paths are the same functions, and the leak rule once more from here.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { MemoryEvent, MemoryItem } from "@engram/sdk";
import { describe, expect, it } from "vitest";
import * as uiProvenance from "../../ui/src/provenance.ts";
import * as uiView from "../../ui/src/view.ts";
import * as view from "../src/index.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("@engram/view", () => {
  it("depends only on the generated client, and imports nothing else", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    expect(Object.keys(pkg.dependencies ?? {})).toEqual(["@engram/sdk"]);
    expect(pkg.devDependencies).toBeUndefined();
    expect(pkg.peerDependencies).toBeUndefined();
    for (const file of readdirSync(join(ROOT, "src"))) {
      const text = readFileSync(join(ROOT, "src", file), "utf8");
      for (const m of text.matchAll(/^\s*(import|export)\s[^;]*?from\s+"([^"]+)"/gms)) {
        const [whole, , from] = m as unknown as [string, string, string];
        if (from.startsWith("./")) continue;
        // Only the client's types: a type import is erased, so no runtime code comes with it.
        expect(from, `${file}: ${whole}`).toBe("@engram/sdk");
        expect(whole, `${file}`).toMatch(/^\s*import type /);
      }
    }
  });

  it("is what the inspector's old paths export, function for function", () => {
    expect(Object.keys(uiView).sort()).toEqual(Object.keys(view).sort());
    expect(Object.keys(uiProvenance).sort()).toEqual(Object.keys(view).sort());
    for (const [name, value] of Object.entries(view)) {
      expect((uiView as Record<string, unknown>)[name], name).toBe(value);
      expect((uiProvenance as Record<string, unknown>)[name], name).toBe(value);
    }
  });

  it("keeps the leak rule: an ancestor the viewer was given nothing of leaves no node, edge or count", () => {
    const id = (n: number) => `01950000-0000-7000-8000-${String(n).padStart(12, "0")}`;
    const focus: MemoryItem = {
      id: id(2),
      class: "semantic",
      scope: "team:core",
      owner: "person:dana",
      content: "the team's fact",
      provenance: {
        kind: "user",
        ref: "t",
        hash: `sha256:${"0".repeat(64)}`,
        actor: "person:dana",
      },
      confidence: 0.9,
      valid_from: "2026-10-01T00:00:00.000Z",
      valid_to: null,
      ttl: null,
      grants: [],
      version: 2,
      lineage: [id(1)],
      status: "active",
      store_ref: null,
      schema_version: 1,
    } as MemoryItem;
    const events: MemoryEvent[] = [];
    const graph = view.provenanceGraph(focus.id, [focus], events);
    expect(graph?.nodes.map((n) => n.id)).toEqual([focus.id]);
    expect(graph?.edges).toEqual([]);
    expect(graph?.items).toBe(1);
    expect(JSON.stringify(view.itemVersions(focus.id, [focus], events))).not.toContain(id(1));
  });
});
