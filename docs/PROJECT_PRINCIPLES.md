# DevBrain — Project Principles

> **Phase 1: Product Specification.** This document states the engineering
> philosophy that governs DevBrain. Principles are not aspirations — they
> are the rules every decision, review, and line of code is measured against.
> Where a principle conflicts with convenience, the principle wins.
>
> Each principle answers two questions: **What it means**, and **Why it exists**
> (the concrete failure it prevents). Principles are mapped to the architectural
> invariants in `docs/ARCHITECTURE.md` and the ADRs in `memory/decisions.md`.

---

## P1. Local-first

**What it means.** DevBrain runs entirely on the user's machine. The vault, derived
indexes, embeddings, and configuration all live in a user-chosen data
directory. No feature *requires* a network round-trip to function. A laptop on a
plane is a fully supported environment.

**Why it exists.** Cloud memory layers ship private project knowledge —
architecture decisions, bug histories, internal identifiers — to a server the
user doesn't control. For the target users (solo developers, privacy-conscious
teams), that's a dealbreaker, not a preference. Local-first is also what makes
"nothing leaves your machine" a *verifiable* claim rather than a privacy policy
you have to trust. If DevBrain only worked online, it would solve one problem
(forgetting) by creating a worse one (exposure).

**Costs.** DevBrain can't offer managed multi-device sync out of the box; the user
brings their own sync (Git, Syncthing, a network drive) if they want one. Some
capabilities (a shared team index, a remote embedding backend) require extra
design effort to keep optional and opt-in.

---

## P2. Privacy-first

**What it means.** No telemetry, no analytics, no crash-reporting "phone home."
DevBrain makes no outbound network calls unless the user explicitly opts into a
specific remote capability. The only network-capable code lives behind a single
interface, gated by an off-by-default flag, so the claim is auditable by
inspection.

**Why it exists.** A privacy claim you can't verify is marketing. By isolating
all network code behind one interface and defaulting it off, an auditor (or a
paranoid user) can confirm in minutes that nothing phones home — they don't have
to take our word for it. This is the difference between "we respect your
privacy" and "we *can't not* respect it without you noticing."

**Costs.** No product analytics means we fly somewhat blind on real-world usage
patterns; we compensate with explicit user feedback, reproducible bug reports,
and a benchmark fixture. Bug reports are opt-in and human-written, never
auto-collected.

---

## P3. Markdown is canonical

**What it means.** The Obsidian vault of Markdown files is the single source of
truth. Embeddings, the vector DB, the knowledge graph, and the FTS index are
*derived* — rebuildable from the files at any time. No knowledge exists only in
a derived store.

**Why it exists.** Markdown is plain text: diffable, future-proof, editable in
any tool, and readable decades from now. If DevBrain disappears tomorrow, the
memory survives intact. If a derived store corrupts, a rebuild restores it. This
turns "data loss" into "index rebuild" — a minutes-long inconvenience instead of
a catastrophe. It also means the user is never locked in: the format outlives
the product.

**Costs.** Some queries are slower than they'd be against a purpose-built store;
we pay the rebuild cost on model/storage swaps; and we must be disciplined that
no shortcut ever stores knowledge *only* in a derived index.

---

## P4. Modular architecture (ports & adapters)

**What it means.** Each concern is a separate module behind a stable interface
(a "port" in `core/ports/`). Concrete technology (LanceDB, SQLite, Ollama) lives
only in adapters, and all wiring happens in a single composition root.
Dependencies point inward and downward only; core knows no infrastructure.

**Why it exists.** DevBrain must survive years of churn: new embedding models, new
vector DBs, new MCP features, new extraction sources. The only way that's
possible without rewrites is if every piece is *swappable behind an interface*.
Today's LanceDB can become tomorrow's Qdrant without touching Core. This is
also what makes Core unit-testable with in-memory fakes — no Ollama, no DB, no
filesystem — so logic is fast and deterministic to verify.

**Costs.** More files, more interfaces, a learning curve for new contributors.
We accept this: the linter enforces the layering rule so the architecture can't
rot quietly, and a stranger should understand one module without understanding
all of them.

---

## P5. Simplicity over cleverness

**What it means.** Readability beats brevity. Small files (one responsibility
each; split past ~400 lines). Explicit names. Comments explain *why*, not
*what*. No god files, no clever metaprogramming where a plain function would do.
The layering *is* the framework — no DI container, no heavy framework obscuring
the composition root.

**Why it exists.** This repository is co-developed with AI agents and is meant to
be maintained over years by people who weren't there when it was written.
Cleverness that saves ten minutes today costs hours of confusion later. "A
stranger can understand this in five minutes" is the bar, because that stranger
is frequently a future version of us — or a new contributor's first PR.

**Costs.** Sometimes more verbose than the tightest possible expression. We
treat that as a feature, not a tax.

---

## P6. AI-native

**What it means.** DevBrain is designed around an AI coding assistant as the
primary client. Retrieval is on-demand (load only what's relevant) rather than
preload-the-vault. Results carry provenance so the AI can cite and trust them.
Writes are explicit (the AI decides what's worth remembering) with a
reviewable path before any autonomy.

**Why it exists.** Memory that isn't retrievable by the agent that needs it is
just a notebook. DevBrain's value is that Claude Code can *use* the memory at the
right moment — which means the interface must be tool-shaped, scoped, and
provenance-bearing. Loading everything into context defeats the purpose (that's
the problem we're solving, not the solution).

**Costs.** We resist "auto-write everything the AI sees" — autonomous,
unreviewed memory writes are never a goal, even when technically easy. The
reviewable propose→confirm flow is a deliberate constraint.

---

## P7. Documentation-driven development

**What it means.** Docs precede code and evolve with it. Major decisions get an
ADR. User-facing behavior ships with matching docs. API/contract changes get a
changelog entry. Stale documentation is treated as a bug, not a nuisance. The
repo keeps its own long-term memory in `memory/`.

**Why it exists.** A project intended for thousands of contributors lives or dies
on whether a newcomer can orient themselves. Decisions recorded with context
and consequences stop the team from re-litigating them or, worse, silently
reversing them. And because this project is co-developed with AI agents, durable
written context is what lets a fresh agent be productive on day one instead of
re-deriving the architecture.

**Costs.** Real time spent writing and keeping docs in sync. We accept it as the
price of longevity; a PR that changes behavior but not docs is incomplete by
definition.

---

## P8. Backward compatibility & versioned contracts

**What it means.** Breaking changes to a port, an MCP tool, or a public export
require an ADR and a changelog entry. Additive changes (new optional inputs, new
tools) are non-breaking. The MCP tool surface is versioned. Memory files use a
future-proof plain format so old data stays readable.

**Why it exists.** DevBrain's memory is meant to outlast versions of DevBrain itself.
If every release invalidated the vault or the tool contracts, users would stop
trusting the memory layer — exactly the volatility we exist to cure.
Compatibility is how a long-term project earns the right to keep being used.

**Costs.** We sometimes carry deprecated paths longer than is fun, and we accept
the discipline of versioning the tool surface. Renaming a tool is never "just a
rename."

---

## P9. Small, composable components

**What it means.** One responsibility per file. A file name that needs "and" is a
signal to split. Components compose through narrow contracts; no module reaches
into another's internals. New capability → new folder in the right layer; new
external tech → new adapter.

**Why it exists.** Composability is what lets the project *grow* without becoming
a tangle. Small components are individually testable, individually swappable, and
individually understandable — which compounds: a contributor can extend one
seam without understanding the whole. This is the operational expression of P4.

**Costs.** More files and more seams to keep consistent. Mitigated by enforced
naming conventions and co-located tests.

---

## P10. Rebuildable, recoverable, durable

**What it means.** Every derived store is rebuildable from the vault. Writes are
atomic and crash-safe. Indexing is resumable. The canonical recovery path
(`devbrain_rebuild`) always exists. Nothing a crash or a corrupted index can take
from you is real memory — only the Markdown is.

**Why it exists.** A memory layer that can silently lose memories is worse than
no memory layer — it breeds false confidence. By making the vault canonical and
everything else derived and rebuildable, we collapse an entire class of
disasters ("the DB got corrupted") into a routine operation ("rebuild"). Trust in
a memory system is earned by its recovery story, not its happy path.

**Costs.** We carry the discipline of never storing knowledge only in a derived
store, and we pay the rebuild cost on swaps. Cheaper than data loss.

---

## P11. Open-source & community-first

**What it means.** Permissive license (MIT or Apache-2.0 — ADR-0010 open). No
proprietary dependencies. Contribution path, issue/PR templates, ADR process,
and an enforced architecture that lets community plugins ship as adapters
without core changes.

**Why it exists.** A local, private, durable memory layer is a public-good-shaped
problem; the right long-term steward is a community, not a single vendor. An
open, permissively-licensed, contributor-friendly project is also the strongest
guarantee that the format and the tool survive independently of any one
maintainer — which reinforces P3 (Markdown canonical) and P8 (compatibility).

**Costs.** Real effort on governance, templates, CI, and review discipline. We
treat contributor experience as a first-class product surface.

---

## Principle ↔ invariant ↔ decision mapping

| Principle | Architectural invariant (ARCHITECTURE.md §9) | ADR |
|---|---|---|
| P1 Local-first | #6 No silent network | ADR-0004 |
| P2 Privacy-first | #6 No silent network | ADR-0004 |
| P3 Markdown canonical | #1 Markdown canonical; #5 Derived stores rebuildable | ADR-0001 |
| P4 Modular | #3 Core knows no infra; #4 All access through ports | ADR-0002 |
| P5 Simplicity | #3 Core knows no infra (keeps it honest) | ADR-0002 |
| P6 AI-native | (process-level; reflected in tool design) | — |
| P7 Documentation-driven | (process-level; enforced by Definition of Done) | — |
| P8 Compatibility | (contract-level; MCP surface versioned) | — |
| P9 Composable | #2 One writer per store (clear ownership) | ADR-0003 |
| P10 Rebuildable | #5 Derived stores rebuildable | ADR-0001 |
| P11 Open-source | (governance-level; permissive license) | ADR-0010 (open) |

When a principle and a shortcut conflict, the principle wins and the shortcut
goes into `memory/technical-debt.md` with a payoff plan.
