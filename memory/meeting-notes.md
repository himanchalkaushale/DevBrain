# meeting-notes.md — Design discussions & syncs

> Decisions and takeaways from design discussions, syncs, or AI working
> sessions. Date-stamped, newest at top. Keep entries short; link to ADRs for
> durable decisions.

## 2026-07-17 — Project renamed to DevBrain

The project was officially renamed **Project Brain → DevBrain**. This was a
repository-wide branding migration (prose product name, the `brain`/`brain_*`
CLI and MCP tool identifiers → `devbrain`/`devbrain_*`, `brain.config.ts` →
`devbrain.config.ts`, `.brainrc` → `.devbrainrc`, repo-root diagram
`project-brain/` → `devbrain/`).

Per the migration policy, **historical entries below are preserved verbatim** —
they intentionally record the old name "Project Brain" as it was used at the
time. They are not rewritten. Read them as historical record, not current
naming. (Project Brain was renamed to DevBrain on 2026-07-17.)

## 2026-07-17 — Initial architecture design (AI working session)

**Context:** Greenfield design of Project Brain. Goal: produce the complete
architecture, repo structure, MCP tool catalog, memory architecture, roadmap,
tech stack, the permanent CLAUDE.md, and the `memory/` scaffold — no
implementation code.

**Key decisions made (→ ADRs):**
- Markdown is canonical; all indexes derived (ADR-0001).
- Layered architecture, deps inward/downward only, enforced by ESLint
  (ADR-0002).
- One writer per store (ADR-0003).
- Local-first & privacy-first; no outbound network by default (ADR-0004).
- LanceDB for vectors (ADR-0005); SQLite for metadata+graph+FTS (ADR-0006);
  Ollama + nomic-embed-text (ADR-0007).

**Open questions deferred to kickoff:**
- Chunking defaults; content-hash source; license; MCP transport defaults; CLI
  framework (proposed ADRs 0008–0012).

**Artifacts produced:** `docs/*`, `CLAUDE.md`, `memory/*`, `README.md`.

**Next:** Phase 1 kickoff — resolve open ADRs, scaffold repo.

## 2026-07-17

Completed:

- Product Specification
- Requirements
- Repository Design
- ADR-0008 (Chunking Strategy)

Decision:

- Markdown-aware chunking
- 512 token chunks
- 64 token overlap
- Atomic code blocks
- Token-based chunking

Next:

ADR-0009

## 2026-07-17 — ADR-0009 (Content hash source)

**Context:** Resolve the open "content hash source for incremental indexing"
question (frontmatter-only vs full-file) so the Phase 1 incremental indexer has
a concrete contract.

**Key realization:** ADR-0008 (Accepted) already constrained the answer — its
Negative-consequences section requires the hash to cover the full file so
heading renames (a body edit) re-index. So the genuine open space was *which
full-file form*, not *whether* full file. A frontmatter-only choice would have
contradicted an Accepted ADR (contradictions are bugs, per CLAUDE.md).

**Decision (→ ADR-0009, Accepted):**
- **Normalized full-content hash** — SHA-256 over a normalized serial form of
  **frontmatter + body** (LF, single trailing newline, BOM stripped, stable
  frontmatter key order).
- `mtime` + size is an **optional fast pre-filter**; the normalized hash is the
  **authoritative** gate (robust to Git/Syncthing mtime-without-content-change
  churn — the failure mode the proposed ADR flagged).
- Raw full-file byte hash available as opt-in **strict** mode (off by default;
  whitespace-fragile).
- Ownership (ADR-0003): hash **function** → Note model / Storage; `hash → indexed`
  **sync-state table** → Indexer.
- Version the normalization (`hashVersion`) so a change triggers an automatic
  one-time `--full` rather than silent re-index noise.

**Rejected:** frontmatter-only (silently stale, contradicts ADR-0008); raw bytes
as default (whitespace-fragile under sync); rendered-chunk-text (couples
sync-state to the chunker → spurious re-index on chunker-config retune).

**Artifacts updated:** `docs/adr/0009-content-hash-source.md`,
`docs/DESIGN_DECISIONS.md` (ADR-0009 🟡→✅), `memory/decisions.md`,
`memory/architecture.md`, `memory/roadmap.md`, this file.

**Next:** ADR-0010 (license), ADR-0011 (MCP transport), ADR-0012 (CLI framework) —
still open; resolve at Phase 1 kickoff.
