"""Card X14, review finding X14-4: vendor-amsb.py refuses bytes that differ from its hashes."""

from __future__ import annotations

import hashlib
import importlib.util
import json
from collections.abc import Callable
from pathlib import Path
from types import ModuleType

import pytest

SCRIPT = Path(__file__).resolve().parents[2] / "packages/bench/scripts/vendor-amsb.py"


def load() -> ModuleType:
    spec = importlib.util.spec_from_file_location("vendor_amsb", SCRIPT)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


V = load()
BODIES = {V.SCENARIOS: b"scenarios at the pin", V.LICENSE: b"licence at the pin"}


def expected() -> dict[str, str]:
    return {path: hashlib.sha256(body).hexdigest() for path, body in BODIES.items()}


def serve(bodies: dict[str, bytes]) -> Callable[[str], bytes]:
    return lambda path: bodies[path]


def test_the_vendored_file_names_the_hashes_a_fetch_must_match(tmp_path: Path) -> None:
    out = tmp_path / "out"
    out.mkdir()
    (out / "scenarios.json").write_text(
        json.dumps({"source": {"upstream_sha256": expected()}}), encoding="utf-8"
    )
    assert V.expected_hashes(out) == expected()
    assert V.expected_hashes(tmp_path / "none") is None


def test_a_download_matching_the_vendored_hashes_is_written(tmp_path: Path) -> None:
    V.fetch(tmp_path, expected(), download=serve(BODIES))
    assert (tmp_path / "scenarios.py").read_bytes() == BODIES[V.SCENARIOS]
    assert (tmp_path / "LICENSE.md").read_bytes() == BODIES[V.LICENSE]


def test_a_download_that_differs_is_refused_and_not_written(tmp_path: Path) -> None:
    changed = {**BODIES, V.SCENARIOS: b"scenarios moved upstream"}
    with pytest.raises(ValueError, match="differs from the vendored hash"):
        V.fetch(tmp_path, expected(), download=serve(changed))
    assert not (tmp_path / "scenarios.py").exists()


def test_a_file_already_fetched_that_differs_is_refused(tmp_path: Path) -> None:
    (tmp_path / "scenarios.py").write_bytes(b"edited by hand")
    with pytest.raises(ValueError, match="differs from the vendored hash"):
        V.fetch(tmp_path, expected(), download=serve(BODIES))
