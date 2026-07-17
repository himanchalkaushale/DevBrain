# Project Brain — Repository Memory

This directory is the **repository's own long-term brain**: meta-knowledge about
the project itself — decisions, conventions, debt, ideas. It is **not** user
knowledge (that lives in the user's Obsidian vault via Brain at runtime).

Every AI agent and human contributor reads the relevant files here before
working on a task, and **writes back** what they learn. See
[Repository Memory](../CLAUDE.md#repository-memory) in `CLAUDE.md`.

## File catalog

| File | Purpose |
|---|---|
| `architecture.md` | The "how-it-actually-works" notes that don't belong in the design docs: implementation realities, gotchas, invariants in practice. |
| `decisions.md` | Architecture Decision Records (ADRs) in log form: every significant decision, the context, the choice, and the consequences. Full ADRs also live in `docs/adr/`. |
| `bugs.md` | Notable bugs and fixes: what broke, root cause, the fix, and the lesson. Not a bug tracker — the durable lessons. |
| `coding-standards.md` | Conventions not obvious from the code or `CLAUDE.md`: idioms, patterns we prefer, patterns we avoid. |
| `roadmap.md` | Live status of the phased plan in `docs/ROADMAP.md`: what's done, in progress, blocked. |
| `meeting-notes.md` | Decisions and takeaways from design discussions / syncs (AI or human). Date-stamped. |
| `ideas.md` | Future ideas, proposals, and open questions — not committed. The backlog of "what if." |
| `technical-debt.md` | What we deferred, why, and the cost. The honest list of shortcuts and their payoff dates. |
| `glossary.md` | Brain-specific terms and their definitions, so "chunk," "port," "vault," etc. always mean the same thing. |

## How to use it

- **Before a task:** read the files relevant to the area you're touching.
- **During/after a task:** write what you learned to the right file. Keep entries
  short and dated. Prefer updating an existing entry over creating duplicates.
- **Don't duplicate the design docs.** `docs/` is the authoritative design;
  `memory/` is the lived experience around it. If a fact belongs in `docs/`, put
  it there and leave a pointer here.
- **Contradictions are bugs.** If `memory/` and `docs/` disagree, resolve it and
  update both. Never leave a known contradiction.
