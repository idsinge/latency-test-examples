# latency-test-examples

Host applications for the [`<latency-test>`](https://github.com/idsinge/latency-test) Web Component ([`@adasp/latency-test`](https://www.npmjs.com/package/@adasp/latency-test)) — a tool that measures browser round-trip audio latency using an MLS signal and cross-correlation.

Everything in this repository consumes the **published npm package** (or CDN build) — never the component's local source. Two tiers:

## Framework integration examples (`examples/`)

One small app per framework, mirroring the corresponding [docs example page](https://idsinge.github.io/latency-test/examples/vanilla-js) and verifying it end-to-end against the installed published package.

### Verification matrix

| Framework | Folder | Tooling | Package | Docs commit | Environment (browser / OS / audio) | Dev | Prod build | Checks | Result | Date | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Vanilla JS (npm + CDN) | `examples/vanilla-js/` | create-vite@9 / Vite 8.x / Node 22.22.3 | `1.2.0` | `8975f31779` | Firefox 151.0.4 aarch64 / macOS 15.4 (24E248) / beyerdynamic DT 770 PRO 80Ω + built-in mic | npm ~44.2 ms r≥23 dB ✓; CDN ~44.2 ms r~29 dB ✓ | npm ~36.9 ms r~29 dB ✓; CDN ~44.2 ms r~29 dB ✓ | ev✓ neg✓ reg✓ con✓ cdn✓ | ✓ | 2026-06-15 | Docs findings: `cdn.html` missing `<title>`, no SRI on CDN script tag, pre-upgrade race in inline script (all in docs snippet — not fixed here) |
| React | `examples/react/` | create-vite@9 / Vite 8.x / React 19.2.6 / Node 22.22.3 | `1.2.0` | `ffe9bbbf` | Firefox 151.0.4 aarch64 / macOS 15.4 (24E248) / beyerdynamic DT 770 PRO 80Ω + built-in mic | ~36.9 ms r~29 dB ✓ | ~44.2 ms r~29 dB ✓ | ev✓ neg✓ reg✓ con✓ | ✓ | 2026-06-15 | StrictMode double-mount logs upgrade check twice in dev — expected, not a finding |
| Vue | `examples/vue/` | — | — | — | — | — | — | — | pending | — | — |
| Svelte | `examples/svelte/` | — | — | — | — | — | — | — | pending | — | — |
| Angular | `examples/angular/` | — | — | — | — | — | — | — | pending | — | — |
| Next.js | `examples/nextjs/` | — | — | — | — | — | — | — | pending | — | — |

**Checks legend** (each recorded individually per row, e.g. `ev✓ neg✓ reg✓ con✓`):
- `ev` — five success-path events fire in order (`latency-start`, `latency-recording`, `latency-processing`, `latency-result`, `latency-complete`) with no `latency-error`
- `neg` — deliberate negative-path test proves `latency-error` wiring
- `reg` — registry consumption proven (fresh `npm ci`, lockfile resolves to registry.npmjs.org, `npm ls @adasp/latency-test` = 1.2.0, no `file:`/`link:`)
- `con` — clean browser console in dev **and** production build
- `cdn` — CDN variant verified (vanilla-js only)

Pass = all checks ✓, the custom element upgrades (the component is headless — nothing visible renders), and a run yields a reliable result (`ratio > 18 dB`). See `CLAUDE.md` for full criteria.

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
