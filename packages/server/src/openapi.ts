// The OpenAPI 3.1 document, built from the route table (card E8.1, ADR 0027
// decision 1) with Zod 4's own JSON Schema export, no OpenAPI plugin. Every
// schema a route names is a component under the name ./contract.ts gives it;
// core's contracts keep the names of sdk/schema/*.json. `make api` writes the
// result to sdk/openapi.json, and the TypeScript client is generated from it.
import { SCHEMA_VERSION } from "@engram/core";
import { z } from "zod";
import { COMPONENTS } from "./contract.ts";
import { API_PREFIX, ROUTES, type Route } from "./routes.ts";

const REF = (name: string) => ({ $ref: `#/components/schemas/${name}` });

/** The component name of a schema the table uses; every one must have one. */
function nameOf(schema: z.ZodType, route: Route): string {
  for (const [name, s] of Object.entries(COMPONENTS)) if (s === schema) return name;
  throw new Error(`route ${route.id}: a schema without a component name in contract.ts`);
}

/** Drops the keys a component does not carry in OpenAPI (`$schema`, `$id`), at any depth. */
function clean(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k]) => k !== "$schema" && k !== "$id")
        .map(([k, v]) => [k, clean(v)]),
    );
  return value;
}

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: REF("ErrorResponse") } },
});

/** What each error status means, for the document. */
const ERRORS: Record<number, string> = {
  400: "the request fails its schema, or the plane refused the call (InvalidCallError)",
  403: "the Host or Origin is not this loopback server's, or the actor may not explain this read",
  404: "no such route, or the read id names no read event",
  413: "the body is over the size limit",
  415: "the body is not application/json",
  500: "an unexpected error; the body carries no internals",
  501: "the Plane method's card has not landed; the body names it",
  503: "the workspace has no store",
};

export function openApiDocument(): Record<string, unknown> {
  const registry = z.registry<{ id: string }>();
  for (const [id, schema] of Object.entries(COMPONENTS)) registry.add(schema, { id });
  const { schemas } = z.toJSONSchema(registry, { uri: (id) => `#/components/schemas/${id}` });

  const paths: Record<string, Record<string, unknown>> = {};
  for (const r of ROUTES) {
    const path = `${API_PREFIX}${r.path}`;
    const params = [...r.path.matchAll(/\{(\w+)\}/g)].map((m) => ({
      name: m[1],
      in: "path",
      required: true,
      schema: { type: "string" },
    }));
    const statuses = [...new Set([...r.errors, 403, 404, 500, ...(r.request ? [413, 415] : [])])];
    const operation: Record<string, unknown> = {
      operationId: r.id,
      summary: r.summary,
      ...(params.length > 0 ? { parameters: params } : {}),
      ...(r.request
        ? {
            requestBody: {
              required: true,
              content: { "application/json": { schema: REF(nameOf(r.request, r)) } },
            },
          }
        : {}),
      responses: {
        "200": {
          description: "the result; a policy decision of any kind is 200 with its event",
          content: { "application/json": { schema: REF(nameOf(r.response, r)) } },
        },
        ...Object.fromEntries(
          statuses.sort((a, b) => a - b).map((s) => [String(s), errorResponse(ERRORS[s] ?? "")]),
        ),
      },
    };
    paths[path] = { ...paths[path], [r.method]: operation };
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Engram",
      version: `0.0.0+schema.${SCHEMA_VERSION}`,
      description:
        "The Engram control plane over HTTP (ADR 0027): every route calls the Plane; no authentication in v0, so the server answers on loopback only.",
    },
    servers: [{ url: "http://127.0.0.1:7313" }],
    paths,
    components: { schemas: clean(schemas) },
  };
}
