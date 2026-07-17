# Project Brain — MCP Tool Catalog

This is the complete catalog of MCP tools Project Brain will expose to Claude
Code. Tools are grouped by the Core subsystem they delegate to.

> **Status: design only.** No tool is implemented. Each tool's contract is fixed
> here so the MCP surface can be designed against before any code exists.
>
> **Naming convention:** all tools are prefixed `brain_` to namespace them in the
> MCP client and avoid collisions with other servers.

## Design rules for every tool

1. **Thin by design.** A tool validates input, delegates to exactly one Core
   service, and serializes the result. No business logic in the MCP layer.
2. **Inputs are validated** with a zod schema; invalid input is rejected before
   Core is touched.
3. **Outputs are structured** (typed objects), not free-form strings. Claude can
   reason over fields; humans get a friendly rendering via the CLI.
4. **Provenance always.** Any tool returning memory content includes the source
   path, score, and a short "why" so Claude can cite and trust results.
5. **Idempotent writes.** Re-calling a write tool with the same input produces
   the same end state (upsert semantics). Destructive ops require an explicit
   confirm flag.
6. **Bounded output.** Every result tool accepts a `limit` and respects a global
   token budget to protect Claude's context window.

---

## Group A — Recall (retrieve specific memories)

### `brain_recall_by_id`
- **Purpose:** Fetch a single note/memory by its stable ID or vault path.
- **Inputs:** `{ id?: string; path?: string; includeBody?: boolean }`
- **Outputs:** `{ note: NoteSummary & { body?: string } }` where `NoteSummary`
  = `{ id, path, title, tags, frontmatter, mtime, links }`.
- **Responsibility:** Direct lookup, no search. Fastest way to pull a known
  memory. Resolves `[[wikilinks]]` in the body to absolute paths.

### `brain_recall_recent`
- **Purpose:** List the most recently created/modified memories.
- **Inputs:** `{ since?: ISO8601; limit?: number; tags?: string[] }`
- **Outputs:** `{ items: NoteSummary[] }`
- **Responsibility:** Recency window. Cheap; used to re-establish context at the
  start of a session.

---

## Group B — Search (find relevant memories)

### `brain_search_semantic`
- **Purpose:** Find memories by meaning using vector similarity.
- **Inputs:** `{ query: string; limit?: number; tags?: string[]; since?: ISO8601 }`
- **Outputs:** `{ results: SearchResult[] }` where `SearchResult` =
  `{ noteId, path, chunk, score, tags }`.
- **Responsibility:** Embeds the query, runs kNN over the Vector Store, applies
  metadata filters. Returns ranked chunks with provenance.

### `brain_search_lexical`
- **Purpose:** Find memories by exact/keyword match (FTS5).
- **Inputs:** `{ query: string; limit?: number; tags?: string[] }`
- **Outputs:** `{ results: SearchResult[] }`
- **Responsibility:** Full-text search over note text. Catches things semantic
  search misses: exact identifiers, error strings, file names.

### `brain_search_hybrid`
- **Purpose:** Combine semantic + lexical results with a unified rank.
- **Inputs:** `{ query: string; limit?: number; tags?: string[]; since?: ISO8601; semanticWeight?: number }`
- **Outputs:** `{ results: SearchResult[]; strategy: string }`
- **Responsibility:** The default search. Runs both, merges by ID, re-ranks with
  a weighted score, deduplicates overlapping chunks. Reports the strategy used.

---

## Group C — Graph (traverse relationships)

### `brain_graph_neighbors`
- **Purpose:** Get notes directly linked to a given note.
- **Inputs:** `{ noteId: string; direction?: "out" | "in" | "both"; limit?: number }`
- **Outputs:** `{ neighbors: { noteId, path, title, relation, direction }[] }`
- **Responsibility:** One-hop traversal. `relation` distinguishes `wikilink`,
  `tag`, or extracted `entity`.

### `brain_graph_path`
- **Purpose:** Find a connection path between two notes.
- **Inputs:** `{ from: string; to: string; maxHops?: number }`
- **Outputs:** `{ paths: Path[] }` where `Path` = `{ nodes: noteId[], edges: {relation}[] }`.
- **Responsibility:** BFS/shortest-path over the Graph Store. Useful for "how
  does X relate to Y?" reasoning.

### `brain_graph_clusters`
- **Purpose:** Discover topic clusters in the vault.
- **Inputs:** `{ minSize?: number; algorithm?: "louvain" | "wcc" }`
- **Outputs:** `{ clusters: { id, noteIds: string[], label?: string }[] }`
- **Responsibility:** Community detection. Optional auto-labeling of clusters.

### `brain_graph_orphans`
- **Purpose:** Find notes with no inbound or outbound links — likely under-connected knowledge.
- **Inputs:** `{ limit?: number }`
- **Outputs:** `{ orphans: NoteSummary[] }`
- **Responsibility:** Graph hygiene. Surfaces memories that should be linked or
  may be stale.

---

## Group D — Remember (write/update memories)

### `brain_remember`
- **Purpose:** Create or update a memory note in the vault.
- **Inputs:** `{ title: string; content: string; tags?: string[]; path?: string; links?: string[]; frontmatter?: object }`
- **Outputs:** `{ noteId, path, created: boolean }`
- **Responsibility:** Upsert. Generates stable ID + frontmatter (type, created,
  updated, source), resolves `links` into `[[wikilinks]]`, writes via Storage.
  Idempotent on title/path.

### `brain_append`
- **Purpose:** Append a fragment to an existing memory (e.g., a new fact to a
  running log).
- **Inputs:** `{ noteId: string; content: string; section?: string }`
- **Outputs:** `{ noteId, path, section }`
- **Responsibility:** Targeted append under an optional heading. Avoids rewriting
  a whole note to add one line.

### `brain_forget`
- **Purpose:** Delete or archive a memory.
- **Inputs:** `{ noteId: string; archive?: boolean; confirm?: boolean }`
- **Responsibility / Outputs:** `{ noteId, action: "deleted" | "archived" }`.
  Default `archive=true` moves to an `_archive/` folder; `archive=false` +
  `confirm=true` hard-deletes (with a pre-delete backup).

### `brain_tag`
- **Purpose:** Add/remove tags on a note.
- **Inputs:** `{ noteId: string; add?: string[]; remove?: string[] }`
- **Outputs:** `{ noteId, tags: string[] }`
- **Responsibility:** Edit frontmatter tags only — no body rewrite.

---

## Group E — Context (assemble what to load)

### `brain_build_context`
- **Purpose:** Build a focused, token-budgeted context bundle for an intent.
- **Inputs:** `{ intent: string; scope?: string[]; budget?: number; includeGraph?: boolean }`
- **Outputs:** `{ bundle: string; manifest: { noteId, path, score }[]; tokensUsed: number }`
- **Responsibility:** Orchestrates recall + graph expansion + budgeting. The
  "what should I actually load into context?" brain. Returns ready-to-paste
  text plus a manifest for citation.

### `brain_status`
- **Purpose:** Report indexer health and coverage.
- **Inputs:** `{}`
- **Outputs:** `{ vaultPath, notesTotal, notesIndexed, pending, lastSync, errors: string[] }`
- **Responsibility:** Read-only diagnostics. Lets Claude know if memory is fresh
  or stale before relying on it.

---

## Group F — Extractor (derive structured knowledge)

### `brain_extract`
- **Purpose:** Extract structured memories from a raw source (conversation log,
  code, free text).
- **Inputs:** `{ source: string; sourceType: "conversation" | "code" | "text"; suggestOnly?: boolean }`
- **Outputs:** `{ proposed: ProposedMemory[] }` where `ProposedMemory` =
  `{ title, content, tags, links, rationale }`.
- **Responsibility:** Propose — does not write unless `suggestOnly` is false and
  a follow-up `brain_remember` is called. Keeps extraction reviewable.

### `brain_index_source`
- **Purpose:** Index an external file or directory into the vault's indexes
  without copying it in (e.g., a codebase for symbol-level recall).
- **Inputs:** `{ path: string; recursive?: boolean; type?: "code" | "docs" }`
- **Outputs:** `{ indexed: number; skipped: number }`
- **Responsibility:** Extends the indexer's view beyond the vault. Read-only
  with respect to the source; writes only to derived stores.

---

## Group G — Administration

### `brain_rebuild`
- **Purpose:** Rebuild derived stores from the vault.
- **Inputs:** `{ full?: boolean; noteIds?: string[] }`
- **Outputs:** `{ reindexed: number; durationMs: number }`
- **Responsibility:** Recovery path. `full=true` wipes + rebuilds vector & graph
  stores; otherwise incremental by `noteIds`.

### `brain_config_get` / `brain_config_set`
- **Purpose:** Inspect and (with care) update live config.
- **Inputs (get):** `{ key?: string }` · **Inputs (set):** `{ key: string; value: unknown }`
- **Outputs:** `{ key, value, source }`
- **Responsibility:** `set` is limited to runtime-safe keys (model, log level,
  budgets) — never vault path or destructive toggles without a CLI restart.

---

## Tool catalog summary

| # | Tool | Group | Phase |
|---|---|---|---|
| 1 | `brain_recall_by_id` | Recall | 1 |
| 2 | `brain_recall_recent` | Recall | 1 |
| 3 | `brain_search_lexical` | Search | 1 |
| 4 | `brain_remember` | Remember | 1 |
| 5 | `brain_status` | Context | 1 |
| 6 | `brain_search_semantic` | Search | 2 |
| 7 | `brain_search_hybrid` | Search | 2 |
| 8 | `brain_graph_neighbors` | Graph | 3 |
| 9 | `brain_graph_path` | Graph | 3 |
| 10 | `brain_graph_clusters` | Graph | 3 |
| 11 | `brain_graph_orphans` | Graph | 3 |
| 12 | `brain_build_context` | Context | 5 |
| 13 | `brain_extract` | Extractor | 6 |
| 14 | `brain_index_source` | Extractor | 6 |
| 15 | `brain_append` | Remember | 4 |
| 16 | `brain_forget` | Remember | 4 |
| 17 | `brain_tag` | Remember | 4 |
| 18 | `brain_rebuild` | Admin | 1 |
| 19 | `brain_config_get` | Admin | 1 |
| 20 | `brain_config_set` | Admin | 1 |

## Versioning

The MCP tool surface is versioned. Breaking changes (renamed/removed tools,
changed required inputs) bump a `brain_mcp_version` and are documented in
`CHANGELOG.md` and `memory/decisions.md`. Additive changes (new optional
inputs, new tools) are non-breaking.
