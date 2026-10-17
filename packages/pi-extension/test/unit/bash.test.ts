import { describe, expect, test } from "vitest";
import { blockedStoreCommand } from "../../src/bash.ts";

const STORES = ["mem0", "letta"];

describe("blockedStoreCommand", () => {
  test("names a store command at the start of the line", () => {
    expect(blockedStoreCommand("mem0 add x", STORES)).toBe("mem0");
  });

  test("names a store command later in a chain", () => {
    expect(blockedStoreCommand("cd /tmp && letta agents create", STORES)).toBe("letta");
    expect(blockedStoreCommand("ls; mem0 list | head", STORES)).toBe("mem0");
  });

  test("names a store command called by path or after environment assignments", () => {
    expect(blockedStoreCommand("/usr/local/bin/mem0 list", STORES)).toBe("mem0");
    expect(blockedStoreCommand("MEM0_API_KEY=k mem0 list", STORES)).toBe("mem0");
  });

  test("ignores a store name used as an argument or as part of another word", () => {
    expect(blockedStoreCommand("echo mem0", STORES)).toBeUndefined();
    expect(blockedStoreCommand("mem0x status", STORES)).toBeUndefined();
  });
});
