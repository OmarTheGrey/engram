// The cassette proxy (card B10, ADR 0036): an outside harness's OpenAI
// chat-completions calls served through the same cached, seeded call as the
// runner. Every upstream here is a scripted model; no test reaches a
// provider. Each proxy listens on 127.0.0.1 on an ephemeral port and is
// closed after its test.
import type { AddressInfo } from "node:net";
import { type ModelRequest, requestHash } from "@engram/core";
import { afterEach, describe, expect, test } from "vitest";
import {
  type CallContext,
  type ChatCall,
  type ChatRequest,
  cached,
  cacheKey,
  memoryCache,
  TransientCallError,
  type UsageRecord,
} from "../src/cached.ts";
import {
  CONTEXT_HEADERS,
  chatRequest,
  checkHarnessEndpoint,
  HarnessEndpointRefused,
  type ProxyHandle,
  type ProxyOptions,
  ProxyRefused,
  proxyCallContext,
  startProxy,
} from "../src/proxy.ts";
import { scriptedChatCall, scriptedModelCall } from "../src/scripted.ts";

const open: ProxyHandle[] = [];
afterEach(async () => {
  await Promise.all(open.splice(0).map((p) => p.close()));
});

async function proxy(options: ProxyOptions): Promise<ProxyHandle> {
  const handle = await startProxy({ env: {}, ...options });
  open.push(handle);
  return handle;
}

/** What every test request shares: the harness and the experiment cell. */
const CELL = {
  harness: "merit",
  condition: "C5",
  preset: "medium",
  store: "fake",
  seed: 1,
} as const;

const post = (handle: ProxyHandle, body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${handle.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

const ask = (content: string, extra: Record<string, unknown> = {}) => ({
  model: "openai/gpt-test",
  messages: [
    { role: "system", content: "You answer briefly." },
    { role: "user", content },
  ],
  temperature: 0,
  max_tokens: 64,
  ...extra,
});

interface Completion {
  choices: { index: number; message: Record<string, unknown>; finish_reason: string }[];
}
interface Failure {
  error: { code: string; message: string };
}
const completion = async (res: Response) => (await res.json()) as Completion;
const failure = async (res: Response) => (await res.json()) as Failure;

/** A scripted upstream that counts the calls it answers. */
function counted(call: ChatCall) {
  const state = { calls: 0 };
  const upstream: ChatCall = async (request) => {
    state.calls++;
    return call(request);
  };
  return { upstream, state };
}

/** The proxy's request for `body` under CELL's seed, for scripting the upstream. */
const asSent = (body: unknown, seed: number = CELL.seed) => chatRequest(body, seed);

describe("replay (the default record mode, none)", () => {
  test("a miss is an error returned to the caller and recorded, and no model is called", async () => {
    const { upstream, state } = counted(scriptedChatCall({}));
    const usage: UsageRecord[] = [];
    const handle = await proxy({
      cache: memoryCache(),
      context: { ...CELL },
      upstream,
      onUsage: (u) => usage.push(u),
    });

    const res = await post(handle, ask("What is two plus two?"), { "x-engram-item": "q1" });
    const body = await failure(res);

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("cassette_miss");
    const key = cacheKey(
      proxyCallContext({ ...CELL, item: "q1" }),
      asSent(ask("What is two plus two?")),
    );
    expect(body.error.message).toContain(key);
    expect(handle.errors).toEqual([
      expect.objectContaining({ status: 404, code: "cassette_miss", key }),
    ]);
    expect(state.calls).toBe(0);
    expect(usage).toEqual([]);
  });

  test("a second run of the same calls makes zero new calls and answers byte for byte the same", async () => {
    const questions = ["What is two plus two?", "Name a prime.", "Spell cat."];
    const table = Object.fromEntries(
      questions.map((q, i) => [requestHash(asSent(ask(q)) as ModelRequest), `answer ${i}`]),
    );
    const cache = memoryCache();
    const run = async (options: Partial<ProxyOptions>) => {
      const { upstream, state } = counted(scriptedChatCall(table));
      const usage: UsageRecord[] = [];
      const handle = await proxy({
        cache,
        context: { ...CELL },
        upstream,
        onUsage: (u) => usage.push(u),
        ...options,
      });
      const bodies: string[] = [];
      const hits: (string | null)[] = [];
      for (const [i, q] of questions.entries()) {
        const res = await post(handle, ask(q), { "x-engram-item": `q${i}` });
        expect(res.status).toBe(200);
        hits.push(res.headers.get("x-engram-cache-hit"));
        bodies.push(await res.text());
      }
      await handle.close();
      return { calls: state.calls, usage, bodies, hits };
    };

    const first = await run({ record: "new_episodes" });
    const second = await run({ record: "new_episodes" });
    const replay = await run({});

    expect(first.calls).toBe(3);
    expect(first.hits).toEqual(["false", "false", "false"]);
    expect(first.usage.map((u) => u.hit)).toEqual([false, false, false]);
    for (const again of [second, replay]) {
      expect(again.calls).toBe(0);
      expect(again.hits).toEqual(["true", "true", "true"]);
      expect(again.usage.map((u) => u.hit)).toEqual([true, true, true]);
      expect(again.usage.map((u) => u.key)).toEqual(first.usage.map((u) => u.key));
      expect(again.bodies).toEqual(first.bodies);
    }
    const reply = JSON.parse(first.bodies[1] as string);
    expect(reply.choices[0]).toEqual({
      index: 0,
      message: { role: "assistant", content: "answer 1" },
      finish_reason: "stop",
    });
  });
});

describe("the cache key", () => {
  test("is the runner's key: a call the runner's cached path recorded replays through the proxy", async () => {
    // The runner's judge path (packages/runner/src/judge.ts): a ModelRequest
    // through cached() from @engram/model, keyed by cacheKey.
    const context: CallContext = {
      item: "merit/q7",
      condition: CELL.condition,
      preset: CELL.preset,
      store: CELL.store,
    };
    const request: ModelRequest = {
      model: "openai/gpt-test",
      system: "You answer briefly.",
      messages: [{ role: "user", content: "Is the sky blue?" }],
      seed: CELL.seed,
      temperature: 0,
      maxTokens: 64,
    };
    const cache = memoryCache();
    const runnerUsage: UsageRecord[] = [];
    const runner = cached(scriptedModelCall({ [requestHash(request)]: "yes" }), {
      cache,
      context,
      offline: false,
      onUsage: (u) => runnerUsage.push(u),
    });
    await expect(runner(request)).resolves.toMatchObject({ text: "yes" });

    const proxyUsage: UsageRecord[] = [];
    const handle = await proxy({
      cache,
      context: { ...CELL },
      onUsage: (u) => proxyUsage.push(u),
    });
    const res = await post(handle, ask("Is the sky blue?"), { "x-engram-item": "q7" });

    expect(res.status).toBe(200);
    expect(res.headers.get("x-engram-cache-hit")).toBe("true");
    const key = cacheKey(context, request);
    expect(runnerUsage[0]?.key).toBe(key);
    expect(res.headers.get("x-engram-cache-key")).toBe(key);
    expect(proxyUsage).toEqual([expect.objectContaining({ key, hit: true })]);
    expect(asSent(ask("Is the sky blue?"))).toEqual(request);
    expect((await completion(res)).choices[0]?.message.content).toBe("yes");
  });

  test("holds the seed, the prompt and every cell field, so changing any one misses", async () => {
    const cache = memoryCache();
    const base = ask("Is the sky blue?");
    const recorded = await proxy({
      cache,
      context: { ...CELL },
      record: "new_episodes",
      upstream: scriptedChatCall({ [requestHash(asSent(base) as ModelRequest)]: "yes" }),
    });
    expect((await post(recorded, base, { "x-engram-item": "q1" })).status).toBe(200);
    await recorded.close();

    const replay = await proxy({ cache, context: { harness: CELL.harness } });
    const cell = {
      "x-engram-item": "q1",
      "x-engram-condition": CELL.condition,
      "x-engram-preset": CELL.preset,
      "x-engram-store": CELL.store,
      "x-engram-seed": String(CELL.seed),
    };
    expect((await post(replay, base, cell)).status).toBe(200);
    const variants: [unknown, Record<string, string>][] = [
      [base, { ...cell, "x-engram-seed": "2" }],
      [base, { ...cell, "x-engram-item": "q2" }],
      [base, { ...cell, "x-engram-condition": "C4" }],
      [base, { ...cell, "x-engram-preset": "strict" }],
      [base, { ...cell, "x-engram-store": "mem0" }],
      [ask("Is the sky green?"), cell],
      [{ ...base, model: "openai/gpt-other" }, cell],
      [{ ...base, temperature: 0.5 }, cell],
      [{ ...base, top_p: 0.9 }, cell],
    ];
    for (const [body, headers] of variants) {
      const res = await post(replay, body, headers);
      expect(res.status).toBe(404);
    }
    const keys = new Set(replay.errors.map((e) => e.key));
    expect(keys.size).toBe(variants.length);
  });

  test("the harness qualifies the item, so two harnesses never share a key", () => {
    const a = proxyCallContext({ ...CELL, harness: "merit", item: "q1" });
    const b = proxyCallContext({ ...CELL, harness: "tau2", item: "q1" });
    expect(a.item).toBe("merit/q1");
    expect(cacheKey(a, asSent(ask("x")))).not.toBe(cacheKey(b, asSent(ask("x"))));
  });
});

describe("tool use passes through", () => {
  const tools = [
    {
      type: "function",
      function: {
        name: "get_order",
        description: "Look up an order by id.",
        parameters: {
          type: "object",
          properties: { order_id: { type: "string" } },
          required: ["order_id"],
        },
      },
    },
  ];
  const toolCalls = [
    {
      id: "call_1",
      type: "function",
      function: { name: "get_order", arguments: '{"order_id":"W123"}' },
    },
  ];
  const turn = {
    model: "openai/gpt-test",
    messages: [
      { role: "system", content: "You are a retail agent." },
      { role: "user", content: "Where is order W123?" },
      { role: "assistant", content: null, tool_calls: toolCalls },
      { role: "tool", tool_call_id: "call_1", content: '{"status":"shipped"}' },
    ],
    tools,
    tool_choice: "auto",
    temperature: 0,
  };

  test("tools, tool_choice and the history's tool messages are in the request the cassette keeps", () => {
    const request = asSent(turn);
    expect(request.tools).toEqual(tools);
    expect(request.toolChoice).toBe("auto");
    expect(request.system).toBe("You are a retail agent.");
    expect(request.messages).toEqual([
      { role: "user", content: "Where is order W123?" },
      { role: "assistant", content: null, tool_calls: toolCalls },
      { role: "tool", tool_call_id: "call_1", content: '{"status":"shipped"}' },
    ]);
  });

  test("a reply's tool_calls reach the harness unchanged, recorded and replayed", async () => {
    const cache = memoryCache();
    const first = { ...turn, messages: turn.messages.slice(0, 2) };
    const upstream = scriptedChatCall({
      [requestHash(asSent(first) as ModelRequest)]: { text: "", toolCalls },
      [requestHash(asSent(turn) as ModelRequest)]: "Order W123 has shipped.",
    });
    const handle = await proxy({
      cache,
      context: { ...CELL, harness: "tau2", item: "retail-0" },
      record: "new_episodes",
      upstream,
    });

    const res = await post(handle, first);
    const reply = await completion(res);
    expect(res.status).toBe(200);
    expect(reply.choices[0]).toEqual({
      index: 0,
      message: { role: "assistant", content: null, tool_calls: toolCalls },
      finish_reason: "tool_calls",
    });
    const after = await completion(await post(handle, turn));
    expect(after.choices[0]?.message).toEqual({
      role: "assistant",
      content: "Order W123 has shipped.",
    });
    await handle.close();

    const replay = await proxy({ cache, context: { ...CELL, harness: "tau2", item: "retail-0" } });
    const again = await post(replay, first);
    expect(again.headers.get("x-engram-cache-hit")).toBe("true");
    expect(await completion(again)).toEqual(reply);
  });

  test("changing a tool definition or the tool choice changes the key", async () => {
    const context = proxyCallContext({ ...CELL, item: "retail-0" });
    const key = (body: unknown) => cacheKey(context, asSent(body));
    const renamed = [{ ...tools[0], function: { ...tools[0]?.function, name: "find_order" } }];
    expect(key({ ...turn, tools: renamed })).not.toBe(key(turn));
    expect(key({ ...turn, tool_choice: "required" })).not.toBe(key(turn));
    expect(key({ ...turn, tools: undefined, tool_choice: undefined })).not.toBe(key(turn));
  });
});

describe("modes and refusals", () => {
  test("record mode is refused under ENGRAM_OFFLINE=1, and without an upstream", async () => {
    const upstream = scriptedChatCall({});
    await expect(
      startProxy({
        cache: memoryCache(),
        record: "new_episodes",
        upstream,
        env: { ENGRAM_OFFLINE: "1" },
      }),
    ).rejects.toThrow(ProxyRefused);
    await expect(
      startProxy({ cache: memoryCache(), record: "new_episodes", env: {} }),
    ).rejects.toThrow(/upstream/);
    await expect(
      startProxy({ cache: memoryCache(), record: "all" as never, env: {} }),
    ).rejects.toThrow(/record mode all/);
  });

  test("replay is allowed under ENGRAM_OFFLINE=1", async () => {
    const handle = await proxy({ cache: memoryCache(), env: { ENGRAM_OFFLINE: "1" } });
    expect(handle.port).toBeGreaterThan(0);
  });

  test("listens on 127.0.0.1 only, on an ephemeral port", async () => {
    const handle = await proxy({ cache: memoryCache() });
    const address = handle.server.address() as AddressInfo;
    expect(address.address).toBe("127.0.0.1");
    expect(address.port).toBe(handle.port);
    expect(handle.baseUrl).toBe(`http://127.0.0.1:${handle.port}/v1`);
  });

  test("streaming and embeddings return 501 with a reason; other routes and methods are refused", async () => {
    const handle = await proxy({ cache: memoryCache(), context: { ...CELL, item: "q1" } });
    const streamed = await post(handle, ask("hi", { stream: true }));
    expect(streamed.status).toBe(501);
    expect((await failure(streamed)).error.message).toMatch(/stream/);
    const embedded = await fetch(`${handle.baseUrl}/embeddings`, {
      method: "POST",
      body: JSON.stringify({ model: "openai/emb", input: "x" }),
    });
    expect(embedded.status).toBe(501);
    expect((await failure(embedded)).error.message).toMatch(/embeddings/);
    expect((await fetch(`${handle.baseUrl}/models`)).status).toBe(404);
    expect((await fetch(`${handle.baseUrl}/chat/completions`)).status).toBe(405);
  });

  test("a request is refused when its cell is incomplete or contradicts the configuration", async () => {
    const handle = await proxy({ cache: memoryCache(), context: { ...CELL } });
    const missing = await post(handle, ask("hi"));
    expect(missing.status).toBe(400);
    expect((await failure(missing)).error.message).toMatch(/item/);
    const contradicts = await post(handle, ask("hi"), {
      "x-engram-item": "q1",
      "x-engram-seed": "2",
    });
    expect(contradicts.status).toBe(400);
    expect((await failure(contradicts)).error.message).toMatch(/seed/);
    const badSeed = await post(handle, ask("hi", { seed: 9 }), { "x-engram-item": "q1" });
    expect(badSeed.status).toBe(400);
    const several = await post(handle, ask("hi", { n: 2 }), { "x-engram-item": "q1" });
    expect(several.status).toBe(400);
    const broken = await fetch(`${handle.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "x-engram-item": "q1" },
      body: "{not json",
    });
    expect(broken.status).toBe(400);
    expect(handle.errors.map((e) => e.status)).toEqual([400, 400, 400, 400, 400]);
  });

  test("the context headers are the six cell fields", () => {
    expect(Object.keys(CONTEXT_HEADERS).sort()).toEqual(
      ["condition", "harness", "item", "preset", "seed", "store"].sort(),
    );
  });

  test("a transient upstream failure is a 503, recorded nowhere in the cassettes, and the call is made again", async () => {
    const cache = memoryCache();
    let failures = 1;
    const body = ask("hi");
    const scripted = scriptedChatCall({ [requestHash(asSent(body) as ModelRequest)]: "hello" });
    const upstream: ChatCall = async (request: ChatRequest) => {
      if (failures-- > 0) throw new TransientCallError("429 rate limited");
      return scripted(request);
    };
    const handle = await proxy({
      cache,
      context: { ...CELL, item: "q1" },
      record: "new_episodes",
      upstream,
    });
    const failed = await post(handle, body);
    expect(failed.status).toBe(503);
    const key = cacheKey(proxyCallContext({ ...CELL, item: "q1" }), asSent(body));
    expect(cache.get(key)).toBeUndefined();
    const retried = await post(handle, body);
    expect(retried.status).toBe(200);
    expect(cache.get(key)?.response.text).toBe("hello");
  });
});

describe("checkHarnessEndpoint", () => {
  test("accepts the proxy's base URL and refuses any other endpoint", async () => {
    const handle = await proxy({ cache: memoryCache() });
    expect(checkHarnessEndpoint(handle.baseUrl, handle)).toBe(handle.baseUrl);
    expect(checkHarnessEndpoint(`${handle.baseUrl}/`, handle)).toBe(handle.baseUrl);
    const other = `http://127.0.0.1:${handle.port === 65535 ? 65534 : handle.port + 1}/v1`;
    for (const endpoint of [
      "https://api.openai.com/v1",
      "https://openrouter.ai/api/v1",
      `http://localhost:${handle.port}/v1`,
      `http://user:pw@127.0.0.1:${handle.port}/v1`,
      `http://127.0.0.1:${handle.port}/v2`,
      `https://127.0.0.1:${handle.port}/v1`,
      other,
      "",
      undefined,
    ]) {
      expect(() => checkHarnessEndpoint(endpoint, handle)).toThrow(HarnessEndpointRefused);
    }
  });

  test("before the proxy starts, a config's endpoint must at least be a loopback proxy endpoint", () => {
    expect(checkHarnessEndpoint("http://127.0.0.1:7400/v1")).toBe("http://127.0.0.1:7400/v1");
    expect(() => checkHarnessEndpoint("https://api.openai.com/v1")).toThrow(
      /not the cassette proxy/,
    );
  });
});
