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

> StackBlitz works fully in Firefox (mic permission included), and in Chrome for Angular. The other five apps fail in Chrome due to a WebContainer native-bindings incompatibility: Vite/Rolldown (Vanilla JS, React, Vue, Svelte) and Turbopack (Next.js) both require native bindings unavailable in WebContainers — unrelated to this project.

### Verification status

All 6 apps verified against `@adasp/latency-test@1.2.0`. Full results, environment, and findings: [VERIFICATION.md](VERIFICATION.md).

| Framework | Dev | Prod build | Date |
|---|---|---|---|
| Vanilla JS (npm + CDN) | ✓ | ✓ | 2026-06-15 |
| React | ✓ | ✓ | 2026-06-15 |
| Vue | ✓ | ✓ | 2026-06-15 |
| Svelte | ✓ | ✓ | 2026-06-15 |
| Angular | ✓ | ✓ | 2026-06-16 |
| Next.js | ✓ | ✓ | 2026-06-16 |

## Re-verifying an example app

Use `verify.sh` at the repo root to wire a harness into any example app for a manual
browser check session and clean up automatically when done. See [verification/README.md](verification/README.md) for usage and the script's self-test checklist.

```
./verify.sh <framework>   # vanilla-js | react | vue | svelte | angular | nextjs
```

## Latency-compensation demos (`demos/`)

Small multitrack editors demonstrating that the measured round-trip latency can align a recording: a default metronome track is recorded through the microphone while wearing headphones — uncompensated, the recording lands late by the round-trip latency (audible flam, visible waveform offset); after running the latency test, the measured value shifts the recording into alignment.

Reference implementation: the [Hi-Audio fork of waveform-playlist](https://github.com/gilpanal/waveform-playlist), which already applies a measured latency value to recorded tracks (MediaRecorder-based).

### Roadmap

| Demo | Target library | Status |
|---|---|---|
| [waveform-playlist (legacy fork)](demos/waveform-playlist-legacy/) | [gilpanal/waveform-playlist](https://github.com/gilpanal/waveform-playlist) (commit-pinned) | done — see [NOTES.md](demos/waveform-playlist-legacy/NOTES.md) |
| [dawcore (Web Components)](demos/dawcore/) | [`@dawcore/*` migration spec](https://github.com/naomiaro/waveform-playlist/blob/main/docs/specs/web-components-migration.md) | done — see [NOTES.md](demos/dawcore/NOTES.md) |
| waveform-playlist (React) | [naomiaro/waveform-playlist](https://github.com/naomiaro/waveform-playlist) | planned |
| openDAW | [andremichelle/openDAW](https://github.com/andremichelle/openDAW) | stretch goal |
| WAM Online Studio | [Brotherta/wam-studio](https://github.com/Brotherta/wam-studio) | stretch goal |

## Running locally

Each app is self-contained: `cd` into its folder and follow its own README. Bootstrap a fresh scaffold with `npm install`; verification runs use `npm ci` once the lockfile exists (this is what the registry-consumption check requires). All apps require a microphone and run on localhost or HTTPS.

## Acknowledgments

<a href="https://hiaudio.fr"><img src="assets/logos/hi-audio.svg" alt="Hi-Audio" height="32"></a>

This project is developed as part of *Hybrid and Interpretable Deep Neural Audio Machines*, funded by the **European Research Council (ERC)** under the European Union's Horizon Europe research and innovation programme (grant agreement No. 101052978).

Component source, API documentation, research background, full citation, and acknowledgments are in the [component repository](https://github.com/idsinge/latency-test).
