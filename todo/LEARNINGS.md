# Project Learnings Log

This file is appended by each agent after completing a task.
Key insights, gotchas, and patterns discovered during implementation.

Use this knowledge to avoid repeating mistakes and build on what works.

---

<!-- Agents: Append your learnings below this line -->
<!-- Format:
## <task-id>

- Key insight or decision made
- Gotcha or pitfall discovered
- Pattern that worked well
- Anything the next agent should know
-->

## create-troubleshooting-doc

- The README troubleshooting section was at lines 318-399, containing: Connection Issues, Authentication Errors, Debug Mode, and Common Issues
- When extracting content, I expanded the documentation with additional context (e.g., added Docker/remote server notes, slow queries section, Phoenix instance errors section) to make TROUBLESHOOTING.md a more complete standalone guide
- The cross-reference link in README.md keeps the troubleshooting section header so users know where to look, but directs them to the detailed guide
- Pattern: Extract content, enhance it for the standalone doc, then simplify the original to just a pointer

## restructure-readme-intro

- The previous intro was descriptive but buried the value proposition. The new intro leads with "what you get" (AI-powered analysis) and "how it works" (bash + files paradigm)
- Key insight: The architecture's value is transparency and reproducibility. Every AI query is just bash commands on files, so users can inspect, copy, and reproduce anything the agent does
- Kept it to exactly 2 paragraphs as requested, covering: (1) what it is and how it works, (2) why the filesystem-native approach matters
- The Vercel blog link is preserved as it provides important context for the paradigm
- Made sure to mention specific commands (cat, grep, jq, awk) to make the "bash" concept concrete and familiar
