# architecture.md — How it actually works

> Lived implementation knowledge. The authoritative design is in
> `docs/ARCHITECTURE.md`; this file captures realities, gotchas, and invariants
> as they hold in practice.

## Current state

- **Phase: Design.** No implementation exists. This file will fill in as code
  lands. Until then, it records the architectural invariants we've committed to
  and the open realities we expect to hit.

## Invariants (must never be violated without an ADR)

1. **Markdown is canonical.** No knowledge exists only in a derived store.
2. **One writer per store.** Storage owns the vault; Indexer owns vector/graph.
3. **Core knows no infrastructure.** No `fs`/`sqlite`/`lancedb`/MCP imports in
   `core/`.
4. **All external access through ports.** Concrete tech lives only in
   `adapters/` and `infrastructure/`.
5. **Derived stores are rebuildable.** `brain_rebuild --full` reproduces them.
6. **No silent network.** No outbound calls unless an opt-in remote capability
   is configured.

## Expected implementation realities (to confirm in Phase 1)

- **Atomic writes:** Storage writes via temp-file + rename so a crash never
  leaves a torn note. Confirm the exact mechanism on Windows (rename-over can
  behave differently than POSIX `rename`).
- **Incremental indexing:** gated on a per-note **normalized full-content hash**
  (frontmatter + body; LF, single trailing newline, BOM stripped, stable
  frontmatter key order) — decided in ADR-0009. `mtime` + size is a fast
  pre-filter only; the hash is authoritative (survives Git/Syncthing mtime
  churn). The hash **function** lives with the Note model / Storage; the
  `hash → indexed` **sync-state table** lives with the Indexer (ADR-0003
  ownership). The Indexer must ask Storage for the normalized hash — not
  re-derive it from raw bytes (would re-open byte-churn and duplicate parsing).
  The normalization is load-bearing: version it (`hashVersion`) so a change
  triggers an automatic one-time `--full`.
- **Concurrency:** a per-note write lock in Storage; a bounded queue in the
  Indexer. Obsidian saves in bursts — the watcher debounces.
- **SQLite co-location:** metadata + graph + FTS in one DB file. Revisit if FTS
  write contention with graph writes shows up under load.

## Layering, in practice

The import-direction rule (inward/downward only) is enforced by ESLint boundary
config, not just convention. When adding a new module:

- If it needs infrastructure (`fs`, a DB client, a network client), it's an
  `adapter/` or `infrastructure/` — and it must implement a `core/ports/`
  interface.
- If it's pure logic, it's `core/` and may import only other `core/`.
- Wiring (which impl behind which port) happens **only** in
  `src/composition-root.ts`.

## Things to watch for (known traps ahead)

- **Wikilink resolution:** `[[name]]` can resolve to multiple files (ambiguity)
  or none (dangling). Storage must define deterministic resolution + record
  dangling links so the graph builder doesn't silently drop edges.
- **Embedding dimension drift:** swapping models changes vector length. The
  vector store records dimensionality and refuses mixed dims → forces rebuild.
- **Chunk coherence:** fixed-window chunking splits mid-thought. We use
  heading-aware chunking; verify the edge cases (very long sections, code
  blocks spanning headings) in Phase 2.
- **Obsidian burst saves:** the watcher must debounce or the indexer thrashes.
