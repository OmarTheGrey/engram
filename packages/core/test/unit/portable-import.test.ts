// What an import makes of a bundle row (card E9.8, decision item 55, review
// finding E9.8-1): the write and its actor, decided in core. A row never
// raises trust: its kind is the least trusted of what it claims and
// `import`, as adoption's (card RV4), so a model, compaction or external row
// keeps its kind and meets the gate's rules for that kind. Each case runs
// through the real Plane.write.
import { describe, expect, it } from "vitest";
import type { Actor } from "../../src/actor.ts";
import { loadPreset } from "../../src/policy/load.ts";
import {
  type BundleRow,
  importActor,
  importedWrite,
  importOrder,
  mapLineage,
  servedImport,
} from "../../src/portable.ts";
import type { MemoryItem, Provenance } from "../../src/schema.ts";
import { AT, fresh, id, item, testPolicy } from "./plane/helpers.ts";

const dana: Actor = {
  id: "person:dana",
  level: "person",
  memberships: ["person:dana", "team:platform"],
};

const row = (n: number, kind: Provenance["kind"], over: Partial<MemoryItem> = {}): BundleRow => ({
  item: item(n, {
    scope: "person:dana",
    owner: "person:dana",
    kind,
    ...(kind === "model" || kind === "compaction"
      ? {
          provenance: {
            kind,
            ref: "doc/1",
            hash: `sha256:${"0".repeat(64)}`,
            actor: "agent:pi",
            model: "faux/scripted",
          },
        }
      : {}),
    ...over,
  }),
  events: [],
});

/** The import of one row by dana into `scope` (the row's own when absent), through Plane.write. */
async function importOne(r: BundleRow, policyName: string | null, scope?: string) {
  const policy = policyName === null ? testPolicy() : loadPreset(policyName as "medium");
  const w = fresh(policy);
  const { actor, item: next } = importedWrite(dana, r, {
    id: id(500),
    scope: scope ?? r.item.scope,
    lineage: [],
  });
  const result = await w.plane.write(actor, next as MemoryItem, AT);
  return { actor, next, result };
}

describe("importedWrite: a row never raises trust", () => {
  it.each([
    ["model", "preset.medium/write/team", "source model is not allowed in team scope"],
    ["external", "preset.medium/write/team", "source external is not allowed in team scope"],
  ] as const)(
    "a %s row aimed at team scope is denied under medium, as a direct write is",
    async (kind, policyId, reason) => {
      const { actor, result } = await importOne(row(1, kind), "medium", "team:platform");
      expect(actor.source).toBe(kind);
      expect(result.event).toMatchObject({ decision: "deny", policy_id: policyId });
      expect(result.event.reason).toContain(reason);
    },
  );

  it.each([["model"], ["external"]] as const)(
    "a %s row aimed at team scope meets source isolation where the rule takes its kind",
    async (kind) => {
      // The test policy takes model in every scope; external it does not list.
      const policy = testPolicy();
      for (const rule of policy.write) rule.allowed_sources.push("external");
      const w = fresh({
        ...policy,
        write: policy.write.map((r) => ({ ...r, forbidden_classes: [] })),
      });
      const { actor, item: next } = importedWrite(dana, row(1, kind), {
        id: id(501),
        scope: "team:platform",
        lineage: [],
      });
      const result = await w.plane.write(actor, next as MemoryItem, AT);
      expect(result.event).toMatchObject({
        decision: "deny",
        policy_id: "engram/write/source-isolation",
      });
    },
  );

  it("a model row in person scope lands a model candidate, its model named", async () => {
    const { result } = await importOne(row(2, "model"), "medium");
    expect(result.event.decision).toBe("allow");
    expect(result.item).toMatchObject({
      status: "candidate",
      provenance: { kind: "model", actor: "import:person:dana", model: "faux/scripted" },
    });
  });

  it.each([["user"], ["document"], ["import"]] as const)(
    "a %s row is capped at import",
    async (kind) => {
      const { actor, result } = await importOne(row(3, kind), "medium");
      expect(actor.source).toBe("import");
      expect(result.item?.provenance.kind).toBe("import");
    },
  );

  it("a tool row stays tool", async () => {
    const { result } = await importOne(row(4, "tool"), "medium");
    expect(result.item?.provenance.kind).toBe("tool");
  });

  it("under strict, a compaction row is refused in person scope, which takes no compaction", async () => {
    const { result } = await importOne(row(5, "compaction"), "strict");
    expect(result.event).toMatchObject({
      decision: "deny",
      policy_id: "preset.strict/write/person",
    });
    expect(result.event.reason).toContain("source compaction is not allowed in person scope");
  });

  it("drops every grant, takes a new id and version 1, and lands active as a candidate", async () => {
    const granted = row(6, "user", {
      grants: [
        { to: "person:sam", class: "semantic", mode: "read", expires: "2027-01-01T00:00:00Z" },
      ],
      version: 5,
      status: "active",
    });
    const { next, result } = await importOne(granted, "medium");
    expect(next).toMatchObject({
      id: id(500),
      version: 1,
      grants: [],
      status: "candidate",
      owner: "person:dana",
    });
    expect(next.provenance).toMatchObject({ ref: `engram-bundle:${id(6)}` });
    expect(result.item?.status).toBe("candidate");
  });

  it("keeps a retired row retired, never more", async () => {
    const { next } = await importOne(row(7, "user", { status: "retired" }), "medium");
    expect(next.status).toBe("retired");
    const candidate = await importOne(row(8, "user", { status: "candidate" }), "medium");
    expect(candidate.next.status).toBe("candidate");
  });

  it("the import actor acts for the importer in exactly its scopes", () => {
    expect(importActor(dana, "import")).toEqual({
      id: "import:person:dana",
      level: "person",
      memberships: ["person:dana", "team:platform"],
      source: "import",
    });
  });
});

describe("servedImport: a served import write is mapped as an imported row", () => {
  const importer = { ...dana, id: "import:person:dana", source: "import" as const };
  const none = () => undefined;
  const claiming = (kind: string, over: Record<string, unknown> = {}) => ({
    id: id(9),
    provenance: { kind },
    ...over,
  });

  it.each([
    ["user", "import"],
    ["document", "import"],
    ["import", "import"],
    ["tool", "tool"],
    ["model", "model"],
    ["compaction", "compaction"],
    ["external", "external"],
  ] as const)("an import actor writing a %s claim writes as %s", (claimed, source) => {
    expect(servedImport(importer, claiming(claimed), none).actor.source).toBe(source);
  });

  it("takes the kind the plane holds for the id into the least trusted (E9.8-8)", () => {
    const held = item(9, { kind: "model" });
    const { actor } = servedImport(importer, claiming("user"), (i) =>
      i === id(9) ? held : undefined,
    );
    expect(actor.source).toBe("model");
  });

  it("makes the row a candidate owned by the importer with no grants; a retired row stays retired", () => {
    const grant = { to: "person:sam", class: "semantic", mode: "read" };
    const sent = claiming("user", { status: "active", owner: "person:sam", grants: [grant] });
    expect(servedImport(importer, sent, none).item).toMatchObject({
      status: "candidate",
      owner: "person:dana",
      grants: [],
    });
    const retired = servedImport(importer, claiming("user", { status: "retired" }), none);
    expect(retired.item).toMatchObject({ status: "retired" });
  });

  it("leaves any other actor, and a body that is no object, unchanged", () => {
    const user = { ...dana, source: "user" as const };
    const body = claiming("model");
    expect(servedImport(user, body, none)).toEqual({ actor: user, item: body });
    expect(servedImport(dana, body, none).actor).toBe(dana);
    expect(servedImport(importer, null, none)).toEqual({ actor: importer, item: null });
  });
});

describe("importOrder and mapLineage", () => {
  const planned = (from: string, lineage: string[]) => ({ from, lineage });

  it("writes a row after the rows its lineage names, else in the order given", () => {
    const order = importOrder([planned("b", ["c"]), planned("a", []), planned("c", ["a"])]);
    expect(order.map((p) => p.from)).toEqual(["a", "c", "b"]);
  });

  it("breaks a lineage cycle at the row met first", () => {
    const order = importOrder([planned("a", ["b"]), planned("b", ["a"])]);
    expect(order.map((p) => p.from)).toEqual(["b", "a"]);
  });

  it("maps pointers to rows already imported and drops the rest, counted", () => {
    const ids = new Map([["a", "A"]]);
    expect(mapLineage(["a", "x", "a"], ids)).toEqual({ lineage: ["A", "A"], dropped: 1 });
  });
});
