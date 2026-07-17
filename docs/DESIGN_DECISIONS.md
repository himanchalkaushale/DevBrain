# Project Brain — Design Decisions

> **Phase 1: Product Specification.** This document records the architectural
> decisions that are already made, each with the reasoning that makes them
> durable. It is the *narrative* companion to the ADR log in
> `memory/decisions.md` (chronological index) and the full ADRs in `docs/adr/`.
>
> **Status legend:** ✅ Accepted & locked · 🟡 Proposed/open (to resolve at the
> noted phase). Decisions marked ✅ are not to be reversed without a superseding
> ADR. Decisions marked 🟡 are recorded here so they are visible, but their final
> form is pending.
>
> **Format per decision:** Decision · Reason · Alternatives considered ·
> Tradeoffs.

---

## ADR-0001 — Markdown is canonical; all indexes are derived ✅

**Decision.** The Obsidian vault (Markdown files with frontmatter, tags, and
`[[wikilinks]]`) is the single source of truth. Embeddings, the vector DB, the
knowledge graph, and the FTS index are *derived, rebuildable* stores. No
knowledge exists only in a derived store.

**Reason.** The product exists to provide *durable, private, portable* memory.
Markdown is plain text — diffable, editable in any tool, readable decades hence,
and independent of Brain. Making files canonical means (a) corruption of any
derived store is a minutes-long rebuild, not data loss; (b) the memory survives
Brain itself; (c) the user is never locked into a binary format. This collapses
the entire class of "the index got corrupted" disasters into a routine
operation.

**Alternatives considered.**
- *Index as source of truth (vectors/graph authoritative).* Rejected: opaque,
  non-portable, and turns every index bug into potential memory loss.
- *Dual-write with no canonical side.* Rejected: invents a consistency problem
  (which side wins on conflict) for no benefit.

**Tradeoffs.** Some queries are slower than a purpose-built store would allow;
we pay a rebuild cost on model/storage swaps; and we must enforce the
discipline that no shortcut ever stores knowledge *only* in a derived index.

---

## ADR-0002 — Layered architecture; dependencies inward/downward only ✅

**Decision.** Strict layering: `mcp/` → `core/` → `indexer/` + `adapters/` +
`infrastructure/`. Core depends only on its own ports and model types. Concrete
technology lives only in `adapters/` and `infrastructure/`. All wiring happens in
a single composition root. The rule is enforced by ESLint boundary config, not
just convention.

**Reason.** Brain must survive years of tech churn — new embedding models, new
vector DBs, new MCP features, new extraction sources. The only way that's
possible without rewrites is if every external technology is swappable behind an
interface. Layering is also what makes Core unit-testable with in-memory fakes
(no DB, no filesystem, no network), so logic is fast and deterministic to
verify.

**Alternatives considered.**
- *A DI framework (NestJS-class).* Rejected: the layering *is* the framework; a
  container would obscure the composition root and add a heavy dependency for a
  single-user local service.
- *Convention-only layering (no lint enforcement).* Rejected: conventions rot
  quietly; the linter is the floor, not the ceiling.

**Tradeoffs.** More files, more interfaces, a learning curve for new
contributors. Accepted: a stranger should understand one module without
understanding all of them.

---

## ADR-0003 — One writer per store ✅

**Decision.** Storage is the sole writer to the vault; the Indexer is the sole
writer to the vector and graph stores. Queries are read-only everywhere. A vault
write triggers the watcher → indexer; the indexing path is the only updater of
derived stores.

**Reason.** Multiple modules writing to the same store invites races,
inconsistency, and "who owns this state?" ambiguity. Single ownership makes the
update path legible: write to vault → watcher → indexer → derived stores. It
also makes the rebuild guarantee (ADR-0001) tractable, because exactly one
component reproduces each store.

**Alternatives considered.**
- *Let any module write any store with locks.* Rejected: distributed write
  authority is hard to reason about and harder to test.
- *Event-sourced writes from many producers.* Rejected: overkill at our scale;
  the watcher already provides a natural event stream.

**Tradeoffs.** A module that wants to update a derived store must go through the
indexer's pipeline rather than writing directly — slightly more indirection,
much more safety.

---

## ADR-0004 — Local-first & privacy-first: no outbound network by default ✅

**Decision.** Brain makes no outbound network calls unless the user explicitly
opts into a specific remote capability (e.g., a remote embedder). Embeddings run
via local Ollama. There is no telemetry, no analytics, no crash-reporting phone
home, ever. The only network-capable code lives behind a single interface
(`IEmbedder`) and an off-by-default flag, so the claim is auditable by
inspection.

**Reason.** The target users will not ship private project knowledge to a server.
A privacy claim is only credible if it's *verifiable* — so we make the absence
of network code a structural property, not a promise. "Nothing leaves your
machine unless you asked for it" must be checkable by an auditor in minutes.

**Alternatives considered.**
- *Cloud embeddings by default, local as opt-in.* Rejected: inverts the product's
  reason to exist.
- *Anonymous telemetry with a clear policy.* Rejected: even "anonymous"
  telemetry from a memory layer is a trust tax the target users won't pay.

**Tradeoffs.** We fly somewhat blind on real-world usage patterns (no product
analytics); we compensate with explicit user feedback and a benchmark fixture.
Some users who'd prefer a remote embedding backend must opt in explicitly —
acceptable, and reversible behind the interface.

---

## ADR-0005 — LanceDB for the vector store ✅

**Decision.** LanceDB is the primary vector store. It is embedded (in-process),
file-based, and needs no server daemon — the most faithful fit for local-first.

**Reason.** "No servers to run" is a core promise. LanceDB is in-process, has
solid Node/TypeScript bindings, uses an efficient columnar format, and supports
incremental upserts and ANN kNN. Keeping it behind `IVectorStore` means a future
ChromaDB or Qdrant adapter is a config-time change, not a core change.

**Alternatives considered.**
- *ChromaDB.* Local-first and popular, but leans client/server (a process to
  manage) and its Node story is less native. Kept as a future adapter option.
- *Qdrant (local mode).* Capable but heavier; overkill for a personal vault.
  Revisit if multi-vault/scale demands it.
- *Cloud vector DBs (Pinecone, Weaviate cloud).* Rejected outright: violate
  local-first.

**Tradeoffs.** LanceDB is younger than the cloud incumbents; we accept the
maturity trade for zero-daemon local operation, and we isolate it behind an
interface so a swap is bounded.

> Note: the vector store ships in **Phase 2**, not the MVP. The *decision* is
> recorded now so Phase 1 leaves the right seams; the *implementation* is
> deferred (see ADR-0013 below).

---

## ADR-0006 — SQLite for metadata + graph + FTS, co-located in one DB ✅

**Decision.** SQLite (`better-sqlite3`) holds relational metadata, the knowledge
graph (nodes/edges/tags), and FTS5 full-text indexes, all in one DB file.

**Reason.** SQLite is local, file-based, transactional, and serverless — exactly
the "one data directory, no daemons" promise. Our graph is vault-sized and our
queries are simple (neighbors, paths, components), so a dedicated graph DB adds
a second engine for no benefit. FTS5 gives us lexical search in the same store.
Co-locating keeps the data story simple: one file, transactional, rebuildable.

**Alternatives considered.**
- *A dedicated graph DB (Neo4j embedded, etc.).* Rejected: a second engine and
  process for queries SQLite handles trivially at our scale. `IGraphStore`
  leaves the door open if scale ever demands it.
- *Separate FTS and graph DB files.* Rejected (for now): more moving parts; we
  revisit only if FTS/graph write contention appears under load.

**Tradeoffs.** Co-locating FTS and graph in one file risks write contention at
scale; flagged in `memory/architecture.md` as a thing to watch. The interface
boundary means a split is possible later without touching core.

---

## ADR-0007 — Ollama + nomic-embed-text for embeddings ✅

**Decision.** Default to Ollama serving `nomic-embed-text` for embeddings, behind
`IEmbedder`.

**Reason.** Ollama runs models locally with one command — no API key, no network,
cross-platform. `nomic-embed-text` is purpose-built for embedding (not a
repurposed LLM), with good quality/size tradeoff and long-context handling for
note chunks. The interface makes the model swappable, and dimensionality is
recorded per store so a swap forces a rebuild rather than silent corruption.

**Alternatives considered.**
- *`all-MiniLM-L6-v2`.* Smaller/faster, slightly lower quality — viable as a
  "fast/lite" preset.
- *`bge-small`.* Also viable. Either is a config change, not a code change.
- *A remote embedding API as default.* Rejected: violates privacy-first; allowed
  only as an explicit opt-in behind `IEmbedder`.

**Tradeoffs.** Requires the user to run Ollama locally (a one-time setup); we
mitigate with clear getting-started docs and a lexical-only fallback when
Ollama is unreachable (logged, never silent).

> Note: embeddings ship in **Phase 2**, not the MVP. Decision recorded now to
> keep the right seams.

---

## ADR-0008 — Chunking defaults ✅

**Status:** Accepted (2026-07-17). Full ADR: `docs/adr/0008-chunking-defaults.md`.

**Decision.** Structure-aware Markdown chunking with **atomic block units**
(fenced code blocks, tables, and list items are never split). Defaults: **token
unit**, target **512 tokens**, overlap **64 tokens** (~12.5%). Oversized atomic
blocks are emitted as one over-target chunk and logged (never silently split —
policy E1). Flat notes (no headings) are sub-chunked by the prose rule. Each
chunk carries provenance `{ noteId, headingPath, charStart, charEnd }`. All knobs
are config; a char-based estimator is available behind `chunk.unit = "char"` for
CI/offline determinism.

**Reason.** Each chunk is a coherent concept (heading-aware) and, for code,
citation-complete (atomic blocks) — improving both embedding quality and the
user-visible citation. The structure-aware approach uses the heading/code signals
the vault already provides for free. It directly closes the code-block edge case
flagged in `memory/architecture.md`.

**Alternatives considered.** (A) plain heading-aware — simpler but splits code
mid-snippet; (B) fixed-window with overlap — simplest but structure-blind and
splits mid-thought/mid-code; (C) sentence-boundary — better than B but
structure-blind and adds a segmenter dependency; (numeric) 256/1024-token and
char-unit variants — runtime choices behind config, not re-architecture.

**Tradeoffs.** More parser logic (~250–350 lines) and a real test surface
(Setext/ATX headings, nested lists, oversized blocks). A heading rename shifts
every chunk boundary → the whole note re-embeds (correct; couples to ADR-0009
hashing the full file). Oversized atomic blocks produce over-target chunks,
mitigated by warn-level logging. Chunking is a single Markdown walk — negligible
vs. the Ollama embedding round-trip — so optimizing for quality costs no real
latency. Implementation deferred to Phase 2 (ADR-0013).

---

## ADR-0009 — Content hash source for incremental indexing ✅

**Status:** Accepted (2026-07-17). Full ADR: `docs/adr/0009-content-hash-source.md`.

**Decision.** Gate incremental re-indexing on a **per-note normalized
full-content hash** — SHA-256 over a normalized serial form of **frontmatter +
body** (LF line endings, single trailing newline, BOM stripped, stable
frontmatter key order). `mtime` + size is used only as an **optional fast
pre-filter**; the normalized hash is the **authoritative** gate (robust to the
Git/Syncthing mtime-without-content-change failure mode). A raw full-file
byte hash is available as an opt-in **strict** mode. Ownership, per ADR-0003:
the hash **function** lives with the Note model / Storage (sole vault
authority); the `hash → indexed` **sync-state table** lives with the Indexer.

**Reason.** A content hash makes indexing O(changes) — unchanged notes are
skipped (FR-5.2; C-15). The hash *source* decides whether "unchanged" is
honest. **Frontmatter-only** would miss body/heading edits → silently stale
FTS (Phase 1) and embeddings (Phase 2), violating the Markdown-canonical
invariant (ADR-0001) and contradicting **ADR-0008**, which requires the hash to
cover the full file so heading renames re-index. **Raw full-file bytes** are
content-complete but brittle to line-ending/whitespace/BOM churn from sync tools
→ spurious re-embeds. The **normalized full-content** hash is content-complete
(catches body + heading changes) *and* stable across pure whitespace/sync churn
(no spurious re-index), and it is a pure function of the `Note` model —
deterministic and unit-testable with no filesystem.

**Alternatives considered.** (A) frontmatter-only — cheapest, avoids re-embed on
cosmetic body edits, but misses meaningful body changes and contradicts
ADR-0008; rejected. (B) raw full-file byte hash — content-complete but
whitespace/line-ending fragile under sync churn; rejected as default, kept as
opt-in strict mode. (D) rendered-chunk-text hash — content-complete but couples
the sync-state key to the chunker, so a chunker-config retune (ADR-0008 knobs)
would spuriously re-index all notes; rejected as default (chunk-level detection
may layer on top later). For the gating mechanism: `mtime`-only (unreliable
across sync/moves — rejected as authoritative, kept as a pre-filter) and no
gating / always full (O(vault) every run, violates C-15 — rejected).

**Tradeoffs.** The normalization function is now **load-bearing**: a change
invalidates every stored hash → a one-time `--full` re-index (acceptable; derived
stores are rebuildable per ADR-0001). Mitigation: version the normalization
(`hashVersion` on the sync-state table) so a mismatch triggers an automatic
one-time `--full` rather than silent re-index noise. The hash function lives on
the boundary of two owners (Storage owns the function; Indexer owns the table)
— correct per ADR-0003 but the Indexer must ask Storage for the normalized hash
rather than re-deriving it from raw bytes (which would re-open the byte-churn
problem and duplicate parsing). A pure-rename move with no content change does
not re-index by the hash gate, so the watcher updates the stored path for the
stable `note_id` on move events (path is metadata, not content). The same key
gates FTS in Phase 1 and embeddings/graph in Phase 2 — Phase 2 only adds *what*
a re-index does, not the gate.

---

## ADR-0010 — License: MIT vs Apache-2.0 🟡

**Status:** Proposed — resolve before first release.

**Decision (proposed).** A permissive OSI license (MIT or Apache-2.0), per
CLAUDE.md.

**Reason.** A community-stewarded, local-first memory layer should be maximally
adoptable and re-embeddable; permissive licensing removes adoption friction.

**Alternatives considered.** Copyleft (GPL) — protects against closed
forks but limits adoption in some corporate environments; the project's
community-first goal favors permissive. Apache-2.0 adds an explicit patent grant
over MIT.

**Tradeoffs.** Patent grant vs. simplicity. Low-stakes; resolve before release.

---

## ADR-0011 — MCP transport defaults 🟡

**Status:** Proposed — resolve at Phase 1 kickoff.

**Decision (proposed).** stdio as the primary transport for local Claude Code;
HTTP/SSE deferred to a future phase for multi-client use.

**Reason.** stdio is the simplest, most local transport and matches the
single-user model. HTTP/SSE adds a server lifecycle and auth surface that
multi-client scenarios need but the MVP doesn't.

**Alternatives considered.** HTTP/SSE from day one. Rejected for MVP scope;
the transport is behind an adapter so adding it later doesn't disturb core.

**Tradeoffs.** Multi-client users wait for a future phase; in exchange the MVP
ships with a simpler, more robust local transport.

---

## ADR-0012 — CLI framework: citty vs commander 🟡

**Status:** Proposed — resolve at Phase 1 kickoff.

**Decision (proposed).** A small, typed CLI framework for the `brain` command.

**Reason.** The CLI is a thin caller of core; the framework choice is
low-stakes and swappable. `citty` is modern/ESM; `commander` is battle-tested.

**Alternatives considered.** Hand-rolled arg parsing. Rejected: not worth the
maintenance for a multi-command CLI.

**Tradeoffs.** Negligible; pick at kickoff, revisit only if it obstructs us.

---

## ADR-0013 — Vector DB & embeddings are out of the MVP ✅ (scoping)

**Decision.** The MVP (Phase 1) ships **lexical search only**. The vector store
(ADR-0005) and embeddings (ADR-0007) are implemented in Phase 2. The *decisions*
on tech are recorded now (ADRs 0005/0007 are ✅) so Phase 1 leaves the right
seams; the *implementation* is deferred.

**Reason.** The MVP's job is to prove the end-to-end loop — store, recall, search,
persist — with the smallest correct surface. Lexical search (FTS5) already proves
the loop and catches the exact-match cases (error strings, identifiers) that are
the most common real queries. Deferring embeddings avoids requiring Ollama setup
just to try Brain, keeps the MVP dependency-light, and lets Phase 1 focus on the
vault/Storage/MCP foundation that everything else builds on.

**Alternatives considered.**
- *Ship semantic search in the MVP.* Rejected: adds a mandatory local-model
  dependency and a second store before the basic loop is proven; risks a fragile
  first release.
- *Ship neither search in the MVP (recall by ID only).* Rejected: search is the
  heart of "retrieve relevant memory"; an MVP without it proves too little.

**Tradeoffs.** MVP users can't do meaning-based search yet — "auth" won't find
"authentication" until Phase 2. We accept this: the MVP proves the loop; semantic
search is the obvious next increment, and the seams are already in place.

---

## Cross-cutting: why these stack together

- **Why Obsidian / Markdown (ADR-0001 + CO-3):** the human-editable,
  future-proof, portable source of truth — and a format the target users often
  already use.
- **Why MCP (ADR-0011):** the native interface for an AI coding assistant; the
  standard Claude Code already speaks, so Brain plugs in without a custom
  protocol.
- **Why local storage (ADR-0004, 0005, 0006):** no servers, no daemons, no
  network — the structural expression of local-first/privacy-first.
- **Why modular (ADR-0002, 0003):** years of churn, swappable tech, testable
  core.
- **Why future embeddings, not MVP (ADR-0013):** prove the loop first; don't
  make the first release depend on a local model server.
- **Why no vector DB in the MVP (ADR-0013):** same — the vector store is a
  Phase-2 increment behind a seam that's already designed in (`IVectorStore`).

---

## Decision log

Full chronological log with context + consequences: `memory/decisions.md`.
Full ADR documents (one per decision): `docs/adr/`. (See the review note in the
Phase-1 review: the `docs/adr/` directory does not yet exist and should be
created with at least the accepted ADRs before implementation begins.)
