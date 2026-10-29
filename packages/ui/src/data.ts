// What the inspector asks the server (cards E8.5 and E8.6), every call through
// the generated client (ADR 0027 decision 2) and none to anything else. The
// lanes are a Plane.read as the viewer (POST /read), so they pass the read
// filter and leave a read event (AGENTS.md rule 2); the timeline is the
// events the server's visibleEvents gives the viewer (POST /events); explain
// is Plane.explain as the viewer (POST /explain/{readId}).
import type {
  Actor,
  EngramClient,
  ExplainResponse,
  MemoryEvent,
  ReadResponse,
} from "./api/index.ts";
import {
  buildLanes,
  contentText,
  type ExplainView,
  explainTarget,
  explainView,
  type Lane,
} from "./view.ts";

/** A call the server answered with an error, carrying its status and message. */
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function fail(response: Response, error: unknown): never {
  const message =
    typeof error === "object" && error !== null && "error" in error
      ? String((error as { error: { message?: unknown } }).error.message)
      : `HTTP ${response.status}`;
  throw new ApiError(response.status, message);
}

/** The viewer `engram serve --as` named, or null. */
export async function fetchViewer(client: EngramClient): Promise<Actor | null> {
  const { data, error, response } = await client.GET("/api/v1/viewer");
  if (data === undefined) fail(response, error);
  return data.viewer;
}

/** One read as the viewer with no query text: everything it may read now, by scope. */
export async function readLanes(
  client: EngramClient,
  viewer: Actor,
): Promise<{ read: ReadResponse; lanes: Lane[] }> {
  const { data, error, response } = await client.POST("/api/v1/read", { body: { actor: viewer } });
  if (data === undefined) fail(response, error);
  return { read: data, lanes: buildLanes(viewer, data) };
}

/** The events the viewer may see, in log order. */
export async function fetchTimeline(client: EngramClient, viewer: Actor): Promise<MemoryEvent[]> {
  const { data, error, response } = await client.POST("/api/v1/events", {
    body: { actor: viewer },
  });
  if (data === undefined) fail(response, error);
  return data.events;
}

/**
 * The explain view of `event` for the viewer. Another actor's read is not
 * asked about; a refusal from the server (403) shows the same line.
 */
export async function fetchExplain(
  client: EngramClient,
  viewer: Actor,
  event: MemoryEvent,
  contents: ReadonlyMap<string, string> = new Map(),
): Promise<ExplainView> {
  if (explainTarget(viewer, event) !== "own") return explainView(viewer, event, null, contents);
  const { data, error, response } = await client.POST("/api/v1/explain/{readId}", {
    params: { path: { readId: event.id } },
    body: { actor: viewer },
  });
  if (response.status === 403) return explainView(viewer, event, null, contents);
  if (data === undefined) fail(response, error);
  return explainView(viewer, event, data satisfies ExplainResponse, contents);
}

export interface Inspection {
  viewer: Actor;
  read: ReadResponse;
  lanes: Lane[];
  events: MemoryEvent[];
  /** Item contents the lanes returned, by id, for the explain view's rows. */
  contents: Map<string, string>;
}

/** The lanes first, so the timeline that follows shows the read they made. */
export async function inspect(client: EngramClient, viewer: Actor): Promise<Inspection> {
  const { read, lanes } = await readLanes(client, viewer);
  const events = await fetchTimeline(client, viewer);
  const contents = new Map(read.items.map((i) => [i.id, contentText(i)]));
  return { viewer, read, lanes, events, contents };
}
