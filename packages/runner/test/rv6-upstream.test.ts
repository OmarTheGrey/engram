// Card RV6 (design review RV-DES-11): OpenRouter's upstream provider pinned
// through pi-ai 1.3.0's `compat.openRouterRouting`, and the upstream that
// served each call recorded in its cassette and in the usage ledger. The
// wire test drives pi-ai's own OpenRouter provider against a fetch that
// answers in OpenRouter's stream format; nothing reaches the network.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  type Api,
  type AssistantMessage,
  createModels,
  fauxProvider,
  type Model,
} from "@earendil-works/pi-ai";
import { type CacheEntry, fileCache, type UsageRecord } from "@engram/model";
import { afterAll, describe, expect, test } from "vitest";
import type { LiveModels } from "../src/answers.ts";
import { type Condition, parseRunnerConfig, readRunnerConfig } from "../src/config.ts";
import { liveJudgeCall } from "../src/judge.ts";
import {
  builtinLiveModels,
  LiveRunRefused,
  liveConfig,
  liveOptions,
  replayConfig,
  upstreamRoutes,
} from "../src/live.ts";
import { routedModels, servedBy } from "../src/model/upstream.ts";
import { runConfig } from "../src/run.ts";
import { fauxLive } from "./live-fakes.ts";
import { B3 } from "./paths.ts";

const REPO = resolve(import.meta.dirname, "../../..");
const temp: string[] = [];
const fresh = () => {
  const dir = mkdtempSync(join(tmpdir(), "engram-rv6u-"));
  temp.push(dir);
  return dir;
};
afterAll(() => {
  for (const dir of temp) rmSync(dir, { recursive: true, force: true });
});

const PIN = { order: ["deepinfra"], allow_fallbacks: false };

/** A fetch answering every chat completion as OpenRouter streams one, served by `upstream`; it keeps each body sent. */
function openRouterFetch(upstream: string) {
  const bodies: Record<string, unknown>[] = [];
  const chunk = (extra: Record<string, unknown>) =>
    `data: ${JSON.stringify({ id: "gen-1", provider: upstream, model: "openai/gpt-4o", object: "chat.completion.chunk", created: 1, ...extra })}\n\n`;
  const fetch = async (_url: unknown, init?: { body?: unknown }) => {
    bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    const body = [
      chunk({
        choices: [{ index: 0, delta: { role: "assistant", content: "ok" }, finish_reason: null }],
      }),
      chunk({
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
        usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 },
      }),
      "data: [DONE]\n\n",
    ].join("");
    return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
  };
  return { fetch: fetch as unknown as typeof globalThis.fetch, bodies };
}

/** pi-ai's built-in providers with every request sent to `fetch` under a test key. */
function wired(fetch: typeof globalThis.fetch): LiveModels {
  const models = builtinLiveModels();
  return {
    getModel: (provider, id) => models.getModel(provider, id),
    completeSimple: (model, context, options) =>
      models.completeSimple(model, context, { ...options, apiKey: "test-key", fetch }),
  };
}

describe("pi-ai 1.3.0 passes OpenRouter's provider routing, and its chunks name the upstream", () => {
  test("a routed model's request carries the routing as `provider`; the reply's upstream is read from the stream", async () => {
    const wire = openRouterFetch("DeepInfra");
    const live = routedModels(wired(wire.fetch), new Map([["openrouter/openai/gpt-4o", PIN]]));
    const model = live.getModel("openrouter", "openai/gpt-4o") as Model<Api>;
    expect(model.api).toBe("openai-completions");
    const reply = await live.completeSimple(
      model,
      { messages: [{ role: "user", content: "hi", timestamp: 0 }] },
      { samplingParams: { seed: 7 } },
    );
    expect(reply.stopReason).toBe("stop");
    expect(wire.bodies[0]?.provider).toEqual(PIN);
    expect(wire.bodies[0]?.seed).toBe(7);
    expect(servedBy(reply)).toBe("DeepInfra");
  });

  test("an unrouted model sends no `provider`, and its upstream is still recorded", async () => {
    const wire = openRouterFetch("Azure");
    const live = routedModels(wired(wire.fetch));
    const model = live.getModel("openrouter", "openai/gpt-4o") as Model<Api>;
    const reply = await live.completeSimple(model, {
      messages: [{ role: "user", content: "hi", timestamp: 0 }],
    });
    expect(wire.bodies[0]).not.toHaveProperty("provider");
    expect(servedBy(reply)).toBe("Azure");
  });

  test("the live judge records the upstream in its cassette and in the ledger; the key does not move, and a replay reads it back", async () => {
    const wire = openRouterFetch("DeepInfra");
    const live = routedModels(wired(wire.fetch), new Map([["openrouter/openai/gpt-4o", PIN]]));
    const dir = join(fresh(), "cassettes");
    const { cached } = await import("@engram/model");
    const context = { item: "i", condition: "C5", preset: "medium", store: "fake" };
    const request = {
      model: "openrouter/openai/gpt-4o",
      messages: [{ role: "user" as const, content: "verdict?" }],
      seed: 1,
    };
    const ledger: UsageRecord[] = [];
    const call = cached(liveJudgeCall(live), {
      cache: fileCache(dir),
      context,
      offline: false,
      onUsage: (u) => ledger.push(u),
    });
    expect((await call(request)).text).toBe("ok");
    const [file] = readdirSync(dir);
    const entry = JSON.parse(readFileSync(join(dir, file as string), "utf8")) as CacheEntry;
    expect(entry.response.upstream).toBe("DeepInfra");
    // The same key as a call that recorded no upstream: the key is the request's, not the reply's.
    const { cacheKey } = await import("@engram/model");
    expect(entry.key).toBe(cacheKey(context, request));
    const replay = cached(
      async () => {
        throw new Error("a replay calls no model");
      },
      { cache: fileCache(dir), context, offline: true, onUsage: (u) => ledger.push(u) },
    );
    await replay(request);
    expect(ledger.map((u) => [u.hit, u.upstream])).toEqual([
      [false, "DeepInfra"],
      [true, "DeepInfra"],
    ]);
  });
});

describe("a config pins the upstream of its answer model and its judge", () => {
  test("a pinned run records into a cassette folder of its own pin; a replay reads the same one (review P60-4)", () => {
    const base = readRunnerConfig(B3);
    const request = { model: "openrouter/openai/gpt-4o", repo: REPO, env: {} };
    const free = liveConfig({ ...base, openrouter_provider: undefined }, request);
    const pinned = liveConfig({ ...base, openrouter_provider: { answer: PIN } }, request);
    const other = liveConfig(
      { ...base, openrouter_provider: { answer: { only: ["openai"] } } },
      request,
    );
    // An unpinned run keeps the folder it always had, so recorded runs still replay.
    expect(free.cassettes.replaceAll("\\", "/")).toMatch(
      /b3-gatemem-plane-live\/openrouter\/openai\/gpt-4o\/cassettes$/,
    );
    expect(pinned.cassettes).toMatch(/cassettes-upstream-[0-9a-f]{12}$/);
    expect(new Set([free.cassettes, pinned.cassettes, other.cassettes]).size).toBe(3);
    // The same pin written in another key order is the same folder.
    const reordered = liveConfig(
      {
        ...base,
        openrouter_provider: { answer: { allow_fallbacks: false, order: ["deepinfra"] } },
      },
      request,
    );
    expect(reordered.cassettes).toBe(pinned.cassettes);
    mkdirSync(pinned.cassettes, { recursive: true });
    writeFileSync(join(pinned.cassettes, "x.json"), "{}");
    try {
      expect(
        replayConfig({ ...base, openrouter_provider: { answer: PIN } }, request).cassettes,
      ).toBe(pinned.cassettes);
    } finally {
      rmSync(pinned.cassettes, { recursive: true, force: true });
    }
  });

  const b3 = readRunnerConfig(B3);

  test("openrouter_provider parses OpenRouter's fields and refuses others", () => {
    const raw = JSON.parse(readFileSync(B3, "utf8"));
    const parsed = parseRunnerConfig({ ...raw, openrouter_provider: { answer: PIN, judge: PIN } });
    expect(parsed.openrouter_provider?.answer).toEqual(PIN);
    expect(() =>
      parseRunnerConfig({ ...raw, openrouter_provider: { answer: { allow_fallbacks: false } } }),
    ).toThrow(/order or only/);
    expect(() =>
      parseRunnerConfig({ ...raw, openrouter_provider: { answer: { ...PIN, sort: "price" } } }),
    ).toThrow();
  });

  test("the routes: the answer model's and the judge's (the paper's judge for an experiment); refused off OpenRouter or pinned two ways", () => {
    const routes = upstreamRoutes({
      ...b3,
      kind: "experiment",
      judge: undefined,
      model: "openrouter/meta-llama/llama-3.3-70b-instruct",
      openrouter_provider: { answer: PIN, judge: { only: ["openai"] } },
    });
    expect([...routes]).toEqual([
      ["openrouter/meta-llama/llama-3.3-70b-instruct", PIN],
      ["openrouter/openai/gpt-4o", { only: ["openai"] }],
    ]);
    expect(() =>
      upstreamRoutes({ ...b3, model: "openai/gpt-4o", openrouter_provider: { answer: PIN } }),
    ).toThrow(LiveRunRefused);
    expect(() =>
      upstreamRoutes({
        ...b3,
        model: "openrouter/openai/gpt-4o",
        judge: { model: "openrouter/openai/gpt-4o" },
        openrouter_provider: { answer: PIN, judge: { only: ["openai"] } },
      }),
    ).toThrow(/pins it two ways/);
    // A pipeline config with no judge pins no judge.
    expect(() =>
      upstreamRoutes({ ...b3, judge: undefined, openrouter_provider: { judge: PIN } }),
    ).toThrow(/calls no judge model/);
  });

  test("a live session on a routed OpenRouter model: every call carries the routing, its cassette and ledger the upstream, and old-style replay is unchanged", async () => {
    // A faux OpenRouter on the seeded API, its stream chunks naming the upstream.
    const faux = fauxLive({ stableIds: true });
    const asked: Model<Api>[] = [];
    const openrouter = fauxProvider({
      api: "openai-completions",
      provider: "openrouter",
      models: [{ id: "test/answer" }],
    });
    const inner = createModels();
    inner.setProvider(openrouter.provider);
    const live: LiveModels = {
      getModel: (provider, id) => inner.getModel(provider, id),
      async completeSimple(model, context, options) {
        asked.push(model);
        const o = options as { onProviderStreamEvent?: (d: unknown, m: unknown) => Promise<void> };
        await o.onProviderStreamEvent?.({ id: "gen", provider: "DeepInfra" }, model);
        const reply = (await faux.models.completeSimple(
          faux.models.getModel("faux-live", "model-1") as Model<Api>,
          context,
          options,
        )) as AssistantMessage;
        return { ...reply, provider: "openrouter", model: "test/answer" };
      },
    };
    const config = liveConfig(
      {
        ...b3,
        items: [b3.items[1] as string],
        store: "fake" as const,
        conditions: ["C2"] as Condition[],
        openrouter_provider: { answer: PIN },
      },
      { model: "openrouter/test/answer", repo: REPO, cassettes: join(fresh(), "c"), env: {} },
    );
    const run = await runConfig(config, liveOptions(config, live, {}));
    expect(run.calls).toEqual({ new: 2, cached: 0 });
    expect(
      asked.map(
        (m) => (m.compat as { openRouterRouting?: unknown } | undefined)?.openRouterRouting,
      ),
    ).toEqual([PIN, PIN]);
    expect(run.usage.map((u) => u.upstream)).toEqual(["DeepInfra", "DeepInfra"]);
    for (const f of readdirSync(config.cassettes)) {
      const e = JSON.parse(readFileSync(join(config.cassettes, f), "utf8")) as CacheEntry;
      expect(e.response.upstream).toBe("DeepInfra");
    }
    const replay = await runConfig(config, { cache: fileCache(config.cassettes), offline: true });
    expect(replay.calls).toEqual({ new: 0, cached: 2 });
    expect(replay.usage.map((u) => u.upstream)).toEqual(["DeepInfra", "DeepInfra"]);
    expect(replay.rows).toEqual(run.rows);
  }, 60_000);
});
