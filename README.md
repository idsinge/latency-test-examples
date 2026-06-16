# latency-test-examples

Host applications for the [`<latency-test>`](https://github.com/idsinge/latency-test) Web Component ([`@adasp/latency-test`](https://www.npmjs.com/package/@adasp/latency-test)) — a tool that measures browser round-trip audio latency using an MLS signal and cross-correlation.

Everything in this repository consumes the **published npm package** (or CDN build) — never the component's local source. Two tiers:

## Framework integration examples (`examples/`)

One small app per framework, mirroring the corresponding [docs example page](https://idsinge.github.io/latency-test/examples/vanilla-js) and verifying it end-to-end against the installed published package.

### Live demos

| | Framework | Live demo | StackBlitz |
|---|---|---|---|
| <img src="assets/logos/javascript.svg" width="18" alt="JavaScript"> | Vanilla JS (npm) | [live](https://idsinge.github.io/latency-test-examples/vanilla-js/) | [open](https://stackblitz.com/fork/github/idsinge/latency-test-examples/tree/main/examples/vanilla-js) |
| <img src="assets/logos/javascript.svg" width="18" alt="JavaScript"> | Vanilla JS (CDN) | [live](https://idsinge.github.io/latency-test-examples/vanilla-js/cdn.html) | — |
| <img src="assets/logos/react.svg" width="18" alt="React"> | React | [live](https://idsinge.github.io/latency-test-examples/react/) | [open](https://stackblitz.com/fork/github/idsinge/latency-test-examples/tree/main/examples/react) |
| <img src="assets/logos/vue.svg" width="18" alt="Vue"> | Vue | [live](https://idsinge.github.io/latency-test-examples/vue/) | [open](https://stackblitz.com/fork/github/idsinge/latency-test-examples/tree/main/examples/vue) |
| <img src="assets/logos/svelte.svg" width="18" alt="Svelte"> | Svelte | [live](https://idsinge.github.io/latency-test-examples/svelte/) | [open](https://stackblitz.com/fork/github/idsinge/latency-test-examples/tree/main/examples/svelte) |
| <img src="assets/logos/angular.svg" width="18" alt="Angular"> | Angular | [live](https://idsinge.github.io/latency-test-examples/angular/) | [open](https://stackblitz.com/fork/github/idsinge/latency-test-examples/tree/main/examples/angular) |
| <img src="assets/logos/nextjs.svg" width="18" alt="Next.js"> | Next.js | [live](https://idsinge.github.io/latency-test-examples/nextjs/) | [open](https://stackblitz.com/fork/github/idsinge/latency-test-examples/tree/main/examples/nextjs) |

> StackBlitz works fully in Firefox (mic permission included). Chrome fails due to a WebContainer native-bindings incompatibility: Vite/Rolldown (Vanilla JS, React, Vue, Svelte) and Turbopack (Next.js) both require native bindings unavailable in WebContainers — unrelated to this project.

### Verification matrix

All apps verified against `@adasp/latency-test@1.2.0`. Verification environment: Firefox 151.0.4 aarch64 / macOS 15.4 (24E248) / beyerdynamic DT 770 PRO 80Ω headphones + built-in mic. All listed apps passed: custom element upgrade, five-event success sequence, negative-path, registry consumption (fresh `npm ci`, lockfile resolves to registry.npmjs.org, no `file:`/`link:` refs), and clean browser console — in dev and production builds. Vanilla JS additionally passed CDN verification. The `<h1>` framework heading in each app is an intentional UX-only deviation from docs-mirror fidelity.

| Framework | Folder | Tooling | Docs commit | Dev | Prod build | Date | Notes |
|---|---|---|---|---|---|---|---|
| Vanilla JS (npm + CDN) | `examples/vanilla-js/` | create-vite@9 / Vite 8.x / Node 22.22.3 | `8975f31779` | npm ~44.2 ms r≥23 dB ✓; CDN ~44.2 ms r~29 dB ✓ | npm ~36.9 ms r~29 dB ✓; CDN ~44.2 ms r~29 dB ✓ | 2026-06-15 | Docs findings: `cdn.html` missing `<title>`, no SRI on CDN script tag, pre-upgrade race in inline script (all in docs snippet — not fixed here) |
| React | `examples/react/` | create-vite@9 / Vite 8.x / React 19.2.6 / Node 22.22.3 | `ffe9bbbf` | ~36.9 ms r~29 dB ✓ | ~44.2 ms r~29 dB ✓ | 2026-06-15 | StrictMode double-mount logs upgrade check twice in dev — expected, not a finding |
| Vue | `examples/vue/` | create-vite@9 / Vite 8.0.16 / Vue 3.5.38 / Node 22.22.3 | `208efe9` | ~44.2 ms r~29 dB ✓ | ~44.2 ms r~29 dB ✓ | 2026-06-15 | `isCustomElement` required in `vite.config.js` (documented on docs page) |
| Svelte | `examples/svelte/` | create-vite@9 / Vite 8.0.16 / Svelte 5.56.3 / Node 22.22.3 | `208efe9` | ~36.9 ms r~29 dB ✓ | ~37.0 ms r~29 dB ✓ | 2026-06-15 | Docs Svelte 4 syntax (`on:click`, bare `let`) works verbatim in Svelte 5 — legacy mode auto-detected, no `runes={false}` needed. **Docs finding:** `<latency-test ... />` self-closing tag triggers Svelte build warning — docs should use `<latency-test ...></latency-test>` |
| Angular | `examples/angular/` | @angular/cli 22.0.1 / Angular 22.0.1 / zone.js 0.16.2 / Node 22.22.3 | `208efe9` | ~36.92 ms r~29 dB ✓ | ~36.92 ms r~25.94 dB ✓ | 2026-06-16 | Angular 22 is fully zoneless by default — `zone.js` must be installed manually and `provideZoneChangeDetection({ eventCoalescing: true })` added to `app.config.ts`. `ChangeDetectorRef.markForCheck()` required after `await getUserMedia()` and CustomEvent callbacks — zone.js alone does not trigger CD in these cases. **Docs finding:** docs page needs note for Angular 22+ scaffolds. Prod-build local preview requires serving `dist/angular/browser` under the `/latency-test-examples/angular/` path prefix (`baseHref`): use `mkdir -p /tmp/ng-preview/latency-test-examples/angular && cp -r dist/angular/browser/* /tmp/ng-preview/latency-test-examples/angular/ && npx serve -l 3000 /tmp/ng-preview`. |
| Next.js | `examples/nextjs/` | create-next-app 16.2.9 / Next.js 16.2.9 / React 19.2.4 / Node 22.22.3 | `ffe9bbb` | ~36.89 ms r~27 dB ✓ | ~36.94 ms r~27 dB ✓ | 2026-06-16 | SSR guard: `'use client'` + lazy `import('@adasp/latency-test')` inside `useEffect`. `basePath` applies in dev — open `/latency-test-examples/nextjs/`. Prod preview requires `/tmp/nextjs-preview` workaround (same baseHref issue as Angular). **Docs finding:** docs claims React 19+ picks up `HTMLElementTagNameMap` automatically — false in Next.js 16 + `@types/react` 19.2.17; `types/custom-elements.d.ts` is required, using `declare module 'react' { namespace JSX { ... } }` (not `declare namespace JSX` — that targets the wrong namespace in React 19). **Docs bugs (noted, not patched):** `connect()` does not reset error state on retry; `connect()` does not close `AudioContext` in catch block. |

Pass = custom element upgrades (the component is headless — nothing visible renders), five-event success sequence in order with no `latency-error`, negative-path confirms `latency-error` wiring, registry consumption verified, clean browser console in dev and prod build, and a run yields a reliable result (`ratio > 18 dB`). See `CLAUDE.md` for full criteria.

## Re-verifying an example app

Use `verify.sh` at the repo root to wire a harness into any example app for a manual
browser check session and clean up automatically when done:

```
./verify.sh <framework>   # vanilla-js | react | vue | svelte | angular | nextjs
```

The script copies the harness file(s) from `verification/<framework>/` into the app,
patches the entry file to import and render the harness, prints the dev/build/preview
commands to run, then waits. On Enter or Ctrl+C it restores all patched files from
backups, removes copied harness files, and confirms `examples/<framework>/` is clean
via `git status` before exiting.

**Testing the script itself (no browser needed):**

| Test | Command | Expected |
|---|---|---|
| No args | `./verify.sh` | Usage message, exit 1 |
| Unknown framework | `./verify.sh badname` | Unknown framework message, exit 1 |
| Happy path | `./verify.sh react`, then Enter immediately | Wires, then cleans up; dirty-check reports clean |
| Collision guard | Run `./verify.sh react` twice in parallel | Second run aborts with "already exists" error |

## Latency-compensation demos (`demos/`)

> **Quarantined until Tier 1 is complete:** no work happens in `demos/` — not even scaffolding — until the verification matrix above is fully passed and Phase 6 is signed off in the component repo.

Small multitrack editors demonstrating that the measured round-trip latency can align a recording: a default metronome track is recorded through the microphone while wearing headphones — uncompensated, the recording lands late by the round-trip latency (audible flam, visible waveform offset); after running the latency test, the measured value shifts the recording into alignment.

Reference implementation: the [Hi-Audio fork of waveform-playlist](https://github.com/gilpanal/waveform-playlist), which already applies a measured latency value to recorded tracks (MediaRecorder-based).

### Roadmap

| Demo | Target library | Status |
|---|---|---|
| waveform-playlist (React) | [naomiaro/waveform-playlist](https://github.com/naomiaro/waveform-playlist) | planned |
| dawcore (Web Components) | [`@dawcore/*` migration spec](https://github.com/naomiaro/waveform-playlist/blob/main/docs/specs/web-components-migration.md) | planned |
| openDAW | [andremichelle/openDAW](https://github.com/andremichelle/openDAW) | stretch goal |
| WAM Online Studio | [Brotherta/wam-studio](https://github.com/Brotherta/wam-studio) | stretch goal |

## Running locally

Each app is self-contained: `cd` into its folder and follow its own README. Bootstrap a fresh scaffold with `npm install`; verification runs use `npm ci` once the lockfile exists (this is what the registry-consumption check requires). All apps require a microphone and run on localhost or HTTPS.

## About

This repository is a companion to the [`<latency-test>` Web Component](https://github.com/idsinge/latency-test) — it hosts example applications only. The component source, API documentation, research background, full citation, and acknowledgments are in the component repository.

This project is developed as part of *Hybrid and Interpretable Deep Neural Audio Machines*, funded by the **European Research Council (ERC)** under the European Union's Horizon Europe research and innovation programme (grant agreement No. 101052978).

<a href="https://hiaudio.fr"><img src="assets/logos/hi-audio.svg" alt="Hi-Audio" height="32"></a>
