"""The content guard's coverage and false-positive rate (card E2.9, ADR 0039).

Usage:
    uv run python research/scripts/secret_guard.py \\
        --config research/configs/secret-guard.json \\
        --out research/results/secret-guard.json

Three sets of texts, every one synthetic or already public in this repository
(rule 12: nothing from dogfood, and no real secret):

- `synthetic`: secrets and personal data of each kind the guard names, drawn
  from the config's seed in the issuer's shape (a card number passing Luhn, an
  IBAN passing mod-97), each set in a sentence. Coverage: the share found at
  all, at the expected tier, and under an expected kind.
- `benign`: the repository's own documentation and source at a pinned commit
  (`git cat-file`, so later edits do not move the result), split into
  paragraphs, test folders, vendored and generated files left out. The
  false-positive rate: the share of paragraphs a guard would deny (a BLOCK-tier
  match) and the share it would hold (REVIEW-tier matches only), with both
  guards on and in `block`.
- `identifiers`: generated technical identifiers that are not secrets (git
  SHAs, UUIDs, uuidv7 ids, Engram content hashes, cloud IAM action names and
  ARNs, package integrity hashes, timestamps), each in a sentence.

The detector is TypeScript (packages/core/src/policy/secrets.ts) and is not
reimplemented here: packages/core/scripts/secret-guard.ts scans each text and
writes back kinds, tiers and lengths, never a value. The result holds counts,
rates with 95 percent Wilson intervals, and the paths of the benign
paragraphs flagged, never their text.
"""

from __future__ import annotations

import argparse
import json
import random
import re
import string
import subprocess
import tempfile
from collections import Counter
from collections.abc import Callable, Mapping, Sequence
from pathlib import Path
from typing import Any

from analysis.wilson import wilson
from scripts.results_io import REPO, load_config, run_node, write_result

ENTRY = "packages/core/scripts/secret-guard.ts"

ALNUM = string.ascii_letters + string.digits
UPPER_DIGIT = string.ascii_uppercase + "234567"
HEX = "0123456789abcdef"
B64URL = ALNUM + "-_"


def draw(rng: random.Random, alphabet: str, n: int) -> str:
    return "".join(rng.choice(alphabet) for _ in range(n))


def luhn_ok(digits: str) -> bool:
    total = 0
    for i, ch in enumerate(reversed(digits)):
        d = int(ch)
        if i % 2 == 1:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return total % 10 == 0


def card(rng: random.Random) -> str:
    prefix, length = rng.choice([("4", 16), ("51", 16), ("55", 16), ("37", 15), ("6011", 16)])
    body = prefix + draw(rng, string.digits, length - len(prefix) - 1)
    check = next(c for c in string.digits if luhn_ok(body + c))
    number = body + check
    if length == 16 and rng.random() < 0.5:
        return " ".join(number[i : i + 4] for i in range(0, 16, 4))
    return number


def iban(rng: random.Random) -> str:
    country, body = rng.choice(
        [
            ("DE", draw(rng, string.digits, 18)),
            ("GB", draw(rng, string.ascii_uppercase, 4) + draw(rng, string.digits, 14)),
            ("FR", draw(rng, string.digits, 23)),
            ("NL", draw(rng, string.ascii_uppercase, 4) + draw(rng, string.digits, 10)),
        ]
    )
    for c in range(2, 99):
        candidate = f"{country}{c:02d}{body}"
        moved = candidate[4:] + candidate[:4]
        if int("".join(str(int(ch, 36)) for ch in moved)) % 97 == 1:
            return candidate
    raise AssertionError("no check digits")


def jwt(rng: random.Random) -> str:
    return ".".join(
        ["eyJ" + draw(rng, B64URL, 30), "eyJ" + draw(rng, B64URL, 60), draw(rng, B64URL, 43)]
    )


def pem(rng: random.Random) -> str:
    body = "\n".join(draw(rng, ALNUM + "+/", 64) for _ in range(4))
    return f"-----BEGIN RSA PRIVATE KEY-----\n{body}\n-----END RSA PRIVATE KEY-----"


def url_credentials(rng: random.Random) -> str:
    scheme = rng.choice(["postgres", "mysql", "redis", "https", "amqp"])
    user = draw(rng, string.ascii_lowercase, 6)
    password = draw(rng, ALNUM, rng.randint(8, 16))
    return f"{scheme}://{user}:{password}@db.internal:5432/app"


def ssn(rng: random.Random) -> str:
    return f"{rng.randint(100, 665)}-{rng.randint(10, 99)}-{rng.randint(1000, 9999)}"


def nino(rng: random.Random) -> str:
    letters = "ABCEGHJKLMNPRSTWXYZ"
    pairs = " ".join(str(rng.randint(10, 99)) for _ in range(3))
    return f"{rng.choice(letters)}{rng.choice(letters)} {pairs} {rng.choice('ABCD')}"


def email(rng: random.Random) -> str:
    return (
        f"{draw(rng, string.ascii_lowercase, 6)}.{draw(rng, string.ascii_lowercase, 5)}@example.org"
    )


def phone(rng: random.Random) -> str:
    return rng.choice(
        [
            f"+44 20 {rng.randint(1000, 9999)} {rng.randint(1000, 9999)}",
            f"({rng.randint(201, 989)}) 555-{rng.randint(1000, 9999)}",
            f"+1 {rng.randint(201, 989)} 555 {rng.randint(1000, 9999)}",
        ]
    )


# kind: (generator, expected tier, kinds that count as named correctly)
Generator = Callable[[random.Random], str]
SYNTHETIC: dict[str, tuple[Generator, str, tuple[str, ...]]] = {
    "aws-access-key": (
        lambda r: "AKIA" + draw(r, UPPER_DIGIT, 16),
        "block",
        ("secret/aws-access-key", "secret/gitleaks/aws-access-token"),
    ),
    "github-token": (
        lambda r: "ghp_" + draw(r, ALNUM, 36),
        "block",
        ("secret/github-token", "secret/gitleaks/github-pat"),
    ),
    "github-fine-grained-pat": (
        lambda r: "github_pat_" + draw(r, ALNUM + "_", 82),
        "block",
        ("secret/github-token", "secret/gitleaks/github-fine-grained-pat"),
    ),
    "openai-project-key": (
        lambda r: "sk-proj-" + draw(r, B64URL, 48),
        "block",
        ("secret/openai-key", "secret/gitleaks/openai-api-key"),
    ),
    "anthropic-key": (
        lambda r: "sk-ant-api03-" + draw(r, B64URL, 93) + "AA",
        "block",
        ("secret/anthropic-key", "secret/gitleaks/anthropic-api-key"),
    ),
    "stripe-key": (
        lambda r: "sk_live_" + draw(r, ALNUM, 24),
        "block",
        ("secret/stripe-key", "secret/gitleaks/stripe-access-token"),
    ),
    "slack-token": (
        lambda r: (
            f"xoxb-{draw(r, string.digits, 12)}-{draw(r, string.digits, 12)}-{draw(r, ALNUM, 24)}"
        ),
        "block",
        ("secret/slack-token", "secret/gitleaks/slack-bot-token"),
    ),
    "google-api-key": (
        lambda r: "AIza" + draw(r, B64URL, 35),
        "block",
        ("secret/google-api-key", "secret/gitleaks/gcp-api-key"),
    ),
    "gitlab-token": (
        lambda r: "glpat-" + draw(r, B64URL, 20),
        "block",
        ("secret/gitlab-token", "secret/gitleaks/gitlab-pat"),
    ),
    "npm-token": (
        lambda r: "npm_" + draw(r, ALNUM, 36),
        "block",
        ("secret/npm-token", "secret/gitleaks/npm-access-token"),
    ),
    "huggingface-token": (
        lambda r: "hf_" + draw(r, string.ascii_letters, 34),
        "block",
        ("secret/huggingface-token", "secret/gitleaks/huggingface-access-token"),
    ),
    "sendgrid-key": (
        lambda r: f"SG.{draw(r, B64URL, 22)}.{draw(r, B64URL, 43)}",
        "block",
        ("secret/sendgrid-key", "secret/gitleaks/sendgrid-api-token"),
    ),
    "jwt": (jwt, "block", ("secret/jwt", "secret/gitleaks/jwt")),
    "private-key": (pem, "block", ("secret/private-key", "secret/gitleaks/private-key")),
    "url-credentials": (url_credentials, "block", ("secret/url-credentials",)),
    "payment-card": (card, "block", ("pii/payment-card",)),
    "iban": (iban, "block", ("pii/iban",)),
    "us-ssn": (ssn, "block", ("pii/us-ssn",)),
    "uk-nino": (nino, "block", ("pii/uk-nino",)),
    "email": (email, "review", ("pii/email",)),
    "phone": (phone, "review", ("pii/phone",)),
    "hex-near-keyword": (
        lambda r: "api secret: " + draw(r, HEX, 64),
        "review",
        ("secret/hex-near-keyword",),
    ),
    "high-entropy": (
        lambda r: (
            draw(r, string.ascii_lowercase, 2)
            + draw(r, string.ascii_uppercase, 2)
            + draw(r, string.digits, 2)
            + draw(r, ALNUM + "+/", 42)
        ),
        "review",
        ("secret/high-entropy",),
    ),
    "generic-password": (
        lambda r: "DB_PASSWORD=" + draw(r, ALNUM, 14),
        "review",
        ("secret/generic-password", "secret/gitleaks/generic-api-key"),
    ),
}

TEMPLATES = (
    "Remember that {s} is the one for staging.",
    "note: {s}",
    "The value we use in CI is {s}, keep it handy.",
    "{s}",
)

IAM_ACTIONS = (
    "s3:GetObject",
    "s3:PutObjectAcl",
    "iam:PassRole",
    "sts:AssumeRoleWithWebIdentity",
    "kms:GenerateDataKeyWithoutPlaintext",
    "secretsmanager:GetSecretValue",
    "ssm:GetParametersByPath",
    "ec2:DescribeInstances",
    "dynamodb:BatchWriteItem",
    "lambda:InvokeFunction",
    "logs:CreateLogStream",
    "ecr:GetAuthorizationToken",
)


def uuid(rng: random.Random, version: str) -> str:
    h = draw(rng, HEX, 32)
    variant = rng.choice("89ab")
    return f"{h[:8]}-{h[8:12]}-{version}{h[13:16]}-{variant}{h[17:20]}-{h[20:]}"


IDENTIFIERS: dict[str, Generator] = {
    "git-sha": lambda r: f"commit {draw(r, HEX, 40)} fixed the build",
    "short-git-sha": lambda r: f"see {draw(r, HEX, 7)} and {draw(r, HEX, 12)}",
    "uuid": lambda r: f"request {uuid(r, '4')} failed",
    "uuidv7": lambda r: f"item 0195{uuid(r, '7')[4:]} was retired",
    "content-hash": lambda r: f"its provenance hash is sha256:{draw(r, HEX, 64)}",
    "iam-action": lambda r: f"the role needs {r.choice(IAM_ACTIONS)} and {r.choice(IAM_ACTIONS)}",
    "arn": lambda r: (
        f"assume arn:aws:iam::{draw(r, string.digits, 12)}:role/"
        f"deploy-{draw(r, string.ascii_lowercase, 5)}"
    ),
    "integrity": lambda r: f'"integrity": "sha512-{draw(r, ALNUM + "+/", 86)}=="',
    "timestamp": lambda r: (
        f"at 2026-{r.randint(1, 12):02d}-{r.randint(1, 28):02d}"
        f"T{r.randint(0, 23):02d}:{r.randint(0, 59):02d}:00Z"
    ),
}


def synthetic_texts(rng: random.Random, per_kind: int) -> list[dict[str, str]]:
    out = []
    for kind, (make, _tier, _kinds) in SYNTHETIC.items():
        for i in range(per_kind):
            out.append(
                {"id": f"synthetic/{kind}/{i}", "text": rng.choice(TEMPLATES).format(s=make(rng))}
            )
    return out


def identifier_texts(rng: random.Random, per_shape: int) -> list[dict[str, str]]:
    return [
        {"id": f"identifiers/{shape}/{i}", "text": make(rng)}
        for shape, make in IDENTIFIERS.items()
        for i in range(per_shape)
    ]


def corpus_files(benign: Mapping[str, Any]) -> list[str]:
    """The benign corpus's paths at the pinned commit, sorted."""
    listed = subprocess.run(
        ["git", "ls-tree", "-r", "--name-only", str(benign["commit"]), "--", *benign["include"]],
        cwd=REPO,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.splitlines()
    return sorted(
        p
        for p in listed
        if p.endswith(tuple(benign["suffixes"])) and not any(x in p for x in benign["exclude"])
    )


def blobs(commit: str, paths: Sequence[str]) -> dict[str, str]:
    """Every path's text at the commit, through one `git cat-file --batch`."""
    request = "".join(f"{commit}:{p}\n" for p in paths).encode("utf-8")
    raw = subprocess.run(
        ["git", "cat-file", "--batch"], cwd=REPO, input=request, check=True, capture_output=True
    ).stdout
    out: dict[str, str] = {}
    pos = 0
    for p in paths:
        header_end = raw.index(b"\n", pos)
        size = int(raw[pos:header_end].split()[2])
        out[p] = raw[header_end + 1 : header_end + 1 + size].decode("utf-8")
        pos = header_end + 1 + size + 1
    return out


def paragraphs(text: str, min_chars: int) -> list[str]:
    return [
        c for c in re.split(r"\n\s*\n", text.replace("\r\n", "\n")) if len(c.strip()) >= min_chars
    ]


def benign_texts(benign: Mapping[str, Any]) -> list[dict[str, str]]:
    paths = corpus_files(benign)
    texts = blobs(str(benign["commit"]), paths)
    return [
        {"id": f"benign/{p}#{i}", "text": chunk}
        for p in paths
        for i, chunk in enumerate(paragraphs(texts[p], int(benign["min_chars"])))
    ]


def rate(k: int, n: int) -> dict[str, Any]:
    low, high = wilson(k, n)
    return {"k": k, "n": n, "rate": k / n, "wilson_low": low, "wilson_high": high}


def scan_all(texts: list[dict[str, str]]) -> tuple[dict[str, Any], dict[str, list[dict[str, Any]]]]:
    with tempfile.TemporaryDirectory() as tmp:
        src, dst = Path(tmp) / "texts.jsonl", Path(tmp) / "findings.jsonl"
        with src.open("w", encoding="utf-8", newline="\n") as f:
            for t in texts:
                f.write(json.dumps(t, ensure_ascii=False) + "\n")
        run_node([ENTRY, "--in", str(src), "--out", str(dst)])
        lines = dst.read_text(encoding="utf-8").splitlines()
    shape = json.loads(lines[0])["rules"]
    found = {row["id"]: row["findings"] for row in map(json.loads, lines[1:])}
    return shape, found


def top_tier(findings: list[dict[str, Any]]) -> str | None:
    tiers = {f["tier"] for f in findings}
    return "block" if "block" in tiers else "review" if tiers else None


def synthetic_result(found: Mapping[str, list[dict[str, Any]]], per_kind: int) -> dict[str, Any]:
    by_kind: dict[str, Any] = {}
    totals = Counter[str]()
    for kind, (_make, tier, names) in SYNTHETIC.items():
        rows = [found[f"synthetic/{kind}/{i}"] for i in range(per_kind)]
        detected = sum(1 for r in rows if r)
        at_tier = sum(1 for r in rows if top_tier(r) == tier)
        named = sum(1 for r in rows if any(f["kind"] in names for f in r))
        by_kind[kind] = {
            "expected_tier": tier,
            "detected": rate(detected, per_kind),
            "at_expected_tier": rate(at_tier, per_kind),
            "named": rate(named, per_kind),
            "kinds_reported": dict(sorted(Counter(f["kind"] for r in rows for f in r).items())),
        }
        totals["detected"] += detected
        totals["at_tier"] += at_tier
        totals["named"] += named
    n = per_kind * len(SYNTHETIC)
    return {
        "by_kind": by_kind,
        "overall": {
            "detected": rate(totals["detected"], n),
            "at_expected_tier": rate(totals["at_tier"], n),
            "named": rate(totals["named"], n),
        },
    }


def flagged_result(ids: list[str], found: Mapping[str, list[dict[str, Any]]]) -> dict[str, Any]:
    denied = [i for i in ids if top_tier(found[i]) == "block"]
    held = [i for i in ids if top_tier(found[i]) == "review"]
    kinds = Counter(f["kind"] for i in ids for f in found[i])
    return {
        "texts": len(ids),
        "denied": rate(len(denied), len(ids)),
        "held": rate(len(held), len(ids)),
        "flagged": rate(len(denied) + len(held), len(ids)),
        "kinds": dict(sorted(kinds.items())),
    }


def run(config: Mapping[str, Any]) -> dict[str, Any]:
    rng = random.Random(int(config["seed"]))
    per_kind = int(config["synthetic"]["per_kind"])
    per_shape = int(config["identifiers"]["per_shape"])
    synthetic = synthetic_texts(rng, per_kind)
    identifiers = identifier_texts(rng, per_shape)
    benign = benign_texts(config["benign"])
    shape, found = scan_all(synthetic + identifiers + benign)

    benign_ids = [t["id"] for t in benign]
    benign_result = flagged_result(benign_ids, found)
    benign_result["files"] = len({i.split("#")[0] for i in benign_ids})
    benign_result["commit"] = config["benign"]["commit"]
    benign_result["flagged_paragraphs"] = [
        {
            "id": i.removeprefix("benign/"),
            "tier": top_tier(found[i]),
            "kinds": sorted({f["kind"] for f in found[i]}),
        }
        for i in benign_ids
        if found[i]
    ]
    identifier_result = {
        shape_name: flagged_result(
            [f"identifiers/{shape_name}/{i}" for i in range(per_shape)], found
        )
        for shape_name in IDENTIFIERS
    }
    return {
        "name": config["name"],
        "card": "E2.9",
        "rules": shape,
        "policy": (
            "content_guards: secrets block, pii block "
            "(a BLOCK-tier match denies, a REVIEW-tier match holds)"
        ),
        "synthetic": synthetic_result(found, per_kind),
        "benign": benign_result,
        "identifiers": identifier_result,
    }


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    write_result(args.out, run(load_config(args.config)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
