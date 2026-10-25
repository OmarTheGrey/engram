// The cassette-backed pi-ai model (card RN1): a session's model call is keyed
// on the transcript the agent loop sent, replayed from the cache on a hit, and
// refused offline on a miss.
import {
  createModels,
  fauxAssistantMessage,
  fauxProvider,
  type Message,
} from "@earendil-works/pi-ai";
import { describe, expect, test } from "vitest";
import { cacheKey, memoryCache, OfflineMissError } from "../../src/model/cached.ts";
import {
  cassettePiModel,
  runtimeAnswers,
  scriptedAnswers,
  transcriptRequest,
} from "../../src/model/cassette.ts";

const CWD = "C:\\Temp\\engram-rn1-abc";
const context = { item: "gatemem/x", condition: "C2", preset: "none", store: "fake" };

const transcript = (stamp: number, cwd = CWD): { messages: Message[] } => ({
  messages: [
    {
      role: "system",
      content: "",
      sections: {
        preamble: "You are a test agent.",
        cwd: `<cwd>\n${cwd.replaceAll("\\", "/")}\n</cwd>`,
      },
      toolsAdded: [{ name: "memory_read", description: "read", parameters: { type: "object" } }],
      timestamp: stamp,
    } as Message,
    { role: "user", content: [{ type: "text", text: "hello" }], timestamp: stamp },
    {
      ...fauxAssistantMessage("thinking aloud"),
      timestamp: stamp,
      usage: { ...fauxAssistantMessage("").usage, input: stamp },
    },
  ],
});

const ask = (cassette: ReturnType<typeof cassettePiModel>, text: string) => {
  const models = createModels();
  models.setProvider(cassette.provider);
  return models.completeSimple(cassette.model, {
    messages: [{ role: "user", content: text, timestamp: 0 }],
  });
};

describe("transcriptRequest", () => {
  test("ignores timestamps, usage and the working directory", () => {
    const options = { model: "scripted/scripted-1", seed: 1 };
    const a = transcriptRequest(transcript(1), { ...options, cwd: CWD });
    const b = transcriptRequest(transcript(2, "/tmp/engram-rn1-xyz"), {
      ...options,
      cwd: "/tmp/engram-rn1-xyz",
    });
    expect(a).toEqual(b);
    expect(a.system).toContain("{cwd}");
    expect(a.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
  });

  test("a different seed or message is a different cache key", () => {
    const base = transcriptRequest(transcript(1), { model: "m/1", seed: 1, cwd: CWD });
    const seed = transcriptRequest(transcript(1), { model: "m/1", seed: 2, cwd: CWD });
    const other = transcript(1);
    other.messages[1] = { role: "user", content: "bye", timestamp: 1 };
    const message = transcriptRequest(other, { model: "m/1", seed: 1, cwd: CWD });
    const keys = [base, seed, message].map((r) => cacheKey(context, r));
    expect(new Set(keys).size).toBe(3);
  });
});

describe("cassettePiModel", () => {
  test("answers a miss from the source, then the same transcript from the cache", async () => {
    const cache = memoryCache();
    let reached = 0;
    const answers = async () => {
      reached++;
      return fauxAssistantMessage("Tuesday");
    };
    const options = {
      model: "scripted/scripted-1",
      seed: 1,
      cwd: CWD,
      cache,
      context,
      offline: false,
    };
    const first = cassettePiModel({ ...options, answers });
    const second = cassettePiModel({ ...options, answers, offline: true });

    expect((await ask(first, "When?")).content).toEqual([{ type: "text", text: "Tuesday" }]);
    expect((await ask(second, "When?")).content).toEqual([{ type: "text", text: "Tuesday" }]);
    expect(reached).toBe(1);
    expect(second.model).toMatchObject({ provider: "scripted", id: "scripted-1" });
  });

  test("offline, a miss is an OfflineMissError and never reaches the source", async () => {
    let reached = 0;
    const cassette = cassettePiModel({
      model: "scripted/scripted-1",
      seed: 1,
      cwd: CWD,
      cache: memoryCache(),
      context,
      offline: true,
      answers: async () => {
        reached++;
        return fauxAssistantMessage("x");
      },
    });
    const reply = await ask(cassette, "When?");
    expect(reply.stopReason).toBe("error");
    expect(cassette.errors[0]).toBeInstanceOf(OfflineMissError);
    expect(reached).toBe(0);
  });

  test("a failed answer is not cached", async () => {
    const cache = memoryCache();
    const options = {
      model: "scripted/scripted-1",
      seed: 1,
      cwd: CWD,
      cache,
      context,
      offline: false,
    };
    const failing = cassettePiModel({
      ...options,
      answers: scriptedAnswers([], { provider: "scripted", model: "scripted-1" }),
    });
    expect((await ask(failing, "When?")).stopReason).toBe("error");
    expect(failing.errors).toHaveLength(1);
    const offline = cassettePiModel({
      ...options,
      offline: true,
      answers: async () => fauxAssistantMessage("x"),
    });
    await ask(offline, "When?");
    expect(offline.errors[0]).toBeInstanceOf(OfflineMissError);
  });

  test("a live model is reached through a model runtime on a miss", async () => {
    const live = fauxProvider({ api: "live", provider: "livelab", models: [{ id: "live-1" }] });
    live.setResponses([fauxAssistantMessage("from the live model")]);
    const models = createModels();
    models.setProvider(live.provider);
    const usage: unknown[] = [];
    const cassette = cassettePiModel({
      model: "livelab/live-1",
      seed: 3,
      cwd: CWD,
      cache: memoryCache(),
      context,
      offline: false,
      answers: runtimeAnswers(models, live.getModel()),
      onUsage: (u) => usage.push(u),
    });
    expect((await ask(cassette, "When?")).content).toEqual([
      { type: "text", text: "from the live model" },
    ]);
    expect(usage).toEqual([expect.objectContaining({ hit: false, model: "livelab/live-1" })]);
  });
});
