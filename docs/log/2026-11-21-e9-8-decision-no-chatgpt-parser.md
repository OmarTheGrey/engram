---
date: 2026-11-21
author: claude-agent
type: decision
card: E9.8
chapter: design
pillar: twin
hypothesis: none
evidence:
  - https://help.openai.com/en/articles/7260999-how-do-i-export-my-chat-history-and-data
  - https://help.openai.com/articles/9106926
supersedes: none
---

**What.** No ChatGPT parser is written.

**Why.** The card allows one only once a real export is seen to contain memories.

**Result.** OpenAI's help article on the data export describes conversations.json and other account data and does not list saved memories; its transfer article says custom instructions and memories are not carried over; third-party tools read memories from the settings page instead (web search, 2026-11-21). No real export was seen, and none could be used under rule 12.

**Consequence.** A person can paste ChatGPT's own list of saved memories into `--claude`, which reads plain bullets; a dedicated parser waits for an export that holds them.
