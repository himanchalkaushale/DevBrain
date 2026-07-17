# coding-standards.md — Conventions

> Conventions not obvious from the code or `CLAUDE.md`. The authoritative
> coding standards live in `CLAUDE.md` → "Coding Standards"; this file captures
> idioms, preferred/avoided patterns, and decisions that don't fit elsewhere.

## TypeScript

- **Strict everywhere:** `strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`. Don't weaken these to make a type "easier."
- **No `any`.** Use `unknown` + narrow, or a proper type. `any` in a PR is a
  review blocker.
- **No non-null assertion (`!`)** unless the type system genuinely can't express
  a proven-safe access — and then add a comment.
- **Prefer discriminated unions** over optional-field soup for result/error
  types.
- **Types from schemas:** MCP tool inputs are zod schemas; derive the TS type
  with `z.infer<typeof schema>`. One source of truth.

## Patterns we prefer

- **Ports + adapters.** Every external capability is an interface in
  `core/ports/`; concrete impls in `adapters/`.
- **Composition root.** All wiring in one file. No service locators, no DI
  container.
- **Pure Core.** Core functions take their dependencies as arguments (the ports),
  not from globals. This is what makes them unit-testable with fakes.
- **Structured errors.** A typed error hierarchy in `core/errors.ts`. Errors
  carry actionable context; they don't leak raw stacks to MCP clients.
- **Result objects with provenance.** Anything returning memory content
  includes source path + score + a short "why."

## Patterns we avoid

- **God classes / god files.** ~400 lines is the smell threshold.
- **Barrel-induced cycles.** Re-export barrels are allowed per module but must
  not create import cycles. Prefer deep imports in app code.
- **Commented-out code.** Delete it; git remembers.
- **Silent fallbacks.** If we fall back (e.g., lexical-only when Ollama is
  down), we log it and/or signal it in the result — never silently degrade.
- **Magic strings.** Config keys, relation types, etc. are typed constants.

## Naming specifics

- Booleans read as assertions: `isIndexed`, `hasLinks`, `canWrite` — not
  `flag`, `data`, `status` (for bools).
- Async functions aren't suffixed `Async` — the `await` at the call site is
  enough.
- Factory functions: `createX` / `makeX`. Constructors for classes.

## File organization specifics

- One primary export per file. If you reach for "and" in a filename, split it.
- Co-located unit test: `foo.ts` → `foo.test.ts`.
- A module's entry file has a one-line purpose comment at the top.

## Testing idioms

- **FakeEmbedder** (deterministic, hash-based vectors) for semantic-search unit
  tests — never a real model in unit tests.
- In-memory fakes for ports in Core unit tests — no DB, no filesystem, no
  network.
- Mark network/real-model tests explicitly; they're opt-in in CI, not the
  default gate.
- Test behavior, not implementation: assert on outputs and observable state,
  not private method calls.
