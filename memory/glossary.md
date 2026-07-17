# glossary.md — DevBrain terms

> DevBrain-specific vocabulary. When a term is used in docs, code, or conversation,
> it means what it says here. Add terms as the project introduces them.

## Core concepts

- **DevBrain** — DevBrain; the local service that manages memory and serves
  MCP tools. ("DevBrain" = the product; "Claude" = the AI client that uses it.)
- **Vault** — the Obsidian folder of Markdown notes that is the canonical source
  of truth. The human-editable surface.
- **Memory** — a single unit of knowledge: one Markdown note (with frontmatter,
  body, tags, links). Not to be confused with the conversation context.
- **Note** — the file form of a Memory. "Memory" and "note" are near-synonyms;
  "memory" emphasizes the conceptual unit, "note" the file.
- **Chunk** — a coherent slice of a note used for embedding and citation.
  Heading-aware, with overlap. The unit the vector store indexes.

## Architecture

- **Port** — an interface in `core/ports/` declaring a capability
  (`IEmbedder`, `IVectorStore`, `IGraphStore`, `IStorage`). The seam between
  Core and concrete tech.
- **Adapter** — a concrete implementation of a port, in `adapters/`
  (e.g., `embedder-ollama`, `vector-lancedb`). The replaceable part.
- **Core** — the framework-agnostic domain logic. Knows no infrastructure.
- **Composition root** — the single file (`src/composition-root.ts`) that wires
  ports to adapters. The only place "which implementation" is decided.
- **Indexer** — the subsystem that turns vault notes into derived indexes
  (chunks→embeddings, links→graph). Sole writer to the vector and graph stores.
- **Storage** — the subsystem that owns vault reads/writes. Sole writer to the
  vault. All other modules go through it.

## Stores (all derived except the vault)

- **Vector store** — LanceDB; holds chunk embeddings + metadata; answers kNN.
- **Graph store** — SQLite; holds nodes/edges/tags; answers traversal.
- **FTS index** — SQLite FTS5; powers lexical/keyword search.
- **Derived store** — any store rebuildable from the vault (vector, graph, FTS).
  Contrast with the canonical vault.

## Retrieval

- **Semantic search** — find by meaning, via vector similarity.
- **Lexical search** — find by exact/keyword match, via FTS5.
- **Hybrid search** — semantic + lexical merged and re-ranked into one result
  set. The default.
- **Graph expansion** — pulling in neighbors of high-signal results to enrich a
  context bundle.
- **Context bundle** — a token-budgeted, citation-backed assembly of memory for
  a given intent (output of `devbrain_build_context`).
- **Provenance** — the source path + score + "why" attached to every retrieved
  memory, so Claude can cite and trust it.

## Relationships

- **Wikilink** — an Obsidian `[[target]]` link; doubles as a graph edge.
- **Edge relation** — the type of a graph edge: `wikilink`, `tag`, or
  `frontmatter` (explicit `links` in frontmatter).
- **Orphan** — a note with no inbound or outbound links; surfaced by
  `devbrain_graph_orphans`.

## Lifecycle

- **Ingestion** — vault note → derived indexes (chunk, embed, graph-build).
- **Rebuild** — re-derive stores from the vault (`devbrain_rebuild --full`). The
  canonical recovery path.
- **Upsert** — insert-or-update; idempotent write semantics for memory tools.
- **Archive** — soft-delete a memory by moving it to `_archive/` (reversible).
  Contrast with hard-delete (requires `confirm`).

## Process

- **ADR** — Architecture Decision Record; a recorded decision with context and
  consequences. Full form in `docs/adr/`, summary log in `memory/decisions.md`.
- **Invariant** — an architectural rule that must never be violated without an
  ADR (see `memory/architecture.md`).
- **Definition of Done** — the checklist a feature must satisfy to be called
  done (see `CLAUDE.md`): implementation, docs, tests, memory update, roadmap
  update.
