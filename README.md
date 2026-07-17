# DevBrain

> A local-first AI memory layer for Claude Code.

DevBrain gives Claude Code long-term, project-specific memory by turning an
Obsidian vault into a queryable knowledge base. Instead of stuffing every detail
into the conversation window, Claude retrieves only what's relevant — by meaning,
by graph relationship, and by keyword — and writes new knowledge back as durable
Markdown notes.

The goal: make Claude Code behave like an engineer who never forgets anything
about the project.

---

## Why

Claude Code's context window is volatile and finite. Hard-won knowledge — why a
decision was made, how a subsystem works, which bug was fixed and how — is lost
the moment a conversation ends or is summarized. DevBrain makes that
knowledge **persistent, editable, and retrievable** without sacrificing privacy:
everything stays on your machine.

## How it works (30-second version)

1. **The vault is the source of truth.** Knowledge lives as Markdown notes with
   frontmatter, tags, and `[[wikilinks]]` — fully editable in Obsidian.
2. **Derived indexes are built from the vault.** A local indexer chunks notes,
   generates embeddings (via Ollama), and extracts a knowledge graph.
3. **Claude Code talks to DevBrain over MCP.** DevBrain exposes recall/search/graph/
   remember tools. Claude reads memory on demand and writes memory back.
4. **Indexes are rebuildable.** Delete the vector DB and graph; re-run the
   indexer; everything comes back from the Markdown. The files always win.

## Status

DevBrain is in the **design phase**. No implementation exists yet. See
[`docs/ROADMAP.md`](docs/ROADMAP.md) for the phased plan and
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full architecture.

## Documentation

| Document | Purpose |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Permanent AI guide — read first when working in this repo |
| [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) | What DevBrain is and why it exists (read first for the product) |
| [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md) | Functional & non-functional requirements + acceptance criteria |
| [`docs/PROJECT_PRINCIPLES.md`](docs/PROJECT_PRINCIPLES.md) | Engineering philosophy and why each principle exists |
| [`docs/DESIGN_DECISIONS.md`](docs/DESIGN_DECISIONS.md) | Architectural decisions, rationale, alternatives, tradeoffs |
| [`docs/MVP_SCOPE.md`](docs/MVP_SCOPE.md) | What is (and isn't) in Version 1, and why |
| [`docs/SUCCESS_CRITERIA.md`](docs/SUCCESS_CRITERIA.md) | Measurable goals for the MVP |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System architecture, components, data flow |
| [`docs/REPOSITORY_STRUCTURE.md`](docs/REPOSITORY_STRUCTURE.md) | Folder layout and conventions |
| [`docs/MCP_TOOLS.md`](docs/MCP_TOOLS.md) | Every MCP tool, specified |
| [`docs/MEMORY_ARCHITECTURE.md`](docs/MEMORY_ARCHITECTURE.md) | How Obsidian, embeddings, vector DB, graph, and Claude interlock |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Development phases and deliverables |
| [`docs/TECH_STACK.md`](docs/TECH_STACK.md) | Technology choices and rationale |
| [`memory/`](memory/) | Long-term project knowledge (architecture, decisions, bugs, …) |

## Principles

- **Local-first.** No cloud dependency. Your vault, your embeddings, your machine.
- **Privacy-first.** No telemetry. Embeddings run locally via Ollama. DevBrain makes
  no third-party calls on its own.
- **Open-source.** Built for community contribution and long-term stewardship.
- **Markdown is canonical.** Files are the source of truth; indexes are derived.
- **Modular and loosely coupled.** Every major component is swappable behind an
  interface.

## License

To be decided (will be a permissive OSI license — MIT or Apache-2.0).
