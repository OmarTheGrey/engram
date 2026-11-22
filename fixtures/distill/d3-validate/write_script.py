# Writes card D3's scripted agent, fixtures/distill/d3-validate/script.json, under the
# lead's rule of 2026-11-22: seeds 1 to 3, a passing or failing session per task, arm
# and seed. Run by hand from the repository root: python -I fixtures/distill/d3-validate/write_script.py
import json

tasks = {t["id"]: t for t in json.load(open("fixtures/distill/d3-validate/tasks.json", encoding="utf8"))["tasks"]}
H1, H2, H3, B06, H4, H5 = (
    "synthetic/rename-symbol-11",
    "synthetic/fix-failing-test-32",
    "synthetic/remove-dead-code-15",
    "synthetic/bump-timeout-06",
    "synthetic/bump-timeout-16",
    "synthetic/log-level-29",
)
MAIN = {H1: "src/rows.ts", H2: "src/totals.ts", H3: "src/format.ts", B06: "src/http.ts", H4: "src/fetch.ts", H5: "src/retry.ts"}
# An edit whose text is not in the file: it changes nothing, so the state check fails.
MISS = {
    H1: ("src/rows.ts", "function parseRows(", "function parseRecords("),
    H2: ("src/totals.ts", "reduce((a, b) => a + b)", "reduce((a, b) => a + b, 0)"),
    H3: ("src/format.ts", "export function legacyFormat() {}\n", ""),
    B06: ("src/fetch.ts", "timeout: 5", "timeout: 10"),
    H4: ("src/config.ts", "timeoutSeconds: 5", "timeoutSeconds: 10"),
    H5: ("src/log.ts", 'level: "debug"', 'level: "info"'),
}
E, I, C, T, R = (
    "edit-a-file-and-check-the-edit",
    "inspect-a-source-file-before-changing-it",
    "run-a-command-then-read-what-it-points-at",
    "raise-the-fetch-timeout-from-5-to-10-seconds",
    "rename-parserow-to-parserecord-everywhere",
)
# Success per seed 1, 2, 3 (1 = the session's final state is the gold state).
OUT = {
    None: {H1: "111", H2: "000", H3: "000", B06: "000", H4: "000", H5: "110"},
    E: {H1: "111", H2: "110", H3: "111", H4: "000", H5: "111"},
    I: {H1: "111", H2: "000", H3: "111", H4: "000", H5: "100"},
    C: {H1: "110", H2: "111", H3: "100", H4: "111", H5: "110"},
    T: {H1: "111", H2: "000", H3: "000", H4: "000", H5: "000"},
    R: {H2: "000", H3: "000", B06: "000", H4: "000", H5: "000"},
}

n = 0


def call(name, **a):
    global n
    n += 1
    return {"toolCall": {"id": f"call_{n}", "name": name, "arguments": a}}


def edits(task, ok):
    if ok:
        return [call("edit", **g["arguments"]) for g in tasks[task]["check"]["gold"]]
    path, old, new = MISS[task]
    return [call("edit", path=path, old=old, new=new)]


def first_command(task):
    cmds = list(tasks[task]["commands"])
    return cmds[0] if cmds else "npm test"


def steps(task, arm, ok):
    main = MAIN[task]
    if arm is None:
        body = edits(task, ok)
    elif arm == E:
        body = [*edits(task, ok), call("read", path=main)]
    elif arm == I:
        body = [call("read", path=main), *edits(task, ok)]
    elif arm == C:
        body = [call("bash", command=first_command(task)), call("read", path=main), *edits(task, ok)]
    elif arm == T:
        # Its steps read the files of its own induction session first.
        body = [call("read", path="src/config.ts"), call("read", path="src/fetch.ts"), *edits(task, ok)]
    elif arm == R:
        # Its steps read and edit src/load.ts, the file of its own induction session.
        lit = [call("read", path="src/load.ts"), call("read", path="src/load.ts")]
        body = [*lit, *(edits(task, ok) if ok else [call("edit", path="src/load.ts", old="parseRow", new="parseRecord")])]
    return [*body, {"text": "The change is made."}]


sessions = {}
for arm, by_task in OUT.items():
    for task, seeds in by_task.items():
        key = f"{task}/without" if arm is None else f"{task}/with/{arm}"
        for i, ok in enumerate(seeds):
            sessions[f"{key}@{i + 1}"] = steps(task, arm, ok == "1")

doc = {
    "_comment": "Card D3's scripted agent under the lead's rule of 2026-11-22: the steps of each replay session, keyed <task>/without@<seed> or <task>/with/<candidate skill name>@<seed>, seeds 1 to 3, answered only while make fixtures records the cassettes. A session passes (its final files are the gold edits' files) or fails (an edit whose text is not in the file changes nothing). The fixture asserts the pipeline, not a model: under 2/3 and no worse than the baseline, edit-a-file-and-check-the-edit passes 4 of 5 held-out tasks (one at 2 of 3 seeds), run-a-command-then-read-what-it-points-at 3 (its rename task reaches 2/3 but falls below a baseline of 1), inspect-a-source-file-before-changing-it 2, and the rule candidates, whose steps replay their own induction sessions' files, 1 and 0: the drift cases (SKILL.nb, Library Drift).",
    "sessions": sessions,
}
with open("fixtures/distill/d3-validate/script.json", "w", encoding="utf8", newline="\n") as f:
    f.write(json.dumps(doc, indent=2) + "\n")
print(len(sessions), "sessions")
