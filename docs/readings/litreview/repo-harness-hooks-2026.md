---
id: repo-harness-hooks-2026
title: Hook systems of Codex, Cursor and Gemini CLI compared with Claude Code
authors: OpenAI, Anysphere, Google
venue: vendor documentation, 2026
year: 2026
tier: new
topics: [hooks, harness, mcp, interception]
engram: [plane, H4]
code: https://github.com/openai/codex
sources_read: [https://learn.chatgpt.com/docs/hooks.md, https://cursor.com/docs/hooks, https://geminicli.com/docs/hooks/reference.md]
---

## Claim
All three harnesses now have command hooks that can deny tool calls, so ADR 0022's statement that Codex has no hook is out of date, and the hook can be ported.

## Method
Fetched each vendor's hook reference and extracted the events, the input fields and how a deny is expressed.

## Key numbers
- Codex: PreToolUse matches MCP tools, Bash and apply_patch; deny via hookSpecificOutput.permissionDecision "deny" or exit 2; SessionStart and UserPromptSubmit can add context, default limit about 2,500 tokens.
- Cursor: beforeMCPExecution, beforeShellExecution, beforeReadFile; deny via "permission": "deny" or exit 2; sessionStart and postToolUse have additional_context.
- Gemini CLI: BeforeTool with decision "deny" or exit 2; BeforeAgent supports hookSpecificOutput.additionalContext; BeforeModel can override the llm_request.

## What Engram borrows
A per-harness adapter around the same core checks the Claude Code hook uses (packages/mcp/src/hook.ts), plus a SessionStart or BeforeAgent injection of governed recall. Lands in AB-SUR-5. Codex already uses the same PreToolUse deny shape Engram emits for Claude Code.

## What Engram does differently
The hook stays a guard (deny and record a bypass_blocked event). Reads stay on the governed MCP tool.

## Risk to our claims
Condition C7 says the MCP path has no read filtering. Context injection hooks could give a governed read path, which would change C7 and needs a pre-registration amendment first. Cursor docs say MCP hooks are deferred in cloud agents, and a forum thread reports hooks not firing.

## Open question
Does Codex's apply_patch matcher expose paths in tool_input.command in a form core's path check can use?

## Notes
Codex trusts project-local hooks only after review in /hooks. Hooks are on by default unless features.hooks is false (search summary, not the page). Not tested by us.
