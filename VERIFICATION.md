# Verification record

Full verification results for the `examples/` apps in this repo, run against the
published `@adasp/latency-test` package. See [CLAUDE.md](CLAUDE.md) for the full pass
criteria and process this record follows.

All findings below were filed against the component repo as
[idsinge/latency-test#30](https://github.com/idsinge/latency-test/issues/30) (Phase 6
findings) — awaiting sign-off there. Tier 2 (`demos/`) stays quarantined until that
issue resolves.

## Environment

- Package version: `@adasp/latency-test@1.2.0`
- Browser: Firefox 151.0.4 (aarch64)
- OS: macOS 15.4 (24E248)
- Audio: beyerdynamic DT 770 PRO 80Ω headphones + built-in mic

## Pass criteria

An app passes when: the custom element upgrades (the component is headless — nothing
visible renders); the five-event success sequence fires in order with no
`latency-error`; the negative-path check confirms `latency-error` wiring; registry
consumption is verified (fresh `npm ci`, lockfile resolves to registry.npmjs.org, no
`file:`/`link:` refs); the browser console is clean in dev and production builds; and
a run yields a reliable result (`ratio > 18 dB`). The `<h1>` framework heading in each
app is an intentional UX-only deviation from docs-mirror fidelity.

## Results

| Framework | Folder | Tooling | Docs commit | Dev | Prod build | Date |
|---|---|---|---|---|---|---|
| Vanilla JS (npm + CDN) | `examples/vanilla-js/` | create-vite@9 / Vite 8.x / Node 22.22.3 | `8975f31779` | npm ≈44.2 ms r≥23 dB ✓; CDN ≈44.2 ms r≈29 dB ✓ | npm ≈36.9 ms r≈29 dB ✓; CDN ≈44.2 ms r≈29 dB ✓ | 2026-06-15 |
| React | `examples/react/` | create-vite@9 / Vite 8.x / React 19.2.6 / Node 22.22.3 | `ffe9bbbf` | ≈36.9 ms r≈29 dB ✓ | ≈44.2 ms r≈29 dB ✓ | 2026-06-15 |
| Vue | `examples/vue/` | create-vite@9 / Vite 8.0.16 / Vue 3.5.38 / Node 22.22.3 | `208efe9` | ≈44.2 ms r≈29 dB ✓ | ≈44.2 ms r≈29 dB ✓ | 2026-06-15 |
| Svelte | `examples/svelte/` | create-vite@9 / Vite 8.0.16 / Svelte 5.56.3 / Node 22.22.3 | `208efe9` | ≈36.9 ms r≈29 dB ✓ | ≈37.0 ms r≈29 dB ✓ | 2026-06-15 |
| Angular | `examples/angular/` | @angular/cli 22.0.1 / Angular 22.0.1 / zone.js 0.16.2 / Node 22.22.3 | `208efe9` | ≈36.92 ms r≈29 dB ✓ | ≈36.92 ms r≈25.94 dB ✓ | 2026-06-16 |
| Next.js | `examples/nextjs/` | create-next-app 16.2.9 / Next.js 16.2.9 / React 19.2.4 / Node 22.22.3 | `ffe9bbb` | ≈36.89 ms r≈27 dB ✓ | ≈36.94 ms r≈27 dB ✓ | 2026-06-16 |

All apps additionally passed: custom element upgrade, five-event success sequence,
negative-path check, and registry consumption — see Pass criteria above.

## Findings

### Vanilla JS

- Docs findings (component repo, not fixed there): CDN snippet originally missing
  `<title>` (fixed in this repo's `cdn.html`, commit `9f97019` — the component-docs
  page itself still carries the omission); no SRI on the CDN script tag; pre-upgrade
  race in the inline script.

### React

- StrictMode double-mount logs the upgrade check twice in dev — expected, not a finding.

### Vue

- `isCustomElement` required in `vite.config.js` (documented on the docs page).

### Svelte

- Docs Svelte 4 syntax (`on:click`, bare `let`) works verbatim in Svelte 5 — legacy
  mode auto-detected, no `runes={false}` needed.
- **Docs finding:** `<latency-test ... />` self-closing tag triggers a Svelte build
  warning — docs should use `<latency-test ...></latency-test>`.

### Angular

- Angular 22 is fully zoneless by default — `zone.js` must be installed manually and
  `provideZoneChangeDetection({ eventCoalescing: true })` added to `app.config.ts`.
- `ChangeDetectorRef.markForCheck()` required after `await getUserMedia()` and
  CustomEvent callbacks — zone.js alone does not trigger CD in these cases.
- **Docs finding:** docs page needs a note for Angular 22+ scaffolds.
- Prod-build local preview requires serving `dist/angular/browser` under the
  `/latency-test-examples/angular/` path prefix (`baseHref`):
  ```
  mkdir -p /tmp/ng-preview/latency-test-examples/angular
  cp -r dist/angular/browser/* /tmp/ng-preview/latency-test-examples/angular/
  npx serve -l 3000 /tmp/ng-preview
  ```
  Open `http://localhost:3000/latency-test-examples/angular/`.

### Next.js

- SSR guard: `'use client'` + lazy `import('@adasp/latency-test')` inside `useEffect`.
- `basePath` applies in dev too — open `http://localhost:3000/latency-test-examples/nextjs/`.
- Prod preview requires the same `/tmp` baseHref-style workaround as Angular:
  ```
  mkdir -p /tmp/nextjs-preview/latency-test-examples/nextjs
  cp -r out/* /tmp/nextjs-preview/latency-test-examples/nextjs/
  npx serve -l 3000 /tmp/nextjs-preview
  ```
- **Docs finding:** docs claims React 19+ auto-bridges `HTMLElementTagNameMap` to JSX
  — false in Next.js 16 + `@types/react` 19.2.17. Manual declaration required:
  `declare module 'react' { namespace JSX { ... } }`, not `declare namespace JSX`
  (targets the wrong namespace in React 19).
- **Docs bugs (noted, not patched):** `connect()` does not reset error state on retry;
  does not close `AudioContext` in the catch block.
