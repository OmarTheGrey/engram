// The cassette-backed pi-ai model (card RN1): a session's model call is keyed
// on the transcript the agent loop sent, replayed from the cache on a hit, and
// refused offline on a miss.
import {
  type Api,
  createModels,
  fauxAssistantMessage,
  fauxProvider,
  type Message,
  type Model,
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
    expect(a.system).toBeUndefined();
    expect(a.messages[0]?.content).toContain("{cwd}");
    expect(a.messages.map((m) => JSON.parse(m.content).role)).toEqual([
      "system",
      "user",
      "assistant",
    ]);
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

describe("transcriptRequest: different transcripts never share a key (R7-6)", () => {
  const key = (messages: Message[], cwd = CWD, stream?: object) =>
    cacheKey(
      context,
      transcriptRequest(
        { messages },
        { model: "m/1", seed: 1, cwd, ...(stream ? { stream } : {}) },
      ),
    );
  const sys = (content: string) => ({ role: "system", content, timestamp: 0 }) as Message;
  const user = (text: string) => ({ role: "user", content: text, timestamp: 0 }) as Message;

  test("a system message keeps its place among the others", () => {
    const early = key([sys("s0"), sys("POLICY"), user("hi"), user("q")]);
    const late = key([sys("s0"), user("hi"), sys("POLICY"), user("q")]);
    expect(early).not.toBe(late);
  });

  test("the literal text {cwd} is not the working directory", () => {
    const real = key([user(`look in ${CWD}`)]);
    const literal = key([user("look in {cwd}")]);
    expect(real).not.toBe(literal);
  });

  test("only the whole working directory is replaced, not a longer path that starts with it", () => {
    const cwd = "/tmp/engram-rn1-abc";
    const longer = transcriptRequest(
      { messages: [user("/tmp/engram-rn1-abcdef/x and /var/tmp/engram-rn1-abc/y")] },
      { model: "m/1", seed: 1, cwd },
    );
    expect(longer.messages[0]?.content).toContain("/tmp/engram-rn1-abcdef/x");
    expect(longer.messages[0]?.content).toContain("/var/tmp/engram-rn1-abc/y");
    const inside = transcriptRequest(
      { messages: [user(`see ${cwd}/x, "${cwd}" and ${cwd}`)] },
      { model: "m/1", seed: 1, cwd },
    );
    expect(inside.messages[0]?.content).toContain('see {cwd}/x, \\"{cwd}\\" and {cwd}');
  });

  test.each([
    ["reasoning", { reasoning: "high" }],
    ["toolChoice", { toolChoice: "none" }],
    ["samplingParams", { samplingParams: { top_p: 0.5 } }],
    ["thinkingBudgets", { thinkingBudgets: { low: 100 } }],
    ["temperature", { temperature: 0.2 }],
    ["maxTokens", { maxTokens: 10 }],
  ])("the stream option %s is part of the key", (_name, stream) => {
    const messages = [user("hi")];
    expect(key(messages, CWD, stream)).not.toBe(key(messages));
  });

  test("an option that does not reach the answer is not", () => {
    const messages = [user("hi")];
    expect(key(messages, CWD, { sessionId: "s1", cacheRetention: "long" })).toBe(key(messages));
  });
});

describe("runtimeAnswers: a live miss is seeded or refused (R7-7)", () => {
  const recording = () => {
    const calls: { model: Model<Api>; options: Record<string, unknown> | undefined }[] = [];
    return {
      calls,
      completeSimple: async (model: Model<Api>, _context: unknown, options?: object) => {
        calls.push({ model, options: options as Record<string, unknown> | undefined });
        return fauxAssistantMessage("live answer");
      },
    };
  };
  const model = (api: string) =>
    ({ id: "live-1", provider: "livelab", api, name: "live" }) as unknown as Model<Api>;

  test("a model whose API takes a seed receives the config's seed and the loop's sampling options", async () => {
    const live = recording();
    const answers = runtimeAnswers(live, model("openai-completions"));
    const signal = new AbortController().signal;
    await answers(
      { messages: [] },
      {
        seed: 7,
        stream: { temperature: 0, maxTokens: 64, samplingParams: { top_p: 0.9 }, signal },
      },
    );
    expect(live.calls).toHaveLength(1);
    expect(live.calls[0]?.options).toMatchObject({
      temperature: 0,
      maxTokens: 64,
      samplingParams: { top_p: 0.9, seed: 7 },
      signal,
    });
  });

  test("through the cassette, a miss passes the session's seed", async () => {
    const live = recording();
    const cassette = cassettePiModel({
      model: "livelab/live-1",
      seed: 3,
      cwd: CWD,
      cache: memoryCache(),
      context,
      offline: false,
      answers: runtimeAnswers(live, model("openai-completions")),
    });
    await ask(cassette, "When?");
    expect(live.calls[0]?.options).toMatchObject({ samplingParams: { seed: 3 } });
  });

  test("a model whose API takes no seed is refused before it is called", async () => {
    const live = recording();
    const answers = runtimeAnswers(live, model("anthropic-messages"));
    await expect(answers({ messages: [] }, { seed: 1 })).rejects.toThrow(/takes no seed/);
    expect(live.calls).toEqual([]);
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
    const live = fauxProvider({
      api: "openai-completions",
      provider: "livelab",
      models: [{ id: "live-1" }],
    });
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
