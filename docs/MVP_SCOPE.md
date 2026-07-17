# DevBrain — MVP Scope (Version 1)

> **Phase 1: Product Specification.** This document draws an unambiguous line
> around **Version 1** (the MVP — Phase 1 of `docs/ROADMAP.md`: Local Memory +
> Lexical Search). It states what is in, what is out, and what is *intentionally
> postponed*, with the reason for each. The goal of the MVP is to prove the
> end-to-end loop with the smallest correct surface; everything else is a later
> increment behind seams that are already designed in.
>
> **The MVP thesis:** a user points DevBrain at an Obsidian vault, starts the MCP
> server, and Claude Code can **remember** a fact and **recall it by keyword in a
> fresh session** — all local, all private, with derived stores rebuildable from
> the vault.

---

## 1. What IS included in Version 1

### 1.1 Foundation & vault
- **V1-1.** Attachment to a user-specified Obsidian vault directory as the
  canonical source of truth.
- **V1-2.** Parsing of Markdown notes with YAML frontmatter, body, tags, and
  `[[wikilinks]]` into a structured note model; deterministic wikilink
  resolution with dangling-link recording (no silent drops).
- **V1-3.** A single storage authority owning all vault reads/writes, with
  path-traversal jail and atomic (temp-file + rename) writes.

### 1.2 Recall (retrieve specific memories)
- **V1-4.** `devbrain_recall_by_id` — fetch a memory by stable ID or vault path,
  with optional body inclusion.
- **V1-5.** `devbrain_recall_recent` — list most-recently changed memories,
  filterable by recency window and tags.

### 1.3 Search
- **V1-6.** `devbrain_search_lexical` — keyword/full-text search (FTS5) over note
  text, with tag/date filters, ranked results, and a `limit`/token budget.

### 1.4 Remember (write/update)
- **V1-7.** `devbrain_remember` — create-or-update a memory with stable ID,
  frontmatter, tags, resolved wikilinks; idempotent upsert on title/path.

### 1.5 Indexing & sync
- **V1-8.** Incremental indexing of metadata + FTS, gated on a per-note
  **normalized full-content hash** (frontmatter + body); `mtime`+size as a fast
  pre-filter. Pinned by ADR-0009 (Accepted).
- **V1-9.** A file watcher (chokidar) detecting create/modify/delete/move,
  debounced for burst saves, triggering incremental re-index.
- **V1-10.** `devbrain_status` — vault path, total/indexed/pending, last sync,
  errors.
- **V1-11.** `devbrain_rebuild` — wipe + rebuild derived stores from the vault
  (full) or re-index by note IDs (incremental).

### 1.6 Configuration & admin
- **V1-12.** Layered typed config (defaults < env < file < CLI flags).
- **V1-13.** `devbrain_config_get` / `devbrain_config_set` for runtime-safe keys
  only (model, log level, budgets).

### 1.7 MCP server & CLI
- **V1-14.** An MCP server over stdio exposing the tools above, with schema
  validation, structured outputs, provenance on results, and no business logic
  in the MCP layer.
- **V1-15.** A `devbrain` CLI with `index`, `search`, `status` (thin caller of
  core).

### 1.8 Architecture, quality & onboarding
- **V1-16.** The layered architecture with enforced (lint) import boundaries,
  ports in `core/ports/`, adapters for concrete tech, and a single composition
  root.
- **V1-17.** Unit tests (co-located, in-memory fakes) for all core logic;
  integration tests for the vault round-trip; one e2e test driving MCP → DevBrain →
  sample vault.
- **V1-18.** A sample vault in `examples/` and a getting-started doc in
  `docs/user/`.
- **V1-19.** Structured logging with levels + quiet mode; a typed error
  hierarchy.

---

## 2. What is NOT included in Version 1

These are explicitly out of the MVP. Each has a home in a future phase (see
`docs/ROADMAP.md`) and, where relevant, a seam already designed in so its
addition is an increment, not a rewrite.

| Out of MVP | Why out | Where it lives later |
|---|---|---|
| Semantic / vector search (`devbrain_search_semantic`, `devbrain_search_hybrid`) | Prove the loop with lexical first; avoid a mandatory Ollama dependency in the first release. | Phase 2 |
| Embeddings / Ollama integration | Same — and to keep the first release light. | Phase 2 (ADR-0007) |
| Vector store (LanceDB) | Same. | Phase 2 (ADR-0005) |
| Knowledge graph tools (`devbrain_graph_*`) | Relationship traversal is a later increment; FTS is enough to prove retrieval. | Phase 3 |
| `devbrain_append`, `devbrain_forget`, `devbrain_tag` | Richer memory lifecycle is Phase 4; the MVP writes via `devbrain_remember`. | Phase 4 |
| Reviewable auto-memory (propose→confirm) | Autonomous writes are never an MVP goal. | Phase 4 |
| `devbrain_build_context` (token-budgeted bundles) | Context assembly is Phase 5; MVP loads memory via recall/search. | Phase 5 |
| `devbrain_extract`, `devbrain_index_source`, auto-linking, dedup, gap detection | AI curation is Phase 6. | Phase 6 |
| HTTP/SSE (multi-client) transport | Multi-client is a future need; stdio is the local MVP transport. | Post-1.0 (ADR-0011) |
| Multi-vault support | Single vault proves the model; namespacing is a later increment. | Post-1.0 |
| Remote embedding backend | Privacy-first default is local; remote is opt-in only, and not in MVP. | Post-1.0 (ADR-0004) |
| Plugin SDK | Community adapters register at the composition root today; a formal SDK is later. | Post-1.0 |
| Obsidian companion plugin | In-vault UX is a thin client on top of a stable DevBrain; later. | Post-1.0 |
| Git-backed vault history/diffs | DevBrain doesn't version the vault in MVP; the user brings backups. | Post-1.0 |
| Telemetry / analytics / crash reporting | Never (privacy-first). | Never |
| A hosted / SaaS offering | Never (local-first by definition). | Never |
| Central enterprise governance / SSO / SLAs | Out of target market. | Never (for the foreseeable roadmap) |

---

## 3. What is intentionally postponed (and why "postponed" ≠ "won't do")

"Postponed" means we *want* it and have left a seam for it, but including it now
would either risk the MVP's correctness or push its first release past the
point where it proves the loop. These are the highest-value deferred items, with
the deferral rationale.

### 3.1 Semantic search (postponed to Phase 2)
- **Want it because** meaning-based retrieval ("auth" ↔ "authentication") is a
  core part of the long-term vision.
- **Postpone because** the MVP must prove the store→recall→search→persist loop,
  and lexical search already proves retrieval and serves the most common real
  query shape (exact identifiers, error strings). Adding embeddings now would
  make the first release depend on a running local model server — friction at
  the worst moment (first try).
- **Seam left:** `IEmbedder` and `IVectorStore` ports are designed in; the
  indexer pipeline and chunker are Phase-2 increments.

### 3.2 Knowledge graph (postponed to Phase 3)
- **Want it because** relationship traversal ("how does X relate to Y?") is a
  differentiator.
- **Postpone because** graph queries are a *second* retrieval modality, not a
  prerequisite for proving the loop. FTS suffices for the MVP's recall promise.
- **Seam left:** `IGraphStore` port and the wikilink/tag extraction that feeds
  it are designed in.

### 3.3 Richer memory lifecycle — append / forget / tag (postponed to Phase 4)
- **Want it because** low-friction, safe writes (append without rewrite;
  reversible archive; confirm-gated delete) are central to the UX.
- **Postpone because** the MVP's write path (`devbrain_remember` upsert) already
  proves durable, idempotent writes. The richer ops add safety/ergonomics, not
  the core loop.
- **Seam left:** storage authority and upsert semantics are in place; append /
  archive / tag are additive tools on the same storage.

### 3.4 Context builder (postponed to Phase 5)
- **Want it because** "load only the right memory" is the answer to context
  bloat — a headline value of the product.
- **Postpone because** the MVP already retrieves scoped memory via recall/search
  with limits and provenance. The dedicated token-budgeted bundle assembler is a
  Phase-5 increment that composes the retrieval primitives.
- **Seam left:** `IContextStrategy` port is designed in.

### 3.5 AI knowledge manager — extract / index_source / auto-link / dedup / gaps
  (postponed to Phase 6)
- **Want it because** a memory layer that *curates itself* is the long-term
  ambition.
- **Postpone because** autonomous, unreviewed writes are never an MVP goal, and
  extraction quality needs the retrieval primitives to be solid first.
- **Seam left:** `IExtractor` port is designed in; propose→confirm is the
  required safety shape.

---

## 4. Why the MVP is shaped this way (summary)

- **Prove the loop, not the ceiling.** Store → recall → search → persist, local
  and private, rebuildable. That is the smallest slice that demonstrates the
  product's reason to exist.
- **Lexical before semantic.** FTS5 catches the most common real queries (exact
  identifiers, error strings) and needs no model server — so the first release
  is light and runnable in minutes.
- **No mandatory external service.** The MVP has zero daemons (SQLite + files,
  in-process). Ollama is *not* required to try DevBrain. This keeps first-run
  friction minimal.
- **Seams, not shortcuts.** Every deferred capability has a port already
  designed in, so Phases 2–6 are *additive* (new adapters/tools), not rewrites.
  This is the MVP's real job: establish a foundation that doesn't have to be
  undone.

---

## 5. MVP exit criteria (the definition of "Version 1 is done")

These mirror the acceptance criteria in `docs/REQUIREMENTS.md` and the
measurable targets in `docs/SUCCESS_CRITERIA.md`:

1. A user points DevBrain at a vault, starts the MCP server, and Claude Code can
   invoke DevBrain tools over stdio (Windows + Linux).
2. Claude creates a memory with `devbrain_remember`; it appears as valid Markdown
   with a stable ID; re-saving is idempotent (no duplicate).
3. In a *fresh* session, Claude recalls that memory by ID and finds it by
   keyword with `devbrain_search_lexical`.
4. Editing a note in Obsidian triggers incremental re-indexing; `devbrain_status`
   reflects it; the updated content is searchable.
5. `devbrain_rebuild --full` reproduces derived stores from the vault; deleting
   derived stores first loses nothing.
6. A path-traversal write is rejected; no outbound network call exists outside
   an off-by-default flag; no telemetry code.
7. All MVP tools have passing unit tests; one integration test covers the vault
   round-trip; one e2e drives MCP → DevBrain → sample vault.
8. The layering rule is enforced by lint, and Core unit tests pass with
   in-memory fakes.

If any of these is unmet, Version 1 is not done — say so plainly.
