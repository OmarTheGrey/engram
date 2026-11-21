"""tau2-bench at its pin, driven for one (condition, seed) of a run (card B11).

Runs inside tau2's own environment (.engram/tau2-venv, the tag's uv.lock),
never the research workspace. The launcher (packages/bench/src/tau2/launcher.ts)
writes the job file, starts the cassette proxies and the memory, and reads
what this writes. Nothing of tau2 is patched: every task runs through tau2's
own `run_single_task(config, task, seed=...)`, whose orchestrator sets the
seed on both models; each model's `llm_args` point LiteLLM at the task's
proxy (`api_base`) and name the item (`extra_headers`), so every agent and
user-simulator call is a cassette call (docs/log/2026-11-21-b11-spike-routing.md).

The memory seam (docs/log/2026-11-21-b11-decision-memory-seam.md): tau2 has
no memory of its own. Under C2 and C5 the agent is tau2's `LLMAgent` given
two more tools, memory_write and memory_read; registered through tau2's
registry (`register_agent_factory`), so tau2 is extended, not changed. A
memory call is answered inside the agent's turn: its result joins the
agent's own history and the agent is asked again, so the orchestrator, the
environment and the evaluator never see a memory call, and the environment
replay that computes the database hash replays only domain tools. C1 is
tau2's own `llm_agent`. Memory persists across the tasks of a job, in order.

The reward is tau2's: each task's SimulationRun, as tau2 serialises it, is
written to <out>/simulations/<task>.json, with its reward_info (the database
hash check, `db_check`) computed by tau2's evaluator. EvaluationType.ALL runs
when the task's reward basis needs no model judge (airline: DB and
COMMUNICATE), EvaluationType.ENV otherwise (retail's NL assertions), so no
judge is called.

    python -I tau2_engram.py <job.json>
"""

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from tau2.agent.llm_agent import LLMAgent
from tau2.data_model.message import MultiToolMessage, ToolMessage
from tau2.data_model.simulation import TextRunConfig
from tau2.data_model.tasks import RewardType
from tau2.evaluator.evaluator import EvaluationType
from tau2.registry import registry
from tau2.runner import get_tasks, load_task_splits, run_single_task
from tau2.utils.llm_utils import generate
from tau2_memory import MEMORY_TOOL_NAMES, MEMORY_TOOLS, Memory

MEMORY_AGENT = "engram_memory_agent"
# Memory calls one agent turn may make before it must answer the user or call a domain tool.
MAX_MEMORY_ROUNDS = 8


class MemoryTool:
    """A memory tool as tau2's generate() reads a tool: its OpenAI schema."""

    def __init__(self, spec):
        self.name = spec["name"]
        self.openai_schema = {"type": "function", "function": dict(spec)}


class EngramMemoryAgent(LLMAgent):
    """tau2's LLMAgent with the memory tools; a memory call is answered within its turn."""

    def __init__(self, tools, domain_policy, llm, llm_args, memory):
        super().__init__(
            tools=list(tools) + [MemoryTool(t) for t in MEMORY_TOOLS],
            domain_policy=domain_policy,
            llm=llm,
            llm_args=llm_args,
        )
        self.memory = memory

    def generate_next_message(self, message, state):
        if isinstance(message, MultiToolMessage):
            state.messages.extend(message.tool_messages)
        else:
            state.messages.append(message)
        for _ in range(MAX_MEMORY_ROUNDS):
            reply = generate(
                model=self.llm,
                tools=self.tools,
                messages=state.system_messages + state.messages,
                call_name="agent_response",
                **self.llm_args,
            )
            state.messages.append(reply)
            calls = reply.tool_calls or []
            memory_calls = [c for c in calls if c.name in MEMORY_TOOL_NAMES]
            if not memory_calls:
                return reply, state
            for call in memory_calls:
                text = self.memory.call(call.name, call.arguments, call.id)
                state.messages.append(
                    ToolMessage(id=call.id, role="tool", content=text, requestor="assistant")
                )
            rest = [c for c in calls if c.name not in MEMORY_TOOL_NAMES]
            if rest:
                # The agent's history keeps the whole reply; the orchestrator gets its domain calls.
                return reply.model_copy(update={"tool_calls": rest}), state
        raise RuntimeError(
            f"the agent made {MAX_MEMORY_ROUNDS} memory calls in a row"
            " without answering or calling a domain tool"
        )


def main(job_path):
    job = json.loads(Path(job_path).read_text(encoding="utf-8"))
    out = Path(job["out"])
    (out / "simulations").mkdir(parents=True, exist_ok=True)
    domain = job["domain"]
    split = load_task_splits(domain) or {}
    if job["split"] not in split:
        raise SystemExit(f"tau2 has no split {job['split']!r} for {domain}")
    outside = [t["id"] for t in job["tasks"] if t["id"] not in split[job["split"]]]
    if outside:
        raise SystemExit(f"tasks {outside} are not in tau2's {domain} {job['split']} split")
    by_id = {t.id: t for t in get_tasks(domain, task_ids=[t["id"] for t in job["tasks"]])}

    memory = None
    agent_name = "llm_agent"
    if job["memory"] is not None:
        m = job["memory"]
        memory = Memory(m["kind"], m["url"], m["actor"], m["at"], m["read_limit"], m["run"])
        agent_name = MEMORY_AGENT
        registry.register_agent_factory(
            lambda tools, domain_policy, **kw: EngramMemoryAgent(
                tools, domain_policy, kw.get("llm"), kw.get("llm_args"), memory
            ),
            MEMORY_AGENT,
        )

    def llm_args(base_url, item):
        return {
            "temperature": job["temperature"],
            "api_base": base_url,
            # LiteLLM's OpenAI client needs a key; the proxy reads none.
            "api_key": "engram-cassette-proxy",
            "extra_headers": {"x-engram-item": item},
        }

    tasks_path = out / "tasks.jsonl"
    memory_path = out / "memory.jsonl"
    tasks_path.write_bytes(b"")
    memory_path.write_bytes(b"")
    logged = 0
    for t in job["tasks"]:
        task = by_id[t["id"]]
        if memory is not None:
            memory.task = task.id
        basis = task.evaluation_criteria.reward_basis if task.evaluation_criteria else []
        needs_judge = RewardType.NL_ASSERTION in basis
        config = TextRunConfig(
            domain=domain,
            agent=agent_name,
            llm_agent=job["agent_model"],
            llm_args_agent=llm_args(t["agent_base_url"], t["agent_item"]),
            user="user_simulator",
            llm_user=job["user_model"],
            llm_args_user=llm_args(t["user_base_url"], t["user_item"]),
            max_steps=job["max_steps"],
            max_errors=job["max_errors"],
        )
        row = {"task": task.id, "evaluation": EvaluationType.ALL.value}
        try:
            with JudgeRoute(t["judge_base_url"] if needs_judge else None):
                simulation = run_single_task(
                    config, task, seed=job["seed"], evaluation_type=EvaluationType.ALL
                )
            path = out / "simulations" / f"{task.id}.json"
            path.write_text(simulation.model_dump_json(indent=2), encoding="utf-8")
            row.update(simulation=str(path), error=None)
        except Exception as e:  # one task's failure is its row; the next task still runs
            row.update(simulation=None, error=f"{type(e).__name__}: {e}"[:2000])
        # Written as each task ends, so a stopped process keeps the tasks it finished.
        append(tasks_path, [row])
        log = memory.log if memory is not None else []
        append(memory_path, log[logged:])
        logged = len(log)
    return 0


def append(path, rows):
    with path.open("ab") as f:
        for r in rows:
            f.write((json.dumps(r, sort_keys=True) + "\n").encode("utf-8"))


class JudgeRoute:
    """Routes tau2's NL-assertion judge to the task's judge proxy, for this task only.

    tau2 calls its judge with its own model and arguments
    (`DEFAULT_LLM_NL_ASSERTIONS`, `DEFAULT_LLM_NL_ASSERTIONS_ARGS`, no
    `api_base` among them), so LiteLLM takes the OpenAI base URL and key from
    the environment: they are set while the task runs and put back after to
    the launcher's dead loopback address (tau2Env), so no other call reaches
    the judge's proxy and nothing reaches a provider.
    """

    def __init__(self, base_url):
        self.base_url = base_url
        self.saved = {}

    def __enter__(self):
        if self.base_url is not None:
            for name, value in (
                ("OPENAI_BASE_URL", self.base_url),
                ("OPENAI_API_BASE", self.base_url),
                # LiteLLM's OpenAI client needs a key; the proxy reads none.
                ("OPENAI_API_KEY", "engram-cassette-proxy"),
            ):
                self.saved[name] = os.environ.get(name)
                os.environ[name] = value
        return self

    def __exit__(self, *exc):
        for name, value in self.saved.items():
            if value is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = value
        return False


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: python -I tau2_engram.py <job.json>", file=sys.stderr)
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
