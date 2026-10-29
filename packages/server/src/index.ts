// The HTTP server over core (card E8.1, ADR 0027): the route table, the app,
// its OpenAPI document, the loopback listener, and the workspace every surface
// opens (the CLI and the MCP server import it).
export {
  type AppOptions,
  allowedHosts,
  createApp,
  DEFAULT_PORT,
  honoPath,
  LOOPBACK_NAMES,
  loopbackGuard,
  MAX_BODY_BYTES,
} from "./app.ts";
export * as contract from "./contract.ts";
export {
  isLoopbackAddress,
  isLoopbackHost,
  type Listening,
  type ListenOptions,
  LOOPBACK_HOSTS,
  listen,
  notLoopbackBound,
} from "./listen.ts";
export { openApiDocument } from "./openapi.ts";
export { API_PREFIX, type Method, ROUTES, type Route, type RouteContext } from "./routes.ts";
export * from "./workspace.ts";
