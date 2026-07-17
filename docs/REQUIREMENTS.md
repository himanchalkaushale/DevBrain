# Project Brain — Requirements

> **Phase 1: Product Specification.** This document translates the product spec
> (`docs/PRODUCT_SPEC.md`) into testable requirements. It is organized into
> functional, non-functional, and quality-attribute sections, and closes with
> acceptance criteria.
>
> **Conventions:**
> - Each requirement has a stable ID (`FR-1`, `NFR-1`, `PR-1`, …).
> - `MUST` / `SHOULD` / `MAY` follow RFC 2119 intent.
> - **(MVP)** marks requirements targeted by Phase 1 of `docs/ROADMAP.md`. Others
>   belong to future phases and are stated here so the contract is complete.
> - Requirements are written as behavior, not implementation. *How* a requirement
>   is met lives in `docs/ARCHITECTURE.md` and `docs/TECH_STACK.md`.
> - This document defines requirements only; it does not commit to a schedule.

---

## 1. Functional Requirements

### 1.1 FR-1 — Vault connection & ownership

- **FR-1.1 (MVP)** The system MUST attach to a user-specified vault directory and
  treat its Markdown files as the canonical source of truth.
- **FR-1.2 (MVP)** The system MUST parse Markdown notes with YAML frontmatter,
  body, tags, and `[[wikilink]]` references into a structured in-memory note
  model.
- **FR-1.3 (MVP)** The system MUST resolve `[[wikilinks]]` to vault paths and
  record dangling (unresolvable) links deterministically — never silently
  dropping them.
- **FR-1.4 (MVP)** The system MUST own all vault writes through a single storage
  authority; no other subsystem writes to the vault directly.
- **FR-1.5 (MVP)** The system MUST reject any write that targets a path outside
  the vault (path-traversal jail).

### 1.2 FR-2 — Recall (retrieve specific memories)

- **FR-2.1 (MVP)** The system MUST retrieve a memory by its stable ID or vault
  path (`brain_recall_by_id`).
- **FR-2.2 (MVP)** The system MUST list the most recently created/modified
  memories, filterable by an optional recency window and tags
  (`brain_recall_recent`).
- **FR-2.3 (MVP)** A just-written memory MUST be recallable by ID immediately,
  before indexing completes.
- **FR-2.4 (MVP)** Every recalled memory MUST include provenance: stable ID,
  vault path, title, tags, frontmatter, modification time, and links.

### 1.3 FR-3 — Search (find relevant memories)

- **FR-3.1 (MVP)** The system MUST provide lexical/keyword full-text search over
  note text (`brain_search_lexical`).
- **FR-3.2 (MVP)** Search results MUST be ranked and MUST support metadata
  filters (tags, date range).
- **FR-3.3 (MVP)** Search results MUST be bounded by a `limit` and respect a
  global token budget to protect the client's context window.
- **FR-3.4 (MVP)** Each search result MUST include provenance: note ID, path, the
  matched chunk, a score, and tags.
- **FR-3.5 (Future)** The system SHOULD provide semantic search via local
  embeddings (`brain_search_semantic`) and a merged hybrid search
  (`brain_search_hybrid`).

### 1.4 FR-4 — Remember (write/update memories)

- **FR-4.1 (MVP)** The system MUST create or update a memory note
  (`brain_remember`) given a title, content, and optional tags/links/frontmatter.
- **FR-4.2 (MVP)** `brain_remember` MUST use upsert semantics: repeated calls
  with the same title/path produce the same end state (idempotent).
- **FR-4.3 (MVP)** On create, the system MUST assign a stable, sortable,
  URL-safe ID and populate frontmatter (`id`, `type`, `created`, `updated`,
  `source`, tags, links).
- **FR-4.4 (MVP)** On update, the system MUST preserve the existing stable ID
  and update the `updated` timestamp.
- **FR-4.5 (MVP)** The system MUST resolve provided `links` into `[[wikilinks]]`
  in the body/frontmatter.
- **FR-4.6 (MVP)** Writes MUST be atomic: a crash leaves either the prior or the
  new file, never a torn one.
- **FR-4.7 (Future)** The system SHOULD support section-aware append
  (`brain_append`), reversible archive (`brain_forget`), and tag-only edits
  (`brain_tag`), with destructive operations requiring an explicit confirm.

### 1.5 FR-5 — Indexing & synchronization

- **FR-5.1 (MVP)** The system MUST maintain derived indexes (metadata + FTS)
  from the vault and MUST rebuild them from the vault on demand
  (`brain_rebuild`).
- **FR-5.2 (MVP)** The system MUST index incrementally: only changed notes are
  re-processed, gated on a per-note content hash.
- **FR-5.3 (MVP)** A file watcher MUST detect create/modify/delete/move in the
  vault and trigger re-indexing, debounced to absorb burst saves.
- **FR-5.4 (MVP)** `brain_status` MUST report vault path, total notes, indexed
  notes, pending count, last sync, and errors.
- **FR-5.5 (MVP)** Derived stores MUST be reproducible: `brain_rebuild --full`
  reproduces metadata and FTS from the vault alone.
- **FR-5.6 (Future)** The system SHOULD build a vector store (Phase 2) and a
  knowledge graph (Phase 3), each rebuildable from the vault.

### 1.6 FR-6 — MCP server & tool surface

- **FR-6.1 (MVP)** The system MUST expose its capabilities as MCP tools
  (namespace `brain_`) consumable by Claude Code, over stdio transport.
- **FR-6.2 (MVP)** Every tool MUST validate its inputs with a schema before any
  business logic runs; invalid input is rejected with a structured error.
- **FR-6.3 (MVP)** Every tool MUST return structured (typed) outputs, not
  free-form strings.
- **FR-6.4 (MVP)** Write tools MUST be idempotent; destructive operations MUST
  require an explicit confirm flag.
- **FR-6.5 (MVP)** The MCP layer MUST contain no business logic; it delegates to
  core services.
- **FR-6.6 (Future)** The system MAY expose HTTP/SSE transport for multi-client
  use.

### 1.7 FR-7 — CLI

- **FR-7.1 (MVP)** The system MUST provide a `brain` CLI with at least `index`,
  `search`, and `status` commands mirroring core capabilities.
- **FR-7.2 (MVP)** The CLI MUST be a thin caller of core; it MUST NOT duplicate
  business logic.

### 1.8 FR-8 — Configuration

- **FR-8.1 (MVP)** The system MUST provide typed configuration layered as
  defaults < environment < config file < CLI flags.
- **FR-8.2 (MVP)** `brain_config_get` / `brain_config_set` MUST operate on
  runtime-safe keys only (model, log level, budgets); vault path and destructive
  toggles MUST NOT be settable live without a restart.
- **FR-8.3 (MVP)** Configuration MUST be typed and centralized — no scattered
  magic strings.

### 1.9 FR-9 — Provenance & citation

- **FR-9.1 (MVP)** Any tool returning memory content MUST include the source
  path, a score where applicable, and a short "why" so the client can cite and
  the user can verify.

---

## 2. Non-Functional Requirements

- **NFR-1 (MVP)** **Local-first.** All runtime data — vault, derived indexes,
  configuration — MUST reside on the user's machine. No feature may *require* a
  network round-trip to function.
- **NFR-2 (MVP)** **Privacy-first.** The system MUST make no outbound network
  calls unless the user explicitly opts into a remote capability. There MUST be
  no telemetry, analytics, or crash-reporting "phone home."
- **NFR-3 (MVP)** **Auditable privacy.** The only network-capable code MUST be
  isolated behind a single interface, gated by an off-by-default flag, so an
  auditor can verify NFR-2 by inspection.
- **NFR-4 (MVP)** **Markdown-canonical.** No knowledge MAY exist solely in a
  derived store. The vault MUST be sufficient to reproduce every derived store.
- **NFR-5 (MVP)** **Modularity.** The system MUST enforce a layered dependency
  rule (inward/downward only) such that core logic has no imports of
  infrastructure (filesystem, database, network, MCP).
- **NFR-6 (MVP)** **Single-writer-per-store.** The storage authority is the sole
  vault writer; the indexer is the sole writer of derived stores. Queries are
  read-only.
- **NFR-7 (MVP)** **Open-source.** Every dependency MUST be free and
  open-source; no proprietary component may be required to build or run Brain.
- **NFR-8 (MVP)** **Cross-platform.** The system MUST run on Windows, macOS, and
  Linux; Windows is a first-class platform (it is the primary dev platform).
- **NFR-9 (MVP)** **Observability.** The system MUST emit structured logs with
  levels and a quiet mode; no raw `console.log` in library code. Indexer sync
  state MUST be queryable (`brain_status`).
- **NFR-10 (MVP)** **Typed errors.** Errors MUST be a typed hierarchy carrying
  actionable context; raw stack traces MUST NOT leak to MCP clients.
- **NFR-11 (MVP)** **Determinism in tests.** Core unit tests MUST run with
  in-memory fakes (no filesystem, DB, or network) and MUST be deterministic.
- **NFR-12 (MVP)** **Documentation.** Every changed behavior MUST ship with
  matching docs + a changelog entry; stale docs are treated as a bug.
- **NFR-13 (MVP)** **Configurability.** Behavior knobs (search limit, token
  budget, log level) MUST be configurable without code changes.

---

## 3. Performance Requirements

> Targets assume a personal vault (hundreds of notes) as the common case and a
> large vault (tens of thousands of notes) as the design ceiling. Exact numbers
> are provisional and will be pinned against a benchmark fixture in Phase 1.

- **PR-1 (MVP)** Incremental re-indexing of a single changed note MUST complete
  in well under one second on commodity hardware (common case).
- **PR-2 (MVP)** Lexical search on a personal vault MUST return in under one
  second (p95).
- **PR-3 (MVP)** Indexing cost MUST be O(changes), not O(vault): only changed
  notes are re-processed on a normal run.
- **PR-4 (MVP)** A full rebuild of derived stores from the vault MUST complete
  in time proportional to vault size (no super-linear blowups), and MUST be
  resumable after a crash.
- **PR-5 (MVP)** Recall by ID MUST be effectively constant-time (direct lookup).
- **PR-6 (MVP)** The system MUST bound resource use: the indexer processes
  changes on a bounded queue, and there is a single-writer-per-note lock to
  prevent write contention.
- **PR-7 (MVP)** Tool output MUST respect a token budget so a large vault cannot
  overflow the client's context window.
- **PR-8 (Future)** Semantic search (vector kNN) MUST be sub-linear via ANN
  indexes (Phase 2).
- **PR-9 (Future)** The system SHOULD sustain a large vault (tens of thousands of
  notes) without architectural redesign.

---

## 4. Security Requirements

- **SR-1 (MVP)** **Path traversal protection.** The storage authority MUST jail
  all file operations to the vault; writes/reads outside the vault MUST be
  rejected.
- **SR-2 (MVP)** **Atomic writes.** Vault writes MUST use a safe write sequence
  (temp file + rename) so a crash cannot produce a torn or partially written
  note.
- **SR-3 (MVP)** **Input validation.** Every MCP tool MUST validate inputs with a
  schema before any logic executes.
- **SR-4 (MVP)** **Destructive-op guards.** Any destructive operation MUST
  require an explicit confirm flag; archiving (reversible) MUST be the default
  over hard-delete.
- **SR-5 (MVP)** **No secret exfiltration.** Because the system makes no
  outbound calls by default (NFR-2/NFR-3), secrets in the vault cannot be sent
  off-machine. Remote capabilities, when opted in, MUST be auditable.
- **SR-6 (MVP)** **Pre-delete backup.** A hard-delete MUST take a pre-delete
  backup so the operation is recoverable from local artifacts (future-phase hard
  delete; MVP archive is reversible by move).
- **SR-7 (MVP)** **Least-privilege config.** Live configuration MUST be limited
  to runtime-safe keys; vault path and destructive toggles MUST NOT change
  without a restart.
- **SR-8 (MVP)** **Dependency hygiene.** Dependencies MUST be kept current via
  automated, reviewable updates; known-vulnerable dependencies MUST be treated as
  release blockers.
- **SR-9 (MVP)** **Error hygiene.** Errors MUST NOT leak raw stack traces or
  internal paths to MCP clients; structured, actionable errors only.
- **SR-10 (MVP)** **Concurrency safety.** Concurrent writes to the same note
  MUST be serialized by a per-note lock; the indexer MUST not corrupt derived
  stores on a mid-index crash (per-note upserts are transactional).

---

## 5. Scalability Requirements

- **SC-1 (MVP)** The architecture MUST scale from a personal vault (hundreds of
  notes) to a large vault (tens of thousands) without redesign.
- **SC-2 (MVP)** Incremental indexing MUST keep steady-state indexing cost
  proportional to changes, not to total vault size.
- **SC-3 (MVP)** Search MUST use indexes (not linear scans) so result latency
  does not degrade linearly with vault size.
- **SC-4 (MVP)** The single-process, local-service model MUST handle a single
  user's working set without a server daemon.
- **SC-5 (Future)** The system SHOULD support multiple vaults with namespaced
  indexes.
- **SC-6 (Future)** The system SHOULD support multiple MCP clients sharing one
  Brain instance (HTTP/SSE transport).
- **SC-7 (Future)** The system SHOULD permit a remote embedding backend
  (opt-in) for users who trade privacy for scale, without changing Core.

---

## 6. Extensibility Requirements

- **EX-1 (MVP)** Every external technology (embedding model, vector store, graph
  store, storage/vault, extractor, context strategy, ranker) MUST sit behind an
  interface defined in core's ports.
- **EX-2 (MVP)** Concrete implementations MUST live only in adapters /
  infrastructure; core MUST depend on interfaces, never on concrete tech.
- **EX-3 (MVP)** All interface-to-implementation wiring MUST occur in a single
  composition root.
- **EX-4 (MVP)** Adding a new external technology MUST be an additive change (a
  new adapter), not a core rewrite.
- **EX-5 (MVP)** The MCP transport MUST be swappable (stdio now; HTTP/SSE later)
  without changing core.
- **EX-6 (MVP)** The MCP tool surface MUST be versioned; additive changes are
  non-breaking, and breaking changes bump a version documented in the changelog.
- **EX-7 (Future)** The system SHOULD offer a plugin model where community
  adapters register at the composition root without core changes.

---

## 7. Compatibility Requirements

- **CO-1 (MVP)** The system MUST run on Windows, macOS, and Linux with current
  LTS runtimes.
- **CO-2 (MVP)** The system MUST speak the Model Context Protocol via the
  official SDK and remain compatible with Claude Code's MCP client.
- **CO-3 (MVP)** Memory files MUST be plain Markdown with Obsidian-compatible
  frontmatter and `[[wikilinks]]` — readable and editable in Obsidian (or any
  text editor) with no Brain-specific binary format required to read them.
- **CO-4 (MVP)** A memory written by Brain MUST remain readable and useful even
  if Brain is uninstalled (format longevity; no vendor lock-in at the data
  layer).
- **CO-5 (MVP)** Derived stores MUST be reproducible by anyone holding the same
  vault (and, for future phases, the same embedding model) — no hidden state.
- **CO-6 (MVP)** The system MUST NOT require Obsidian to be running; it only
  respects Obsidian's file conventions.
- **CO-7 (MVP)** Breaking changes to a port, an MCP tool, or a public export
  MUST be accompanied by an ADR and a changelog entry.

---

## 8. Acceptance Criteria

> These are the binary checks that define "Phase 1 is done." Each maps to one or
> more requirements above and to `docs/SUCCESS_CRITERIA.md`.

- **AC-1 (MVP) ✅ maps FR-1, FR-6, CO-1, CO-2:** Brain connects to a real
  Obsidian vault on Windows and Linux, exposes MCP tools over stdio, and Claude
  Code can invoke them.
- **AC-2 (MVP) ✅ maps FR-4:** Claude can create a memory with `brain_remember`,
  and the note appears in the vault as valid Markdown with frontmatter and a
  stable ID.
- **AC-3 (MVP) ✅ maps FR-4.2:** Re-calling `brain_remember` with the same
  title/path produces no duplicate (idempotent upsert).
- **AC-4 (MVP) ✅ maps FR-2, FR-3:** In a *fresh* session, Claude can recall the
  stored memory by ID (`brain_recall_by_id`) and find it by keyword
  (`brain_search_lexical`).
- **AC-5 (MVP) ✅ maps FR-2.2:** `brain_recall_recent` lists recently changed
  memories scoped by optional tags/window.
- **AC-6 (MVP) ✅ maps FR-5:** Editing a note in Obsidian triggers incremental
  re-indexing; `brain_status` reflects the change; the updated content is
  searchable.
- **AC-7 (MVP) ✅ maps FR-5.5, NFR-4:** `brain_rebuild --full` reproduces all
  derived stores from the vault; no memory is lost when derived stores are
  deleted first.
- **AC-8 (MVP) ✅ maps SR-1:** A write targeting a path outside the vault is
  rejected.
- **AC-9 (MVP) ✅ maps NFR-2, NFR-3:** An audit of the codebase finds no outbound
  network call outside an off-by-default remote flag, and no telemetry code.
- **AC-10 (MVP) ✅ maps NFR-5, NFR-11:** Core unit tests pass using in-memory
  fakes (no filesystem/DB/network), and the layering rule is enforced by lint.
- **AC-11 (MVP) ✅ maps NFR-12:** Every MVP tool has documentation and a passing
  unit test; one integration test covers the vault round-trip; one e2e test
  drives MCP → Brain → sample vault.
- **AC-12 (MVP) ✅ maps FR-7, FR-8:** The `brain` CLI runs `index`, `search`,
  `status`, and `brain_config_get`/`set` works for runtime-safe keys.
- **AC-13 (MVP) ✅ maps FR-9:** Search and recall results include provenance
  (source path, score/why) consumable by Claude for citation.

---

## 9. Requirement traceability (summary)

| Section | IDs | MVP? |
|---|---|---|
| Functional | FR-1 … FR-9 | mixed (future items marked) |
| Non-Functional | NFR-1 … NFR-13 | all MVP |
| Performance | PR-1 … PR-9 | PR-1..7 MVP; PR-8..9 future |
| Security | SR-1 … SR-10 | all MVP |
| Scalability | SC-1 … SC-7 | SC-1..4 MVP; SC-5..7 future |
| Extensibility | EX-1 … EX-7 | EX-1..6 MVP; EX-7 future |
| Compatibility | CO-1 … CO-7 | all MVP |
| Acceptance | AC-1 … AC-13 | all MVP |

Full measurable targets: `docs/SUCCESS_CRITERIA.md`. Architectural basis:
`docs/ARCHITECTURE.md`. Decision rationale: `docs/DESIGN_DECISIONS.md`.
