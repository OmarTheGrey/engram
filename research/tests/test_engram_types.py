"""The generated Python types carry their contract names (make api)."""

import importlib

CONTRACTS = ["MemoryItem", "MemoryEvent", "Policy", "Grant", "Explanation", "LintFinding"]


def test_each_module_defines_a_type_named_after_its_contract() -> None:
    for name in CONTRACTS:
        module = importlib.import_module(f"engram_types.{name}")
        assert hasattr(module, name), f"engram_types.{name} has no type named {name}"
