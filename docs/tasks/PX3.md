# PX3 pi package and project setup

Status: open; `.pi/` prompts, settings and the context file exist since S0.2.

Added by ADR 0001.

Goal: `packages/pi-package` bundles the extension, skills and prompt templates (`/engram explain`, `/engram lint`, `/engram simulate`, `/engram policy`) as an installable pi package; this repository's `.pi/settings.json` loads it.

Files: `packages/pi-package/`, `.pi/settings.json`

Depends on: PX1

Acceptance: `pi install` of the package in a fresh project lists the Engram tools and commands (RPC `get_commands`)

Out of scope: publishing to npm.
