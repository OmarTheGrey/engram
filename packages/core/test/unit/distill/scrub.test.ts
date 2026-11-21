// Card D1's scrub (AGENTS.md rule 12): the bypass redactor's secret table
// runs over every episode before anything is stored; free text is redacted,
// and an episode whose identifiers still match is held. Every secret here is
// synthetic and planted.
import { describe, expect, test } from "vitest";
import type { Episode, Step } from "../../../src/distill/episode.ts";
import { scrubEpisode } from "../../../src/distill/scrub.ts";
import { REDACTED_SECRET } from "../../../src/plane/bypass.ts";

/** A planted key: the shape of one, and nobody's. */
const PLANTED = "sk-synthetic0planted0for0d1test";

const fn = (over: Partial<Extract<Step, { kind: "function" }>> = {}): Step => ({
  entry_id: "a0000003",
  kind: "function",
  caller: "model",
  tool: "bash",
  arguments: { command: "ls" },
  result: "ok",
  is_error: false,
  result_entry_id: "a0000004",
  ...over,
});

const episode = (over: Partial<Episode> = {}): Episode => ({
  format: "engram.episode/1",
  session_id: "0193a000-0000-4000-8000-000000000001",
  task_id: "synthetic/rename-1",
  model: "scripted/scripted-1",
  steps: [
    { entry_id: "a0000001", kind: "user", text: "Rename foo" },
    {
      entry_id: "a0000002",
      kind: "generation",
      text: "Looking.",
      model: "scripted/scripted-1",
      stop_reason: "toolUse",
      tool_calls: 1,
    },
    fn(),
  ],
  outcome: { verdict: "success", reward: 1, stop_reason: "stop", leaf_id: "a0000004" },
  abandoned: [],
  summarised: false,
  skipped_lines: 0,
  ...over,
});

describe("scrubEpisode", () => {
  test("leaves an episode with nothing secret as it is", () => {
    const e = episode();
    expect(scrubEpisode(e)).toEqual({ episode: e, redacted: 0, held: [] });
  });

  test("redacts a planted key in a tool result, and the key is nowhere in what is kept", () => {
    const e = episode({ steps: [fn({ result: `export OPENAI_KEY=${PLANTED}\nok` })] });
    const out = scrubEpisode(e);
    expect(out.held).toEqual([]);
    expect(out.redacted).toBe(1);
    expect(JSON.stringify(out.episode)).not.toContain(PLANTED);
    expect(out.episode.steps[0]).toMatchObject({
      result: `export OPENAI_KEY=${REDACTED_SECRET}\nok`,
    });
  });

  test("redacts a key in user text, a generation, a summary and an abandoned branch", () => {
    const e = episode({
      steps: [
        { entry_id: "a0000001", kind: "user", text: `use ${PLANTED}` },
        {
          entry_id: "a0000002",
          kind: "summary",
          source: "compaction",
          text: `Bearer ${PLANTED}`,
          from_id: null,
        },
      ],
      abandoned: [
        {
          left_at: "a0000001",
          leaf_id: "b0000001",
          summary: `tried ${PLANTED}`,
          outcome: { verdict: null, reward: null, stop_reason: null, leaf_id: "b0000001" },
          steps: [{ entry_id: "b0000001", kind: "custom", custom_type: "x", text: PLANTED }],
        },
      ],
    });
    const out = scrubEpisode(e);
    expect(out.held).toEqual([]);
    expect(out.redacted).toBe(4);
    expect(JSON.stringify(out.episode)).not.toContain(PLANTED);
  });

  test("redacts a tool argument whose name says it holds a secret, whatever its value", () => {
    const e = episode({
      steps: [
        fn({
          arguments: { url: "https://x.test", api_key: "plain-short", nested: [{ token: 42 }] },
        }),
      ],
    });
    const out = scrubEpisode(e);
    expect(out.held).toEqual([]);
    expect(out.redacted).toBe(2);
    expect(out.episode.steps[0]).toMatchObject({
      arguments: {
        url: "https://x.test",
        api_key: REDACTED_SECRET,
        nested: [{ token: REDACTED_SECRET }],
      },
    });
  });

  test("redacts a key in a string argument by the table", () => {
    const e = episode({
      steps: [fn({ arguments: { command: `curl -H 'Authorization: Bearer ${PLANTED}'` } })],
    });
    const out = scrubEpisode(e);
    expect(JSON.stringify(out.episode)).not.toContain(PLANTED);
    expect(out.held).toEqual([]);
  });

  test("holds an episode whose task id still matches, naming the field and not the value", () => {
    const out = scrubEpisode(episode({ task_id: `task-${PLANTED}` }));
    expect(out.held).toEqual(["task_id"]);
  });

  test("holds an episode whose tool name, entry id or argument name matches", () => {
    const long = "x".repeat(40);
    const out = scrubEpisode(
      episode({
        steps: [
          fn({ tool: PLANTED }),
          fn({ entry_id: long }),
          fn({ arguments: { [`sk-${long}`]: "v" } }),
        ],
      }),
    );
    expect(out.held).toEqual(["steps[0].tool", "steps[1].entry_id", "steps[2].arguments"]);
    expect(JSON.stringify(out.held)).not.toContain(PLANTED);
  });

  test("does not hold pi's own id shapes, a UUID session id and 8-hex entry ids", () => {
    // A UUID is 36 characters of the table's 32-character key rule; pi's
    // default session id is one, and an entry id may fall back to one.
    const uuid = "0193a000-0000-4000-8000-0000000000ff";
    const out = scrubEpisode(
      episode({ session_id: uuid, steps: [fn({ entry_id: uuid, result_entry_id: "deadbeef" })] }),
    );
    expect(out.held).toEqual([]);
  });

  test("holds a session id that is not one of pi's shapes and matches", () => {
    expect(scrubEpisode(episode({ session_id: `s-${"y".repeat(40)}` })).held).toEqual([
      "session_id",
    ]);
  });

  test("is idempotent: a scrubbed episode scrubs to itself", () => {
    const once = scrubEpisode(
      episode({ steps: [fn({ result: `KEY=${PLANTED}`, arguments: { secret: "s" } })] }),
    );
    const twice = scrubEpisode(once.episode);
    expect(twice.episode).toEqual(once.episode);
    expect(twice.redacted).toBe(0);
  });

  test("does not change its input", () => {
    const e = episode({ steps: [fn({ result: PLANTED })] });
    const copy = structuredClone(e);
    scrubEpisode(e);
    expect(e).toEqual(copy);
  });
});
