import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ownerFromLogin, packageConfig } from "../../src/config.ts";

const cwd = join("work", "project");

describe("packageConfig", () => {
  it("defaults to a files store in the project and the login as owner", () => {
    expect(packageConfig({}, cwd, "shady")).toEqual({
      root: resolve(cwd, ".engram", "memory"),
      owner: "shady",
      actor: { id: "person:shady", level: "person", memberships: ["person:shady"] },
    });
  });

  it("takes root, store, policy and actor from ENGRAM_ variables", () => {
    const config = packageConfig(
      {
        ENGRAM_ROOT: "mem",
        ENGRAM_STORE: "letta",
        ENGRAM_POLICY: "strict",
        ENGRAM_OWNER: "omar",
        ENGRAM_AS: "team:platform",
        ENGRAM_MEMBER: "team:platform, person:omar",
      },
      cwd,
      "shady",
    );
    expect(config).toEqual({
      root: resolve(cwd, "mem"),
      store: "letta",
      policy: "strict",
      owner: "omar",
      actor: { id: "team:platform", level: "team", memberships: ["team:platform", "person:omar"] },
    });
  });

  it("keeps an absolute ENGRAM_ROOT as given", () => {
    const root = resolve("elsewhere", "memory");
    expect(packageConfig({ ENGRAM_ROOT: root }, cwd, "shady").root).toBe(root);
  });

  it("gives an agent principal no memberships unless ENGRAM_MEMBER names them", () => {
    expect(packageConfig({ ENGRAM_AS: "agent:pi" }, cwd, "shady").actor).toEqual({
      id: "agent:pi",
      level: "person",
      memberships: [],
    });
  });

  it("refuses an ENGRAM_MEMBER entry that is not a scope", () => {
    expect(() => packageConfig({ ENGRAM_MEMBER: "everyone" }, cwd, "shady")).toThrow(
      "ENGRAM_MEMBER: everyone is not a scope",
    );
  });
});

describe("ownerFromLogin", () => {
  it("replaces characters a scope refuses and never returns an empty owner", () => {
    expect(ownerFromLogin("DOMAIN\\Shady Adham")).toBe("DOMAIN-Shady-Adham");
    expect(ownerFromLogin("")).toBe("local");
  });
});
