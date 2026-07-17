# DevBrain — Success Criteria

> **Phase 1: Product Specification.** This document defines **measurable** goals
> for the MVP (Version 1 / Phase 1). Each criterion is binary or quantified, has
> a way to check it, and maps to the requirements in `docs/REQUIREMENTS.md` and
> the exit criteria in `docs/MVP_SCOPE.md`. "Done" means every applicable
> criterion is met — if one isn't, the MVP is not done and we say so plainly.
>
> **Conventions:** Targets are provisional pending a benchmark fixture created
> in Phase 1; the *form* of each criterion (what we measure) is fixed. "p95"
> means the 95th-percentile latency over the benchmark workload on commodity
> hardware.

---

## 1. Headline success criteria (the loop)

### C-1 — The MCP server connects to an Obsidian vault
- **Measure:** On Windows and Linux, DevBrain attaches to a real vault directory,
  exposes its MCP tools over stdio, and Claude Code successfully invokes them.
- **Pass when:** A fresh `devbrain` server started against a sample vault responds
  to a `devbrain_status` call from an MCP client with a non-error result.
- **Maps to:** FR-1.1, FR-6.1, AC-1, CO-1, CO-2.

### C-2 — Notes can be created
- **Measure:** `devbrain_remember` creates a Markdown note in the vault with valid
  frontmatter (`id`, `type`, `created`, `updated`, `source`, tags, links) and a
  stable, sortable, URL-safe ID.
- **Pass when:** The note exists on disk and is parseable back into the
  structured note model with the assigned ID intact.
- **Maps to:** FR-4.1, FR-4.3, AC-2.

### C-3 — Notes can be updated (idempotently)
- **Measure:** Re-calling `devbrain_remember` with the same title/path does not
  create a duplicate; the stable ID is preserved and `updated` advances.
- **Pass when:** After N repeated identical writes, exactly one note exists for
  that key.
- **Maps to:** FR-4.2, FR-4.4, AC-3.

### C-4 — Notes can be recalled by ID and by recency
- **Measure:** `devbrain_recall_by_id` returns the memory (immediately after write,
  before indexing completes); `devbrain_recall_recent` lists most-recently changed
  memories scoped by optional tags/window.
- **Pass when:** A just-written memory is recallable by ID within the same
  session, and `devbrain_recall_recent` ordering matches modification time.
- **Maps to:** FR-2.1, FR-2.2, FR-2.3, AC-4, AC-5.

### C-5 — Keyword search works
- **Measure:** `devbrain_search_lexical` returns ranked results for an exact
  string/identifier, supports tag/date filters, and respects `limit`/token
  budget.
- **Pass when:** Searching for a known exact token in a fixture vault returns the
  containing note ranked in the top results, with provenance (path, score, tags).
- **Maps to:** FR-3.1–3.4, FR-9.1, AC-4, AC-13.

### C-6 — Recall works across sessions (the persistence proof)
- **Measure:** A memory written in one session is findable by keyword in a
  *fresh* session with no in-memory state carried over.
- **Pass when:** Server is stopped, restarted against the same vault, and the
  previously written memory is returned by `devbrain_search_lexical`.
- **Maps to:** G1, FR-3.1, AC-4. (This is the MVP's central proof.)

---

## 2. Architecture & modularity

### C-7 — The architecture remains modular (layering enforced)
- **Measure:** The import-direction rule (inward/downward only) is enforced by
  ESLint boundary config; no `core/` file imports infrastructure (`fs`,
  `sqlite`, `lancedb`, MCP).
- **Pass when:** `pnpm lint` fails on a deliberately introduced violating import
  (negative test) and passes on the real tree.
- **Maps to:** NFR-5, EX-1–3, AC-10.

### C-8 — Core is unit-testable with in-memory fakes
- **Measure:** All core logic has unit tests using in-memory fakes for ports —
  no filesystem, no DB, no network — and they are deterministic.
- **Pass when:** `pnpm test` (unit) passes offline with no real stores; tests are
  reproducible across runs.
- **Maps to:** NFR-11, AC-10, coding-standards.

### C-9 — A single composition root wires everything
- **Measure:** All port→adapter wiring lives in one file; no service locator or
  DI container; "which implementation" is discoverable in one place.
- **Pass when:** Grep confirms no other file instantiates concrete adapters for
  ports outside the composition root and tests.
- **Maps to:** EX-3, ADR-0002.

### C-10 — Every external technology is behind a port
- **Measure:** Concrete tech (SQLite, chokidar, zod, the MCP SDK) lives only in
  `adapters/`/`infrastructure/`/`mcp/`; core depends on interfaces.
- **Pass when:** `core/` contains no import of a concrete technology package.
- **Maps to:** NFR-5, EX-1–2, ADR-0002.

---

## 3. Privacy & recovery

### C-11 — No outbound network by default (auditable)
- **Measure:** An audit of the codebase finds no outbound network call outside a
  single interface gated by an off-by-default flag; no telemetry/analytics code.
- **Pass when:** A reviewer can confirm — by grepping for network APIs and
  reading the one flagged path — that nothing phones home unless opted in.
- **Maps to:** NFR-2, NFR-3, SR-5, ADR-0004, AC-9.

### C-12 — Derived stores are rebuildable from the vault
- **Measure:** Deleting the derived (metadata + FTS) stores and running
  `devbrain_rebuild --full` reproduces them; no memory is lost.
- **Pass when:** Search results before and after a wipe+rebuild are identical
  for a fixture vault.
- **Maps to:** FR-5.5, NFR-4, ADR-0001, AC-7.

### C-13 — Path traversal is blocked
- **Measure:** A write targeting a path outside the vault (`../` escape,
  absolute path elsewhere) is rejected with a structured error.
- **Pass when:** A negative test confirms rejection; no file is created outside
  the vault.
- **Maps to:** SR-1, FR-1.5, AC-8.

### C-14 — Writes are atomic / crash-safe
- **Measure:** Vault writes use temp-file + rename; a simulated mid-write crash
  leaves either the prior or the new file, never a torn one.
- **Pass when:** A fault-injection test confirms no partially-written note can
  exist on disk.
- **Maps to:** SR-2, FR-4.6, NFR-6.

---

## 4. Performance (provisional targets, pinned against a Phase-1 fixture)

### C-15 — Incremental indexing is O(changes)
- **Measure:** Re-indexing after a single-note change does not re-process
  unchanged notes; cost is proportional to changes, not vault size.
- **Pass when:** A benchmark shows indexing N changed notes costs ~N units, not
  ~vault-size units; unchanged notes are skipped (hash-gated).
- **Maps to:** PR-1, PR-3, FR-5.2.

### C-16 — Single-note incremental re-index is fast
- **Measure:** Re-indexing one changed note completes in **< 1 s** on commodity
  hardware (common case).
- **Pass when:** p95 over the benchmark workload is under the target.
- **Maps to:** PR-1.

### C-17 — Lexical search latency
- **Measure:** `devbrain_search_lexical` on a personal vault (hundreds of notes)
  returns in **< 1 s (p95)**.
- **Pass when:** p95 over the benchmark workload is under the target.
- **Maps to:** PR-2.

### C-18 — Recall-by-ID is constant-time
- **Measure:** `devbrain_recall_by_id` latency is effectively flat regardless of
  vault size (direct lookup).
- **Pass when:** Recall latency on the large-vault fixture is within a small
  constant of the small-vault fixture.
- **Maps to:** PR-5.

### C-19 — Token budget is respected
- **Measure:** No tool returns more content than the configured token budget /
  `limit`; a large vault cannot overflow the client's context window.
- **Pass when:** A test with a high-cardinality result set is truncated to the
  budget and the result reports truncation.
- **Maps to:** PR-7, FR-3.3, NFR-13.

---

## 5. Reliability & observability

### C-20 — Incremental indexing survives a crash (resumable)
- **Measure:** A crash mid-index leaves a `pending` set that resumes on next
  start; no half-indexed note corrupts the derived store (per-note upserts are
  transactional).
- **Pass when:** A fault-injection test confirms a resumable, consistent state
  after recovery.
- **Maps to:** PR-4, SR-10, FR-5.

### C-21 — `devbrain_status` reports accurate sync state
- **Measure:** `devbrain_status` reports vault path, total, indexed, pending, last
  sync, and errors consistent with the actual vault state.
- **Pass when:** Counts match a controlled fixture after a known set of writes
  and edits.
- **Maps to:** FR-5.4, NFR-9.

### C-22 — File watcher reflects edits and debounces bursts
- **Measure:** Editing a note in Obsidian triggers exactly one re-index per
  logical edit (debounced); the updated content is searchable on the next query.
- **Pass when:** A burst-save test produces one re-index and the new content is
  searchable.
- **Maps to:** FR-5.3, AC-6.

### C-23 — Structured logging & typed errors
- **Measure:** The system emits structured logs with levels + quiet mode; no raw
  `console.log` in library code; errors are a typed hierarchy that does not leak
  raw stacks to MCP clients.
- **Pass when:** A lint/test check bars `console.log` in library code and
  verifies error responses are structured.
- **Maps to:** NFR-9, NFR-10, SR-9.

---

## 6. Quality, documentation & onboarding

### C-24 — All MVP features are covered by tests
- **Measure:** Every MVP MCP tool and CLI command has a passing unit test; one
  integration test covers the vault round-trip; one e2e drives MCP → DevBrain →
  sample vault.
- **Pass when:** Coverage gates pass for the MVP surface; integration + e2e
  tests are green, not skipped.
- **Maps to:** NFR-11, NFR-12, AC-11, Definition of Done.

### C-25 — Documentation is complete and synchronized
- **Measure:** Every MVP behavior has matching docs (`docs/user/`,
  `docs/MCP_TOOLS.md`, `CHANGELOG.md`); the getting-started guide walks a new
  user to a working setup in minutes.
- **Pass when:** A reviewer following the getting-started guide from a clean
  checkout reaches a working `devbrain status` without external help.
- **Maps to:** NFR-12, AC-11, V1-18.

### C-26 — First-run is low-friction (no mandatory external service)
- **Measure:** The MVP runs with no daemon and no mandatory model server —
  SQLite + files, in-process. Ollama is *not* required to use Version 1.
- **Pass when:** A clean install + configure + `devbrain index` + `devbrain search`
  works with only the bundled dependencies.
- **Maps to:** NFR-1, ADR-0013, MVP thesis.

### C-27 — Cross-platform parity (Windows + Linux)
- **Measure:** The MVP builds, tests, and runs on Windows and Linux in CI.
- **Pass when:** CI gates pass on both OSes for the MVP surface.
- **Maps to:** NFR-8, CO-1, AC-1.

### C-28 — Open-source & dependency hygiene
- **Measure:** All dependencies are free and open-source; a permissive license
  is chosen (ADR-0010 resolved); no proprietary component is required.
- **Pass when:** `pnpm` license audit shows no proprietary required deps;
  `LICENSE` is present.
- **Maps to:** NFR-7, P11, ADR-0010.

---

## 7. Composite "Definition of Done" for the MVP

The MVP is **done** only when *all* of the following are true (mirrors
`CLAUDE.md`'s Definition of Done applied to Phase 1):

- [ ] **Working implementation** respecting the architecture and layering
      (C-7, C-9, C-10).
- [ ] **The loop works end-to-end** (C-1 through C-6).
- [ ] **Privacy is real and auditable** (C-11); **recovery is real** (C-12);
      **safety is real** (C-13, C-14).
- [ ] **Performance targets met** against a Phase-1 fixture (C-15–C-19).
- [ ] **Reliability & observability** in place (C-20–C-23).
- [ ] **Tests** passing, not skipped (C-24); **docs** complete (C-25);
      **low-friction first run** (C-26); **cross-platform** (C-27);
      **open-source** (C-28).
- [ ] **Project memory updated** (`memory/roadmap.md` status, any new
      `memory/decisions.md` entries for resolved ADRs 0008–0012).
- [ ] **Roadmap updated** (`memory/roadmap.md`, `docs/ROADMAP.md` if scope
      shifted).

If any box is unchecked, the MVP is not done — state which criteria are unmet
rather than claiming partial completion.

---

## 8. Out-of-scope success measures (future phases, for contrast)

These are *not* MVP success criteria and must not gate Version 1. They are listed
so the line is unambiguous:

- Semantic/hybrid search quality (Phase 2).
- Graph traversal correctness (Phase 3).
- Auto-memory propose→confirm safety (Phase 4).
- Context-bundle token budgeting & citation (Phase 5).
- Extraction / curation quality (Phase 6).
- Multi-vault / multi-client / remote-embedding (post-1.0).

Each has its own exit criteria in `docs/ROADMAP.md`.
