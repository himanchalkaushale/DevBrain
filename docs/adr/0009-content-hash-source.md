# ADR-0009 — Content hash source for incremental indexing

- **Status:** Accepted
- **Date:** 2026-07-17
- **Phase:** Phase 1 (MVP) — decided during the Architecture Decision phase so the
  Phase 1 incremental indexer builds against a concrete contract.
- **Supersedes / relates:** Resolves the open question proposed in
  `docs/DESIGN_DECISIONS.md` (ADR-0009 🟡) and referenced in
  `memory/architecture.md` ("hash source is a Phase-1 decision"). Refines, and is
  constrained by, **ADR-0008** (chunking), whose Negative-consequences section
  states the content hash "must cover the full file (or the rendered chunk text)
  so such renames trigger re-index." No prior ADR is superseded; this pins the
  *form* of the hash that ADR-0008 left open.

---

## Context

Incremental indexing keeps DevBrain's steady-state cost **O(changes), not O(vault)**
(`docs/ARCHITECTURE.md §8`; success criterion C-15). The mechanism is a per-note
**content hash** the Indexer records as sync state — `hash(note) → indexed`
(`docs/MEMORY_ARCHITECTURE.md §3.1`) — so unchanged notes are skipped on
re-index (functional requirement FR-5.2: "only changed notes are re-processed,
gated on a per-note content hash").

The MVP (Phase 1) is **lexical-only** (ADR-0013): there is no vector store yet.
But Phase 1 already gates metadata + FTS re-index on this hash (V1-8), and Phase
2 will gate the far more expensive **embedding** re-generation on the same key.
So the hash source chosen now carries forward: a wrong choice that under-reports
changes silently serves stale FTS in Phase 1 and stale embeddings in Phase 2 —
a violation of the Markdown-canonical invariant (ADR-0001: the vault wins; a
derived store that disagrees with the vault is a bug, not a feature).

Constraints from the rest of the system:

- **ADR-0008 (Accepted) couples this decision.** Its Negative-consequences and
  Risks sections state the content hash *must* cover the full file (or the
  rendered chunk text) so a heading rename/reorder — a body edit, not a
  frontmatter edit — triggers re-index. Any hash that covers frontmatter only
  would *contradict* an Accepted ADR. (CLAUDE.md: "Contradictions are bugs.")
- **Sync-tool reality.** The proposed ADR (`docs/DESIGN_DECISIONS.md`) flagged
  that Git and Syncthing can change a file's `mtime` without a content change.
  Obsidian on Windows also introduces CRLF↔LF and trailing-newline churn.
  `mtime`-only gating is therefore unreliable as an *authoritative* signal; a
  raw full-file *byte* hash is reliable on content but brittle to pure
  whitespace/line-ending churn, causing spurious re-embeds.
- **Ownership (ADR-0003).** Storage is the sole reader/authority over the vault;
  the Indexer is the sole writer to the derived + sync-state stores. The hash is
  a function of *parsed note content*, so the hash **function** belongs with the
  Note model / Storage; the **sync-state table** (`hash → indexed`) belongs with
  the Indexer. This split must be preserved.
- **Determinism for tests.** A pure, normalization-based hash is trivially
  unit-testable with fixtures and a `FakeStorage`, no filesystem needed —
  consistent with Core-testability (ADR-0002) and the deterministic-fakes
  testing rule.

Prior commitment: `docs/MEMORY_ARCHITECTURE.md §3.1` and `docs/ARCHITECTURE.md
§4.1` already commit to "a per-note content hash → indexed." This ADR pins
**what the hash covers and how it is computed**; it does not reopen the
existence of hash-gated incremental indexing.

---

## Decision

DevBrain's incremental-indexing gate is a **normalized full-content hash** of
each note, computed over **frontmatter + body** after a small, well-defined
normalization. `mtime` (+ size) is used only as an **optional fast pre-filter**,
never as the authoritative gate. A raw full-file byte hash is available as an
opt-in **strict** mode.

### What the hash covers (default)

| Aspect | Choice | Rationale |
|---|---|---|
| **Scope** | Frontmatter **and** body (the whole Note) | Content-complete: catches body edits and heading renames (ADR-0008 coupling). |
| **Computation** | SHA-256 over **normalized** note text | Deterministic; collision-resistant at vault scale; cheap vs. embedding. |
| **Normalization** | LF line endings; single trailing `\n`; strip UTF-8 BOM; optional stable frontmatter key order | Stable across sync/whitespace churn → no spurious re-index; identical content hashes identically regardless of editor/platform. |
| **Authoritative gate** | The normalized content hash | Robust to the mtime-without-content-change failure mode (Git/Syncthing). |
| **Fast pre-filter** | `mtime` + `size` (when available) | Skip re-reading/hashing files unchanged since last scan; the common case is cheap. A mismatch in *either* mtime or size triggers the hash computation. The hash, not mtime, decides re-index. |
| **Strict mode (opt-in)** | SHA-256 over raw file **bytes** | For users who want byte-exact change detection and accept re-embed on whitespace churn. Off by default. |
| **Owner of the hash function** | Note model / Storage (vault parser) | Storage is the sole vault authority (ADR-0003); the hash is a pure function of parsed content. |
| **Owner of the sync-state table** | Indexer | "Indexer records sync state" (`docs/ARCHITECTURE.md §4.1`); the `hash → indexed` map is a derived store the Indexer owns. |

### The normalization function (precise contract)

Given a parsed `Note`, the hash input is the **normalized serial form**:

1. Frontmatter: keys emitted in a **stable order** (declared schema order, then
   alphabetical for unknown keys) — so reordering frontmatter keys in the editor
   does not trigger re-index. Values are serialized canonically (sorted map keys
   for nested objects; arrays in declared order).
2. A single separator (`\n---\n`) between frontmatter and body.
3. Body: line endings normalized to **LF**; exactly **one trailing newline**;
   **BOM stripped**.
4. SHA-256 of the resulting UTF-8 byte string → the content hash.

This is a pure function of the `Note` model, lives in `core/` (no
infrastructure), and is unit-testable with string fixtures.

### Gating behavior

- **Modify:** new hash ≠ stored hash → re-index that note (metadata/FTS in
  Phase 1; + chunks/embeddings/graph in Phase 2). Store the new hash.
- **Unchanged:** new hash == stored hash → skip (and, when used, the mtime
  pre-filter avoided even the read).
- **Delete:** the note's sync-state row and all derived rows for that `note_id`
  are pruned (Indexer responsibility; one writer per store).
- **Move/rename:** the note `id` (ULID, per `docs/MEMORY_ARCHITECTURE.md §2`) is
  stable across moves, so a path change alone does not invalidate the hash; only
  content changes re-index. (Path is metadata, reflected in derived rows by the
  re-index that a move may or may not trigger depending on whether content also
  changed — the path is always reconciled on the next re-index of that note.)
- **`devbrain_rebuild --full`:** sync state is reset and every note is re-hashed and
  re-indexed (`docs/ARCHITECTURE.md §4.4`).

---

## Options considered

### Option A — Frontmatter-only hash
Hash only the frontmatter (id, title, type, tags, dates, links). Cheapest to
compute and avoids re-embedding on purely cosmetic body edits.

**Rejected.** It misses meaningful **body** changes — a heading rename, a code
block edit, a prose correction — so it would silently serve stale FTS (Phase 1)
and stale embeddings (Phase 2). That directly contradicts the Markdown-canonical
invariant (ADR-0001) and **ADR-0008**, whose Negative-consequences section
requires the hash to cover the full file so heading renames re-index. It also
re-introduces the exact failure the proposed ADR worried about (derived store
disagreeing with the vault). Cosmetic-body-edit avoidance is not worth silently
stale memory.

### Option B — Raw full-file byte hash
SHA-256 of the raw file bytes. Content-complete and trivially simple.

**Rejected as the default.** It is brittle to **line-ending, whitespace, and BOM
churn** from Git, Syncthing, and Obsidian-on-Windows — the same sync-tool reality
the proposed ADR flagged for `mtime`. The result is spurious re-embeds (expensive
in Phase 2) and re-index thrash on burst saves. Retained as an **opt-in strict
mode** for users who want byte-exactness and accept the churn cost.

### Option C — Normalized full-content hash *(chosen)*
SHA-256 over a normalized serial form of frontmatter + body (LF, single trailing
newline, BOM stripped, stable frontmatter key order). Content-complete *and*
stable across pure whitespace/sync churn. Pure function of the `Note` model →
unit-testable with no filesystem.

**Chosen.** It satisfies ADR-0008's coupling (full-file coverage, so body and
heading edits re-index), keeps O(changes) honest (no spurious re-embeds from
whitespace churn), is robust to the mtime/sync failure mode, and is deterministic
and cheap. The normalization is a small, well-bounded, well-tested function — the
kind of "explain *why*" code the coding standards favor.

### Option D — Rendered-chunk-text hash
Hash the concatenation of the chunk texts the chunker emits (the "or the rendered
chunk text" alternative ADR-0008 names). Content-complete and directly aligned
with the embed/citation unit.

**Rejected as the default.** It **couples the sync-state key to the chunker**:
a chunker-config change (e.g., retuning `chunk.targetSize` / `overlap` per
ADR-0008's configurable knobs) changes the hash even when note content is
identical, forcing a spurious full re-index on every config tweak. The note-level
hash (C) should be **independent of chunker knobs** so that re-tuning chunking is
a rebuild decision, not a sync-state invalidation. Chunk-level change detection is
a possible Phase-2 optimization layered on top of C, not a replacement for it.

### Gating mechanism (orthogonal axis)
- **`mtime`-only:** cheap but unreliable across sync/moves (proposed ADR flagged
  this). **Rejected as authoritative**; retained as a fast pre-filter only.
- **No gating (always full):** simple but O(vault) every run, violating C-15 and
  FR-5.2. **Rejected.**
- **`mtime`+size pre-filter + content hash authoritative *(chosen)*:** the common
  unchanged case is resolved by the cheap pre-filter; the hash is the robust
  fallback that survives sync churn.

---

## Consequences

### Positive
- **Correctness with the canonical invariant:** any real content change — body,
  heading, frontmatter — re-indexes the note; no silent staleness. Satisfies
  ADR-0001 and the ADR-0008 coupling.
- **Honest O(changes):** pure-whitespace/sync churn does not re-embed, so the
  cost really is proportional to semantic changes (C-15). mtime pre-filter keeps
  the unchanged case nearly free (C-16 single-note re-index < 1 s).
- **Crash-resumability (C-20):** the `hash → indexed` map is the resumable
  pending set; a crash mid-index resumes by comparing stored vs. fresh hashes.
- **Deterministic and testable:** the hash is a pure `Note → string` function —
  unit-testable with fixtures and a `FakeStorage`, no I/O (ADR-0002 testability).
- **Phase-portable:** the same key gates FTS (Phase 1) and embeddings/graph
  (Phase 2) with no change to the gate; Phase 2 only adds *what* a re-index does.
- **Strict mode available:** users who want byte-exact detection can opt in
  without forcing churn on everyone else.

### Negative
- **Normalization is a contract that must be maintained.** If normalization
  changes, every stored hash is stale → a one-time full re-index. This is
  acceptable (derived stores are rebuildable, ADR-0001) but the normalization
  function is now load-bearing: changes require a CHANGELOG entry and ideally a
  schema/version stamp on the sync-state table so a mismatch can trigger an
  automatic `--full` rather than silent re-index noise.
- **Hash function lives on the boundary of two owners.** Storage/Note-model owns
  the *function*; the Indexer owns the *sync-state table*. This is correct per
  ADR-0003 but must be respected: the Indexer must not re-derive the hash from
  raw bytes (that would re-open the byte-churn problem and duplicate parsing);
  it must ask Storage for the normalized hash. Documented in `memory/`.
- **Path-vs-content edge case on move:** a pure rename with no content change
  does not re-index by the hash gate, so the derived store's stored path could
  be stale until the next content change. Mitigation below.

### Performance
SHA-256 over a normalized note is ~microseconds per note and dominated entirely
by the Markdown parse that produces the `Note` (which happens once per changed
candidate anyway). Hashing is never the bottleneck — the embedding round-trip
(Phase 2) is — so the normalization work is free in practice. The mtime pre-filter
avoids even the parse for unchanged files in the common case.

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Normalization changes → all hashes stale | Version the normalization (a `hashVersion` on the sync-state table); on mismatch, auto-trigger a one-time `--full` and log it. Derived stores are rebuildable (ADR-0001). |
| Frontmatter key-reorder should not re-index, but a *value* change must | Stable-order serialization covers keys; values are compared by content. Test both cases explicitly. |
| Move/rename leaves stale path in derived store | On a watcher move event, the Indexer updates the stored path for the stable `note_id` regardless of hash; content still gated by hash. (Path is metadata, not content.) |
| mtime pre-filter misses a content-only change that also reset mtime | The pre-filter triggers hashing on mtime *or* size mismatch; if both somehow match yet content changed (e.g., in-place rewrite of same size + restored mtime), the periodic `devbrain_rebuild` (or `devbrain_status` drift check) reconciles. Documented as a known, rare drift source. |
| Strict (raw-bytes) mode surprises users with churn | Off by default; documented in `docs/user/configuration.md`; the normalized default is the supported path. |
| Indexer tempted to re-hash raw bytes | Ownership rule documented: Storage provides the normalized hash; Indexer stores it. Enforced in review and by keeping the hash function in `core/` model code. |

---

## Future migration path

- **Durable contracts:** the per-note content hash as the incremental gate, and
  the `hash → indexed` sync-state table, are stable. The *normalization* and the
  *strict-mode option* are swappable behind the indexer without schema changes to
  the vector/graph stores.
- **Changing normalization** → bump `hashVersion` → one-time `--full` (cheap, by
  design — ADR-0001). No vault-data loss.
- **Chunk-level change detection (Phase 2+):** a future optimization may hash
  individual chunks to re-embed only changed chunks rather than the whole note.
  This **layers on top of** C (the note hash still gates "did anything change";
  chunk hashes gate "which chunks re-embed") — it does not replace the note-level
  gate. Composes with ADR-0008's per-chunk provenance.
- **`devbrain_status` drift detection:** a future `devbrain doctor`/`devbrain_status`
  enhancement can sample-verify stored hashes against fresh hashes to catch
  silent drift (the rare mtime+size match with content change). Idea-level, per
  `memory/ideas.md` (`devbrain doctor`).
- **Remote/embedder-agnostic:** the hash is independent of the embedder, so a
  model swap (ADR-0007) — gated by dimensionality, not content hash — composes
  without touching incremental indexing.

---

## References

- `docs/MEMORY_ARCHITECTURE.md §3.1` ("records `hash(note) → indexed` so
  unchanged notes are skipped on re-index")
- `docs/ARCHITECTURE.md §4.1` ("Indexer records sync state (note hash →
  indexed)"), §4.4 (rebuild resets sync state), §8 (O(changes) scalability)
- `docs/REQUIREMENTS.md` FR-5.2 (per-note content hash gate), PR-1 (single-note
  re-index < 1 s), SC-2 (steady-state O(changes))
- `docs/SUCCESS_CRITERIA.md` C-15 (O(changes)), C-16 (fast single-note re-index),
  C-20 (crash-resumable), C-21 (`devbrain_status` sync state)
- `docs/MVP_SCOPE.md` V1-8 (incremental indexing gated on a per-note content
  hash — this ADR pins the final form)
- `memory/architecture.md` ("hash source is a Phase-1 decision" — this ADR
  resolves it)
- ADR-0001 (Markdown canonical → derived stores must track the vault)
- ADR-0003 (one writer per store → hash function in Storage/Note model; sync-state
  table in Indexer)
- ADR-0008 (chunking — couples: hash must cover full file so heading renames
  re-index)
- ADR-0013 (lexical-only MVP — hash gates FTS in Phase 1, embeddings in Phase 2)
