// Card D1's acceptance: the fifty fixture sessions in fixtures/sessions/d1/
// are recorded through the plane, and a read finds fifty episodic items with
// their task ids. Also the recorder's scrub (rule 12, with a planted
// synthetic secret), the source it sets, and a write the gate denies.
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createFakeAdapter } from "@engram/adapters";
import {
  createPlane,
  type Episode,
  loadPreset,
  type MemoryItem,
  migrate,
  openSqlite,
} from "@engram/core";
import { describe, expect, test } from "vitest";
import { sequentialIds } from "../src/gatemem-probe.ts";
import { type RecorderOptions, recordSession, recordSessionFiles } from "../src/recorder.ts";
import type { SessionFixture } from "../src/session-fixtures.ts";

const DIR = new URL("../../../fixtures/sessions/d1/", import.meta.url);
const INDEX = JSON.parse(readFileSync(new URL("index.json", DIR), "utf8")) as {
  sessions: SessionFixture[];
};
const FILES = readdirSync(DIR)
  .filter((f) => f.endsWith(".jsonl"))
  .sort()
  .map((f) => fileURLToPath(new URL(f, DIR)));
const AT = "2026-11-21T12:00:00.000Z";
const OWNER = "person:fixture";
const actor = { id: OWNER, level: "person" as const, memberships: [OWNER] };
/** A planted key: the shape of one, and nobody's. */
const PLANTED = "sk-synthetic0planted0for0d1test";

function setup(over: Partial<RecorderOptions> = {}) {
  const db = openSqlite(":memory:");
  migrate(db);
  const adapter = createFakeAdapter();
  const newId = sequentialIds();
  const plane = createPlane({ db, adapter, policy: loadPreset("medium"), newId });
  const options: RecorderOptions = {
    plane,
    actor,
    scope: OWNER,
    owner: OWNER,
    at: AT,
    newId,
    ...over,
  };
  return { db, adapter, plane, options };
}

const episodeOfItem = (item: MemoryItem) => item.content as unknown as Episode;

describe("acceptance (card D1): the fifty fixture sessions, recorded through the plane", () => {
  test("a read finds fifty episodic items with their task ids", async () => {
    const { plane, options, db } = setup();
    try {
      expect(FILES).toHaveLength(50);
      const recorded = await recordSessionFiles(FILES, options);
      expect(recorded.map((r) => r.status)).toEqual(FILES.map(() => "stored"));

      const read = await plane.read(actor, { at: AT });
      const episodic = read.items.filter((i) => i.class === "episodic");
      expect(episodic).toHaveLength(50);
      const taskIds = episodic.map((i) => episodeOfItem(i).task_id).sort();
      expect(taskIds).toEqual(INDEX.sessions.map((s) => s.task_id).sort());
      expect(new Set(taskIds).size).toBe(50);

      // Each item is its session: its ref, outcome and abandoned branches as
      // the index records them, and the source the recorder set.
      const bySession = new Map(episodic.map((i) => [episodeOfItem(i).session_id, i]));
      for (const s of INDEX.sessions) {
        const item = bySession.get(s.session_id) as MemoryItem;
        const episode = episodeOfItem(item);
        expect(item.provenance.ref).toBe(`pi-session:${s.session_id}`);
        expect(item.provenance.kind).toBe(
          s.branch === "summary" || s.compacted ? "compaction" : "model",
        );
        expect(item.provenance.actor).toBe(OWNER);
        expect(item.provenance.model).toBe("scripted/scripted-1");
        expect(episode.task_id).toBe(s.task_id);
        expect(episode.outcome.verdict).toBe(s.verdict);
        expect(episode.abandoned).toHaveLength(s.abandoned);
        expect(episode.omitted).toHaveLength(s.recovered ? 1 : 0);
        for (const b of episode.abandoned) expect(b.outcome.verdict).toBe("failure");
        expect(episode.steps.length).toBeGreaterThan(2);
      }
      // Fifty allowed writes, then the read.
      const events = plane.events();
      expect(events.filter((e) => e.op === "write" && e.decision === "allow")).toHaveLength(50);
      expect(events.map((e) => e.op)).toEqual([...FILES.map(() => "write"), "read"]);
    } finally {
      db.close();
    }
  });
});

describe("the recorder's scrub (rule 12)", () => {
  const first = readFileSync(FILES[0] as string, "utf8");

  test("a planted key in a tool result is redacted before it is stored", async () => {
    const planted = first.replace(": 42 lines", `: 42 lines; OPENAI_API_KEY=${PLANTED}`);
    expect(planted).toContain(PLANTED);
    const { plane, adapter, options, db } = setup();
    try {
      const r = await recordSession(planted, "planted.jsonl", options);
      expect(r).toMatchObject({ status: "stored", redacted: 1 });
      expect(JSON.stringify(plane.events())).not.toContain(PLANTED);
      expect(JSON.stringify(await adapter.list(OWNER))).not.toContain(PLANTED);
      const read = await plane.read(actor, { at: AT });
      expect(read.items).toHaveLength(1);
      expect(JSON.stringify(read.items)).toContain("OPENAI_API_KEY=<redacted>");
    } finally {
      db.close();
    }
  });

  test("a session whose task id still matches after the scrub is held: no item, no event", async () => {
    const taskId = INDEX.sessions[0]?.task_id as string;
    const planted = first.replace(taskId, `${taskId}-${PLANTED}`);
    const { plane, adapter, options, db } = setup();
    try {
      const r = await recordSession(planted, "held.jsonl", options);
      expect(r).toEqual({ status: "held", file: "held.jsonl", held: ["task_id"] });
      expect(JSON.stringify(r)).not.toContain(PLANTED);
      expect(plane.events()).toEqual([]);
      expect(await adapter.list(OWNER)).toEqual([]);
    } finally {
      db.close();
    }
  });
});

describe("the recorder", () => {
  const first = readFileSync(FILES[0] as string, "utf8");

  test("sets the actor's source itself, whatever the caller passes", async () => {
    const { plane, options, db } = setup();
    try {
      const claimed = { ...actor, source: "user" } as unknown as RecorderOptions["actor"];
      const r = await recordSession(first, "a.jsonl", { ...options, actor: claimed });
      expect(r.status).toBe("stored");
      const [event] = plane.events();
      expect(event?.item?.provenance.kind).toMatch(/^(model|compaction)$/);
      expect(event?.reason).toContain("provenance set by the plane");
    } finally {
      db.close();
    }
  });

  test("a session older than the episodic ttl is stored and read back: validity runs from the recording", async () => {
    // The fixture session started on 2026-10-01; medium keeps person
    // episodic items 90 days. Recorded five months later it must still read.
    const late = "2027-03-01T00:00:00.000Z";
    const { plane, options, db } = setup({ at: late });
    try {
      const r = await recordSession(first, "a.jsonl", options);
      expect(r).toMatchObject({ status: "stored", event: { decision: "allow" } });
      const read = await plane.read(actor, { at: late });
      expect(read.items).toHaveLength(1);
      const [item] = read.items;
      expect(item?.valid_from).toBe(late);
      const episode = episodeOfItem(item as MemoryItem);
      expect(episode.started_at).toBe("2026-10-01T09:00:00.000Z");
      expect(episode.ended_at).not.toBeNull();
      expect(Date.parse(episode.ended_at as string)).toBeGreaterThan(
        Date.parse(episode.started_at as string),
      );
    } finally {
      db.close();
    }
  });

  test("reports a write the gate denies, with its event", async () => {
    // The medium preset forbids episodic items in team scope.
    const team = { id: OWNER, level: "team" as const, memberships: ["team:platform"] };
    const { plane, options, db } = setup({ actor: team, scope: "team:platform" });
    try {
      const r = await recordSession(first, "a.jsonl", options);
      expect(r.status).toBe("denied");
      if (r.status !== "denied") return;
      expect(r.event).toMatchObject({
        op: "write",
        decision: "deny",
        policy_id: "preset.medium/write/team",
      });
      expect(plane.events()).toEqual([r.event]);
    } finally {
      db.close();
    }
  });

  test("reports a file with no session in it as invalid, and writes nothing", async () => {
    const { plane, options, db } = setup();
    try {
      const r = await recordSession('{"type":"message"}\n', "bad.jsonl", options);
      expect(r).toEqual({
        status: "invalid",
        file: "bad.jsonl",
        reason: "the file has no session header on its first line",
      });
      expect(plane.events()).toEqual([]);
    } finally {
      db.close();
    }
  });
});
