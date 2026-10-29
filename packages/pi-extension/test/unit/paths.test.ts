// Store roots (decision D10, finding R7-1): pi's file tools are blocked on a
// path that resolves inside an adapter root (realpath where it exists, else
// the normalised absolute path, without case on Windows). A recursive tool
// (grep, find) is also blocked when a root lies inside what it searches.
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";
import { shellDrivePath, storeRootOf, toolPaths } from "../../src/paths.ts";

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

  test("path arguments nested at any depth, under a path key or as a path-like value (defect 4)", () => {
    const { paths } = toolPaths("someone_elses_tool", {
      options: { target: "t", deeper: [{ source_path: "s" }, { outFile: "o" }] },
      sources: [["../up/a.md"], "./here.md"],
      query: "/abs/a.md",
      win: "C:\\store\\a.md",
      unc: "\\\\host\\share\\a.md",
      home: "~/a.md",
      url: "file:///tmp/a.md",
    });
    expect(paths).toEqual(
      expect.arrayContaining([
        "t",
        "s",
        "o",
        "../up/a.md",
        "./here.md",
        "/abs/a.md",
        "C:\\store\\a.md",
        "\\\\host\\share\\a.md",
        "~/a.md",
        "file:///tmp/a.md",
      ]),
    );
    expect(paths).toHaveLength(10);
  });

  test("free text, code and words under other keys are not paths", () => {
    const { paths } = toolPaths("edit", {
      path: "a.md",
      edits: [{ oldText: "see /tmp/x for more", newText: "a/b\n/c/d" }],
      pattern: "src/**",
      content: "/* a comment */\nexport {};",
    });
    expect(paths).toEqual(["a.md"]);
  });

  test("a one-line value that looks like a path is checked, and blocks only inside a root", () => {
    const { paths } = toolPaths("write", { path: "a.md", content: "/* a comment */" });
    expect(paths).toEqual(["a.md", "/* a comment */"]);
    expect(hit("/* a comment */")).toBeUndefined();
  });
});

describe("shellDrivePath (defect 2)", () => {
  test("Git Bash, MSYS, Cygwin and WSL drive paths map to the Windows drive", () => {
    expect(shellDrivePath("/c/Users/x/a.md")).toBe("C:\\Users\\x\\a.md");
    expect(shellDrivePath("/C/Users")).toBe("C:\\Users");
    expect(shellDrivePath("/cygdrive/d/data/a.md")).toBe("D:\\data\\a.md");
    expect(shellDrivePath("/mnt/c/Users/x")).toBe("C:\\Users\\x");
    expect(shellDrivePath("/c")).toBe("C:\\");
    expect(shellDrivePath("/c/")).toBe("C:\\");
  });

  test("anything else is left alone", () => {
    expect(shellDrivePath("/usr/bin")).toBeUndefined();
    expect(shellDrivePath("//host/share")).toBeUndefined();
    expect(shellDrivePath("C:\\Users")).toBeUndefined();
    expect(shellDrivePath("rel/c/x")).toBeUndefined();
  });

  test.runIf(process.platform === "win32")(
    "on Windows a drive path in shell form reaches the root",
    () => {
      const shell = (p: string) =>
        p.replace(/^([A-Za-z]):/, (_, d: string) => `/${d.toLowerCase()}`);
      const file = join(root, "a.md").replaceAll("\\", "/");
      expect(hit(shell(file))).toBe(root);
      expect(hit(`/cygdrive${shell(file)}`)).toBe(root);
      expect(hit(`/mnt${shell(file)}`)).toBe(root);
      expect(hit(shell(join(base, "memory", "new.md").replaceAll("\\", "/")))).toBe(root);
      expect(hit(shell(join(cwd, "a.md").replaceAll("\\", "/")))).toBeUndefined();
    },
  );

  test("a file URL reaches the root, as pi's tools resolve it", () => {
    expect(hit(pathToFileURL(join(root, "a.md")).href)).toBe(root);
  });
});
