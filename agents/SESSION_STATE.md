# Session state — resume point

Last session: 2026-06-15. Read this together with `CLAUDE.md` to resume.

## Where we are

Tier 1, app 1 of 6 (vanilla-js): **complete and Codex-reviewed. Pending user commit.**
Tier 1, app 2 of 6: **React — next.**

## vanilla-js — done

Files: `examples/vanilla-js/index.html`, `src/main.js`, `src/verify.js`, `public/cdn.html`, `vite.config.js`.
Docs commit pinned: `8975f31779`.
README matrix row filled in. Codex sign-off: green light, no blocking findings.

Accepted non-blocking findings (do not re-raise):
- Harness sequence check uses set membership, not strict order (repetition pattern makes ordered comparison non-trivial)
- Harness does not assert ratio > 18 dB (environment-dependent; README records actual values)
- cdn.html closing tags trail the harness (unavoidable in valid HTML; accepted boundary exception)

Docs findings to patch in component repo (log when contributing back):
- `cdn.html` docs snippet missing `<title>`
- No SRI on CDN script tag
- Pre-upgrade race in inline script vs module load order

## Next actions for React

1. Fetch docs page: `docs/examples/react.md` in companion repo at `/Users/jose/Desktop/rountriplatencytest-webcomponent`
2. Pin docs commit SHA for react page
3. Scaffold: `npm create vite@9 examples/react -- --template react` (or whatever the docs page prescribes)
4. Follow same loop: mirror docs, write verify harness, dev run, prod build, registry proof, README matrix row, Codex review, commit.

## Environment (established, do not re-derive)

- Node: 22.22.3 (nvm)
- Browser: Firefox 151.0.4 (aarch64)
- OS: macOS 15.4 (24E248)
- Audio: beyerdynamic DT 770 PRO 80Ω headphones, built-in mic
