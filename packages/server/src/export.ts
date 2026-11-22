// Decision export (card E8.13, ADR 0043, proposed): every event appended to
// the log after the export starts, mapped by core's decisionSpan, sent to the
// sinks configured. Two sinks, both off unless named: a JSONL file (one span
// a line) and OTLP over HTTP (JSON encoding) to a collector. No webhook. The
// standard OTEL_* variables never turn an export on; once one is on, the
// OTLP exporter reads its headers and certificates from them, as any OTel
// exporter does. The spans carry no memory content (core's mapping and its
// content-free test); what does leave is listed in ADR 0043.
import { appendFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import {
  type Db,
  type DecisionSpan,
  decisionSpan,
  eventsAfter,
  GENAI_SEMCONV,
  lastSeq,
} from "@engram/core";
import { ROOT_CONTEXT, SpanKind, SpanStatusCode } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  type IdGenerator,
  SimpleSpanProcessor,
  type SpanExporter,
  TracerProvider,
} from "@opentelemetry/sdk-trace";
import { UsageError } from "./workspace.ts";

/** Names an OTLP traces endpoint when --otlp is not given, such as http://127.0.0.1:4318/v1/traces. */
export const OTLP_URL_ENV = "ENGRAM_OTLP_URL";
/** Names a JSONL file when --export-jsonl is not given. */
export const EXPORT_JSONL_ENV = "ENGRAM_EXPORT_JSONL";
/** How long one OTLP export may take before it is abandoned and reported. */
export const OTLP_TIMEOUT_MS = 5000;

/** Where decisions go: none of either unless the flag or its variable names one. */
export interface ExportConfig {
  /** The OTLP/HTTP traces endpoint, http or https. */
  otlp?: string;
  /** The JSONL file, absolute. */
  jsonl?: string;
}

/** A place spans go. `send` never throws for a remote failure; it reports it. */
export interface DecisionSink {
  readonly label: string;
  send(spans: readonly DecisionSpan[]): void;
  /** Sends what is pending and stops. */
  close(): Promise<void>;
}

/** The export: `flush` sends what the log gained since the last flush. */
export interface DecisionExport {
  readonly sinks: readonly DecisionSink[];
  flush(): void;
  close(): Promise<void>;
}

/**
 * The export configuration from the flags, else the variables; empty when
 * neither names a sink, which is the default. A bad URL is a UsageError.
 */
export function exportConfig(
  flags: { otlp?: string | undefined; "export-jsonl"?: string | undefined },
  env: Readonly<Record<string, string | undefined>>,
  cwd: string,
): ExportConfig {
  const config: ExportConfig = {};
  const otlp = flags.otlp ?? (env[OTLP_URL_ENV] || undefined);
  if (otlp !== undefined) {
    let url: URL;
    try {
      url = new URL(otlp);
    } catch {
      throw new UsageError(`--otlp ${otlp} is not a URL such as http://127.0.0.1:4318/v1/traces`);
    }
    if (url.protocol !== "http:" && url.protocol !== "https:")
      throw new UsageError(`--otlp ${otlp}: OTLP over HTTP takes an http or https URL`);
    config.otlp = url.href;
  }
  const jsonl = flags["export-jsonl"] ?? (env[EXPORT_JSONL_ENV] || undefined);
  if (jsonl !== undefined) config.jsonl = isAbsolute(jsonl) ? jsonl : resolve(cwd, jsonl);
  return config;
}

/** True when the configuration names any sink. */
export const exportsAnything = (config: ExportConfig) =>
  config.otlp !== undefined || config.jsonl !== undefined;

/** Appends one JSON span a line; the file is created owner-only where the system allows. */
export function jsonlSink(path: string): DecisionSink {
  return {
    label: `jsonl ${path}`,
    send(spans) {
      if (spans.length === 0) return;
      appendFileSync(path, spans.map((s) => `${JSON.stringify(s)}\n`).join(""), {
        encoding: "utf8",
        mode: 0o600,
      });
    },
    close: async () => undefined,
  };
}

/**
 * Sends spans to an OTLP/HTTP traces endpoint through the OpenTelemetry SDK:
 * one span per decision, ids, times, status and attributes as decisionSpan
 * gives them, the resource `service.name` engram and nothing else (no host,
 * process or command line), each exported as it ends. A failed export goes
 * to `onError`, never to the caller.
 */
export function otlpSink(
  url: string,
  onError: (e: unknown) => void = () => undefined,
): DecisionSink {
  // The ids of the next span, set just before it starts: startSpan asks for
  // the trace id and then the span id, synchronously.
  let next: { trace: string; span: string } | undefined;
  const ids: IdGenerator = {
    generateTraceId: () => next?.trace ?? "0".repeat(32),
    generateSpanId: () => next?.span ?? "0".repeat(16),
  };
  const inner = new OTLPTraceExporter({ url, timeoutMillis: OTLP_TIMEOUT_MS });
  const reporting: SpanExporter = {
    export(spans, done) {
      inner.export(spans, (result) => {
        // ExportResultCode.SUCCESS is 0.
        if (result.code !== 0) onError(result.error ?? new Error(`OTLP export to ${url} failed`));
        done(result);
      });
    },
    shutdown: () => inner.shutdown(),
    forceFlush: () => inner.forceFlush(),
  };
  const provider = new TracerProvider({
    resource: resourceFromAttributes({ "service.name": "engram" }),
    idGenerator: ids,
    spanProcessors: [new SimpleSpanProcessor({ exporter: reporting })],
  });
  const tracer = provider.getTracer("engram", undefined, {
    schemaUrl: `https://opentelemetry.io/schemas/${GENAI_SEMCONV.semconv.slice(1)}`,
  });
  return {
    label: `otlp ${url}`,
    send(spans) {
      for (const s of spans) {
        next = { trace: s.trace_id, span: s.span_id };
        const span = tracer.startSpan(
          s.name,
          { kind: SpanKind.INTERNAL, startTime: new Date(s.start_time), attributes: s.attributes },
          ROOT_CONTEXT,
        );
        next = undefined;
        if (s.status === "error") span.setStatus({ code: SpanStatusCode.ERROR });
        span.end(new Date(s.end_time));
      }
    },
    close: () => provider.shutdown(),
  };
}

/** The sinks a configuration names, JSONL first. */
export function openSinks(config: ExportConfig, onError?: (e: unknown) => void): DecisionSink[] {
  const sinks: DecisionSink[] = [];
  if (config.jsonl !== undefined) sinks.push(jsonlSink(config.jsonl));
  if (config.otlp !== undefined) sinks.push(otlpSink(config.otlp, onError));
  return sinks;
}

/**
 * Starts an export over `db` at the log's head: only events appended after
 * this call are sent, whichever handle of the log appended them. A sink
 * that throws (a JSONL file that cannot be written) goes to `onError` and
 * the others still get the spans.
 */
export function startExport(
  db: Db,
  sinks: readonly DecisionSink[],
  onError: (e: unknown) => void = () => undefined,
): DecisionExport {
  let cursor = lastSeq(db);
  return {
    sinks,
    flush() {
      const events = eventsAfter(db, cursor);
      if (events.length === 0) return;
      cursor = (events.at(-1) as (typeof events)[number]).seq;
      const spans = events.map(decisionSpan);
      for (const sink of sinks) {
        try {
          sink.send(spans);
        } catch (e) {
          onError(e);
        }
      }
    },
    async close() {
      await Promise.all(sinks.map((s) => s.close().catch(onError)));
    },
  };
}
