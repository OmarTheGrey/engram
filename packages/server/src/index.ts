// The HTTP server over core (card E8.1, ADR 0027): the route table, the app,
// its OpenAPI document, the listener, and the workspace every surface opens
// (the CLI and the MCP server import it). Verified actors (card E8.12, ADR
// 0042): credentials, API keys and the attestation side table.
export {
  type AppAuth,
  type AppOptions,
  allowedHosts,
  createApp,
  credentialGuard,
  DEFAULT_PORT,
  honoPath,
  LOOPBACK_NAMES,
  loopbackGuard,
  MAX_BODY_BYTES,
  type Principals,
  publicOriginOf,
  serveMetadata,
} from "./app.ts";
export {
  type Attestation,
  type AttestationRow,
  type AuthMethod,
  attestations,
  attested,
  attestingDb,
  currentAttestation,
  type Surface,
} from "./attest.ts";
export {
  type AuthOutcome,
  authenticate,
  bindActor,
  type CredentialFlags,
  type Credentials,
  hasCredentialFlags,
  JWT_ALGORITHMS,
  type JwtSetup,
  loadSubjects,
  metadataPath,
  openCredentials,
  openJwks,
  type Principal,
  protectedResourceMetadata,
  SubjectsFile,
  wwwAuthenticate,
} from "./auth.ts";
export * as contract from "./contract.ts";
export {
  type DecisionExport,
  type DecisionSink,
  EXPORT_JSONL_ENV,
  type ExportConfig,
  exportConfig,
  exportsAnything,
  jsonlSink,
  OTLP_TIMEOUT_MS,
  OTLP_URL_ENV,
  openSinks,
  otlpSink,
  startExport,
} from "./export.ts";
export {
  createKey,
  HeldActor,
  hashKey,
  isKeyExpired,
  KEY_PREFIX,
  KeyFileError,
  type KeyRecord,
  type KeyStore,
  keyStatus,
  listKeys,
  maskKey,
  openKeyStore,
  parseKey,
  readKeyFile,
  revokeKey,
  verifyKeyHash,
} from "./keys.ts";
export {
  appAuth,
  baseUrl,
  bindRefusal,
  isLoopbackAddress,
  isLoopbackHost,
  type Listening,
  type ListenOptions,
  LOOPBACK_HOSTS,
  listen,
  notLoopbackBound,
  type ServeAuth,
} from "./listen.ts";
export { openApiDocument } from "./openapi.ts";
export { API_PREFIX, type Method, ROUTES, type Route, type RouteContext } from "./routes.ts";
export { builtUi, UI_CSP, UI_DIST, uiFile, uiResponse } from "./static.ts";
export * from "./workspace.ts";
