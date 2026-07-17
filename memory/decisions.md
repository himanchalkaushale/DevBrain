# decisions.md — Architecture Decision Records (log)

> Every significant decision, with context and consequences. Full ADRs also
> live in `docs/adr/` (one file per decision); this file is the chronological
> index + summary. Newest at top.

Format: `ADR-NNNN — Title — Status — Date`

---

## ADR-0001 — Markdown is canonical; all indexes are derived
- **Status:** Accepted
- **Date:** 2026-07-17
- **Context:** Brain needs durable, private memory. We must choose what the
  source of truth is: the Markdown files, or the derived indexes (vectors,
  graph)?
- **Decision:** The Obsidian vault (Markdown) is the single source of truth.
  Embeddings, the vector DB, and the graph are derived, rebuildable indexes.
- **Consequences:** Any derived store can be deleted and rebuilt from the vault.
  We must never store knowledge *only* in a derived store. Rebuild performance
  matters (incremental indexing). The memory survives Brain itself.

## ADR-0002 — Layered architecture; dependencies point inward/downward only
- **Status:** Accepted
- **Date:** 2026-07-17
- **Context:** The project must survive years of tech churn (new models, DBs,
  MCP features). How do we keep it maintainable?
- **Decision:** Strict layering — `mcp/` → `core/` → `indexer/` + `adapters/`
  + `infrastructure/`. Core depends only on its own ports and model types.
  Concrete tech lives only in `adapters/`/`infrastructure/`. Enforced by ESLint.
- **Consequences:** Core is unit-testable with in-memory fakes. Adapters are
  swappable. A single composition root does all wiring. Contributors must learn
  the layer rules; the linter is the floor.

## ADR-0003 — One writer per store
- **Status:** Accepted
- **Date:** 2026-07-17
- **Context:** Multiple modules writing to the same store invites races and
  inconsistency.
- **Decision:** Storage is the sole writer to the vault; the Indexer is the sole
  writer to the vector and graph stores. Queries are read-only.
- **Consequences:** Clear ownership. A write to the vault triggers the watcher →
  indexer; the indexing path is the only updater of derived stores.

## ADR-0004 — Local-first & privacy-first: no outbound network by default
- **Status:** Accepted
- **Date:** 2026-07-17
- **Context:** Cloud memory layers ship user knowledge to servers. We must be
  verifiably private.
- **Decision:** Brain makes no outbound network calls unless the user opts into
  a specific remote capability (e.g., a remote embedder). Embeddings run via
  local Ollama. No telemetry/analytics, ever.
- **Consequences:** The only network-capable code lives behind `IEmbedder` and an
  off-by-default flag. Auditable. Offline-capable by default.

## ADR-0005 — LanceDB for the vector store
- **Status:** Accepted
- **Date:** 2026-07-17
- **Context:** Need a local vector DB. Options: LanceDB (embedded, file-based),
  ChromaDB (leans client/server), Qdrant (heavier).
- **Decision:** LanceDB. It's in-process, file-based, no server daemon — the
  most faithful to local-first.
- **Consequences:** Zero extra processes. `IVectorStore` keeps ChromaDB/Qdrant as
  future adapter options without Core changes. (Full rationale in
  `docs/TECH_STACK.md`.)

## ADR-0006 — SQLite for metadata + graph + FTS, co-located in one DB
- **Status:** Accepted
- **Date:** 2026-07-17
- **Context:** Need relational metadata, a knowledge graph, and full-text search.
  A separate graph DB or a second engine adds complexity.
- **Decision:** SQLite (`better-sqlite3`) for all three, in one DB file. FTS5 for
  lexical search; tables for graph nodes/edges/tags.
- **Consequences:** One file, no daemon, transactional. Revisit if FTS/graph
  write contention or scale demands a split.

## ADR-0007 — Ollama + nomic-embed-text for embeddings
- **Status:** Accepted
- **Date:** 2026-07-17
- **Context:** Need local embeddings. `IEmbedder` makes the model swappable.
- **Decision:** Default to Ollama serving `nomic-embed-text`.
- **Consequences:** No network for embedding. Dimensionality recorded per store
  so a model swap forces a rebuild rather than silent corruption. (Implementation
  deferred to Phase 2 — see ADR-0013.)

## ADR-0013 — Vector DB & embeddings are out of the MVP (scoping)
- **Status:** Accepted
- **Date:** 2026-07-17
- **Context:** ADRs 0005/0007 choose LanceDB + Ollama/nomic, but when do they
  ship? The MVP's job is to prove the loop (store→recall→search→persist) with
  the smallest correct surface.
- **Decision:** The MVP (Phase 1) ships **lexical search only**. The vector
  store and embeddings are implemented in Phase 2. The tech *decisions*
  (0005/0007) are Accepted now so Phase 1 leaves the right seams
  (`IVectorStore`, `IEmbedder`); the *implementation* is deferred.
- **Consequences:** MVP requires no model server (no Ollama) to try Brain —
  lower first-run friction. Semantic search ("auth"↔"authentication") is a
  Phase-2 increment. Full rationale in `docs/DESIGN_DECISIONS.md` and scope in
  `docs/MVP_SCOPE.md`.

## ADR-0008 — Chunking defaults
- **Status:** Accepted
- **Date:** 2026-07-17
- **Context:** Phase 2 embeds notes; the chunk is the embed/citation unit.
  Prior docs pre-committed "heading-aware, configurable size/overlap,
  `{ noteId, headingPath, charStart, charEnd }` provenance" but left the
      numeric defaults and the code-block edge case open.
- **Decision:** Structure-aware Markdown chunking with **atomic block units**
  (fenced code, tables, lists never split). Defaults: **token unit**, target
  **512 tokens**, overlap **64 tokens** (~12.5%). Oversized atomic blocks are
  emitted as one over-target chunk and logged (E1). Flat notes are sub-chunked
  by the prose rule. All knobs are config; the unit is token by default with a
  char-based estimator fallback for CI/offline.
- **Consequences:** Coherent, citation-complete chunks; closes the
  `memory/architecture.md` code-block edge case. Couples to ADR-0009: the content
  hash must cover the full file so a heading rename re-indexes the note.
  Implementation deferred to Phase 2 (per ADR-0013). Full ADR:
  `docs/adr/0008-chunking-defaults.md`.

## ADR-0009 — Content hash source for incremental indexing
- **Status:** Accepted
- **Date:** 2026-07-17
- **Context:** Incremental indexing is gated on a per-note content hash
  (`hash(note) → indexed`) so unchanged notes are skipped — O(changes), not
  O(vault) (FR-5.2; C-15). The open question was what the hash covers.
  ADR-0008 (Accepted) already constrained the answer: the hash must cover the
  full file so heading renames (a body edit) re-index — so "frontmatter-only vs
  full-file" was really "which full-file form."
- **Decision:** **Normalized full-content hash** — SHA-256 over a normalized
  serial form of **frontmatter + body** (LF, single trailing newline, BOM
  stripped, stable frontmatter key order). `mtime` + size is an **optional fast
  pre-filter** only; the normalized hash is the **authoritative** gate (robust to
  Git/Syncthing mtime-without-content-change churn). A raw full-file byte hash is
  an opt-in **strict** mode. Ownership (ADR-0003): the hash **function** lives
  with the Note model / Storage; the `hash → indexed` **sync-state table** lives
  with the Indexer.
- **Consequences:** Content-complete (catches body + heading edits, satisfying
  ADR-0008's coupling) and stable across whitespace/sync churn (no spurious
  re-embeds). The normalization is load-bearing — changes invalidate all hashes
  → a one-time `--full` (mitigated by versioning the normalization). The same
  key gates FTS in Phase 1 and embeddings/graph in Phase 2. Frontmatter-only
  rejected (silently stale, contradicts ADR-0008); raw-bytes rejected as default
  (whitespace-fragile); rendered-chunk-text rejected (couples sync-state to the
  chunker). Full ADR: `docs/adr/0009-content-hash-source.md`.

---

## Open decisions (to resolve)

- **ADR-0010 (proposed):** License — MIT vs Apache-2.0. Resolve before first
  release.
- **ADR-0011 (proposed):** MCP transport defaults (stdio primary; HTTP/SSE
  timeline). Resolve at Phase 1 kickoff.
- **ADR-0012 (proposed):** CLI framework — citty vs commander. Low-stakes;
  resolve at Phase 1 kickoff.
