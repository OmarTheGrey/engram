"""Card X16: the gate mutation audit, killed and surviving mutants per invariant.

Usage:
    uv run python research/scripts/gate_mutation_audit.py \\
        --config research/configs/gate-mutation-audit.json \\
        --out research/results/h1-gate-mutation-audit.json

Each file in the config's `mutants` folder (fixtures/mutants/) is one
hand-written mutant of the write gate, the read filter, retention,
promotion, adoption, offboarding, the trust floors or the log's chain: one
exact substitution (`find` to `replace`) in one source file, and the
invariant whose test must kill it. The config names each invariant's test
(a file and the test's exact name). The script:

1. refuses to start when a tracked file under the audited paths has
   uncommitted changes: the audit is of the committed code;
2. copies the tracked files into a scratch folder outside the repository and
   gives it the repository's installed dependencies by links (a workspace
   package's link points into the copy, so the copy's packages import each
   other's mutated source); the working tree is never edited;
3. runs every invariant's test once on the unmutated copy: each must pass,
   or the run stops (a kill on code already red proves nothing);
4. for each mutant, checks that `find` occurs exactly once in its file,
   applies it in the copy, runs that one test, and restores the file
   whatever happens, checking its bytes are back and the working tree's
   status is what it was before the run;
5. counts a red run as a kill only when an assertion failed: a red run from
   a crash, a module that does not load, a timeout, or a filter that did not
   select exactly the named test is could-not-tell, and stops the run with
   an error, since it says nothing about the test;
6. fails unless every invariant of the config has at least one killed
   mutant; survivors are listed, never hidden.

No model is called and nothing leaves the machine. The result serves no
hypothesis ("hypothesis": "none"): it is a proof of concept on the code's own
property tests, an engineering check of card X16, and it takes the `h1-`
prefix only because test_prereg.py requires one. It is slow (the
invariants' property tests, about ten to twenty minutes on one worker) and
`make test-repro` runs it; CI does not.
"""

# The guards are ported from plur-ai/plur (https://github.com/plur-ai/plur),
# commit 7c6aa73ba14e933709c92c45495b52577218b866, `.evals/bite.py`, Apache
# License 2.0, Copyright 2026 PLUR (plur.ai): the test must be green without
# the mutant, the mutant must apply, the file is restored whatever happens,
# and only a failed assertion counts as a kill (a crash, a timeout or a broken
# run is could-not-tell). Changed here: an exact substitution in place of a
# patch, a scratch copy in place of editing a clean checkout, could-not-tell
# fatal rather than reported, a baseline failure fatal rather than waiting,
# and the tree's status checked after every mutant.

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from scripts.results_io import REPO, load_config, write_result

VERDICTS = ("killed", "survived")
TIMED_OUT = re.compile(r"Test timed out|timed out in \d+ms|Hook timed out", re.I)
MUTANT_KEYS = {"id", "invariant", "area", "file", "find", "replace", "what"}
OPTIONAL_KEYS = {"note"}


class AuditError(RuntimeError):
    """The audit cannot vouch for a verdict: a guard failed."""


@dataclass(frozen=True)
class Invariant:
    id: str
    file: str
    name: str


@dataclass(frozen=True)
class Mutant:
    id: str
    invariant: str
    area: str
    file: str
    find: str
    replace: str
    what: str
    note: str | None = None


@dataclass(frozen=True)
class Outcome:
    """One run of one test: passed, failed by an assertion, or could-not-tell with why."""

    status: str  # passed | assertion | could-not-tell
    detail: str = ""


def load_invariants(config: Mapping[str, Any]) -> dict[str, Invariant]:
    out: dict[str, Invariant] = {}
    for row in config["invariants"]:
        inv = Invariant(row["id"], row["file"], row["name"])
        if inv.id in out:
            raise AuditError(f"invariant {inv.id} is named twice in the config")
        out[inv.id] = inv
    return out


def load_mutants(folder: Path) -> list[Mutant]:
    """Every mutant file in `folder`, sorted by id; each is checked for its fields."""
    mutants: list[Mutant] = []
    for path in sorted(folder.glob("*.json")):
        raw = json.loads(path.read_text(encoding="utf-8"))
        keys = set(raw)
        if not MUTANT_KEYS <= keys or not keys <= MUTANT_KEYS | OPTIONAL_KEYS:
            raise AuditError(
                f"{path.name}: a mutant has exactly the fields {sorted(MUTANT_KEYS)}"
                f" (and optionally {sorted(OPTIONAL_KEYS)}); it has {sorted(keys)}"
            )
        if raw["id"] != path.stem:
            raise AuditError(f"{path.name}: its id {raw['id']!r} is not its file name")
        if raw["find"] == raw["replace"]:
            raise AuditError(f"{path.name}: find and replace are equal, so nothing is mutated")
        mutants.append(Mutant(**raw))
    ids = [m.id for m in mutants]
    if len(set(ids)) != len(ids):
        raise AuditError("two mutants share an id")
    return sorted(mutants, key=lambda m: m.id)


def check_mutant(m: Mutant, text: str, invariants: Mapping[str, Invariant]) -> None:
    """The mutant names a known invariant and its find string occurs exactly once in `text`."""
    if m.invariant not in invariants:
        raise AuditError(f"mutant {m.id}: invariant {m.invariant} is not in the config")
    count = text.count(m.find)
    if count != 1:
        raise AuditError(
            f"mutant {m.id}: its find string occurs {count} times in {m.file}, not once;"
            " the code moved, so the frozen mutant must be rewritten against it"
        )


def apply_mutant(m: Mutant, text: str) -> str:
    return text.replace(m.find, m.replace, 1)


# The reporter the copy's vitest runs with, written into the copy (never into
# the repository). Vitest's own JSON reporter keeps only an error's stack,
# and fast-check reports a failed property as an Error whose `cause` is what
# the predicate threw, so the stack alone cannot tell an assertion from a
# crash. This one writes every error as its chain of causes, name and message.
REPORTER = """\
import { writeFileSync } from "node:fs";

const chain = (e) => {
  const out = [];
  for (let c = e, d = 0; c && d < 8; c = c.cause, d++)
    out.push({ name: String(c.name ?? ""), message: String(c.message ?? "").slice(0, 4000) });
  return out;
};

export default class MutationReporter {
  onTestRunEnd(modules, unhandled) {
    const report = {
      unhandled: (unhandled ?? []).map(chain),
      modules: modules.map((m) => ({
        errors: m.errors().map(chain),
        tests: [...m.children.allTests()].map((t) => {
          const r = t.result();
          return { name: t.name, state: r.state, errors: (r.errors ?? []).map(chain) };
        }),
      })),
    };
    writeFileSync(process.env.ENGRAM_MUTATION_REPORT, JSON.stringify(report));
  }
}
"""

# What counts as a failed assertion in an error's chain: vitest's expect, or a
# fast-check predicate that returned false.
PROPERTY_FALSE = re.compile(r"Property failed by returning false")


def _is_assertion(error: Mapping[str, Any]) -> bool:
    return error.get("name") == "AssertionError" or bool(
        PROPERTY_FALSE.search(str(error.get("message", "")))
    )


def classify(report: Mapping[str, Any] | None, inv: Invariant) -> Outcome:
    """What one run's report says of the one test it should have run."""
    if report is None:
        return Outcome("could-not-tell", "vitest wrote no report")
    if report.get("unhandled"):
        return Outcome("could-not-tell", "the run had an unhandled error")
    modules = report.get("modules", [])
    if any(m.get("errors") for m in modules):
        return Outcome("could-not-tell", "the test file failed outside any test (did not load)")
    ran = [t for m in modules for t in m.get("tests", []) if t.get("state") in ("passed", "failed")]
    if len(ran) != 1 or ran[0].get("name") != inv.name:
        names = sorted(str(t.get("name")) for t in ran)
        return Outcome(
            "could-not-tell", f"the filter ran {len(ran)} tests, not exactly {inv.id}'s: {names}"
        )
    test = ran[0]
    if test.get("state") == "passed":
        return Outcome("passed")
    errors = [e for c in test.get("errors", []) for e in c]
    if any(TIMED_OUT.search(str(e.get("message", ""))) for e in errors):
        return Outcome("could-not-tell", "the test timed out")
    if any(_is_assertion(e) for e in errors):
        return Outcome("assertion")
    first = errors[-1] if errors else {"name": "", "message": "no error recorded"}
    line = (str(first.get("message", "")).splitlines() or [""])[0]
    text = f"{first.get('name')}: {line[:200]}"
    return Outcome("could-not-tell", f"red, but not from an assertion: {text}")


JS_SPECIAL = re.compile(r"[.*+?^${}()|\[\]\\/]")


def js_pattern(name: str) -> str:
    """A JavaScript regular expression matching `name` literally at the end of the full test name."""
    return JS_SPECIAL.sub(lambda m: "\\" + m.group(0), name) + "$"


def summarise(
    mutants: Sequence[Mutant],
    verdicts: Mapping[str, str],
    invariants: Mapping[str, Invariant],
) -> dict[str, Any]:
    """The result body's counts: per mutant, per invariant, per area and in total."""
    rows = []
    for m in mutants:
        row: dict[str, Any] = {
            "id": m.id,
            "invariant": m.invariant,
            "area": m.area,
            "file": m.file,
            "what": m.what,
            "verdict": verdicts[m.id],
        }
        if m.note is not None:
            row["note"] = m.note
        rows.append(row)

    def counts(group: Sequence[Mutant]) -> dict[str, Any]:
        killed = [m.id for m in group if verdicts[m.id] == "killed"]
        survived = [m.id for m in group if verdicts[m.id] == "survived"]
        return {
            "mutants": len(group),
            "killed": len(killed),
            "survived": len(survived),
            "survivors": survived,
            "kill_rate": len(killed) / len(group) if group else None,
        }

    per_invariant = {}
    for inv in invariants.values():
        group = [m for m in mutants if m.invariant == inv.id]
        per_invariant[inv.id] = {"test": {"file": inv.file, "name": inv.name}, **counts(group)}
    areas = sorted({m.area for m in mutants})
    per_area = {a: counts([m for m in mutants if m.area == a]) for a in areas}
    return {
        "mutants": rows,
        "per_invariant": per_invariant,
        "per_area": per_area,
        "totals": counts(list(mutants)),
    }


def every_invariant_bites(summary: Mapping[str, Any]) -> list[str]:
    """The invariants with no killed mutant; the audit fails unless this is empty."""
    return sorted(i for i, row in summary["per_invariant"].items() if row["killed"] == 0)


# The scratch copy.


def _git(args: Sequence[str]) -> str:
    out = subprocess.run(["git", *args], cwd=REPO, capture_output=True, check=True)
    return out.stdout.decode("utf-8")


def tree_status() -> str:
    """The working tree's status, untracked files included: it must not change during the run."""
    return _git(["status", "--porcelain=v1", "--untracked-files=all"])


def tracked_files(exclude: Sequence[str]) -> list[str]:
    files = [f for f in _git(["ls-files", "-z"]).split("\0") if f]
    return [f for f in files if not any(f == e or f.startswith(e + "/") for e in exclude)]


def _link(target: Path, link: Path) -> None:
    """A directory link: a junction on Windows (no privilege needed), a symlink elsewhere."""
    if os.name == "nt":
        import _winapi

        _winapi.CreateJunction(str(target), str(link))
    else:
        os.symlink(target, link, target_is_directory=True)


def _unlink(link: Path) -> None:
    if os.name == "nt":
        os.rmdir(link)  # removes the junction itself, never what it points at
    else:
        os.unlink(link)


class Scratch:
    """A copy of the tracked files outside the repository, with links to the installed dependencies."""

    def __init__(self, exclude: Sequence[str]) -> None:
        self.root = Path(tempfile.mkdtemp(prefix="engram-mutants-"))
        self.links: list[Path] = []
        try:
            files = tracked_files(exclude)
            for rel in files:
                src = REPO / rel
                if not src.is_file():
                    continue
                dst = self.root / rel
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(src, dst)
            packages = ["."] + sorted(
                str(Path(f).parent).replace("\\", "/")
                for f in files
                if f.endswith("/package.json") and (REPO / Path(f).parent / "node_modules").is_dir()
            )
            for pkg in packages:
                self._mirror(pkg)
        except BaseException:
            self.close()
            raise

    def _remap(self, target: Path) -> Path:
        """A link into the repository's own packages points at the copy's; any other stays."""
        real = REPO.resolve()
        try:
            rel = target.relative_to(real)
        except ValueError:
            return target
        return target if "node_modules" in rel.parts else self.root / rel

    def _mirror(self, pkg: str) -> None:
        src = REPO / pkg / "node_modules"
        dst = self.root / pkg / "node_modules"
        dst.mkdir(parents=True, exist_ok=True)
        for entry in sorted(src.iterdir(), key=lambda p: p.name):
            if entry.name.startswith(".") and entry.name != ".pnpm":
                continue
            if entry.name.startswith("@") and not _is_link(entry):
                scope = dst / entry.name
                scope.mkdir(exist_ok=True)
                for sub in sorted(entry.iterdir(), key=lambda p: p.name):
                    self._add(sub, scope / sub.name)
            else:
                self._add(entry, dst / entry.name)

    def _add(self, entry: Path, link: Path) -> None:
        target = self._remap(entry.resolve())
        if not target.is_dir():
            return
        _link(target, link)
        self.links.append(link)

    def close(self) -> None:
        for link in reversed(self.links):
            if link.exists() or _is_link(link):
                _unlink(link)
        self.links.clear()
        shutil.rmtree(self.root, ignore_errors=True)


def _is_link(path: Path) -> bool:
    return path.is_symlink() or (hasattr(os.path, "isjunction") and os.path.isjunction(path))


def vitest_runner(
    copy: Path, env_extra: Mapping[str, str], timeout_s: int
) -> Callable[[Invariant], Outcome]:
    """Runs one invariant's test in the copy and classifies its report."""
    entry = copy / "node_modules" / "vitest" / "vitest.mjs"
    reporter = copy / ".mutation-reporter.mjs"
    reporter.write_text(REPORTER, encoding="utf-8", newline="\n")
    out = copy / ".mutation-report.json"
    env = {**os.environ, **env_extra, "ENGRAM_MUTATION_REPORT": str(out)}
    env.pop("ENGRAM_INVARIANTS", None)

    def run(inv: Invariant) -> Outcome:
        out.unlink(missing_ok=True)
        args = [
            "node",
            str(entry),
            "run",
            inv.file,
            "-t",
            js_pattern(inv.name),
            f"--reporter={reporter.as_posix()}",
        ]
        try:
            subprocess.run(
                args, cwd=copy, env=env, capture_output=True, timeout=timeout_s, check=False
            )
        except subprocess.TimeoutExpired:
            return Outcome("could-not-tell", f"the run passed its {timeout_s} s timeout")
        report = json.loads(out.read_text(encoding="utf-8")) if out.exists() else None
        return classify(report, inv)

    return run


def audit(
    mutants: Sequence[Mutant],
    invariants: Mapping[str, Invariant],
    copy: Path,
    run: Callable[[Invariant], Outcome],
    status: Callable[[], str],
    log: Callable[[str], None] = print,
) -> dict[str, str]:
    """The verdict of every mutant; raises AuditError when a guard fails."""
    before = status()
    for m in mutants:
        check_mutant(m, (copy / m.file).read_text(encoding="utf-8"), invariants)
    used = sorted({m.invariant for m in mutants} | set(invariants))
    for inv_id in used:
        outcome = run(invariants[inv_id])
        log(f"gate-mutation-audit: baseline {inv_id} {outcome.status} {outcome.detail}".rstrip())
        if outcome.status != "passed":
            raise AuditError(
                f"baseline: {inv_id}'s test is not green on the unmutated code"
                f" ({outcome.status}: {outcome.detail}); a kill on red code proves nothing"
            )
    verdicts: dict[str, str] = {}
    for m in mutants:
        path = copy / m.file
        original = path.read_bytes()
        digest = hashlib.sha256(original).hexdigest()
        text = original.decode("utf-8")
        check_mutant(m, text, invariants)
        try:
            path.write_bytes(apply_mutant(m, text).encode("utf-8"))
            outcome = run(invariants[m.invariant])
        finally:
            path.write_bytes(original)
        if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            raise AuditError(f"mutant {m.id}: {m.file} was not restored in the copy")
        if status() != before:
            raise AuditError(f"mutant {m.id}: the working tree's status changed during the run")
        if outcome.status == "could-not-tell":
            raise AuditError(f"mutant {m.id}: could not tell ({outcome.detail})")
        verdicts[m.id] = "killed" if outcome.status == "assertion" else "survived"
        log(f"gate-mutation-audit: {m.id} {verdicts[m.id]}")
    return verdicts


def result_body(
    config: Mapping[str, Any], mutants: Sequence[Mutant], verdicts: Mapping[str, str]
) -> dict[str, Any]:
    invariants = load_invariants(config)
    summary = summarise(mutants, verdicts, invariants)
    return {
        "name": config["name"],
        "card": config["card"],
        "hypothesis": "none",
        "status": "proof of concept",
        "wording": config["wording"],
        "guards": config["guards"],
        **summary,
    }


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    config = load_config(args.config)
    if config.get("hypothesis") != "none" or config.get("status") != "proof of concept":
        raise AuditError('the config must say "hypothesis": "none" and "status": "proof of concept"')
    invariants = load_invariants(config)
    mutants = load_mutants(REPO / config["mutants"])
    dirty = _git(["status", "--porcelain=v1", "--untracked-files=no", "--", *config["audited"]])
    if dirty.strip():
        raise AuditError(f"tracked files under {config['audited']} have uncommitted changes:\n{dirty}")
    scratch = Scratch(config["copy_exclude"])
    try:
        run = vitest_runner(scratch.root, config["env"], int(config["run_timeout_s"]))
        verdicts = audit(
            mutants, invariants, scratch.root, run, tree_status, lambda s: print(s, flush=True)
        )
    finally:
        scratch.close()
    body = result_body(config, mutants, verdicts)
    toothless = every_invariant_bites(body)
    if toothless:
        raise AuditError(f"no mutant of {toothless} was killed; every invariant needs one")
    write_result(args.out, body)
    totals = body["totals"]
    print(
        f"gate-mutation-audit: {totals['killed']} of {totals['mutants']} mutants killed;"
        f" survivors {totals['survivors']}",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AuditError as e:
        print(f"gate-mutation-audit: {e}", file=sys.stderr)
        raise SystemExit(1) from e
