# ideas.md — Future ideas & open questions

> The backlog of "what if." Not committed, not scheduled. Promote an idea to
> `decisions.md` (as a proposed ADR) only when it's ready to act on.

## Retrieval & search

- **Re-ranking model:** a small local cross-encoder to re-rank hybrid search
  results. Phase 2+; only if quality warrants the complexity.
- **Query expansion:** Claude-side or Brain-side synonym/concept expansion
  before embedding. Decide where it belongs.
- **Time-decay scoring:** weight recent memories higher for "current project
  state" queries; keep evergreen memories for conceptual queries. Maybe a
  query-intent flag.
- **Multi-modal chunks:** index code blocks and prose separately so a code
  query hits code chunks first.

## Graph & linking

- **Auto-linking suggestions** (Phase 6): propose `[[wikilinks]]` between
  semantically similar notes; reviewable.
- **Entity extraction:** named entities (people, files, concepts) as graph
  nodes beyond tags/wikilinks. Watch quality/cost.
- **Bidirectional link maintenance:** when a note is renamed, update inbound
  wikilinks. Obsidian does this in-app; Brain should handle edits made outside
  Obsidian.

## Memory lifecycle

- **Memory decay / archival policy:** auto-archive memories untouched for N
  months, with a review prompt. Privacy-safe; opt-in.
- **Conflict resolution** when the same fact is remembered twice: detect,
  propose merge (Phase 6).
- **Source provenance chains:** track which conversation/session produced a
  memory, for trust and audit.

## Integrations

- **Obsidian companion plugin:** in-vault UI for Brain status, proposed
  memories, graph view. Keep Brain server-side; plugin is a thin client.
- **Git-backed vault:** version the vault itself; Brain could surface memory
  history/diffs.
- **Multi-vault:** namespaced indexes; attach to several vaults (personal,
  work, …).
- **HTTP/SSE transport:** multi-client Brain (several MCP clients, one index
  set).

## Developer experience

- **`brain doctor`:** health check — vault path valid, Ollama reachable, index
  fresh, no orphan errors.
- **A `brain repl`** for exploring memory interactively during development.
- **Benchmark suite:** index/search latency over a large fixture vault, tracked
  over time so we catch regressions.

## Architecture experiments

- **Pluggable storage backends** beyond Obsidian (e.g., a plain-Markdown
  folder, a Git repo) via `IStorage`.
- **Streaming context:** stream `brain_build_context` results as they assemble,
  rather than one bundle.
- **Local LLM for extraction:** use a small local model (via Ollama) for the
  Phase-6 extractor instead of relying on Claude — keeps extraction offline.

## Open questions (research, not decisions yet)

- Best heading-aware chunker for Markdown with mixed prose/code?
- Is Louvain or WCC better for typical vault-sized graphs? (Phase 3.)
- How to represent embeddings for a note that's mostly a code block?
