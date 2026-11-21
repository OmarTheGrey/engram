---
id: repo-agent-skills-spec
title: Agent Skills specification (agentskills.io), the anthropics/skills repository and the skills-ref validator
authors: Anthropic and the agentskills community (specification repository); Anthropic (anthropics/skills)
venue: open specification and repositories, 2025 to 2026
year: 2026
tier: new
topics: [procedural, governance, store]
engram: [distill, plane, H5]
code: https://github.com/agentskills/agentskills (Apache-2.0, 27,491 stars, pushed 2026-11-04 per gh api); https://github.com/anthropics/skills (198,205 stars, pushed 2026-11-16; gh reports no single licence, the pdf and skill-creator folders carry an Apache-2.0 LICENSE.txt, other skills' licences not checked)
sources_read: [docs/specification.mdx of agentskills/agentskills (via gh api), gh api folder listings of both repositories, a web search summary of pi's docs/skills.md at pi-coding-agent 1.5.2 (not read directly)]
---

## Claim
A skill is a directory whose `SKILL.md` has YAML frontmatter and a Markdown body, and that one format is read by many harnesses, so a procedure written once can run in Claude Code, pi and others.

## Method
The specification (read in full) defines: required `name` (1 to 64 characters, lowercase letters, digits and single hyphens, equal to the directory name) and `description` (1 to 1024 characters, what it does and when to use it); optional `license`, `compatibility` (at most 500 characters), `metadata` (string to string map) and `allowed-tools` (space-separated, experimental). Optional folders are `scripts/`, `references/` and `assets/`. Loading is progressive: name and description at startup (about 100 tokens), the body on activation (under 5,000 tokens recommended, under 500 lines), other files on demand. The agentskills repository also holds a `skills-ref` reference validator (Python; its licence file exists but was not read).

## Key numbers
- Field limits above, from the specification.
- Repository stars and push dates, from gh api on 2026-11-21.
- anthropics/skills lists 19 skill folders (docx, pdf, pptx, xlsx, skill-creator, mcp-builder and others), from the folder listing.

## What Engram borrows
A procedural item already carries `{ body, tools }` (`ProceduralContent` in packages/core/src/schema.ts), the same shape as a `SKILL.md` body plus `allowed-tools`. An export maps item to directory (name from a slug of the item id, description from the induced trigger, `metadata` carrying item id, version, scope, policy id and replay k of n). An import maps a directory to a candidate. The `skills-ref` rules are the conformance check for export output.

## What Engram does differently
The specification has no lifecycle, provenance, scope or consent. Engram exports only active items readable by the target actor, and imports only as `candidate` with the importer as source, never as active.

## Risk to our claims
`allowed-tools` is experimental and its syntax differs by harness (Claude Code uses patterns such as `Bash(git:*)`). Round-tripping Engram's tool allowlist may lose meaning. Mitigation: export the list verbatim, state that it is advisory, and enforce only through Engram's own gate.

## Open question
Does pi 1.3.0 (the pinned version) match the 1.5.2 behaviour the search summary describes (project `.agents/skills/` discovery, name need not match directory)? Read the pinned package's docs/skills.md before the export card.

## Notes
Pi implements the specification and discovers `SKILL.md` directories under `~/.pi/agent/skills/`, `~/.agents/skills/` and project `.agents/skills/` (search summary, not read directly). Claude Code's skill folders (`.claude/skills/`) were not read in this pass. In pi, a duplicate name keeps the first discovered.
