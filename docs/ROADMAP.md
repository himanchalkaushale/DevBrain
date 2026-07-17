# Project Brain — Development Roadmap

The project is delivered in six phases. Each phase is independently valuable —
every phase ships a working slice, not a partial subsystem. No phase begins
until the previous is "done" per the Definition of Done in `CLAUDE.md`.

> Dates are not committed. Phases are scoped by capability, not calendar.
> Track live status in `memory/roadmap.md`.

---

## Phase 1 — MVP: Local Memory + Lexical Search

**Goal:** Claude Code can store and retrieve project memory from an Obsidian
vault, over MCP, with no embeddings yet. Proves the end-to-end loop.

**Deliverables:**
- Repo scaffolded per `docs/REPOSITORY_STRUCTURE.md` (TS, ESLint boundaries,
  Vitest, build, CI).
- `IStorage` port + Obsidian adapter: parse Markdown + frontmatter, resolve
  `[[wikilinks]]`, atomic writes, path-traversal guards.
- SQLite-backed metadata + **FTS5 lexical search** (`brain_search_lexical`).
- MCP server (stdio) with tools:
  - `brain_recall_by_id`, `brain_recall_recent`
  - `brain_search_lexical`
  - `brain_remember`
  - `brain_status`, `brain_rebuild`, `brain_config_get`/`set`
- CLI: `brain index`, `brain search`, `brain status`.
- File watcher (chokidar) → incremental re-index of metadata/FTS.
- Composition root wiring + typed config.
- Sample vault in `examples/` + a getting-started doc.
- Tests: unit (co-located) + integration (vault round-trip) + one e2e (MCP
  client → Brain → sample vault).

**Exit criteria:** A user points Brain at their vault, starts the MCP server,
and Claude Code can remember a fact, then recall it by keyword in a fresh
session. All Phase-1 tools have tests. `brain_status` reports accurate
sync state.

---

## Phase 2 — Semantic Search

**Goal:** Meaning-based retrieval via local embeddings + a local vector DB.

**Deliverables:**
- `IEmbedder` port + Ollama adapter (`nomic-embed-text`).
- `IVectorStore` port + LanceDB adapter.
- Heading-aware chunker with configurable size/overlap.
- Indexer pipeline extended: chunk → embed → upsert (incremental, hash-gated).
- Tools: `brain_search_semantic`, `brain_search_hybrid` (semantic + lexical
  merge + re-rank).
- Dimensionality-mismatch detection → forced rebuild.
- Embedding batching + Ollama-down fallback (lexical-only with warning).
- Config: embedding model, chunk size/overlap, hybrid weights.
- Tests: fake embedder for unit tests; integration test against a real Ollama
  (marked, opt-in in CI).

**Exit criteria:** `brain_search_hybrid("how do we handle auth")` returns the
auth notes even when the word "auth" never appears. Rebuild reproduces the
vector store from the vault.

---

## Phase 3 — Knowledge Graph

**Goal:** Relationship-aware retrieval and vault hygiene.

**Deliverables:**
- `IGraphStore` port + SQLite adapter (nodes/edges/tags).
- Graph Builder: `[[wikilinks]]`, tags, and frontmatter relations → edges.
- Tools: `brain_graph_neighbors`, `brain_graph_path`, `brain_graph_clusters`
  (Louvain/WCC), `brain_graph_orphans`.
- Graph expansion integrated as an optional step in retrieval.
- CLI: `brain graph neighbors|path|orphans`.
- Visualization export (JSON/GraphML) — not an in-process UI.
- Tests: graph construction + traversal correctness on a fixture vault.

**Exit criteria:** Claude can answer "how does X relate to Y?" with a real path,
and `brain_graph_orphans` surfaces under-linked notes. Full graph rebuilds from
the vault.

---

## Phase 4 — Automatic Memory

**Goal:** Reduce manual note-writing; make remembering low-friction and safe.

**Deliverables:**
- `brain_append` (section-aware), `brain_forget` (archive/default + confirm
  hard-delete with pre-delete backup), `brain_tag`.
- A **reviewable auto-memory proposal** flow: the Extractor proposes, nothing
  auto-writes without an explicit confirmation path.
- Idempotent upserts keyed on title/path; duplicate detection.
- Write-protect / dry-run modes.
- Config: auto-memory policy (off / propose-only / confirmed-write).
- Tests: idempotency, archive-vs-delete safety, concurrency on same note.

**Exit criteria:** Claude can append a fact to an existing memory without
rewriting it; archiving is reversible; no destructive op happens without
`confirm`.

---

## Phase 5 — Context Builder

**Goal:** The "what should I actually load?" brain — assemble token-budgeted,
citation-backed context bundles.

**Deliverables:**
- `IContextStrategy` port + default strategy (recall + recency + graph expand +
  budget + dedupe).
- Tool: `brain_build_context` returning a ready-to-paste bundle + a source
  manifest.
- Token budgeting (estimator) and ordering for coherence.
- Provenance/citation in every bundle.
- CLI: `brain context <intent>`.
- Tests: budget enforcement, dedupe, manifest accuracy.

**Exit criteria:** Given an intent, `brain_build_context` returns a bundle that
fits a configured token budget and cites its sources; Claude loads it and works
with accurate, scoped memory.

---

## Phase 6 — AI Knowledge Manager

**Goal:** Claude actively curates the knowledge base — extracting, linking,
deduplicating, and surfacing gaps.

**Deliverables:**
- `brain_extract` (conversation/code/text → proposed memories, reviewable).
- `brain_index_source` (index external code/docs read-only).
- Auto-linking suggestions (propose `[[wikilinks]]` between related notes).
- Deduplication and merge suggestions.
- Gap detection: "you have notes about X and Z but nothing connecting them."
- A curation loop: propose → review (human or Claude) → apply.
- Tests: extraction quality on fixtures; safety of apply paths.

**Exit criteria:** Claude can take a conversation log, propose structured
memories, and — after review — write them as well-linked, de-duplicated notes.
`brain_index_source` lets Claude recall symbols from an external codebase.

---

## Cross-cutting work (continuous, not phased)

- **Docs:** each phase ships its user docs in `docs/user/`.
- **Observability:** `brain_status` and structured logs grow with each phase.
- **Performance:** incremental indexing and ANN tuning are revisited per phase.
- **Security:** path guards, write-protect, and audit of any new network path.
- **Community:** `CONTRIBUTING.md`, issue/PR templates, and an ADR process live
  from Phase 1.

## Post-1.0 ideas (not scheduled)

- Multi-vault support with namespaced indexes.
- HTTP/SSE transport for multi-client Brain.
- Optional remote embedding (opt-in, audited).
- Plugin SDK for third-party adapters.
- Obsidian plugin companion for in-vault Brain UX.
