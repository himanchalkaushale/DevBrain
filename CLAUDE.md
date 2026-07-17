# CLAUDE.md — Project Brain AI Guide

> This is the **permanent AI guide** for the Project Brain repository. Any AI
> agent (Claude Code or otherwise) working in this repo reads this file **first**,
> before writing or changing any code. It takes precedence over general habits.

Project Brain is a **local-first AI memory layer for Claude Code**. It gives
Claude long-term project memory using an Obsidian vault as a persistent,
queryable knowledge base — instead of relying on the finite, volatile
conversation context.

This file is the contract between the humans and the AI that maintain this
project. Follow it. When it's wrong or incomplete, update it (see
[Documentation Rules](#documentation-rules)).

---

## Project Vision

### What it is
Project Brain is a local service that Claude Code talks to over the
**Model Context Protocol (MCP)**. It turns an Obsidian vault of Markdown notes
into a queryable memory: semantic search, lexical search, knowledge-graph
traversal, and token-budgeted context assembly. Claude reads memory on demand and
writes memory back as durable Markdown.

### Why it exists
Claude Code's context window is volatile and finite. Hard-won knowledge — why a
decision was made, how a subsystem works, which bug was fixed and how — is lost
when a conversation ends or is summarized. Project Brain makes that knowledge
**persistent, editable, and retrievable** without sacrificing privacy.

### What problem it solves
- **Forgetting across sessions:** the answer Claude found yesterday is gone today.
  Brain remembers it.
- **Context bloat:** instead of loading huge transcripts, Claude loads only the
  relevant memory (the `brain_build_context` tool).
- **Privacy:** cloud memory layers ship your knowledge to a server. Brain keeps
  everything on your machine — vault, embeddings, indexes, all local.

### Long-term vision
Make Claude Code behave like an engineer who never forgets anything about the
project: recallable memory, traversable relationships, automatic note creation,
AI-assisted documentation, and a knowledge graph that grows smarter over time —
all local, all private, all open-source. See `docs/ROADMAP.md`.

---

## Core Principles

These are non-negotiable. Every decision, review, and line of code is measured
against them.

- **Local-first.** Runs entirely on the user's machine. No cloud dependency.
  The vault, vector DB, and graph DB all live in a user-chosen data directory.
- **Open-source.** Built for community contribution and long-term stewardship.
  Permissive license. No proprietary dependencies.
- **Privacy-first.** No telemetry, no analytics, no third-party requests. Brain
  makes no outbound network calls unless the user explicitly opts into a remote
  capability. Verifiable by audit.
- **Modular.** Each concern is a separate module behind a stable interface.
- **Maintainable.** Readability over cleverness. Small files. Clear names. Code
  that a stranger can understand in five minutes.
- **AI-assisted development.** This repo is co-developed with AI agents. The
  conventions here exist so AI and humans stay consistent over years.
- **Developer experience first.** Fast builds, fast tests, clear errors, good
  docs. If it's painful to work in, contributions die.

---

## Architecture Philosophy

### Markdown is canonical
The Obsidian vault is the **single source of truth**. Embeddings, the vector
DB, and the knowledge graph are **derived, rebuildable indexes**. Lose any
derived store and you lose nothing but search speed until the next rebuild.
Lose the Markdown and you've lost the actual memory. This invariant is sacred.

### Why modularity matters
Brain must survive years of churn: new embedding models, new vector DBs, new
MCP features, new extraction sources. The only way that's possible is if each
piece is **swappable behind an interface**. Today's LanceDB can become
tomorrow's Qdrant without touching Core. Today's nomic can become tomorrow's
local model without touching Storage.

### Why components stay loosely coupled
Dependencies point **inward and downward only** (see `docs/ARCHITECTURE.md`).
Core knows no infrastructure. Adapters know only their port. The MCP layer knows
no business logic. This means:
- Core can be unit-tested with in-memory fakes — no Ollama, no DB, no filesystem.
- A change in one layer rarely forces changes in another.
- New contributors can understand one module without understanding all of them.

### How the project should evolve
Additively, not by rewrite. New capability → new folder in the right layer. New
external tech → new adapter. Re-shuffling the layers requires an Architecture
Decision Record (ADR). The structure is allowed to grow; the **layering rule is
fixed**.

---

## Development Rules

Claude (and any contributor) **always**:

1. **Understand the existing architecture before writing code.** Read
   `docs/ARCHITECTURE.md`, `docs/REPOSITORY_STRUCTURE.md`, and the relevant
   `memory/` files first. Never assume.
2. **Reuse abstractions.** If a port exists for what you need (`IEmbedder`,
   `IVectorStore`, `IStorage`, …), use it. Don't reinvent.
3. **Avoid duplicate implementations.** Search before writing. Two functions
   doing the same thing is a bug in our discipline.
4. **Keep files small.** One responsibility per file. If a file passes ~400
   lines, look for a split. No god files.
5. **Write maintainable code.** Prefer readability over cleverness. Name things
   explicitly. Comments explain *why*, not *what*.
6. **Never break existing APIs without documenting changes.** A breaking change
   to a port, an MCP tool, or a public export requires an ADR and a
   `CHANGELOG.md` entry.
7. **Respect the layering rule.** No infrastructure imports in `core/`. No
   cross-adapter imports. The ESLint boundary config enforces this — don't
   disable it.
8. **One writer per store.** Storage owns the vault; the Indexer owns the
   vector/graph stores. Never write to a store you don't own.
9. **Derived stores are rebuildable.** Any change to indexing must keep
   `brain_rebuild --full` able to reproduce the stores from the vault.
10. **No silent network.** Any new outbound-call capability must be off by
    default and audited.

---

## Coding Standards

### Naming
- **Files:** `kebab-case.ts` (e.g., `graph-builder.ts`).
- **Classes & types:** `PascalCase` (e.g., `ObsidianStorage`).
- **Interfaces:** `I`-prefixed `PascalCase` (e.g., `IEmbedder`) — lives in
  `core/ports/`.
- **Functions & variables:** `camelCase`.
- **Constants:** `UPPER_SNAKE_CASE` for true module constants.
- **Tests:** `<unit>.test.ts`, co-located with the unit.
- **Booleans:** name them as assertions (`isIndexed`, `hasLinks`), not
  `flag`/`data`.

### Folder structure & file organization
- Follow `docs/REPOSITORY_STRUCTURE.md` exactly. A file goes in the layer its
  dependencies allow, not "wherever."
- One primary concept per file. If the name needs "and," split the file.
- Co-locate unit tests with code. Integration/e2e tests live in `tests/`.
- No circular imports. Prefer direct deep imports over barrel re-exports in app
  code.

### Commenting
- Comments explain **why**, not **what** (the code says what).
- Document non-obvious decisions inline and link the ADR if one exists.
- Every public port, type, and exported function gets a TSDoc comment.
- Avoid commented-out code — delete it; git remembers.

### Documentation expectations
- Every module has a one-line purpose at the top of its entry file.
- Major design decisions → an ADR in `docs/adr/` and a pointer in
  `memory/decisions.md`.
- User-facing behavior → `docs/user/`.
- API/contract changes → `CHANGELOG.md`.
- Keep docs **synchronized with code** — stale docs are worse than no docs.

### Testing expectations
- Unit tests for all Core logic and pure functions, using in-memory fakes for
  ports. Fast and deterministic.
- Integration tests for adapter↔store behavior against a fixture vault.
- E2E test for the MCP↔Brain↔vault loop per phase.
- No test depends on the network unless explicitly marked and opt-in.
- A `FakeEmbedder` (deterministic) is used for semantic-search unit tests — no
  real model required.
- Tests are part of "done." Don't mark a feature complete with tests missing or
  failing.

---

## Repository Memory

Important project knowledge **must always be preserved** in `memory/`. This is
the repository's own brain — the meta-knowledge about the project itself (not
the user knowledge, which lives in their vault).

Always record:
- **Architecture decisions** — `memory/decisions.md` (+ an ADR in `docs/adr/`).
- **Bug fixes** — `memory/bugs.md` (what broke, root cause, the fix, the
  lesson).
- **Coding conventions** — `memory/coding-standards.md` (anything not obvious
  from the code or CLAUDE.md).
- **API changes** — `memory/decisions.md` + `CHANGELOG.md`.
- **Important implementation details** — `memory/architecture.md` (the
  "how-it-actually-works" that isn't in the design docs).
- **Future ideas** — `memory/ideas.md`.
- **Technical debt** — `memory/technical-debt.md` (what we deferred and why).
- **Glossary** — `memory/glossary.md` (Brain-specific terms).

See `memory/README.md` for the full catalog. **If you learn something
non-obvious while working, write it to the right memory file before closing the
task.**

---

## Documentation Rules

Whenever major changes occur, update the appropriate documentation **in the
same change**:

| Change type | Update |
|---|---|
| Architecture / layering | `docs/ARCHITECTURE.md` + ADR + `memory/decisions.md` |
| New/changed MCP tool | `docs/MCP_TOOLS.md` + `CHANGELOG.md` |
| Memory model change | `docs/MEMORY_ARCHITECTURE.md` |
| Repo structure change | `docs/REPOSITORY_STRUCTURE.md` |
| Stack change | `docs/TECH_STACK.md` + ADR |
| Phase progress | `memory/roadmap.md` (+ `docs/ROADMAP.md` if scope shifts) |
| User-facing behavior | `docs/user/*` |

**The documentation evolves alongside the code.** A PR that changes behavior but
not docs is incomplete. Stale documentation is treated as a bug.

---

## Roadmap

Six phases, each independently valuable. Full detail in `docs/ROADMAP.md`;
live status in `memory/roadmap.md`.

1. **MVP — Local Memory + Lexical Search:** vault I/O, MCP server, FTS5 search,
   remember/recall. Proves the loop.
2. **Semantic Search:** Ollama embeddings + LanceDB; semantic + hybrid search.
3. **Knowledge Graph:** SQLite graph; neighbors, paths, clusters, orphans.
4. **Automatic Memory:** append/forget/tag; reviewable auto-memory proposals.
5. **Context Builder:** `brain_build_context` — token-budgeted, cited bundles.
6. **AI Knowledge Manager:** extraction, auto-linking, dedup, gap detection.

Cross-cutting (continuous): docs, observability, performance, security,
community.

---

## Contributor Guide

(See also `CONTRIBUTING.md` when it exists; this section is the AI-facing
summary.)

### How to add a feature
1. **Confirm it fits the architecture.** If it's a new external tech, it's a new
   adapter behind an existing or new port — not a Core change.
2. **Read first.** Read the relevant `docs/` and `memory/` files. Don't assume.
3. **Decide before implementing.** For anything non-trivial, write the approach
   down (an ADR or a `memory/decisions.md` entry) and get alignment.
4. **Implement in the right layer.** Respect the import rules. The linter is
   the floor, not the ceiling.
5. **Test it.** Unit (fake ports) + integration where it crosses a boundary.
6. **Document it.** Update the matching `docs/` file, `CHANGELOG.md`, and the
   relevant `memory/` file.
7. **Keep it small.** One concern per change. Reviewable in one sitting.

### How to organize code
- Put it in the layer its dependencies allow (see the table in
  `docs/REPOSITORY_STRUCTURE.md`).
- One responsibility per file. Co-locate its unit test.
- Wire concrete implementations **only** in `src/composition-root.ts`.

### How to document changes
- Behavior change → matching `docs/` update + `CHANGELOG.md`.
- Architectural decision → ADR in `docs/adr/` + pointer in
  `memory/decisions.md`.
- Non-obvious learning → the right `memory/` file.

---

## AI Collaboration Rules

This section is the most important for AI agents. This repository is a
**long-term project**, not a one-shot task.

The AI (Claude) **must**:

- **Read existing documentation first.** Before proposing or writing anything,
  read `docs/ARCHITECTURE.md`, `docs/REPOSITORY_STRUCTURE.md`, and any
  `memory/` file relevant to the task. Surface what you found before acting.
- **Never assume architecture.** If something isn't documented, say so and ask —
  don't invent. If the code disagrees with the docs, flag it; don't silently
  pick a side.
- **Keep consistency.** Match existing patterns, names, and idioms. A new module
  should look like it was written by the same author as the rest.
- **Suggest improvements.** When you spot a cleaner abstraction, a missing test,
  or a doc drift, raise it — but don't sneak large changes into an unrelated
  task.
- **Prefer incremental development.** Ship the smallest correct step. Big-bang
  rewrites are rejected by default; break them into reviewable increments.
- **Preserve project knowledge.** Write what you learned to `memory/`. If you
  undo a decision, update `memory/decisions.md` and the ADR — don't leave
  contradictions.
- **Explain major architectural decisions before implementing them.** For
  anything that crosses a layer, changes a port, or affects an MCP tool, state
  the decision and rationale **first**, get alignment, then implement.
- **Never break invariants.** (Markdown-canonical; one-writer-per-store; Core
  knows no infrastructure; all external access through ports; derived stores
  rebuildable; no silent network.) A "fix" that breaks an invariant is a bug.

---

## Definition of Done

A feature is **done** only when **all** of the following are true:

- [ ] **Working implementation** that respects the architecture and layering.
- [ ] **Documentation** updated for every changed behavior (`docs/` + changelog).
- [ ] **Tests** (unit, plus integration/e2e where the change crosses a
      boundary) — passing, not skipped.
- [ ] **Updated project memory** (`memory/`) where the change introduced or
      resolved non-obvious knowledge.
- [ ] **Updated roadmap** (`memory/roadmap.md`, and `docs/ROADMAP.md` if scope
      shifted) — if the change affects phase scope or status.

If any box is unchecked, the feature is not done — say so plainly. Don't claim
completion on partial work.

---

## Quick reference — where things live

| Need | Look at |
|---|---|
| The big picture | `docs/ARCHITECTURE.md` |
| Where a file goes | `docs/REPOSITORY_STRUCTURE.md` |
| What an MCP tool does | `docs/MCP_TOOLS.md` |
| How memory works | `docs/MEMORY_ARCHITECTURE.md` |
| What's planned / status | `docs/ROADMAP.md` + `memory/roadmap.md` |
| Why a tech was chosen | `docs/TECH_STACK.md` |
| Past decisions | `memory/decisions.md` + `docs/adr/` |
| Conventions | `memory/coding-standards.md` + this file |
| Known debt | `memory/technical-debt.md` |
| Terms | `memory/glossary.md` |
