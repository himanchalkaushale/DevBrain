# roadmap.md — Live status

> Live counterpart to `docs/ROADMAP.md`. The plan lives there; status lives
> here. Update this as phases move.

## Summary

| Phase | Name | Status | Notes |
|---|---|---|---|
| 0 | Design & architecture | ✅ Done | Docs, CLAUDE.md, memory scaffold. No code. |
| 0.5 | Product specification | ✅ Done | Phase-1 spec docs (PRODUCT_SPEC, REQUIREMENTS, PROJECT_PRINCIPLES, DESIGN_DECISIONS, MVP_SCOPE, SUCCESS_CRITERIA). No code. |
| 1 | MVP: Local Memory + Lexical Search | ⬜ Not started | Awaits kickoff. Open ADRs 0008–0012. |
| 2 | Semantic Search | ⬜ Not started | Blocked by Phase 1. |
| 3 | Knowledge Graph | ⬜ Not started | Blocked by Phase 2. |
| 4 | Automatic Memory | ⬜ Not started | Blocked by Phase 3. |
| 5 | Context Builder | ⬜ Not started | Blocked by Phase 4. |
| 6 | AI Knowledge Manager | ⬜ Not started | Blocked by Phase 5. |

## Phase 0 — Design & architecture ✅

Delivered the complete design set:
- `docs/`: ARCHITECTURE, REPOSITORY_STRUCTURE, MCP_TOOLS, MEMORY_ARCHITECTURE,
  ROADMAP, TECH_STACK.
- `CLAUDE.md` (permanent AI guide).
- `memory/` scaffold (this file + 8 others).
- `README.md`.

**No implementation code** — by design (this phase was planning only).

## Phase 0.5 — Product specification ✅

Delivered the Phase-1 product-spec layer (no implementation):
- `docs/PRODUCT_SPEC.md` — vision, problem, users, goals/non-goals, MVP/future
  features, success metrics, workflows, 40 user stories.
- `docs/REQUIREMENTS.md` — functional, non-functional, performance, security,
  scalability, extensibility, compatibility, acceptance criteria.
- `docs/PROJECT_PRINCIPLES.md` — 11 principles, each with rationale.
- `docs/DESIGN_DECISIONS.md` — narrative ADRs 0001–0013 (0008–0012 open).
- `docs/MVP_SCOPE.md` — Version-1 in/out/postponed with rationale.
- `docs/SUCCESS_CRITERIA.md` — 28 measurable MVP criteria.
- Recorded ADR-0013 (vector DB & embeddings out of MVP) in `memory/decisions.md`.
- Indexed the six docs in `README.md`.

**No implementation code** — by design (this phase was specification only).

## Phase 1 — MVP — checklist (not started)

- [ ] Resolve open ADRs 0008–0012 (kickoff decisions). ADR-0008 ✅ and ADR-0009 ✅
      resolved; 0010–0012 remain open for kickoff.
- [ ] Scaffold repo (TS strict, ESLint boundaries, Vitest, tsup, pnpm, CI).
- [ ] `IStorage` + Obsidian adapter (parse, wikilinks, atomic writes, guards).
- [ ] SQLite metadata + FTS5 lexical search.
- [ ] MCP server (stdio): recall_by_id, recall_recent, search_lexical,
      remember, status, rebuild, config_get/set.
- [ ] CLI: index, search, status.
- [ ] File watcher → incremental re-index (metadata/FTS).
- [ ] Composition root + typed config.
- [ ] Sample vault in `examples/` + getting-started doc.
- [ ] Tests: unit + integration + one e2e.

## Blockers / waiting-on

- Phase 1 has no hard blockers. Open ADRs 0010–0012 should be resolved at
  kickoff (0008 and 0009 are resolved).

## Changelog of status changes

- 2026-07-17 — Phase 0 marked Done; Phases 1–6 Not started. (Initial design.)
- 2026-07-17 — ADR-0009 (content hash source) resolved (Accepted): normalized
  full-content hash as the incremental-index gate; `hashVersion`-ed; raw-bytes
  opt-in strict mode. Phase 1 checklist updated; open ADRs now 0010–0012.
