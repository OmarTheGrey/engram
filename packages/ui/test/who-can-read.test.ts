// The who-can-read panel's view (card E2.13): readerView labels what the
// plane's answer holds, and adds nothing to it.
import { describe, expect, it } from "vitest";
import type { WhoCanReadAnswer } from "../src/api/index.ts";
import { readerView } from "../src/view.ts";

const base: WhoCanReadAnswer = {
  answered: true,
  target: "01950000-0000-7000-8000-000000000001",
  at: "2026-11-19T12:00:00.000Z",
  reason: "answered",
  readers: [],
  grants_shown: "all",
  closed: null,
  dormant: [],
};

describe("readerView", () => {
  it("labels each members and grant entry with its rule, and the owner's dormant grants", () => {
    const view = readerView({
      ...base,
      readers: [
        {
          kind: "members",
          scope: "person:dana",
          level: "person",
          policy_id: "profile.twin/read/person",
          reason: "r",
        },
        {
          kind: "grant",
          to: "person:sam",
          grant: "grants[0]:person:sam",
          grant_detail: {
            to: "person:sam",
            class: "semantic",
            mode: "read",
            expires: "2026-12-31T00:00:00.000Z",
          },
          policy_id: "profile.twin/read/grants",
          reason: "r",
        },
      ],
      dormant: [{ grant: "grants[1]:person:lee", reason: "it expired" }],
    });
    expect(view.rows).toEqual([
      {
        key: "members:person:dana:person",
        kind: "members",
        who: "person:dana",
        text: "every member of person:dana reading as person",
        policyId: "profile.twin/read/person",
      },
      {
        key: "1:grants[0]:person:sam",
        kind: "grant",
        who: "person:sam",
        text: "person:sam by grants[0]:person:sam, until 2026-12-31T00:00:00.000Z",
        policyId: "profile.twin/read/grants",
      },
    ]);
    expect(view.dormant).toEqual(["grants[1]:person:lee: it expired"]);
    expect(view.withheld).toBe(false);
  });

  it("says when grants are withheld, why an item is closed, and shows a refusal as given", () => {
    expect(readerView({ ...base, grants_shown: "yours" }).withheld).toBe(true);
    expect(
      readerView({ ...base, closed: { policy_id: "engram/read/status", reason: "retired" } })
        .closed,
    ).toBe("retired (engram/read/status)");
    const refused = readerView({ ...base, answered: false, grants_shown: null, reason: "no" });
    expect(refused).toMatchObject({ answered: false, reason: "no", rows: [], withheld: false });
  });
});
