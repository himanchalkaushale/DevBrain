# DevBrain — Product Specification

> **Phase 1: Product Specification.** This document defines *what* DevBrain is
> and *why* it exists. It is intentionally free of implementation detail — the
> *how* lives in `docs/ARCHITECTURE.md`, `docs/MCP_TOOLS.md`, and
> `docs/TECH_STACK.md`. Read this first; read those only when behavior must be
> pinned down to a contract.
>
> **Status:** Design phase. No implementation exists. This spec is allowed to
> evolve, but every change is a recorded decision (see `memory/decisions.md`).
>
> **Scope note:** Where this spec references capabilities, "MVP" means the
> features targeted by Phase 1 of `docs/ROADMAP.md` (Local Memory + Lexical
> Search). Everything else is a future phase and is called out as such.

---

## 1. Vision

**Make Claude Code behave like an engineer who never forgets anything about the
project.**

DevBrain is a **local-first AI memory layer for Claude Code**. It turns an
Obsidian vault of Markdown notes into a persistent, queryable knowledge base that
Claude reads on demand and writes back to as durable memory — so that hard-won
project knowledge survives across sessions, summaries, and reboots, without ever
leaving the user's machine.

The long-term ambition is a memory layer that grows smarter over time: recallable
memory, traversable relationships, automatic note creation, AI-assisted
curation, and a knowledge graph that compounds in value — all local, all private,
all open-source.

---

## 2. Problem Statement

Claude Code's context window is **volatile and finite**. Knowledge that an engineer
and their AI assistant build together — *why* a decision was made, *how* a
subsystem works, *which* bug was fixed and the *lesson* from it — is lost the
moment a conversation ends, is summarized, or hits a context limit. The cost is
repetition: re-explaining the architecture, re-discovering the gotcha,
re-deriving the decision. Over weeks, this compounds into wasted effort and
slower, less trustworthy assistance.

Existing fixes make tradeoffs the target users won't accept:

- **Cloud memory layers** ship private project knowledge to a server. Many
  engineering teams and solo developers cannot or will not do that.
- **Manual note-taking** offloads the burden to the human, who must remember to
  write, organize, and search their own notes — and who rarely does it
  consistently under deadline pressure.
- **"Just keep a bigger context"** doesn't scale: transcripts grow unbounded,
  cost rises, and signal drowns in noise. Loading everything is not memory; it's
  hoarding.

There is no widely-adopted answer that is **persistent, retrievable, private,
local, and AI-native** at the same time. DevBrain is that answer.

---

## 3. Target Users

### 3.1 Primary: the solo developer / indie engineer
- Works on one or a few long-lived codebases (personal projects, startups,
  freelance engagements).
- Uses Claude Code (or a comparable MCP-capable AI coding client) daily.
- Cares about privacy — their code, decisions, and notes stay on their machine.
- Already keeps notes (Obsidian, a notes folder, scattered Markdown) but
  inconsistently; wants the AI to help maintain memory rather than fight it.

### 3.2 Secondary: the small engineering team
- 2–15 engineers sharing a codebase and a desire for shared institutional
  memory ("why did we do X?").
- Comfortable running a local service; may share one vault via a synced folder
  (Git, Syncthing, a network drive) in the MVP, with multi-vault support as a
  future capability.
- Wants onboarding to be faster: a new teammate's AI assistant can recall the
  team's decisions and gotchas instead of re-asking.

### 3.3 Tertiary: the privacy-conscious power user
- Uses Obsidian heavily; wants their vault to *also* serve as an AI memory layer
  without surrendering it to a cloud service.
- Comfortable on the command line; values auditability ("prove nothing leaves
  my machine").

### 3.4 Non-targets (explicit)
- **Enterprise customers needing central governance, SSO, and SLAs** — DevBrain is
  local-first by design; central management is out of scope for the foreseeable
  roadmap.
- **Users who want a hosted/SaaS memory product** — DevBrain will never host your
  data.
- **Non-developers** — DevBrain is an AI-coding-assistant memory layer; a general
  personal-knowledge-manager is adjacent but not the MVP target.

---

## 4. Goals

G1. **Persistent memory across sessions.** Knowledge Claude writes to DevBrain is
recallable in any later session, by ID, by recency, and (MVP) by keyword.

G2. **Privacy by construction.** Everything — vault, indexes, embeddings — runs
and stays local. No outbound network calls unless the user explicitly opts into a
remote capability. This is verifiable by audit, not a promise.

G3. **A human-readable, durable, portable format.** Memory lives as Markdown in
an Obsidian vault, editable by the human at any time, with derived indexes that
can be deleted and rebuilt from the files.

G4. **An AI-native retrieval interface.** Claude Code reads and writes memory
through MCP tools, loading only what's relevant rather than the whole vault.

G5. **A modular, swappable foundation.** Every external technology (embedding
model, vector DB, graph store) sits behind an interface, so the project can
evolve for years without rewrites.

G6. **A high-quality open-source project.** Clear docs, a recorded decision
history, enforced architectural rules, and a contribution path that thousands of
contributors could follow.

G7. **Low-friction, safe writes.** Claude can record a memory in one tool call;
destructive operations are guarded and reversible by default.

---

## 5. Non-Goals

N1. **Not a hosted or SaaS product.** There is no DevBrain cloud. (A *remote
embedding model* is an explicit, off-by-default opt-in — that is not hosting
memory.)

N2. **Not a replacement for Obsidian.** DevBrain respects Obsidian's conventions
but does not require Obsidian to be running and does not modify its config.

N3. **Not a general-purpose vector database or RAG platform.** DevBrain is a memory
layer for an AI coding assistant, scoped to a personal/team vault.

N4. **No telemetry or analytics.** DevBrain makes no "phone home" calls, ever, for
product analytics. Crashes are not auto-reported to a server.

N5. **No autonomous, unattended memory writes in the MVP.** DevBrain records what
Claude (or the user) explicitly asks it to record. Automatic, reviewable
proposals are a future phase; unreviewed auto-writing is never a goal.

N6. **Not a Git/backup system.** DevBrain does not version memory itself in the MVP
(though a Git-backed vault is a future idea). The user is responsible for vault
backups.

N7. **No proprietary dependencies.** The stack is free and open-source
end-to-end; DevBrain will not depend on closed-source components.

N8. **No multi-user server in the MVP.** A single local service with stdio
transport; multi-client/multi-vault is a future phase.

---

## 6. MVP Features (Phase 1)

The MVP proves the end-to-end loop: **store and retrieve project memory from an
Obsidian vault, over MCP, with keyword search and no embeddings yet.**

M1. **Connect to an Obsidian vault.** Point DevBrain at a vault directory; DevBrain
reads Markdown notes with frontmatter, tags, and `[[wikilinks]]` and treats that
directory as the canonical source of truth.

M2. **Recall by ID/path and by recency.** Claude can fetch a specific memory by
its stable ID or vault path, and list the most recently created/modified memories
to re-establish context at the start of a session.

M3. **Lexical (keyword) search.** Full-text search over note text — catches exact
identifiers, error strings, and file names. Metadata filters (tags, dates) narrow
results.

M4. **Write and update memories.** `devbrain_remember` creates or updates a Markdown
note with stable ID, frontmatter, tags, and resolved wikilinks, using upsert
semantics (idempotent on title/path).

M5. **Incremental indexing.** A file watcher detects vault changes and re-indexes
only what changed; `devbrain_status` reports accurate sync state (total, indexed,
pending, errors).

M6. **Recovery by rebuild.** Derived stores (metadata, FTS index) can be wiped and
rebuilt from the vault.

M7. **A command-line interface.** `devbrain index`, `devbrain search`, `devbrain status`
mirror core capabilities for humans and scripting.

M8. **Live configuration.** `devbrain_config_get` / `devbrain_config_set` for
runtime-safe keys (model, log level, budgets); layered config (defaults < env <
file < CLI).

M9. **Provenance on every result.** Any memory returned to Claude carries its
source path and a short "why" so it can be cited and trusted.

M10. **A sample vault and getting-started guide** so a new user can be running in
minutes.

---

## 7. Future Features (Phases 2–6 and beyond)

These are *intentionally out of the MVP* and tracked in `docs/ROADMAP.md`. They are
listed here so the MVP scope is unambiguous.

- **Semantic search** (Phase 2): meaning-based retrieval via local embeddings +
  a local vector DB; `devbrain_search_semantic` and `devbrain_search_hybrid`.
- **Knowledge graph** (Phase 3): neighbors, paths, clusters, orphans from
  wikilinks/tags; `devbrain_graph_*` tools.
- **Automatic, reviewable memory** (Phase 4): `devbrain_append`, `devbrain_forget`
  (archive + confirm-delete), `devbrain_tag`; a propose→confirm flow for
  auto-memory.
- **Context builder** (Phase 5): `devbrain_build_context` — token-budgeted,
  citation-backed context bundles for an intent.
- **AI knowledge manager** (Phase 6): `devbrain_extract`, `devbrain_index_source`,
  auto-linking, dedup, gap detection.
- **Multi-vault** support with namespaced indexes.
- **HTTP/SSE transport** for multi-client DevBrain.
- **Optional remote embedding** (opt-in, audited, off by default).
- **Plugin SDK** for third-party adapters.
- **Obsidian companion plugin** for in-vault DevBrain UX.
- **Git-backed vault** history and diffs.

---

## 8. Success Metrics

> Measurable targets are itemized in `docs/SUCCESS_CRITERIA.md`. The headline
> measures:

S1. **Loop works end-to-end:** a user points DevBrain at a vault, starts the MCP
server, and Claude can remember a fact then recall it by keyword in a *fresh*
session.

S2. **Privacy is real:** an audit of the codebase shows no outbound network call
outside an off-by-default remote flag, and no telemetry.

S3. **Recovery is real:** `devbrain_rebuild` from the vault reproduces all derived
stores; nothing is lost.

S4. **Quality is real:** all MVP tools have passing unit tests; one integration
test exercises the vault round-trip; one e2e test drives MCP → DevBrain → sample
vault.

S5. **Modularity is real:** the layering rule is enforced by lint, and Core can
be unit-tested with in-memory fakes (no filesystem, no DB, no network).

S6. **Speed is real:** incremental indexing is O(changes), not O(vault); keyword
search returns in well under a second on a personal vault.

---

## 9. Example User Workflows

### Workflow A — "Remember why, then recall it later"
1. During a session, Claude and the user decide to store a database choice.
2. Claude calls `devbrain_remember` with a title, the rationale, and tags
   (`storage`, `decision`). DevBrain writes a Markdown note atomically.
3. Days later, in a fresh session, Claude calls `devbrain_recall_recent` to
   re-establish context, then `devbrain_search_lexical` with "database choice" and
   cites the stored rationale.

### Workflow B — "Re-establish context at session start"
1. A new session begins on a long-lived project.
2. Claude calls `devbrain_recall_recent` (limit ~10) to see what was touched
   recently, reads a couple of summaries, and resumes work without the user
   re-explaining the project.

### Workflow C — "Find the gotcha"
1. The user hits an obscure error. Months ago they (or Claude) recorded the
   workaround.
2. Claude searches the error string with `devbrain_search_lexical`; lexical search
   is exactly the tool for exact error text. The note comes back with provenance;
   Claude applies the workaround and cites it.

### Workflow D — "Human edits the vault, DevBrain catches up"
1. The user reorganizes tags and rewrites a note in Obsidian directly.
2. The file watcher fires; the indexer re-processes only that note. `devbrain_status`
   reflects the new state. Search returns the updated content on the next query.

### Workflow E — "Indexes corrupted — recover"
1. The FTS/metadata store is corrupted or the user changed machines.
2. The user runs `devbrain rebuild`; DevBrain re-derives everything from the Markdown.
   No memory is lost because the files are canonical.

### Workflow F — "Audit for privacy"
1. A security-conscious user (or reviewer) greps the codebase for outbound network
   calls.
2. The only network-capable code is behind a single interface, gated by an
   off-by-default flag. The reviewer is satisfied: nothing leaves the machine
   unless the user asked for it.

---

## 10. User Stories

> Convention: `As a <role>, I want <goal>, so that <benefit>.` Stories marked
> **(MVP)** are targeted by Phase 1; the rest belong to future phases and are
> included to define the product's trajectory.

### Remembering & writing

1. **(MVP)** As a developer, I want Claude to save a decision's rationale as a
   memory, so that I don't re-litigate it next month.
2. **(MVP)** As a developer, I want to record a bug and its fix as a memory, so
   that the lesson persists past this session.
3. **(MVP)** As a developer, I want `devbrain_remember` to be idempotent, so that
   re-saving the same fact doesn't create duplicates.
4. **(MVP)** As a developer, I want memories written as plain Markdown, so that I
   can read and edit them in Obsidian without any special tool.
5. **(MVP)** As a developer, I want each memory to carry a stable ID, so that
   Claude can reference it precisely across sessions.
6. **(MVP)** As a developer, I want tags and wikilinks in my memories, so that
   knowledge is organized and connectable.
7. *(Future)* As a developer, I want Claude to *append* a new fact to an existing
   memory without rewriting the whole note.
8. *(Future)* As a developer, I want a reviewable propose→confirm flow for
   auto-memory, so that nothing is written without my awareness.
9. *(Future)* As a developer, I want archiving to be reversible and hard-delete
   to require explicit confirmation, so that I never lose memory by accident.

### Recalling & searching

10. **(MVP)** As a developer, I want to recall a specific memory by ID or path,
    so that I can pull exactly the note Claude referenced.
11. **(MVP)** As a developer, I want to list recently changed memories, so that I
    can re-establish context at the start of a session.
12. **(MVP)** As a developer, I want keyword search over my memories, so that I
    can find a note by an exact error string or identifier.
13. **(MVP)** As a developer, I want to filter search by tags and dates, so that
    results stay scoped to what's relevant.
14. **(MVP)** As a developer, I want every search result to include its source
    path and a short "why", so that Claude can cite memory and I can verify it.
15. *(Future)* As a developer, I want semantic search, so that "auth" finds notes
    about "authentication" even without the exact word.
16. *(Future)* As a developer, I want hybrid search that merges keyword and
    meaning, so that I get the best of both without choosing.
17. *(Future)* As a developer, I want to traverse the knowledge graph, so that I
    can answer "how does X relate to Y?"
18. *(Future)* As a developer, I want a token-budgeted context bundle for an
    intent, so that Claude loads only the right memory, not the whole vault.

### Trust, privacy & control

19. **(MVP)** As a privacy-conscious developer, I want everything to run locally,
    so that my project knowledge never leaves my machine.
20. **(MVP)** As a privacy-conscious developer, I want an auditable guarantee of
    no telemetry, so that I can verify the claim rather than trust it.
21. **(MVP)** As a developer, I want any remote capability to be off by default,
    so that I must opt in before anything goes over the network.
22. **(MVP)** As a developer, I want derived indexes to be rebuildable from the
    vault, so that corruption is never data loss.
23. **(MVP)** As a developer, I want the vault to be the source of truth, so that
    even if DevBrain disappears, my memory survives in plain Markdown.

### Daily operation & reliability

24. **(MVP)** As a developer, I want a `devbrain_status` command, so that I know
    whether memory is fresh or stale before I rely on it.
25. **(MVP)** As a developer, I want incremental re-indexing on file change, so
    that editing in Obsidian is reflected quickly without full re-indexing.
26. **(MVP)** As a developer, I want a CLI (`devbrain search`, `devbrain index`,
    `devbrain status`), so that I can use DevBrain from the terminal without an AI
    client.
27. **(MVP)** As a developer, I want live configuration for safe keys, so that I
    can tune behavior without editing files and restarting.
28. **(MVP)** As a developer, I want a sample vault and getting-started guide, so
    that I can try DevBrain in minutes.
29. **(MVP)** As a developer, I want atomic note writes, so that a crash never
    leaves a half-written memory.

### Extensibility & contribution

30. **(MVP)** As a contributor, I want the layering rule enforced by lint, so that
    the architecture can't rot quietly.
31. **(MVP)** As a contributor, I want Core to be unit-testable with in-memory
    fakes, so that I can develop logic without a DB, files, or network.
32. **(MVP)** As a contributor, I want one composition root for all wiring, so
    that "which implementation" is obvious and centralized.
33. *(Future)* As a contributor, I want a plugin SDK, so that I can add a new
    embedder or store without touching Core.
34. *(Future)* As a contributor, I want to swap LanceDB for another vector DB via
    an adapter, so that I'm never locked in.
35. *(Future)* As a contributor, I want an Obsidian companion plugin, so that I
    can interact with DevBrain from inside my vault.

### Team & scale (future)

36. *(Future)* As a team lead, I want shared memory via a synced vault, so that
    new teammates' assistants can recall our decisions.
37. *(Future)* As a team lead, I want multi-vault support, so that I can keep
    personal and work memory separate but queryable.
38. *(Future)* As a team lead, I want multi-client transport, so that several AI
    sessions share one DevBrain instance.
39. *(Future)* As a power user, I want gap detection ("you have X and Z but
    nothing connecting them"), so that my knowledge base gets denser over time.
40. *(Future)* As a power user, I want to index an external codebase read-only,
    so that Claude can recall symbols from a project without copying it in.

---

## 11. Related documents

| Need | See |
|---|---|
| The engineering philosophy | `docs/PROJECT_PRINCIPLES.md` |
| Architectural decisions | `docs/DESIGN_DECISIONS.md`, `memory/decisions.md` |
| Exactly what's in/out of Version 1 | `docs/MVP_SCOPE.md` |
| Measurable goals | `docs/SUCCESS_CRITERIA.md` |
| Detailed requirements | `docs/REQUIREMENTS.md` |
| System architecture | `docs/ARCHITECTURE.md` |
| The MCP tool catalog | `docs/MCP_TOOLS.md` |
| How memory works | `docs/MEMORY_ARCHITECTURE.md` |
| Phased plan | `docs/ROADMAP.md` |
| Technology choices | `docs/TECH_STACK.md` |
