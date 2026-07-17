# DevBrain — Repository Structure

The repository is organized to make the architecture's layering rule
(deps point inward/downward only) **structurally enforceable**. A file in `core/`
that tries to import `lancedb` should fail review, and ideally fail the build.

> The codebase does not exist yet. This is the target layout for Phase 1 onward.
> Directories are created as they gain their first file — do not pre-create
> empty directories.

## Top level

```
devbrain/
├── .github/                  # CI workflows, issue/PR templates, funding
├── .vscode/                  # Recommended editor settings (suggestions only)
├── docs/                     # Design + user documentation (Markdown)
├── memory/                   # Long-term project knowledge (the repo's own brain)
├── src/                      # All source code
├── tests/                    # Integration & e2e tests (unit tests live with code)
├── examples/                 # Example vaults, configs, MCP client snippets
├── scripts/                  # Dev/release helper scripts
├── .editorconfig
├── .gitignore
├── .prettierrc
├── eslint.config.js
├── tsconfig.json
├── tsconfig.build.json
├── package.json
├── vitest.config.ts
├── CLAUDE.md                 # Permanent AI guide
├── README.md
├── LICENSE
├── CONTRIBUTING.md
└── CHANGELOG.md
```

## `src/` — source code

Mirrors the architecture's layers. **Import direction is downward only.**

```
src/
├── cli/                      # `devbrain` command-line entry point
│   ├── index.ts              #   arg parsing, command dispatch
│   ├── commands/             #   one file per command (index, search, …)
│   └── output.ts             #   human-readable formatting
│
├── mcp/                      # MCP Server Layer (thin adapter)
│   ├── server.ts             #   MCP server bootstrap + transport
│   ├── tools/                #   one file per MCP tool (see docs/MCP_TOOLS.md)
│   ├── schemas.ts            #   input validation schemas (zod)
│   └── serializer.ts         #   Core result → MCP response
│
├── core/                     # Domain logic — NO infrastructure imports
│   ├── recall/               #   retrieve by id/query
│   ├── search/               #   hybrid search + ranking
│   ├── graph/                #   graph traversal
│   ├── remember/             #   write/update/delete memories
│   ├── context/              #   context bundle assembly
│   ├── extractor/            #   structured knowledge extraction
│   ├── ports/                #   INTERFACES (IEmbedder, IVectorStore, …)
│   ├── model/                #   domain types (Note, Chunk, Memory, …)
│   └── errors.ts             #   typed error hierarchy
│
├── indexer/                  # Builds derived indexes from the vault
│   ├── chunker.ts            #   note → chunks
│   ├── pipeline.ts           #   orchestration + sync state
│   └── graph-builder.ts      #   links/tags → nodes/edges
│
├── adapters/                 # Concrete implementations of core/ports
│   ├── embedder-ollama/      #   IEmbedder via Ollama
│   ├── vector-lancedb/       #   IVectorStore via LanceDB
│   ├── graph-sqlite/         #   IGraphStore via better-sqlite3
│   └── storage-obsidian/     #   IStorage for an Obsidian vault
│
├── infrastructure/           # Cross-cutting concrete services
│   ├── config.ts             #   typed config loader (defaults<env<file<cli)
│   ├── logger.ts             #   structured logging
│   ├── watcher.ts            #   chokidar file watcher
│   └── paths.ts              #   vault path resolution + traversal guards
│
├── composition-root.ts       # Single place that wires interfaces→impls
└── index.ts                  # Public package entry (exports stable API)
```

### Layering & import rules (enforced)

| Layer | May import | May NOT import |
|---|---|---|
| `cli/` | `core/`, `infrastructure/`, `adapters/`, `composition-root` | — |
| `mcp/` | `core/`, `infrastructure/`, `composition-root` | `adapters/` directly (go through root) |
| `core/` | only `core/` (siblings + ports + model) | `adapters/`, `infrastructure/`, `mcp/`, `cli/`, any npm infra pkg |
| `indexer/` | `core/`, `infrastructure/` | `adapters/` (use ports), `mcp/` |
| `adapters/` | `core/ports`, their own npm dep | other adapters, `mcp/`, `cli/` |
| `infrastructure/` | `core/` types only | `adapters/`, `mcp/`, `cli/` |

**Enforcement:** an ESLint `no-restricted-imports` rule (or `eslint-plugin-import`
boundary config) makes violating these a lint error, not just a convention.

### Test placement

- **Unit tests** live next to the code they test: `foo.ts` → `foo.test.ts`.
- **Integration tests** (multiple modules / real stores) live in `tests/`.
- **E2E tests** (MCP client ↔ DevBrain ↔ a sample vault) live in `tests/e2e/`.

## `docs/` — documentation

```
docs/
├── ARCHITECTURE.md           # system architecture (authoritative)
├── REPOSITORY_STRUCTURE.md   # this file
├── MCP_TOOLS.md              # MCP tool catalog
├── MEMORY_ARCHITECTURE.md    # how the six pillars interlock
├── ROADMAP.md                # phased plan
├── TECH_STACK.md             # stack + rationale
├── adr/                      # Architecture Decision Records (numbered)
│   └── 0001-markdown-canonical.md
└── user/                     # end-user docs (written from Phase 1)
    ├── getting-started.md
    ├── configuration.md
    └── mcp-setup.md
```

## `memory/` — project knowledge

The repository's own long-term brain. See `memory/README.md` for the file
catalog. These are *project-meta* knowledge (decisions, conventions, debt), not
user knowledge — that lives in the user's Obsidian vault.

```
memory/
├── README.md                 # what each memory file is for
├── architecture.md
├── decisions.md
├── bugs.md
├── coding-standards.md
├── roadmap.md
├── meeting-notes.md
├── ideas.md
├── technical-debt.md
└── glossary.md
```

## `examples/`, `scripts/`, `.github/`

- `examples/` — a tiny sample Obsidian vault, example `devbrain.config.ts`, and MCP
  client snippets showing how Claude Code connects.
- `scripts/` — dev helpers (e.g., `bootstrap-vault.ts`, `release.ts`).
- `.github/` — CI (lint, typecheck, test on Windows + Linux), issue templates,
  PR template, `CONTRIBUTING.md` pointer, `dependabot.yml`.

## Naming & file-organization conventions

- **One responsibility per file.** A file exports one primary concept (a class,
  a function family, a type set). If a file name needs "and" in it, split it.
- **File names:** `kebab-case.ts` for files; `PascalCase` for classes and types;
  `camelCase` for functions and variables.
- **Test files:** `<unit>.test.ts`, co-located.
- **Barrels:** `index.ts` re-exports are allowed per module but must not create
  circular imports; prefer direct deep imports in app code.
- **No god files.** If a file grows past ~400 lines, look for a split.

## What deliberately is NOT here

- No `dist/` (build output — gitignored).
- No `node_modules/` (gitignored).
- No secrets, vaults, or `.obsidian/` configs committed — `examples/` carries a
  *sample* vault only, clearly marked as a fixture.
- No per-feature `README.md` sprawl — one `docs/` tree, cross-linked.

## Evolution principle

The structure is allowed to grow, but the **layering rule is fixed**. New
features become a new folder in the right layer; new external tech becomes a new
folder in `adapters/`. Re-shuffling layers requires an ADR.
