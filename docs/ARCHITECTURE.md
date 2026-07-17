# Project Brain — Architecture

This document defines the complete software architecture of Project Brain. It is
the authoritative design reference. Implementation must conform to it; deviations
require an Architecture Decision Record (ADR) in `memory/decisions.md`.

> Status: **Design phase.** No implementation exists yet. This document precedes
> code and is allowed to evolve, but every change is a recorded decision.

---

## 1. Design goals

| Goal | What it means |
|---|---|
| Local-first | Runs entirely on the user's machine. No cloud calls. |
| Privacy-first | No telemetry, no third-party requests. Embeddings via local Ollama. |
| Markdown-canonical | The Obsidian vault is the source of truth. All indexes are derived and rebuildable. |
| Modular | Each concern is a separate module behind a stable interface. |
| Loosely coupled | Modules communicate through narrow contracts, never reaching into each other's internals. |
| Scalable | Handles a personal vault (hundreds of notes) to a large one (tens of thousands) without redesign. |
| Production-quality | Typed, tested, observable, documented. |

## 2. High-level architecture

Project Brain is a **local service** that Claude Code talks to over the
**Model Context Protocol (MCP)**. Brain is split into a thin MCP-facing layer and
a set of independent **core subsystems** that do the real work.

```
 ┌──────────────────────────────────────────────────────────────┐
 │                        Claude Code                           │
 │              (MCP client — calls Brain tools)                │
 └───────────────────────────┬──────────────────────────────────┘
                             │ MCP (stdio / HTTP)
 ┌───────────────────────────┴──────────────────────────────────┐
 │                     MCP Server Layer                         │
 │   Tool definitions · input validation · authz · rate limit   │
 │   (thin adapter — no business logic)                         │
 └───────────────────────────┬──────────────────────────────────┘
                             │ internal service API
 ┌───────────────────────────┴──────────────────────────────────┐
 │                       Core (Domain)                          │
 │  Recall · Search · Graph · Remember · Context · Extractor    │
 │  (pure-ish business logic, framework-agnostic)               │
 └─┬──────────────┬──────────────┬──────────────┬───────────────┘
   │              │              │              │
 ┌─┴────────┐ ┌───┴──────┐ ┌─────┴────┐ ┌───────┴────────┐
 │ Storage  │ │ Indexer  │ │ Embedder │ │ Graph Builder  │
 │ (vault + │ │ (chunks, │ │ (Ollama) │ │ (links/tags/   │
 │  meta)   │ │  index)  │ │          │ │  entities)     │
 └─┬────────┘ └───┬──────┘ └─────┬────┘ └───────┬────────┘
   │              │              │              │
 ┌─┴────────┐ ┌───┴──────────┐ ┌─┴──────────┐ ┌─┴─────────────┐
 │ Obsidian │ │ Vector Store │ │ Embedding  │ │ Graph Store   │
 │  Vault   │ │ (LanceDB)    │ │  Model     │ │ (SQLite)      │
 │(Markdown)│ │              │ │ (nomic-    │ │               │
 │          │ │              │ │  embed)    │ │               │
 └──────────┘ └──────────────┘ └────────────┘ └───────────────┘
        ▲
        │ side-effects (reads/writes)
 ┌──────┴───────────────────────────────────────────────────────┐
 │              File System Watcher (chokidar)                  │
 │   Detects note changes → triggers incremental re-indexing    │
 └──────────────────────────────────────────────────────────────┘
```

The arrows downward are **storage side-effects**; the arrows upward (not drawn)
are **queries**. The vault is the only human-editable surface; everything below
it is a derived, rebuildable cache.

## 3. Major components

### 3.1 MCP Server Layer
- **Responsibility:** Expose Brain's capabilities as MCP tools to Claude Code.
  Parse and validate tool inputs, enforce authorization and rate limits, and
  translate results into MCP responses.
- **Boundary:** Contains *no* business logic. It is a thin adapter over the Core.
  Every tool delegates to a Core service. This keeps the protocol surface
  swappable and testable in isolation.
- **Transport:** stdio (default, for local Claude Code) and HTTP/SSE (for remote
  or multi-client scenarios).

### 3.2 Core (Domain)
The heart of Brain. Each subsystem is a cohesive set of capabilities:

| Subsystem | Responsibility |
|---|---|
| **Recall** | Retrieve a specific note or memory by ID/path with full context. |
| **Search** | Hybrid search: semantic (vector) + lexical (keyword/FTS) + metadata filter. |
| **Graph** | Traverse the knowledge graph: neighbors, paths, clusters, orphan nodes. |
| **Remember** | Write/update/delete notes (memories) in the vault with proper frontmatter. |
| **Context** | Assemble a focused context bundle for a given query — the "what should I load?" brain. |
| **Extractor** | Derive structured knowledge from unstructured sources (conversation logs, code, raw text). |

- **Boundary:** Core is framework-agnostic — it has no knowledge of MCP, HTTP, or
  the filesystem watcher. It depends only on the Storage/Indexer/Embedder/Graph
  interfaces. This means Core can be unit-tested with in-memory fakes and can be
  driven by a CLI or test harness, not only MCP.

### 3.3 Storage
- **Responsibility:** The single read/write authority over the vault and its
  metadata. Parses Markdown + frontmatter, resolves `[[wikilinks]]`, manages
  attachments, and guards vault integrity (atomic writes, backups before
  destructive ops).
- **Boundary:** All vault mutations go through Storage. Other modules request
  reads/writes; they never touch the filesystem directly. This centralizes
  parsing, path safety, and concurrency.

### 3.4 Indexer
- **Responsibility:** Transform vault notes into queryable indexes: chunking,
  embedding generation, graph node/edge extraction. Maintains **incremental
  state** so only changed notes are re-processed.
- **Boundary:** Reads via Storage, writes to Vector Store and Graph Store. It is
  the *only* writer to those stores (queries are read-only). Triggered by the
  File Watcher or by an explicit `rebuild` command.

### 3.5 Embedder
- **Responsibility:** Generate vector embeddings for text chunks via a local
  Ollama model. Abstracted behind an interface so the model is swappable
  (nomic-embed-text today; any local model tomorrow) and so tests can use a
  deterministic fake embedder.
- **Boundary:** Pure function — text in, vector out. No vault or storage knowledge.

### 3.6 Graph Builder
- **Responsibility:** Build and maintain the knowledge graph from note links,
  tags, frontmatter relations, and optionally extracted entities. Computes
  graph metrics (degree, clusters, orphans).
- **Boundary:** Reads note structure via Storage/Indexer, writes to Graph Store.

### 3.7 Vector Store
- **Responsibility:** Persist embeddings and support nearest-neighbor search.
  LanceDB — local, file-based, no server process.
- **Boundary:** Stores `(chunk_id, note_id, embedding, metadata)`. Knows nothing
  about Markdown.

### 3.8 Graph Store
- **Responsibility:** Persist nodes and edges; support traversal queries.
  SQLite (via better-sqlite3) — local, transactional, no server process.
- **Boundary:** Pure graph storage. Nodes reference note IDs but store no note
  content.

### 3.9 File Watcher
- **Responsibility:** Observe the vault for changes (create/modify/delete/move)
  and notify the Indexer. chokidar provides cross-platform file watching.
- **Boundary:** Emits change events only. No indexing logic. Debounced to avoid
  thrashing on rapid saves (common in Obsidian).

## 4. Data flow

### 4.1 Write flow — "Claude remembers something"
```
Claude → MCP:remember(content, metadata)
  → Remember service validates + structures the memory
  → Storage writes a Markdown note (frontmatter + body) atomically
  → File Watcher fires on the new/changed file
  → Indexer re-processes that note:
        chunk → Embedder → Vector Store (upsert)
        extract links/tags → Graph Builder → Graph Store (upsert)
  → Indexer records sync state (note hash → indexed)
```
The write returns to Claude as soon as Storage confirms the file write. Indexing
is asynchronous; recall of a just-written note is available immediately via
direct ID, and via search once indexing completes (typically sub-second).

### 4.2 Read flow — "Claude needs relevant memory"
```
Claude → MCP:recall(query or id)
  → Recall/Search service:
        semantic: Vector Store.knn(embed(query))
        lexical:  SQLite FTS5 over note text
        metadata: frontmatter filters (tags, dates, type)
  → results merged + re-ranked (hybrid score)
  → optional: Graph.expand(results) pulls linked neighbors
  → returns ranked note chunks with provenance (path, score, why)
```

### 4.3 Context-build flow — "Claude is about to work on X"
```
Claude → MCP:build_context(intent, scope)
  → Context service orchestrates:
        1. Recall recent + relevant notes (semantic + recency)
        2. Expand via graph (neighbors of high-signal nodes)
        3. Apply a budget (token limit) — keep highest-scoring chunks
        4. De-duplicate and order for coherence
  → returns a compact context bundle + a manifest of sources
```

### 4.4 Rebuild flow — "Indexes are corrupt or model changed"
```
Operator → CLI:brain rebuild --full
  → Indexer truncates Vector Store + Graph Store
  → Storage streams all notes
  → Indexer re-chunks, re-embeds, re-builds graph
  → sync state reset
```
This is the canonical recovery path and a core guarantee: **the vault can always
rebuild every derived store.**

## 5. Dependency direction (the layering rule)

Dependencies point **inward and downward** only:

```
MCP Layer  ──▶  Core  ──▶  Storage / Indexer / Embedder / Graph Builder
                              │
                              ▼
                    Vector Store · Graph Store · Vault
```

- Core never imports from the MCP layer.
- Storage/Indexer never import Core business logic.
- No module imports a concrete store directly — always through an interface
  (defined in `core/ports/`).

This is the single most important architectural rule. It is what makes components
swappable, testable, and durable over years.

## 6. Extension points

Project Brain is built to be extended without modifying core:

| Extension point | Interface | Example extension |
|---|---|---|
| **Embedding model** | `IEmbedder` | Swap nomic for a domain-specific local model. |
| **Vector store** | `IVectorStore` | Swap LanceDB for ChromaDB or Qdrant local. |
| **Graph store** | `IGraphStore` | Swap SQLite for an embedded graph DB. |
| **Storage / vault** | `IStorage` | Support a non-Obsidian Markdown vault, or a Git-backed vault. |
| **Extractor** | `IExtractor` | New source types: Git history, GitHub issues, code symbols. |
| **Context strategy** | `IContextStrategy` | Different assembly/recency/depth strategies. |
| **Ranker** | `IRanker` | Custom hybrid-score or re-ranking logic. |
| **MCP transport** | adapter | stdio today; HTTP/SSE or WebSocket tomorrow. |
| **Authz policy** | `IPolicy` | Multi-user or restricted-write policies. |

All interfaces live in `core/ports/`. Default implementations live in
`adapters/` or `infrastructure/`. Wiring happens in a single composition root
(`src/composition-root.ts`), so "which implementation" is configurable without
touching Core.

## 7. Cross-cutting concerns

- **Configuration:** Single typed config (`brain.config.ts` / `.brainrc`), layered
  defaults < env < file < CLI flags. Never scattered magic strings.
- **Logging:** Structured logging with levels and a quiet mode. No `console.log`
  in library code.
- **Errors:** Typed error hierarchy. Errors carry enough context to be acted on;
  they never leak raw stack traces to MCP clients.
- **Concurrency:** A single-writer-per-note lock in Storage. Indexer processes
  changes on a bounded queue to bound resource use.
- **Observability:** Indexer emits sync-state metrics (notes indexed, pending,
  failed) queryable via a `brain status` CLI and an MCP tool.
- **Security:** Path traversal guards in Storage (vault is a jail — no writes
  outside it). Optional write-protect / dry-run modes.

## 8. Future scalability

- **Vault size:** Chunking + incremental indexing keep indexing O(changes), not
  O(vault). Vector search stays sub-linear via ANN indexes.
- **Multiple vaults:** Storage is vault-scoped; Brain can attach to multiple
  vaults with namespaced indexes.
- **Remote embedding (optional, opt-in):** `IEmbedder` can wrap a remote API —
  but only if the user explicitly configures it. Local stays the default.
- **Multi-client:** HTTP/SSE transport lets several MCP clients share one Brain
  instance and one set of indexes.
- **Plugin model:** The interface/adapter split means community plugins ship as
  new adapters, registered at the composition root — no core changes needed.

## 9. Architectural invariants

These must *never* be violated without an ADR:

1. **Markdown is canonical.** No knowledge exists only in a derived store.
2. **One writer per store.** Storage owns the vault; Indexer owns vector/graph
   stores. No cross-writing.
3. **Core knows no infrastructure.** No `fs`, no `sqlite`, no `lancedb`, no MCP
   imports inside `core/`.
4. **All external access through ports.** Concrete tech lives only in
   `adapters/` and `infrastructure/`.
5. **Derived stores are rebuildable.** A `rebuild` from the vault always
   reproduces them.
6. **No silent network.** Brain makes no outbound network calls unless the user
   configures an opt-in remote capability.

## 10. Open questions (to resolve before/within Phase 1)

- Exact MCP SDK version and transport defaults (decide at Phase 1 kickoff).
- Chunking strategy defaults (size, overlap, heading-aware vs fixed) — see
  `memory/ideas.md`.
- Whether the Graph Store and metadata/FTS share one SQLite DB or split.
- Licensing choice (MIT vs Apache-2.0).

These are tracked in `memory/decisions.md` as they get resolved.
