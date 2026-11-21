"""The memory tools tau2-bench's agent is given under C2 and C5 (card B11).

Standard library only, so it is tested without tau2's environment; the
driver (tau2_engram.py) imports it inside that environment.

The tools are the runner's, the same in every condition that has memory
(decision D13, ADR 0015): `memory_write` and `memory_read` with the names,
descriptions and parameters of packages/pi-extension/src/tools.ts, the write
result of `writeResultText` and the read in the memory tag of
packages/pi-extension/src/tag.ts (`tagUngovernedRead` for C2, `tagRecall`
for C5). packages/bench/test/tau2/shim.test.ts checks both against those
files. One difference from the runner's C5 tag: no `read_id`, since
`engram serve` draws read ids at random and a prompt holding one would never
replay from a cassette (docs/log/2026-11-21-b11-decision-no-read-id.md).

Each call crosses to memory over loopback HTTP with the bodies of
`engram serve`'s routes (`POST /api/v1/items`, `POST /api/v1/read`): C5's URL
is `engram serve`, C2's is the launcher's ungoverned store
(packages/bench/src/tau2/memory.ts). The actor is the launcher's, its source
`model`, as the pi extension sets for agent tool calls (ADR 0004, D4).
"""

import hashlib
import json
import sys
import urllib.error
import urllib.request

MEMORY_WRITE = {
    "name": "memory_write",
    "description": "Write one item to memory in a scope such as person:<id>, team:<id> or org.",
    "parameters": {
        "type": "object",
        "properties": {
            "scope": {"type": "string"},
            "content": {"type": "string"},
            "class": {
                "anyOf": [
                    {"const": "semantic", "type": "string"},
                    {"const": "episodic", "type": "string"},
                ]
            },
            "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        },
        "required": ["scope", "content"],
    },
}

MEMORY_READ = {
    "name": "memory_read",
    "description": "Read the memory items that match a query.",
    "parameters": {
        "type": "object",
        "properties": {"query": {"type": "string"}},
        "required": ["query"],
    },
}

MEMORY_TOOLS = (MEMORY_WRITE, MEMORY_READ)
MEMORY_TOOL_NAMES = frozenset(t["name"] for t in MEMORY_TOOLS)


def write_result_text(item):
    """packages/pi-extension/src/tools.ts, writeResultText."""
    return f"stored {item['id']} in {item['scope']} as {item['status']}"


def refusal_text(event):
    """packages/pi-extension/src/extension.ts, refusal: the Plane's reason and rule."""
    return f"engram: {event['reason']} ({event['policy_id']})"


def _escape(text):
    """tag.ts, escapeMarkup: `&` first, then the angle brackets and quotes."""
    return (
        text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")
    )


def _attr(name, value):
    return "" if value is None else f' {name}="{_escape(value)}"'


def tag_read(filtered, items, read_id=None, policy_id=None):
    """tag.ts, tagRead: the memory tag every condition shares.

    `items` are dicts with item_id, scope, rank, content and, under C5,
    policy_id (the rule that admitted the item).
    """
    rules = _attr("read_id", read_id) + _attr("policy_id", policy_id)
    head = f'<engram:memory{rules} filtered="{filtered}">'
    body = []
    for i in items:
        where = _attr("item_id", i["item_id"]) + _attr("scope", i["scope"])
        rule = _attr("policy_id", i.get("policy_id"))
        content = _escape(i["content"])
        body.append(f'<engram:item{where} rank="{i["rank"]}"{rule}>\n{content}\n</engram:item>')
    return "\n".join([head, *(body if body else ["no memories"]), "</engram:memory>"])


def _content(item):
    content = item["content"]
    if isinstance(content, str):
        return content
    return json.dumps(content, separators=(",", ":"), ensure_ascii=False)


def tag_ungoverned_read(items):
    """tag.ts, tagUngovernedRead (C2): the store's matches in order, nothing filtered, no rules."""
    return tag_read(
        0,
        [
            {"item_id": i["id"], "scope": i["scope"], "rank": n + 1, "content": _content(i)}
            for n, i in enumerate(items)
        ],
    )


def tag_governed_read(read, limit):
    """tag.ts, tagRecall (C5) over an /api/v1/read response, without the read id.

    The items in the order of their explanations' ranks, cut to the
    runner's read limit (`engram serve` cuts none), each with its rule.
    """
    by_id = {i["id"]: i for i in read["items"]}
    items = []
    for e in sorted(read["explanations"], key=lambda e: e["rank"]):
        item = by_id.get(e["item_id"])
        if item is None:
            continue
        items.append(
            {
                "item_id": item["id"],
                "scope": item["scope"],
                "rank": e["rank"],
                "content": _content(item),
                "policy_id": e["policy_id"],
            }
        )
    return tag_read(read["filtered"], items[:limit], policy_id=read["event"]["policy_id"])


def item_id(*parts):
    """A UUID version 7 in shape, drawn from a hash: the same call always writes the same id."""
    h = hashlib.sha256("/".join(parts).encode("utf-8")).hexdigest()[:32]
    h = h[:12] + "7" + h[13:16] + "89ab"[int(h[16], 16) % 4] + h[17:]
    return f"{h[:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:]}"


def memory_item(arguments, tool_call_id, actor, at, ident):
    """The item a memory_write call asks for, as the runner's C2 tool assembles it."""
    params_hash = hashlib.sha256(
        json.dumps(arguments, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    ).hexdigest()
    return {
        "id": ident,
        "class": arguments.get("class", "semantic"),
        "scope": arguments["scope"],
        "owner": actor["id"],
        "content": arguments["content"],
        "provenance": {
            "kind": "model",
            "ref": f"tau2:tool_call/{tool_call_id}",
            "hash": f"sha256:{params_hash}",
            "actor": actor["id"],
        },
        "confidence": arguments.get("confidence", 0.5),
        "valid_from": at,
        "valid_to": None,
        "ttl": None,
        "grants": [],
        "version": 1,
        "lineage": [],
        "status": "active",
        "store_ref": None,
        "schema_version": 1,
    }


class MemoryError_(Exception):
    """Memory did not answer as /api/v1 does: the run stops, it is never shown to the model."""


def _post(url, body, timeout=30):
    data = json.dumps(body).encode("utf-8")
    request = urllib.request.Request(
        url, data=data, headers={"content-type": "application/json"}, method="POST"
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise MemoryError_(f"{url} answered {e.code}: {e.read().decode('utf-8', 'replace')}") from e


class Memory:
    """One condition's memory: C2 (`store`) or C5 (`plane`) at `url`."""

    def __init__(self, kind, url, actor, at, read_limit, run):
        if kind not in ("store", "plane"):
            raise ValueError(f"memory kind {kind!r} is neither store (C2) nor plane (C5)")
        self.kind = kind
        self.url = url.rstrip("/")
        self.actor = actor
        self.at = at
        self.read_limit = read_limit
        self.run = run
        self.task = None
        self.log = []

    def call(self, name, arguments, tool_call_id):
        """The text the model is shown for one memory call."""
        if name == "memory_write":
            return self._write(arguments, tool_call_id)
        if name == "memory_read":
            return self._read(arguments, tool_call_id)
        raise ValueError(f"{name} is not a memory tool")

    def _entry(self, name, tool_call_id, **fields):
        self.log.append({"task": self.task, "tool": name, "tool_call_id": tool_call_id, **fields})

    def _write(self, arguments, tool_call_id):
        if not isinstance(arguments.get("scope"), str) or not isinstance(
            arguments.get("content"), str
        ):
            text = "memory_write: scope and content must be strings"
            self._entry("memory_write", tool_call_id, decision="malformed", text=text)
            return text
        ident = item_id(self.run, self.task or "", tool_call_id)
        item = memory_item(arguments, tool_call_id, self.actor, self.at, ident)
        result = _post(f"{self.url}/api/v1/items", {"actor": self.actor, "item": item})
        stored = result.get("item")
        event = result.get("event")
        text = write_result_text(stored) if stored else refusal_text(event)
        self._entry(
            "memory_write",
            tool_call_id,
            item_id=ident,
            scope=item["scope"],
            decision=event["decision"] if event else "stored",
            policy_id=event["policy_id"] if event else None,
            status=stored["status"] if stored else None,
        )
        return text

    def _read(self, arguments, tool_call_id):
        query = arguments.get("query")
        if not isinstance(query, str):
            text = "memory_read: query must be a string"
            self._entry("memory_read", tool_call_id, decision="malformed", text=text)
            return text
        result = _post(f"{self.url}/api/v1/read", {"actor": self.actor, "text": query})
        if self.kind == "plane":
            text = tag_governed_read(result, self.read_limit)
            returned = [
                e["item_id"] for e in sorted(result["explanations"], key=lambda e: e["rank"])
            ][: self.read_limit]
            self._entry(
                "memory_read",
                tool_call_id,
                query=query,
                decision=result["event"]["decision"],
                policy_id=result["event"]["policy_id"],
                filtered=result["filtered"],
                returned=returned,
            )
        else:
            items = result["items"][: self.read_limit]
            text = tag_ungoverned_read(items)
            self._entry(
                "memory_read",
                tool_call_id,
                query=query,
                decision="stored",
                filtered=0,
                returned=[i["id"] for i in items],
            )
        return text


def _out(text):
    """Bytes, so Windows neither re-encodes nor turns a newline into two characters."""
    sys.stdout.buffer.write(text.encode("utf-8"))
    sys.stdout.buffer.flush()


def _selftest(command):
    """The tests' entry: `tools`, or `render` reading {kind, ...} on stdin."""
    if command == "tools":
        _out(json.dumps([dict(t) for t in MEMORY_TOOLS]))
        return 0
    if command == "render":
        spec = json.loads(sys.stdin.buffer.read().decode("utf-8"))
        if spec["kind"] == "store":
            _out(tag_ungoverned_read(spec["items"]))
        elif spec["kind"] == "plane":
            _out(tag_governed_read(spec["read"], spec["limit"]))
        elif spec["kind"] == "write":
            _out(write_result_text(spec["item"]))
        elif spec["kind"] == "refusal":
            _out(refusal_text(spec["event"]))
        elif spec["kind"] == "item_id":
            _out(item_id(*spec["parts"]))
        return 0
    print(f"usage: tau2_memory.py tools | render < spec.json; not {command!r}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(_selftest(sys.argv[1] if len(sys.argv) > 1 else ""))
