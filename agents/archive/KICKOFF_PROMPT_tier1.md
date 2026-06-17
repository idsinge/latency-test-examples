# Kickoff — Tier 1 Verification (Phase 6)

Instructions for the Claude Code instance working in this repository. The user will point you to this file at the start of a session; treat it as your work order.

## 1. Read the constitution first

Read `CLAUDE.md` in the repo root before doing anything else. Its collaboration rules are binding:

- Never edit or create files without explicit user confirmation.
- The user types all code themselves to learn — explain what to write, where, and why; no paste-ready code blocks unless the user explicitly asks.
- Commits and PRs are user-driven only. When a branch is complete, declare "this branch is final and push-complete" before the user merges.
- Codex reviews each completed app before its matrix row is recorded; the user runs Codex and relays results.

## 2. Mission

**Tier 1 only:** verify the six framework example pages of https://idsinge.github.io/latency-test/ end-to-end against the installed published package `@adasp/latency-test@1.2.0`. This is "Phase 6" — the final v1 gate of the component project.

`demos/` is **quarantined**: no work there, not even scaffolding, until Tier 1 is complete and signed off in the component repo.

## 3. Working loop — one framework at a time

Order: vanilla-js → React → Vue → Svelte → Angular → Next.js.

For each framework:

1. **Fetch and read the docs page** (`https://idsinge.github.io/latency-test/examples/<framework>`). The page is the spec — the app must mirror it literally. Record which docs commit you verified against: use the latest `main` commit of https://github.com/idsinge/latency-test whose `docs/examples/<framework>.md` content matches the fetched page. If the deployed page cannot be matched to a commit, stop and ask the user.
2. **Propose the plan**: scaffold command (official CLI, named versions), folder layout under `examples/<framework>/`, base path setting for GitHub Pages (`/latency-test-examples/<framework>/`). Wait for approval. The user runs the commands and types the code with your guidance.
3. **Verify all pass criteria** from `CLAUDE.md` Tier 1 — in short: the custom element upgrades (the component is headless — nothing visible renders); five success-path events fire in order with no `latency-error`; one deliberate negative-path check proves `latency-error` wiring; a reliable result (`ratio > 18 dB`, environment recorded — an unreliable result questions the physical setup before the docs); dev **and** production build pass with a clean console; registry consumption proven (`npm ci`, lockfile resolves to registry.npmjs.org, `npm ls @adasp/latency-test` = 1.2.0, no `file:`/`link:`).
4. **Any forced deviation from the docs page is a finding.** Record it precisely: page, section, what is wrong or missing, suggested fix. Do **not** attempt to edit the component repository from here — the user relays findings to the component-repo session. An ambiguity that forces you to choose is a finding too.
5. **Propose the README matrix row** (all columns), get approval, the user updates and commits.

For vanilla-js specifically: the npm variant first, then the CDN variant (the docs advertise both install paths).

## 4. When in doubt, ask

Ambiguous docs instruction, scaffold tooling choice, version conflict, unexpected browser or build behavior — ask the user instead of assuming. Wrong assumptions here contaminate the verification record.

## 5. Never

- `file:` / `link:` / workspace references to the component repo — this repo exists to consume the published package.
- Version bumps beyond `1.2.0` (Tier 1 pins exactly what is being verified).
- Work in `demos/` before Tier 1 signoff.
- Commits, pushes, or file changes without explicit user approval.

## First task

Start with `examples/vanilla-js/`: fetch the docs page, propose the setup, and walk the user through it.

The **npm variant** must be a minimal bundler/dev-server app (e.g. the Vite vanilla template) so that npm-package consumption through a bundler is genuinely exercised — do not build it as a plain static page unless the docs page itself dictates that. The **CDN variant** is a separate static HTML page using the documented CDN pin.
