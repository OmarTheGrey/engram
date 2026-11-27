// ADR 0046, decision 7 (card E2.21, review finding E221-2): no surface exposes
// `replay` until verified actors are in place, and the pi extension is a
// surface in its own right. Every tool the extension registers is collected
// from a recording pi (every other call a no-op): none promotes, and no
// parameter schema, at any depth, carries a `replay` key.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadPreset } from "@engram/core";
import { describe, expect, test } from "vitest";
import { createEngramExtension } from "../src/extension.ts";
import { freshLog, OMAR } from "./harness.ts";

/** Every key of a JSON value, at any depth. */
function keysDeep(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysDeep);
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([k, v]) => [k, ...keysDeep(v)]);
}

/** The tools the extension registers, as name and JSON parameter schema. */
function registeredTools(): { name: string; parameters: unknown }[] {
  const tools: { name: string; parameters: unknown }[] = [];
  const pi = new Proxy(
    {},
    {
      get: (_target, key) =>
        key === "registerTool"
          ? (tool: { name: string; parameters: unknown }) =>
              tools.push({
                name: tool.name,
                parameters: JSON.parse(JSON.stringify(tool.parameters)),
              })
          : () => undefined,
    },
  ) as unknown as ExtensionAPI;
  const extension = createEngramExtension({
    ...freshLog(),
    policy: loadPreset("medium"),
    actor: OMAR,
    now: () => "2026-11-25T00:00:00.000Z",
  });
  extension(pi);
  return tools;
}

describe("ADR 0046, decision 7: the pi extension exposes no replay", () => {
  test("no registered tool promotes, and no tool's schema carries replay at any depth", () => {
    const tools = registeredTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "memory_explain",
      "memory_read",
      "memory_simulate",
      "memory_write",
    ]);
    for (const t of tools) {
      expect(t.name).not.toMatch(/promot/);
      expect(keysDeep(t.parameters), t.name).not.toContain("replay");
    }
  });

  test("the deep key walk sees a nested replay", () => {
    expect(keysDeep({ properties: { evidence: { properties: { replay: {} } } } })).toContain(
      "replay",
    );
  });
});
