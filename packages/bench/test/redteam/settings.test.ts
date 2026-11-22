import { loadPreset } from "@engram/core";
import { describe, expect, test } from "vitest";
import { buildSetting } from "../../src/redteam/settings.ts";

describe("the red-team settings", () => {
  test("the store setting runs with no plane", () => {
    expect(buildSetting({ name: "store" }).policy).toBeNull();
  });

  test("a registered preset runs as it stands, under its own name", () => {
    expect(buildSetting({ name: "medium", preset: "medium" }).policy).toEqual(loadPreset("medium"));
  });

  test("a variant keeps the preset's policy id and adds only its guard", () => {
    const s = buildSetting({
      name: "medium+screen-default",
      preset: "medium",
      content_guards: { injection_screen: "default" },
    });
    expect(s.policy?.id).toBe("preset.medium");
    expect(s.policy).toEqual({ ...loadPreset("medium"), content_guards: { injection_screen: "default" } });
  });

  test("a variant under a bare preset name is refused, so no registered cell is shadowed", () => {
    expect(() =>
      buildSetting({ name: "medium", preset: "medium", content_guards: { injection_screen: "default" } }),
    ).toThrow(/registered preset runs under its own name/);
  });

  test("a guard core does not enforce yet is refused by the loader, never run as if on", () => {
    expect(() =>
      buildSetting({ name: "medium+trust", preset: "medium", trust: { unattested_floor: "on" } }),
    ).toThrow(/not enforced yet/);
  });
});
