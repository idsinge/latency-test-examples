# Session state — resume point

Last session: 2026-06-15. Read this together with `CLAUDE.md` to resume.

## Where we are

Tier 1, app 1 of 6 (vanilla-js): **complete, committed, pushed.**
Tier 1, app 2 of 6 (React): **complete, committed, pushed.**
Tier 1, app 3 of 6 (Vue): **complete, committed, pushed.**
Tier 1, app 4 of 6 (Svelte): **next — plan below.**

## Structural decisions made this session

### Verification harness separation
Harness files moved out of `examples/` into `verification/<framework>/`. Each `examples/` app
is now a pure docs-code mirror. The `verification/` folder has wiring instructions per framework.
All future apps (Svelte, Angular, Next.js) use this pattern from the start: no Verify component
in the example app; harness lives in `verification/<framework>/` only.

### Post-Tier-1 polish pass (deferred)
After all 6 examples are committed: page headers (<h1> with framework name), negative-path UI
status message, minimal CSS, StackBlitz links per app in README.

### Root index / landing page (deferred)
After all 6 examples are committed: root index.html linking all apps.

### Full documentation pass (deferred)
After Tier 2 is complete.

## Established per-app workflow

For each app, in order:
1. Read docs page from `/Users/jose/Desktop/rountriplatencytest-webcomponent/docs/examples/<name>.md`
2. Pin docs commit: `git -C /Users/jose/Desktop/rountriplatencytest-webcomponent log --oneline docs/examples/<name>.md`
3. Draft plan: scaffold commands, file layout, content notes, special considerations
4. Write Codex prompt for plan review (user pastes into Codex, no file changes)
5. Update plan with Codex feedback
6. User runs scaffold commands
7. Claude writes all files after user confirms scaffold done
8. User runs `npm run dev`, shares console logs
9. User runs `npm run build && npm run preview`, shares console logs
10. User runs `npm ci && npm ls @adasp/latency-test && grep -E "file:|link:" package-lock.json`
11. Claude updates README matrix row and SESSION_STATE
12. Claude writes Codex sign-off prompt (user pastes into Codex, no file changes)
13. Claude commits + pushes after green light

## Svelte — plan (to be drafted)

Not yet drafted. Next session: read docs/examples/svelte.md, pin commit, draft plan, send to Codex.

Key Svelte considerations to investigate:
- SSR/build-time risk: Svelte (via SvelteKit or plain Vite) may attempt to resolve custom elements
  at build time — need to confirm the right compiler option (customElement: true? or just ignore?)
- Scaffolding: `npm create svelte@latest` (SvelteKit) vs `npm create vite@latest -- --template svelte`
  — docs page will dictate which one
- No Verify component in src/ — harness goes to verification/svelte/ only

## Environment (established — do not re-derive)

- Node: 22.22.3 (nvm)
- Browser: Firefox 151.0.4 (aarch64)
- OS: macOS 15.4 (24E248)
- Audio: beyerdynamic DT 770 PRO 80Ω headphones, built-in mic
