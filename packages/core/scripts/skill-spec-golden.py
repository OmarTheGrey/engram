"""The Agent Skills specification's own validator on card D2's SKILL.md cases.

Runs `skills_ref.validator.validate` (agentskills/agentskills, skills-ref,
Apache-2.0, commit 83021e2be457a9b6679148719c1f6074f0ad975e) on every case of
cases.json (hand-written) and emitted.json (what toSkillMd writes for the
sample items of packages/core/test/unit/distill/skill.test.ts), each written
as SKILL.md in a fresh directory named by the case's `dir`, and records the
errors it returns. Nothing from skills-ref is copied into this repository;
it is run, offline, at development time only:

    git clone https://github.com/agentskills/agentskills .engram/upstream/agentskills
    git -C .engram/upstream/agentskills checkout 83021e2be457a9b6679148719c1f6074f0ad975e
    (cd .engram/upstream/agentskills/skills-ref && uv sync --frozen --no-dev)
    .engram/upstream/agentskills/skills-ref/.venv/Scripts/python -I -X utf8 \
        packages/core/scripts/skill-spec-golden.py \
        --cases packages/core/test/unit/distill/skill-spec \
        --out packages/core/test/unit/distill/skill-spec/expected.json
    pnpm exec biome format --write packages/core/test/unit/distill/skill-spec/expected.json

(`.venv/bin/python` outside Windows.) `-X utf8` matters: skills-ref reads
SKILL.md with the platform's encoding, which is not UTF-8 on Windows, and
`-I` makes Python ignore PYTHONUTF8.
"""

from __future__ import annotations

import argparse
import json
import tempfile
from pathlib import Path

from skills_ref.validator import validate

UPSTREAM = {
    "repository": "https://github.com/agentskills/agentskills",
    "commit": "83021e2be457a9b6679148719c1f6074f0ad975e",
    "package": "skills-ref 0.1.0",
    "function": "skills_ref.validator.validate",
}


def run(cases: list[dict[str, str]]) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    with tempfile.TemporaryDirectory() as tmp:
        for i, case in enumerate(cases):
            root = Path(tmp) / str(i)
            skill = root / case["dir"]
            skill.mkdir(parents=True)
            (skill / "SKILL.md").write_bytes(case["text"].encode("utf-8"))
            if case["id"] in out:
                raise SystemExit(f"case id {case['id']} appears twice")
            out[case["id"]] = validate(skill)
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cases", required=True, help="the folder of cases.json and emitted.json")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    folder = Path(args.cases)
    cases: list[dict[str, str]] = []
    for name in ("cases.json", "emitted.json"):
        cases.extend(json.loads((folder / name).read_text(encoding="utf-8"))["cases"])
    result = {"upstream": UPSTREAM, "errors": run(cases)}
    Path(args.out).write_bytes(
        (json.dumps(result, indent=2, ensure_ascii=False, sort_keys=True) + "\n").encode("utf-8")
    )


if __name__ == "__main__":
    main()
