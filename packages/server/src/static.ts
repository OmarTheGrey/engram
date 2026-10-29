// The inspector's files (card E8.5; plan docs/tasks/gate-b-plan.md, PR 4):
// `engram serve` serves the built UI (packages/ui/dist, written by `make ui`)
// at / beside the API. A path names a file inside that directory or nothing:
// it is decoded once, and refused when it holds a backslash, a NUL, a `.` or
// `..` segment, or a segment with a `:`; the file it names must resolve, links followed, inside the
// directory. A page path (no file extension) that names no file gets
// index.html, since the UI routes itself. Every response carries a
// Content-Security-Policy that keeps the page to its own origin: it loads
// its own scripts and styles and fetches only the API, no font, script or
// style from anywhere else.
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** The policy every inspector response carries. */
export const UI_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
};

/** Where `make ui` writes the inspector, beside this package. */
export const UI_DIST = fileURLToPath(new URL("../../ui/dist", import.meta.url));

/** `dir` when it holds a built inspector (an index.html), else null. */
export function builtUi(dir: string = UI_DIST): string | null {
  return existsSync(join(dir, "index.html")) ? dir : null;
}

const headers = (type: string, cache: string) => ({
  "content-type": type,
  "content-security-policy": UI_CSP,
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "cache-control": cache,
});

/**
 * Whether `pathname` is in the API's space: its first segment, decoded once
 * and compared without case, is `api` (so `/api`, `/API/v1/x`, `/api/v2/x`,
 * `/api%2fv1/x`), or any part of it decodes to a NUL (`/api%00/x`), which no
 * page has. Such a path is never answered with the inspector's page.
 */
export function isApiPath(pathname: string): boolean {
  let whole = pathname;
  try {
    whole = decodeURIComponent(pathname);
  } catch {
    // Compared as written below.
  }
  if (whole.includes("\0")) return true;
  const first = pathname.split("/")[1] ?? "";
  let decoded = first;
  try {
    decoded = decodeURIComponent(first);
  } catch {
    // An undecodable segment is compared as written.
  }
  return (decoded.split(/[/\\]/)[0] ?? "").toLowerCase() === "api";
}

/** The file under `root` that `pathname` names, or null; see the module comment. */
export function uiFile(root: string, pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes("\\") || decoded.includes("\0")) return null;
  const segments = decoded.split("/").filter((s) => s !== "");
  // A `:` would name a drive or an alternate data stream on Windows.
  if (segments.some((s) => s === "." || s === ".." || s.includes(":"))) return null;
  let base: string;
  try {
    base = realpathSync(resolve(root));
  } catch {
    return null;
  }
  const path = join(base, ...segments);
  if (!existsSync(path)) return null;
  const real = realpathSync(path);
  if (real !== base && !real.startsWith(base + sep)) return null;
  return statSync(real).isFile() ? real : null;
}

/** The response for a GET of `pathname` from the inspector in `root`; null when it names nothing. */
export function uiResponse(root: string, pathname: string, head = false): Response | null {
  let file = uiFile(root, pathname);
  const page = extname(pathname) === "";
  if (file === null && page) file = uiFile(root, "/index.html");
  if (file === null) return null;
  const type = TYPES[extname(file).toLowerCase()] ?? "application/octet-stream";
  const html = type.startsWith("text/html");
  const body = head ? null : readFileSync(file);
  return new Response(body, {
    status: 200,
    headers: headers(type, html ? "no-store" : "no-cache"),
  });
}
