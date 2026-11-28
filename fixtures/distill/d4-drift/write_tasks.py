# Writes card D4's drift pool, fixtures/distill/d4-drift/tasks.json: card D3's pool
# (fixtures/distill/d3-validate/tasks.json) with one held-out task changed, as a
# repository changes under an admitted procedure. In synthetic/remove-dead-code-15 the
# unused legacyFormat helper now takes a digits argument, so the edit the procedure
# taught (remove the old helper by its old text) finds nothing to replace and the task
# fails; the gold edit removes the new helper. Every other task is D3's, byte for byte.
# Run by hand from the repository root: python -I fixtures/distill/d4-drift/write_tasks.py
import json

SOURCE = "fixtures/distill/d3-validate/tasks.json"
TARGET = "fixtures/distill/d4-drift/tasks.json"
CHANGED = "synthetic/remove-dead-code-15"

doc = json.load(open(SOURCE, encoding="utf8"))
helper = "\nexport function legacyFormat(x: number, digits = 0) {\n  return x.toFixed(digits);\n}\n"
for task in doc["tasks"]:
    if task["id"] != CHANGED:
        continue
    task["files"]["src/format.ts"] = "export function format(x: number) {\n  return x.toFixed(2);\n}\n" + helper
    task["commands"] = {
        "grep -rn legacyFormat src": "src/format.ts:5: export function legacyFormat(x: number, digits = 0) {"
    }
    task["check"] = {
        "kind": "state-hash",
        "gold": [{"name": "edit", "arguments": {"path": "src/format.ts", "old": helper, "new": ""}}],
    }
doc["_comment"] = (
    "Card D4's drift pool: card D3's pool with " + CHANGED + " changed (its legacyFormat helper now "
    "takes a digits argument), written by write_tasks.py. The procedure D3 admitted removes the old "
    "helper by its old text, which is no longer there."
)
with open(TARGET, "w", encoding="utf8", newline="\n") as f:
    f.write(json.dumps(doc, indent=2, ensure_ascii=False) + "\n")
