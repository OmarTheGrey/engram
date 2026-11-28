// Card E2.19: the approval queue. A held write (a candidate landed in a
// scope that requires review) or a promotion that waits for a reviewer opens
// a request keyed by its item's id and version; the policy's approval block
// routes it to named approvers (a route narrows ADR 0026's reviewers and
// never widens them; `owner` is ADR 0049's owner acceptance), expires it by
// a recorded deny at the injected clock, and no approver approves their own
// write. Real Plane over the fake adapter; every decision is one event with
// a reason and a policy id.
import { describe, expect, test } from "vitest";
import { currentItems } from "../../../src/events.ts";
import {
  type Actor,
  APPROVAL_EXPIRED_ID,
  APPROVAL_MEMBERSHIP_ID,
  APPROVAL_NO_REQUEST_ID,
  APPROVAL_REFUSED_ID,
  APPROVAL_ROUTE_ID,
  approvalQueue,
  InvalidCallError,
} from "../../../src/plane.ts";
import { exportCedar } from "../../../src/policy/cedar.ts";
import {
  loadPreset,
  PolicyError,
  type PolicyProblem,
  PRESETS,
  parsePolicy,
} from "../../../src/policy/load.ts";
import {
  PROMOTE_MEMBERSHIP_ID,
  PROMOTE_NOT_CANDIDATE_ID,
  PROMOTE_OWNER_PERSON_ID,
  PROMOTE_REVIEWER_ID,
  routeFor,
} from "../../../src/policy/promotion.ts";
import type { Policy } from "../../../src/schema.ts";
import { AT, fresh, id, item, testPolicy } from "./helpers.ts";

const user = (name: string, memberships: string[]): Actor => ({
  id: `person:${name}`,
  level: "person",
  memberships: [`person:${name}`, ...memberships],
  source: "user",
});
/** The writer and owner of every team item, also a member of role:lead. */
const omar = user("omar", ["team:platform", "role:lead"]);
/** A lead: routed by role:lead. */
const ada = user("ada", ["team:platform", "role:lead"]);
/** A reviewer ADR 0026 admits, whom no role route names. */
const bob = user("bob", ["team:platform"]);
/** A lead who is not a member of the team. */
const carl = user("carl", ["role:lead"]);
const dana = user("dana", ["team:platform"]);
const eve = user("eve", []);
const adaAgent: Actor = { ...ada, source: "model" };

const later = (seconds: number) =>
  new Date(Date.parse(AT) + seconds * 1000).toISOString().replace(".000Z", "Z");

type Routes = NonNullable<Policy["approval"]>["routes"];
/** Every level requires review, so a user write lands as a candidate. */
function routed(routes: Routes | undefined, reviewed = true): Policy {
  const base = testPolicy();
  return {
    ...base,
    write: base.write.map((r) => ({ ...r, requires_review: reviewed && r.scope !== "role" })),
    ...(routes === undefined ? {} : { approval: { routes } }),
  };
}
const LEADS: Routes = [{ scope: "team", approvers: ["role:lead"], expires_after: 3600 }];

async function held(plane: ReturnType<typeof fresh>["plane"], n = 1, over = {}) {
  const w = await plane.write(omar, item(n, over), AT);
  expect(w.event.decision).toBe("allow");
  expect(w.item?.status).toBe("candidate");
  return w;
}

describe("the projection: a held write opens a request keyed by id and version", () => {
  test("pending, routed, with its expiry", async () => {
    const { plane, policy } = fresh(routed(LEADS));
    const w = await held(plane);
    const [r, ...rest] = approvalQueue(policy, plane.events(), AT);
    expect(rest).toEqual([]);
    expect(r).toMatchObject({
      item_id: id(1),
      version: 1,
      scope: "team:platform",
      target: "team:platform",
      opened_by: w.event.id,
      opened_at: AT,
      requester: omar.id,
      route: "team",
      approvers: ["role:lead"],
      expires_at: later(3600),
      state: "pending",
      due: false,
      closed_by: null,
    });
    expect(approvalQueue(policy, plane.events(), later(3599))[0]?.due).toBe(false);
    expect(approvalQueue(policy, plane.events(), later(3600))[0]?.due).toBe(true);
  });

  test("without an approval block the queue still lists it, unrouted and never expiring", async () => {
    const { plane, policy } = fresh(routed(undefined));
    await held(plane);
    expect(approvalQueue(policy, plane.events(), later(10 ** 7))[0]).toMatchObject({
      route: null,
      approvers: [],
      expires_at: null,
      state: "pending",
      due: false,
    });
    // ADR 0026 as before: any eligible reviewer approves.
    const r = await plane.promote(bob, id(1), "team:platform", AT, { review: true });
    expect(r.decision).toBe("allow");
  });

  test("an active write opens nothing", async () => {
    const { plane, policy } = fresh(routed(LEADS, false));
    await plane.write(omar, item(1), AT);
    expect(approvalQueue(policy, plane.events(), AT)).toEqual([]);
  });
});

describe("routing narrows the reviewers", () => {
  test("a routed approver approves: one promote event, the request approved", async () => {
    const { plane, policy } = fresh(routed(LEADS));
    await held(plane);
    const r = await plane.promote(ada, id(1), "team:platform", later(60), { review: true });
    expect(r.decision).toBe("allow");
    expect(r.event).toMatchObject({ op: "promote", actor: ada.id, decision: "allow" });
    expect(approvalQueue(policy, plane.events(), later(60))[0]).toMatchObject({
      state: "approved",
      closed_by: r.event.id,
      closer: ada.id,
    });
  });

  test("an eligible reviewer the route does not name is refused under engram/approval/route", async () => {
    const { plane, db, policy } = fresh(routed(LEADS));
    await held(plane);
    const r = await plane.promote(bob, id(1), "team:platform", AT, { review: true });
    expect(r).toMatchObject({ decision: "deny", item: null });
    expect(r.event.policy_id).toBe(APPROVAL_ROUTE_ID);
    expect(r.event.reason).toContain("role:lead (the approval route for team)");
    expect(currentItems(db)[0]?.status).toBe("candidate");
    expect(approvalQueue(policy, plane.events(), AT)[0]?.state).toBe("pending");
  });

  test("no approver approves their own write: the writer is a lead and is refused", async () => {
    const { plane } = fresh(routed(LEADS));
    await held(plane);
    const r = await plane.promote(omar, id(1), "team:platform", AT, { review: true });
    expect(r.decision).toBe("deny");
    expect(r.event.policy_id).toBe(PROMOTE_REVIEWER_ID);
    expect(r.event.reason).toContain("cannot approve its own item");
  });

  test("a person route naming the writer still refuses the writer", async () => {
    const { plane } = fresh(routed([{ scope: "team:platform", approvers: ["person:omar"] }]));
    await held(plane);
    const r = await plane.promote(omar, id(1), "team:platform", AT, { review: true });
    expect(r.event.policy_id).toBe(PROMOTE_REVIEWER_ID);
  });

  test("a routed lead acting through an agent, or outside the team, is refused", async () => {
    const { plane } = fresh(routed(LEADS));
    await held(plane);
    const agent = await plane.promote(adaAgent, id(1), "team:platform", AT, { review: true });
    expect(agent.event.policy_id).toBe(PROMOTE_REVIEWER_ID);
    const outside = await plane.promote(carl, id(1), "team:platform", AT, { review: true });
    expect(outside.event.policy_id).toBe(PROMOTE_MEMBERSHIP_ID);
  });

  test("a route naming the scope beats one naming its level", async () => {
    const policy = routed([...LEADS, { scope: "team:platform", approvers: ["person:bob"] }]);
    expect(routeFor(policy, "team:platform")?.approvers).toEqual(["person:bob"]);
    expect(routeFor(policy, "team:other")?.approvers).toEqual(["role:lead"]);
    expect(routeFor(policy, "org")).toBeUndefined();
    const { plane } = fresh(policy);
    await held(plane);
    expect(
      (await plane.promote(ada, id(1), "team:platform", AT, { review: true })).event.policy_id,
    ).toBe(APPROVAL_ROUTE_ID);
    expect((await plane.promote(bob, id(1), "team:platform", AT, { review: true })).decision).toBe(
      "allow",
    );
  });

  test("the ask names the route and its expiry", async () => {
    const { plane, policy } = fresh(routed(LEADS));
    await held(plane);
    const r = await plane.promote(bob, id(1), "team:platform", AT);
    expect(r.event).toMatchObject({ op: "gate", decision: "ask" });
    expect(r.event.reason).toContain("routed to role:lead (the approval route for team)");
    expect(r.event.reason).toContain("expires 3600 seconds after it opened");
    // The ask joins the held write's request; it does not reopen or extend it.
    const queue = approvalQueue(policy, plane.events(), AT);
    expect(queue).toHaveLength(1);
    expect(queue[0]?.opened_at).toBe(AT);
  });

  test("owner on a person route is ADR 0049's acceptance; another person route refuses the owner", async () => {
    const person = (approvers: Routes[number]["approvers"]) =>
      fresh(routed([{ scope: "person", approvers }]));
    for (const [approvers, policy_id] of [
      [["owner"], PROMOTE_OWNER_PERSON_ID],
      [["person:ada"], APPROVAL_ROUTE_ID],
    ] as const) {
      const { plane } = person([...approvers]);
      const own = item(1, { scope: dana.id, owner: dana.id });
      expect((await plane.write(dana, own, AT)).item?.status).toBe("candidate");
      const r = await plane.promote(dana, id(1), dana.id, AT, { review: true });
      expect(r.event.policy_id).toBe(policy_id);
    }
  });
});

describe("expiry is an event", () => {
  test("the sweep records each due request as one promote deny, and nothing before it is due", async () => {
    const { plane, db, policy } = fresh(routed(LEADS));
    await held(plane);
    const early = await plane.expireRequests(bob, "team:platform", later(3599));
    expect(early).toEqual({ decision: "allow", events: [], expired: [] });
    const r = await plane.expireRequests(bob, "team:platform", later(3600));
    expect(r.expired).toEqual([id(1)]);
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({
      op: "promote",
      decision: "deny",
      item_id: id(1),
      actor: bob.id,
      scope_to: "team:platform",
      policy_id: APPROVAL_EXPIRED_ID,
    });
    expect(r.events[0]?.reason).toContain(`expired at ${later(3600)}`);
    expect(approvalQueue(policy, plane.events(), later(3600))[0]).toMatchObject({
      state: "expired",
      closed_by: r.events[0]?.id,
    });
    // Recorded once: a second sweep finds nothing due.
    expect((await plane.expireRequests(bob, "team:platform", later(7200))).events).toEqual([]);
    // The version is closed: a routed approver is refused, the item stays held.
    const late = await plane.promote(ada, id(1), "team:platform", later(3700), { review: true });
    expect(late.event.policy_id).toBe(APPROVAL_EXPIRED_ID);
    expect(currentItems(db)[0]?.status).toBe("candidate");
  });

  test("an approval attempted after the expiry records it, without a sweep", async () => {
    const { plane, policy } = fresh(routed(LEADS));
    await held(plane);
    const r = await plane.promote(ada, id(1), "team:platform", later(3600), { review: true });
    expect(r.event).toMatchObject({
      op: "promote",
      decision: "deny",
      policy_id: APPROVAL_EXPIRED_ID,
    });
    expect(approvalQueue(policy, plane.events(), later(3600))[0]?.state).toBe("expired");
  });

  test("a rewrite is a new request with its own expiry", async () => {
    const { plane, policy } = fresh(routed(LEADS));
    await held(plane);
    const w = await plane.write(
      omar,
      item(1, { version: 2, content: "fact number 1, restated", status: "candidate" }),
      later(3000),
    );
    expect(w.item).toMatchObject({ version: 2, status: "candidate" });
    const [first, second] = approvalQueue(policy, plane.events(), later(3600));
    expect(first).toMatchObject({ version: 1, state: "denied", closed_by: w.event.id });
    expect(second).toMatchObject({ version: 2, state: "pending", due: false });
    expect(second?.expires_at).toBe(later(6600));
    expect(
      (await plane.promote(ada, id(1), "team:platform", later(3600), { review: true })).decision,
    ).toBe("allow");
  });

  test("a sweep by a non-member is one deny event", async () => {
    const { plane } = fresh(routed(LEADS));
    await held(plane);
    const r = await plane.expireRequests(eve, "team:platform", later(3600));
    expect(r.decision).toBe("deny");
    expect(r.events[0]).toMatchObject({ decision: "deny", policy_id: APPROVAL_MEMBERSHIP_ID });
  });

  test("an invalid scope is refused before the log is touched", async () => {
    const { plane } = fresh(routed(LEADS));
    await expect(plane.expireRequests(bob, "nowhere", AT)).rejects.toThrow(InvalidCallError);
    expect(plane.events()).toEqual([]);
  });
});

describe("refusal is an event with the approver's reason", () => {
  test("a routed approver refuses a held candidate: it is retired, never promoted", async () => {
    const { plane, db, policy } = fresh(routed(LEADS));
    await held(plane);
    const r = await plane.refuse(ada, id(1), "  not ours to keep ", later(60));
    expect(r.decision).toBe("allow");
    expect(r.event).toMatchObject({
      op: "retire",
      actor: ada.id,
      item_id: id(1),
      policy_id: APPROVAL_REFUSED_ID,
    });
    expect(r.event.reason).toContain(": not ours to keep; the candidate is retired");
    expect(currentItems(db)[0]?.status).toBe("retired");
    expect(approvalQueue(policy, plane.events(), later(60))[0]).toMatchObject({
      state: "denied",
      closed_under: APPROVAL_REFUSED_ID,
    });
    const after = await plane.promote(ada, id(1), "team:platform", later(61), { review: true });
    expect(after.event.policy_id).toBe(PROMOTE_NOT_CANDIDATE_ID);
  });

  test("a refusal the route or the reviewer rule refuses is one deny event, the item still held", async () => {
    const { plane, db } = fresh(routed(LEADS));
    await held(plane);
    expect((await plane.refuse(bob, id(1), "no", AT)).event.policy_id).toBe(APPROVAL_ROUTE_ID);
    expect((await plane.refuse(omar, id(1), "no", AT)).event.policy_id).toBe(PROMOTE_REVIEWER_ID);
    expect((await plane.refuse(eve, id(1), "no", AT)).event.policy_id).toBe(PROMOTE_MEMBERSHIP_ID);
    expect((await plane.refuse(eve, id(9), "no", AT)).event.policy_id).toBe(PROMOTE_MEMBERSHIP_ID);
    expect(currentItems(db)[0]?.status).toBe("candidate");
  });

  test("no pending request, or a due one, is refused with its own rule", async () => {
    const { plane } = fresh(routed(LEADS, false));
    await plane.write(omar, item(1), AT);
    expect((await plane.refuse(ada, id(1), "no", AT)).event.policy_id).toBe(APPROVAL_NO_REQUEST_ID);
    const second = fresh(routed(LEADS));
    await held(second.plane);
    const due = await second.plane.refuse(ada, id(1), "no", later(3600));
    expect(due.event).toMatchObject({ op: "promote", policy_id: APPROVAL_EXPIRED_ID });
  });

  test("an empty reason is refused before the log is touched", async () => {
    const { plane } = fresh(routed(LEADS));
    await held(plane);
    const before = plane.events().length;
    await expect(plane.refuse(ada, id(1), "  ", AT)).rejects.toThrow(InvalidCallError);
    expect(plane.events()).toHaveLength(before);
  });

  test("a widening asked for is a request; refusing it leaves the active item as it is", async () => {
    const { plane, db, policy } = fresh(routed(LEADS));
    // role scopes do not require review here, so the role write lands active.
    await plane.write(omar, item(1, { scope: "role:lead" }), AT);
    const ask = await plane.promote(omar, id(1), "team:platform", AT);
    expect(ask.event).toMatchObject({ op: "gate", decision: "ask" });
    expect(approvalQueue(policy, plane.events(), AT)[0]).toMatchObject({
      scope: "role:lead",
      target: "team:platform",
      opened_by: ask.event.id,
      approvers: ["role:lead"],
    });
    const r = await plane.refuse(ada, id(1), "keep it in the role", later(1));
    expect(r.event).toMatchObject({
      op: "promote",
      decision: "deny",
      policy_id: APPROVAL_REFUSED_ID,
    });
    expect(currentItems(db)[0]?.status).toBe("active");
    expect(approvalQueue(policy, plane.events(), later(1))[0]?.state).toBe("denied");
    // A refused version is closed: no approver promotes it, and no ask reopens it.
    const again = await plane.promote(ada, id(1), "team:platform", later(2), { review: true });
    expect(again.event.policy_id).toBe(APPROVAL_REFUSED_ID);
    expect((await plane.promote(omar, id(1), "team:platform", later(3))).event.policy_id).toBe(
      APPROVAL_REFUSED_ID,
    );
    expect(approvalQueue(policy, plane.events(), later(3))).toHaveLength(1);
  });

  test("a widening approved by a routed approver closes it as approved", async () => {
    const { plane, policy } = fresh(routed(LEADS));
    await plane.write(omar, item(1, { scope: "role:lead" }), AT);
    await plane.promote(omar, id(1), "team:platform", AT);
    const r = await plane.promote(ada, id(1), "team:platform", later(1), { review: true });
    expect(r.decision).toBe("allow");
    expect(approvalQueue(policy, plane.events(), later(1))[0]).toMatchObject({
      state: "approved",
      closed_by: r.event.id,
    });
  });
});

describe("Plane.approvals: the queue as one actor sees it", () => {
  test("members of the scope see the request, and only a routed approver may decide it", async () => {
    const { plane } = fresh(routed(LEADS));
    await held(plane);
    const seen = async (who: Actor, at = AT) =>
      (await plane.approvals(who, at)).map((r) => [r.item_id, r.may_decide]);
    expect(await seen(ada)).toEqual([[id(1), true]]);
    expect(await seen(bob)).toEqual([[id(1), false]]);
    expect(await seen(omar)).toEqual([[id(1), false]]);
    expect(await seen(eve)).toEqual([]);
    expect(await seen(carl)).toEqual([]);
    expect(await seen(ada, later(3600))).toEqual([[id(1), false]]);
    const before = plane.events().length;
    await plane.approvals(ada, AT);
    expect(plane.events()).toHaveLength(before);
  });
});

describe("the option: loaded, exported, and off in every preset", () => {
  const VALID = `id: t
version: 1
write:
  - { scope: person, allowed_sources: [user], confidence_floor: 0.5, forbidden_classes: [], requires_review: false }
  - { scope: role, allowed_sources: [user], confidence_floor: 0.5, forbidden_classes: [], requires_review: false }
  - { scope: team, allowed_sources: [user], confidence_floor: 0.5, forbidden_classes: [], requires_review: true }
  - { scope: org, allowed_sources: [user], confidence_floor: 0.5, forbidden_classes: [], requires_review: true }
read:
  matrix:
    - { reader: person, may_read: [person, role, team, org] }
    - { reader: role, may_read: [role, org] }
    - { reader: team, may_read: [team, org] }
    - { reader: org, may_read: [org] }
  honour_grants: true
retention: []
promotion:
  episodic_to_semantic: { confirmations: 3, or_review: true }
  procedural: { replay_k: 4, replay_n: 5 }
lints:
  enabled: []
  thresholds: {}
`;
  const withRoutes = (routes: string) =>
    `${VALID}approval:\n  routes:\n${routes}schema_version: 1\n`;
  function problemsOf(text: string): PolicyProblem[] {
    try {
      parsePolicy(text, "test.yaml");
    } catch (e) {
      expect(e).toBeInstanceOf(PolicyError);
      return (e as PolicyError).problems;
    }
    throw new Error("expected the policy to be rejected");
  }

  test("routes load, owner on a person route included", () => {
    const p = parsePolicy(
      withRoutes(
        "    - { scope: team, approvers: [role:lead, person:ada], expires_after: 604800 }\n    - { scope: person, approvers: [owner] }\n    - { scope: person:dana, approvers: [owner, person:ada] }\n",
      ),
      "t.yaml",
    );
    expect(p.approval?.routes).toHaveLength(3);
    const empty = parsePolicy(`${VALID}approval:\n  routes: []\nschema_version: 1\n`, "t.yaml");
    expect(empty.approval).toEqual({ routes: [] });
  });

  test("two routes for one scope or level are refused, so order never decides", () => {
    const problems = problemsOf(
      withRoutes(
        "    - { scope: team, approvers: [role:lead] }\n    - { scope: team, approvers: [person:ada] }\n",
      ),
    );
    expect(problems.map((p) => [p.path.join("."), p.message])).toEqual([
      ["approval.routes.1.scope", "a second approval route for team"],
    ]);
  });

  test("owner on a route that is not a person scope is refused", () => {
    for (const scope of ["team", "team:platform", "org"]) {
      const [p, ...rest] = problemsOf(
        withRoutes(`    - { scope: ${scope}, approvers: [owner] }\n`),
      );
      expect(rest).toEqual([]);
      expect(p?.path).toEqual(["approval", "routes", 0, "approvers"]);
      expect(p?.message).toContain("owner approves only on a person-scope route");
    }
  });

  test("no registered preset sets it", () => {
    for (const name of PRESETS) expect(loadPreset(name).approval).toBeUndefined();
  });

  test("the Cedar export takes it, names its routes as not exported, and is otherwise unchanged", () => {
    const medium = loadPreset("medium");
    const plain = exportCedar(medium);
    const withApproval = exportCedar({ ...medium, approval: { routes: LEADS } });
    const line =
      "// Not exported: the approval block's 1 route (card E2.19), which narrow who approves a promotion and when a request expires; the promotion gate is not exported, and the read and write rules below are the same without them.\n";
    expect(withApproval.policies).toContain(line);
    expect(withApproval.policies.replace(line, "")).toBe(plain.policies);
    expect(withApproval.schema).toBe(plain.schema);
    expect(withApproval.rules).toEqual(plain.rules);
  });
});
