// Store roots (decision D10, finding R7-1): pi's file tools are blocked on a
// path that resolves inside an adapter root (realpath where it exists, else
// the normalised absolute path, without case on Windows). A recursive tool
// (grep, find) is also blocked when a root lies inside what it searches.
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { storeRootOf, toolPaths } from "../../src/paths.ts";

let base: string;
let root: string;
let cwd: string;

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "engram-paths-"));
  root = join(base, "memory");
  cwd = join(base, "work");
  mkdirSync(root);
  mkdirSync(cwd);
  writeFileSync(join(root, "a.md"), "x");
});

const hit = (path: string | undefined, recursive = false) =>
  storeRootOf(path, { cwd, roots: [root], recursive });

describe("storeRootOf", () => {
  test("a file inside the root, absolute or relative, existing or not", () => {
    expect(hit(join(root, "a.md"))).toBe(root);
    expect(hit(join(root, "new.md"))).toBe(root);
    expect(hit("../memory/a.md")).toBe(root);
    expect(hit(`${cwd}/../memory/./a.md`)).toBe(root);
    expect(hit(root)).toBe(root);
    expect(hit(`@${join(root, "a.md")}`)).toBe(root);
  });

  test("a path outside the root, or a sibling that shares its prefix", () => {
    expect(hit(join(cwd, "notes.md"))).toBeUndefined();
    expect(hit(`${root}-backup/a.md`)).toBeUndefined();
    expect(hit(base)).toBeUndefined();
  });

  test("a recursive tool over a directory holding the root, or with no path from a cwd holding it", () => {
    expect(hit(base, true)).toBe(root);
    expect(storeRootOf(undefined, { cwd: base, roots: [root], recursive: true })).toBe(root);
    expect(hit(cwd, true)).toBeUndefined();
  });

  test("a symlink into the root resolves to it", () => {
    const link = join(cwd, "link");
    try {
      symlinkSync(root, link, "junction");
    } catch {
      return; // no symlink permission on this machine
    }
    expect(hit(join(link, "a.md"))).toBe(root);
    expect(hit("link/new.md")).toBe(root);
  });

  test.runIf(process.platform === "win32")("case does not matter on Windows", () => {
    expect(hit(join(root, "a.md").toUpperCase())).toBe(root);
    expect(hit(join(root, "a.md").replaceAll("\\", "/"))).toBe(root);
  });
});

describe("toolPaths", () => {
  test("pi's file tools and any tool with a path argument", () => {
    expect(toolPaths("read", { path: "a.md" })).toEqual({ paths: ["a.md"], recursive: false });
    expect(toolPaths("write", { path: "a.md", content: "x" }).paths).toEqual(["a.md"]);
    expect(toolPaths("edit", { path: "a.md", edits: [] }).paths).toEqual(["a.md"]);
    expect(toolPaths("ls", {})).toEqual({ paths: [undefined], recursive: false });
    expect(toolPaths("grep", { pattern: "x" })).toEqual({ paths: [undefined], recursive: true });
    expect(toolPaths("find", { pattern: "*", path: "d" })).toEqual({
      paths: ["d"],
      recursive: true,
    });
    expect(toolPaths("someone_elses_tool", { file_path: "f", paths: ["g", "h"] }).paths).toEqual([
      "f",
      "g",
      "h",
    ]);
    expect(toolPaths("memory_read", { query: "x" }).paths).toEqual([]);
  });
});
