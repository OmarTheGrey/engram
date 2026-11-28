// Card D4 lifts card E2.14's refusal of `procedures.drift`: the loader takes
// it, absent still means off (every registered preset), and a policy that
// turns it on must set ADR 0011's two thresholds, which the retirement rule
// reads. Readers of an already-parsed policy take it too: Plane.simulate,
// and exportCedar, which exports it faithfully because drift is a lifecycle
// outside the gate (Plane.revalidate's events set an item's status, and the
// status rule is exported).
import { describe, expect, test } from "vitest";
import { exportCedar } from "../../../src/policy/cedar.ts";
import { loadPreset, PolicyError, PRESETS, parsePolicy } from "../../../src/policy/load.ts";
import { notBuiltOptions } from "../../../src/policy/options.ts";
import type { Policy } from "../../../src/schema.ts";
import { fresh } from "../plane/helpers.ts";

const VALID = `id: test-policy
version: 1
write:
  - { scope: person, allowed_sources: [user, model], confidence_floor: 0.5, forbidden_classes: [], requires_review: false }
  - { scope: role, allowed_sources: [user], confidence_floor: 0.5, forbidden_classes: [], requires_review: false }
  - { scope: team, allowed_sources: [user], confidence_floor: 0.5, forbidden_classes: [], requires_review: false }
  - { scope: org, allowed_sources: [user], confidence_floor: 0.5, forbidden_classes: [], requires_review: false }
read:
  matrix:
    - { reader: person, may_read: [person, org] }
    - { reader: role, may_read: [role, org] }
    - { reader: team, may_read: [team, org] }
    - { reader: org, may_read: [org] }
  honour_grants: true
retention:
  - { scope: person, class: episodic, ttl: 86400, budget: null, eviction: recency }
promotion:
  episodic_to_semantic: { confirmations: 3, or_review: true }
  procedural: { replay_k: 4, replay_n: 5 }
lints:
  enabled: [expired-validity]
  thresholds: {}
schema_version: 1
`;

const THRESHOLDS =
  "  thresholds:\n    replay-drift.success-floor: 0.7\n    replay-drift.min-trials: 10\n";
const withDrift = (drift: string, thresholds = THRESHOLDS) =>
  VALID.replace("  thresholds: {}\n", thresholds).replace(
    "schema_version: 1\n",
    `procedures:\n  drift:${drift}\nschema_version: 1\n`,
  );

describe("procedures.drift is built (card D4)", () => {
  test.each([
    [" {}"],
    ['\n    environment_change: "on"'],
    ['\n    environment_change: "off"\n    period: 604800'],
  ])("drift:%s loads with ADR 0011's thresholds", (drift) => {
    const policy = parsePolicy(withDrift(drift), "test.yaml");
    expect(policy.procedures?.drift).toBeDefined();
    expect(notBuiltOptions(policy)).toEqual([]);
  });

  test("drift without the thresholds is refused at its key, naming them", () => {
    const text = withDrift('\n    environment_change: "on"', "  thresholds: {}\n");
    try {
      parsePolicy(text, "test.yaml");
      throw new Error("expected a refusal");
    } catch (e) {
      expect(e).toBeInstanceOf(PolicyError);
      const [p, ...rest] = (e as PolicyError).problems;
      expect(rest).toEqual([]);
      expect(p?.path).toEqual(["procedures", "drift"]);
      expect(p?.message).toContain("replay-drift.success-floor");
      const lines = text.split("\n");
      expect(p?.line).toBe(lines.indexOf("  drift:") + 1);
    }
  });

  test("absent is off: every registered preset leaves it out", () => {
    for (const name of PRESETS) expect(loadPreset(name).procedures).toBeUndefined();
  });

  const medium = loadPreset("medium");
  const drifting: Policy = { ...medium, procedures: { drift: { environment_change: "on" } } };

  test("Plane.simulate takes a candidate that sets it", async () => {
    const { plane } = fresh(medium);
    const report = await plane.simulate({ id: "w", actors: {}, steps: [] }, drifting);
    expect(report.changed).toEqual([]);
  });

  test("exportCedar exports it faithfully: the same rules as without it", () => {
    expect(exportCedar(drifting)).toEqual(exportCedar(medium));
  });
});
