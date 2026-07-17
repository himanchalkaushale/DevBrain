# DevBrain — Technology Stack

Every choice below is **free, local-first, and open-source**. The guiding rule:
no component requires a server process we don't own, no component phones home,
and every component is replaceable behind an interface in `core/ports/`.

Rationale is given per choice. Alternatives are noted where the decision was
non-obvious.

> Status: **recommended stack, design phase.** Final picks are recorded as ADRs
> in `memory/decisions.md` before Phase 1 implementation begins.

---

## Language & runtime

### TypeScript
- **Why:** Type safety catches a whole class of bugs at design time; it makes
  the port/interface contracts in `core/ports/` *enforceable*, not aspirational.
  Excellent tooling (tsserver, ESLint, Vitest snapshots). First-class MCP SDK
  support. The ecosystem for local AI (Ollama clients, vector DB bindings) is
  mature in TS/Node.
- **Strictness:** `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
  We opt into the strictest practical settings — the architecture's guarantees
  are only as good as the types that express them.

### Node.js (current LTS)
- **Why:** The MCP SDK and most local-AI libraries target Node. LTS gives us a
  stable, supported runtime. A single language across CLI, MCP server, and
  indexer keeps the team small and the toolchain unified.
- **Note:** DevBrain ships as an ESM package (`"type": "module"`). CJS interop is
  handled only where a dependency demands it.

---

## MCP integration

### `@modelcontextprotocol/sdk`
- **Why:** The official SDK. Defines the server, tool registration, transport
  (stdio + HTTP/SSE), and the JSON-RPC framing. Using the official SDK keeps us
  compatible with Claude Code's MCP client and any future MCP client without
  us re-implementing the protocol.
- **How we use it:** `src/mcp/server.ts` boots the SDK server; each file in
  `src/mcp/tools/` registers one tool and delegates to Core. The SDK never
  appears outside `src/mcp/` — that's the layering rule.

---

## Embeddings & local model serving

### Ollama
- **Why:** Runs embedding (and, later, lightweight LLM) models **locally** with
  one command. No API key, no network. Cross-platform. Matches the privacy-first
  principle exactly: text never leaves the machine to be embedded.
- **How we use it:** `adapters/embedder-ollama/` calls Ollama's HTTP API
  (`/api/embeddings`) behind `IEmbedder`. Batching for throughput. When Ollama
  is unreachable, the indexer queues/retries and search falls back to
  lexical-only.

### Embedding model — `nomic-embed-text` (default)
- **Why:** Strong quality for its size, runs comfortably on commodity hardware
  via Ollama, and is purpose-built for embedding (not a repurposed LLM). Good
  long-context handling for note chunks.
- **Swappable:** `IEmbedder` means any local Ollama model (or, opt-in, a remote
  model) can replace it. Dimensionality is recorded per store so a swap triggers
  a rebuild rather than silent corruption.
- **Alternatives considered:** `all-MiniLM-L6-v2` (smaller, faster, slightly
  lower quality) — fine as a "fast/lite" preset; `bge-small` — also viable.
  The interface makes any of these a config change, not a code change.

---

## Vector database

### LanceDB (primary recommendation)
- **Why:** **Local, file-based, no server process** — a perfect local-first fit.
  Embedded (in-process library), so DevBrain doesn't manage a separate DB daemon.
  Native Arrow columnar format → fast kNN, efficient storage, good for
  incremental upserts. Solid TypeScript/Node bindings.
- **How we use it:** `adapters/vector-lancedb/` implements `IVectorStore` with a
  `memories` table holding chunk + embedding + metadata; ANN index for kNN.
- **Alternatives considered:**
  - **ChromaDB:** Also local-first and popular. Two tradeoffs: it leans toward a
    client/server model (a Python or HTTP server), which adds a process to
    manage; and its Node story is less native than LanceDB's. We keep
    `IVectorStore` so a ChromaDB adapter is a feasible future option.
  - **Qdrant (local mode):** Capable, but heavier. Overkill for a personal
    vault; revisit if multi-vault/scale demands it.
- **Decision driver:** LanceDB needs **zero extra processes** and stays
  in-process — the most faithful to "local-first, no servers."

---

## Relational + graph + full-text store

### SQLite (via `better-sqlite3`)
- **Why:** Local, file-based, transactional, **no server**. A single file holds
  metadata, the knowledge graph (nodes/edges/tags), and **FTS5** full-text
  indexes. `better-sqlite3` is synchronous and fast — ideal for a single-user
  local service. Keeps the "one data directory, no daemons" promise.
- **How we use it:**
  - `graph-sqlite/` implements `IGraphStore` (nodes/edges/tags + traversal).
  - FTS5 powers `devbrain_search_lexical`.
  - Co-located in one DB file for simplicity (decision tracked as an ADR).
- **Why not a dedicated graph DB:** Our graph is small (vault-sized) and our
  queries are simple (neighbors, paths, components). SQLite handles these
  trivially and avoids a second process/engine. `IGraphStore` leaves the door
  open to a real graph DB if scale ever demands it.

---

## File watching

### chokidar
- **Why:** Cross-platform file watching that actually works on Windows
  (notoriously tricky) and macOS/Linux. Debounce-friendly. The de facto standard.
- **How we use it:** `infrastructure/watcher.ts` watches the vault, debounces
  rapid saves (Obsidian saves in bursts), and emits a single change event per
  logical edit to the Indexer. The watcher emits events only — no indexing logic.

---

## Validation & schemas

### zod
- **Why:** TypeScript-first schema validation. We validate every MCP tool input
  with a zod schema *and* derive the TS type from it — one source of truth for
  the tool's contract. Runtime safety + compile-time types from the same
  declaration.
- **How we use it:** `src/mcp/schemas.ts` holds one schema per tool; the MCP
  layer validates before Core is touched.

---

## Build, package, lint, format

### tsup (build) · tsc (type emit)
- **Why:** `tsup` (esbuild-based) for fast dev builds and a bundled CLI; `tsc`
  for type-checked declaration emit for the library entry. Keep build fast and
  output small.
### ESLint (`typescript-eslint`) + `eslint-plugin-import`
- **Why:** `typescript-eslint` for TS-aware rules; the import plugin lets us
  **enforce the layering rule** (`no-restricted-imports` / import boundaries) so
  a `core/` file importing `lancedb` is a lint error, not a hope.
### Prettier
- **Why:** Eliminate formatting debate; consistent style across contributors.
### `editorconfig`
- **Why:** Consistent basic formatting regardless of editor.

---

## Testing

### Vitest
- **Why:** Fast, ESM-native, Jest-compatible API, first-class TypeScript. Watch
  mode and snapshot support. Runs unit tests (co-located) and integration tests
  (`tests/`) from one config.
- **Strategy:**
  - **Unit** (co-located `*.test.ts`): pure logic with in-memory fakes for ports
    — no Ollama, no DB, no filesystem. Fast and deterministic.
  - **Integration** (`tests/`): real SQLite + LanceDB against a fixture vault;
    optional real Ollama (marked, opt-in via env, not required in CI).
  - **E2E** (`tests/e2e/`): an MCP client drives DevBrain against a sample vault —
    proves the whole loop.
- **Fakes:** a deterministic `FakeEmbedder` (hash-based vectors) keeps semantic
  tests reproducible without a model.

---

## CLI

### `citty` or `commander`
- **Why:** A small, typed CLI framework for the `devbrain` command (`index`,
  `search`, `status`, `rebuild`, `graph …`). `citty` is modern/ESM; `commander`
  is the battle-tested default. Pick at Phase 1 kickoff — low-stakes, swappable.
- The CLI is a thin caller of Core, never duplicating logic.

---

## Process & dependency management

### pnpm
- **Why:** Fast, disk-efficient (content-addressed store), strict about
  phantom deps (reinforces the layering rule — a module can't accidentally use
  a transitive dep it didn't declare). `pnpm`'s workspace support also leaves
  room to split packages later without re-tooling.
### `node-version` pin + `engines`
- **Why:** A declared Node version + `engines` field prevents drift across
  contributors and CI.

---

## CI & quality gates

### GitHub Actions
- **Why:** Free for OSS, runs on Windows + Linux (DevBrain must work on Windows —
  our primary dev platform — and Linux).
- **Gates:** install → lint (incl. boundary rules) → typecheck → unit tests →
  integration tests (no Ollama required) → build. E2E and real-Ollama tests run
  on demand/nightly.
### Dependabot
- **Why:** Automated, reviewable dependency updates for an OSS project that must
  stay secure and current without manual toil.

---

## What we deliberately do NOT pick (and why)

| Rejected | Reason |
|---|---|
| Cloud vector DBs (Pinecone, Weaviate cloud) | Violates local-first. |
| A separate DB server (Postgres, etc.) | Adds a daemon; SQLite is enough at our scale. |
| A remote embedding API as default | Violates privacy-first; only allowed as an explicit opt-in behind `IEmbedder`. |
| A heavy framework (NestJS etc.) | Our layering *is* the framework; a DI container would obscure the composition root. We use a single, readable `composition-root.ts`. |
| Telemetry/analytics SDKs | Privacy-first: none, ever. |

---

## Stack summary

| Concern | Choice | Free? | Local? |
|---|---|---|---|
| Language | TypeScript (strict) | ✅ | ✅ |
| Runtime | Node.js LTS | ✅ | ✅ |
| MCP | `@modelcontextprotocol/sdk` | ✅ | ✅ |
| Embeddings | Ollama + `nomic-embed-text` | ✅ | ✅ |
| Vector DB | LanceDB | ✅ | ✅ |
| Relational/Graph/FTS | SQLite (`better-sqlite3`) + FTS5 | ✅ | ✅ |
| File watching | chokidar | ✅ | ✅ |
| Validation | zod | ✅ | ✅ |
| Build | tsup + tsc | ✅ | ✅ |
| Lint/Format | ESLint + Prettier | ✅ | ✅ |
| Test | Vitest | ✅ | ✅ |
| CLI | citty / commander | ✅ | ✅ |
| Package mgr | pnpm | ✅ | ✅ |
| CI | GitHub Actions | ✅ | ✅ |

**Everything free. Everything local. Nothing phones home.**
