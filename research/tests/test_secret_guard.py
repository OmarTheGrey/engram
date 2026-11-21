"""research/scripts/secret_guard.py (card E2.9): the synthetic sets and the tallies.

The scan itself is TypeScript and is tested in
packages/core/test/unit/policy/secrets.test.ts; here, that the synthetic
values are what they claim (Luhn, mod-97, the issuer's shape), that they are
seeded, and that the counting is right.
"""

from __future__ import annotations

import random

from scripts import secret_guard as sg


def test_cards_pass_luhn_and_ibans_pass_mod97() -> None:
    rng = random.Random(1)
    for _ in range(200):
        assert sg.luhn_ok(sg.card(rng).replace(" ", ""))
        value = sg.iban(rng)
        moved = value[4:] + value[:4]
        assert int("".join(str(int(ch, 36)) for ch in moved)) % 97 == 1
    assert not sg.luhn_ok("4111111111111112")


def test_the_sets_are_seeded_and_complete() -> None:
    a = sg.synthetic_texts(random.Random(7), 3)
    b = sg.synthetic_texts(random.Random(7), 3)
    assert a == b
    assert len(a) == 3 * len(sg.SYNTHETIC)
    assert {t["id"].split("/")[1] for t in a} == set(sg.SYNTHETIC)
    ids = sg.identifier_texts(random.Random(7), 2)
    assert len(ids) == 2 * len(sg.IDENTIFIERS)


def test_paragraphs_drop_short_chunks() -> None:
    text = "a short one\n\n" + "x" * 50 + "\r\n\r\n" + "y" * 39 + "\n  \n" + "z" * 40
    assert sg.paragraphs(text, 40) == ["x" * 50, "z" * 40]


def test_tallies() -> None:
    block = {"kind": "secret/a", "tier": "block", "guard": "secrets", "length": 4}
    review = {"kind": "pii/email", "tier": "review", "guard": "pii", "length": 9}
    assert sg.top_tier([review, block]) == "block"
    assert sg.top_tier([review]) == "review"
    assert sg.top_tier([]) is None
    found = {"x": [block], "y": [review], "z": []}
    out = sg.flagged_result(["x", "y", "z"], found)
    assert (out["denied"]["k"], out["held"]["k"], out["flagged"]["k"], out["texts"]) == (1, 1, 2, 3)
    assert out["kinds"] == {"pii/email": 1, "secret/a": 1}
