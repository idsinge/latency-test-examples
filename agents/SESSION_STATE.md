# Session state — resume point

Last session: 2026-06-15. Read this together with `CLAUDE.md` to resume.

## Where we are

Tier 1, app 1 of 6 (vanilla-js): **complete, committed, pushed.**
Tier 1, app 2 of 6 (React): **complete — Codex review pending, then commit + push.**
Tier 1, app 3 of 6: **Vue — next after React commit.**

## vanilla-js — done

Docs commit: `8975f31779`. Committed and pushed.

## React — pending Codex review + commit

Files: `examples/react/index.html`, `src/main.jsx`, `src/LatencyTester.jsx`, `src/App.jsx`, `src/Verify.jsx`, `vite.config.js`.
Docs commit: `ffe9bbbf`. React 19.2.6. No CDN variant.
README matrix row filled in. All four passes complete (dev ✓, prod ✓, registry ✓, console clean ✓).
Note: StrictMode double-mount logs upgrade check twice in dev — expected behaviour, not a finding.

## Environment (established)

- Node: 22.22.3 (nvm)
- Browser: Firefox 151.0.4 (aarch64)
- OS: macOS 15.4 (24E248)
- Audio: beyerdynamic DT 770 PRO 80Ω headphones, built-in mic
