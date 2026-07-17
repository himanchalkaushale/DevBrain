# ADR-0008 — Chunking defaults

- **Status:** Accepted
- **Date:** 2026-07-17
- **Phase:** Phase 2 (Semantic Search) — decided during the Architecture Decision
  phase so Phase 2 builds against a concrete contract.
- **Supersedes / relates:** Refines the proposed text in `docs/DESIGN_DECISIONS.md`
  and the chunking section of `docs/MEMORY_ARCHITECTURE.md §5`. No prior ADR is
  superseded; this pins the defaults those docs left open.

---

## Context

When DevBrain indexes a note for semantic search (Phase 2), the note is
split into **chunks** — the unit that is embedded, stored in the vector DB, and
cited back to the user. The chunking strategy governs three downstream properties
at once:

- **Embedding quality** — a chunk about one coherent concept embeds better than a
  chunk split mid-thought.
- **Citation precision** — provenance must point back to a meaningful span of the
  source so the user can verify and Claude can cite.
- **Retrieval granularity** — too-large chunks waste the token budget; too-small
  chunks lose context.

Constraints from the rest of the system:

- Chunks are embedded by `nomic-embed-text` via Ollama (ADR-0007). The model has
  an 8192-token context window; quality degrades on very long inputs, and tiny
  chunks lose surrounding context.
- Chunks flow into the LanceDB `memories` table with schema
  `{ id, note_id, chunk_text, embedding, heading_path, tags, mtime }`
  (`docs/MEMORY_ARCHITECTURE.md §7`). `heading_path` and per-chunk `tags` are
  already expected columns.
- Search results return `{ noteId, path, chunk, score, tags }` (`docs/MCP_TOOLS.md`),
  so chunk text and its provenance are user-visible.
- The vault is Markdown prose with frontmatter, tags, and `[[wikilinks]]`, but
  engineering notes contain substantial **code blocks** and occasionally very long
  sections (dumped logs, long design docs).

Prior commitment: four existing docs already state the direction as *heading-aware*
chunking with configurable size/overlap, oversized sections sub-chunked, and
chunks carrying `{ noteId, headingPath, charStart, charEnd }` provenance. This ADR
pins the **defaults** and the **edge-case policy** those docs left open; it does
not reopen the heading-aware algorithm class.

---

## Decision

DevBrain's default chunking is **structure-aware Markdown chunking with
atomic block units**, configured as follows:

| Setting | Default | Configurable? |
|---|---|---|
| Algorithm | Structure-aware (heading-path + atomic blocks) | No (swap = new ADR) |
| Unit | Token (nomic-embed-text tokenizer) | Yes — `chunk.unit = "token" \| "char"` |
| Target size | 512 tokens | Yes — `chunk.targetSize` |
| Overlap | 64 tokens (~12.5% of target) | Yes — `chunk.overlap` |
| Atomic blocks | Fenced code blocks, tables, list items are never split | Yes — `chunk.splitCodeBlocks` (default `false`) |
| Oversized atomic block | Emitted as a single over-target chunk + logged | Policy, not a flag |
| Flat-note fallback | A note with no headings is treated as one section and sub-chunked | Behavior |

### Algorithm (Option D — "Markdown-aware with structure tokens")

1. Walk the note's parsed Markdown. Establish the **heading path** at every point
   (e.g., `Architecture > Storage > Atomic writes`).
2. Emit a **candidate chunk** per top-level section. If a section exceeds the
   target size, sub-chunk it:
   - **Prose paragraphs** are eligible for sub-chunking with `overlap` tokens of
     overlap.
   - **Atomic units** — fenced code blocks (` ``` `), tables, and list items —
     are never split. They are emitted as a single chunk regardless of size
     (Option E1).
3. Each chunk carries provenance: `{ noteId, headingPath, charStart, charEnd }`,
   plus the note's tags (per the LanceDB schema).
4. **Oversized atomic block policy:** if an atomic block exceeds the target size,
   it is emitted as one over-target chunk (not truncated) and **logged** at warn
   level so the user can see and refactor it. It is never silently split.
5. **Flat-note fallback:** a note with no headings is treated as a single section
   and sub-chunked by the prose rule — so a quick `devbrain_remember` log entry does
   not become one giant chunk.

### Defaults rationale

- **512 tokens / 64 overlap** is the well-tested RAG default, fits nomic's window
  with headroom, and the 12.5% overlap is the standard guard against boundary loss.
- **Token unit** keeps chunk size, embed budget, and context budget all in the
  same unit (no char↔token estimation seam). A **char-based estimator** is
  available behind `chunk.unit = "char"` for CI/offline determinism and for
  environments where a tokenizer is not available.
- **Atomic blocks (E1)** directly closes the edge case flagged in
  `memory/architecture.md` ("code blocks spanning headings"): a search hit that
  lands in a code snippet returns the *whole* snippet, not half of it — the
  difference between a useful citation and a broken one in an engineering vault.

---

## Options considered

### Option A — Plain heading-aware
Split along Markdown headings; sub-chunk oversized sections with overlap. Simpler
(~150–250 lines) but code blocks can be split mid-snippet unless a policy is added
later. Rejected because the code-block edge case is load-bearing for citation
quality in an engineering-notes vault, and Option D closes it for marginal extra
complexity.

### Option B — Fixed-window with overlap
Ignore Markdown structure; slide a fixed window with overlap across raw text.
Dead simple (~50 lines) and predictable, but splits mid-sentence/mid-code
routinely, discards the free heading signal, and yields offset-only citation.
Rejected: for a tool whose pitch is "your notes are the memory," ignoring note
structure is incoherent.

### Option C — Sentence/semantic-boundary
Split on sentence boundaries, pack to target size, overlap by sentence. Better
than B at preserving thought boundaries, but structure-blind (ignores
headings/code) and adds a segmenter dependency with its own edge cases
(abbreviations, CJK, code). Rejected: it solves a problem heading-aware chunking
already solves better for our domain, at the cost of a segmenter we don't need.

### Option D — Structure-aware + atomic blocks *(chosen)*
Heading-aware **plus** fenced code blocks, tables, and list items treated as
atomic units. Most complex (~250–350 lines) but bounded and testable; best
citation quality; directly addresses the flagged edge case. Chosen.

### Numeric defaults considered
- D1 — 512 tokens / 64 overlap *(chosen)*. RAG default; nomic-friendly.
- D2 — ~1000 chars / ~200 chars. No tokenizer dependency; weaker for CJK/code.
- D3 — 256 tokens / 32. Finer citation; more chunks, larger store, more embeds.
- D4 — 1024 tokens / 128. Richest per-chunk context; dilutes embedding signal.

D1 chosen as the balance; the unit and target are config keys so D2/D3/D4 are
runtime choices, not re-architecture.

### Edge policies considered
- E1 — atomic blocks, oversized emitted whole and logged *(chosen)*.
- E2 — split all blocks like prose (simpler; breaks code snippets).

E1 chosen so citation integrity holds for engineering content.

---

## Consequences

### Positive
- Each chunk is topically coherent and, for code, citation-complete — improving
  both embedding quality and the user-visible citation.
- The heading path gives free, high-quality citation context with no extra
  parsing (headings are already in the note model).
- Defaults are standard and well-understood by contributors; the pattern is
  recognized across the RAG ecosystem.
- Fully consistent with the prior commitment in four docs — no rewrites required.
- All knobs are config, so re-tuning is a runtime change, not a re-architecture.

### Negative
- Heading-path tracking and block-type atomicity add ~250–350 lines of parser
  logic and a real test surface (Setext vs ATX headings, nested lists, oversized
  blocks).
- A heading rename/reorder shifts every chunk boundary in that note → the whole
  note is re-embedded. This is correct behavior (the rendered content changed)
  but couples to ADR-0009: the content hash must cover the full file (or the
  rendered chunk text) so such renames trigger re-index as intended.
- Oversized atomic blocks produce over-target chunks; the logging policy must be
  implemented and documented or users see mysteriously large chunks.

### Performance
Chunking is a single Markdown walk per note and is negligible compared to the
Ollama embedding round-trip that follows. Chunking is never the bottleneck, so
optimizing for quality (Option D) costs no real latency.

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Tokenizer dependency for the unit | Char-based estimator behind `chunk.unit = "char"` for CI/offline determinism; reuse the Ollama stack's tokenizer otherwise. |
| Oversized atomic block → huge chunk | E1 policy + warn-level logging; documented; user can refactor. |
| Heading rename → full-note re-embed | Correct behavior; ensure ADR-0009 hashes full file so renames re-index. |
| Flat/heading-less notes degenerate | Flat-note fallback sub-chunks the whole body by the prose rule. |
| Complexity creep from a future multi-modal chunker | D's atomic-block classification is a stepping stone toward, not a conflict with, code-vs-prose separate indexing. |

---

## Future migration path

- **Durable contracts:** the chunk provenance shape
  `{ noteId, headingPath, charStart, charEnd }` and the LanceDB `memories` schema
  are stable. The *algorithm* and *defaults* are swappable behind the indexer
  without schema changes.
- **Changing defaults or algorithm** → vector-store rebuild (cheap, by design —
  ADR-0001).
- **Multi-modal chunks** (code vs prose indexed separately, per `memory/ideas.md`)
  composes *on top of* D's atomic-block classification, reusing the block-type
  detection rather than replacing it.
- **A future re-ranker** (per `memory/ideas.md`) consumes chunks unchanged;
  chunking decisions are downstream-compatible.
- **Swapping the algorithm entirely** (e.g., to a learned segmenter) would be a
  new ADR and a vector-store rebuild, with no vault-data loss (Markdown is
  canonical — ADR-0001).

---

## References

- `docs/MEMORY_ARCHITECTURE.md §5` (chunking strategy, provenance shape)
- `docs/ROADMAP.md` Phase 2 (heading-aware chunker deliverable)
- `docs/MCP_TOOLS.md` (search result shape including `chunk`)
- `memory/architecture.md` (code-block edge case this ADR closes)
- `memory/ideas.md` (multi-modal chunks — future, composes on top of this)
- `docs/DESIGN_DECISIONS.md` ADR-0008 (proposed text this ADR finalizes)
- ADR-0001 (Markdown canonical → rebuildable vector store)
- ADR-0007 (nomic-embed-text → token unit rationale)
- ADR-0009 (content hash source — coupled; must hash full file)
