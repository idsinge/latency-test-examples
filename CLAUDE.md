# CLAUDE.md — latency-test-examples

## Critical collaboration rules

- **Never edit or create files without explicit user confirmation.** Reading, analysis, and proposing changes are always allowed; applying them is not.
- **The user types all code themselves to learn.** Explain what to write, where, and why — do not hand over paste-ready code blocks unless the user explicitly asks for a concrete file change.
- **Commits and PRs are user-driven.** Propose, never auto-commit. When a branch is complete, state explicitly: "This branch is final and push-complete" — the user merges only after that declaration (prevents merge races with late pushes).
- **Codex reviews each completed block** (typically one app/folder) before its row is recorded — same adversarial-review loop as the component repo.

## What this repository is

Host applications for the `<latency-test>` Web Component, published on npm as **`@adasp/latency-test`** — a tool that measures browser round-trip audio latency using an MLS signal and cross-correlation.

Direct companion to the component repository: https://github.com/idsinge/latency-test (docs site: https://idsinge.github.io/latency-test/). The component repo holds the source, docs, and plan; this repo proves the published package works in real host applications.

**Hard rule:** everything here consumes the **published package** (npm registry or CDN). Never reference the component repo by `file:` dependency, relative import, git submodule, or local `dist/` copy — defeating that defeats the purpose of this repo.

There are two tiers with different goals and different rules.

## Tier 1 — `examples/` (framework integration verification)

Goal: prove each framework example page of the docs site works end-to-end against the installed published package. This is "Phase 6" of the component repo's plan.

- One self-contained app per folder: `examples/vanilla-js/`, `examples/react/`, `examples/vue/`, `examples/svelte/`, `examples/angular/`, `examples/nextjs/`.
- Each app mirrors its docs page **literally** (https://idsinge.github.io/latency-test/examples/ — same code, same instructions). Any deviation forced by reality is a **finding** → the docs page gets patched in the component repo.
- **Exact version pin:** `"@adasp/latency-test": "1.2.0"` — no `^` or `~`. The pin documents what was verified; bump only when deliberately re-verifying.
- **Pass criteria per app:**
  1. The custom element upgrades: `customElements.get('latency-test')` is defined and the element is callable from the host UI. (The component is headless with an empty shadow root — nothing visible renders; do not wait for visual output.)
  2. A successful run fires the **five success-path events** in order — `latency-start`, `latency-recording`, `latency-processing`, `latency-result`, `latency-complete` — and `latency-error` does **not** fire.
  3. One deliberate **negative-path check**: e.g. call `start()` before setting `inputStream`, assert `latency-error` fires.
  4. A run produces a reliable result (`ratio > 18 dB`). This proves the audio path end-to-end but is environment-dependent: an unreliable result questions the physical setup (mic, headphones, levels, sample rate) **before** it implies a docs bug.
  5. The app passes in **dev mode and as a production build/preview**, with a clean browser console — SSR/build-time is where custom elements typically break (Next.js, Angular, Svelte).
  6. **Registry consumption proven:** fresh `npm ci`; lockfile `resolved` URLs point to registry.npmjs.org; `npm ls @adasp/latency-test` shows `1.2.0`; no `file:`, `link:`, or workspace references anywhere.
- The vanilla-js example also exercises the **CDN path** (a second HTML variant using the documented jsDelivr/unpkg `@1.2.0` pin) — its docs page advertises CDN usage, and the gate must not silently skip a documented install path. The npm variant itself is a minimal bundler/dev-server app (e.g. Vite vanilla template) so bundler-based npm consumption is genuinely verified; the CDN variant is a separate static HTML page.
- **Verification order:** vanilla-js → React → Vue → Svelte → Angular → Next.js (cheapest smoke test first, SSR risk last).
- **The verification record lives in `VERIFICATION.md`:** scaffold tooling + versions, package version, the docs-page commit SHA verified against, browser + OS + audio device setup, dev and production-build results, date, mismatches found. README keeps only a slim pass/date summary linking to it. Without the commit SHA and environment, the record becomes ambiguous after docs drift.
- Runtime requirements: localhost or HTTPS; mic permission; create the `AudioContext` synchronously in the user gesture **before** `await getUserMedia()` (Firefox needs this to start in `running` state); the host owns the `AudioContext` and `MediaStream` — the component never closes or stops them.

## Tier 2 — `demos/` (latency-compensation R&D)

> **Hard quarantine (cleared 2026-06-17):** no work in `demos/` — not even scaffolding "to prepare" — was allowed until the Tier 1 verification record was complete and Phase 6 was signed off in the component repo: [idsinge/latency-test#30](https://github.com/idsinge/latency-test/issues/30) (closed 2026-06-17). Tier 2 was the project's main scope-creep risk; this rule was the guardrail until the gate cleared. Phase A and Phase B demos have since shipped — see Demo targets below.

Goal: demonstrate in a real multitrack editor that the measured round-trip latency can align a recording.

**Concept:** the app provides a default metronome track. The user wears headphones and records it through the microphone. Without compensation, the recorded track lands late by the round-trip latency — audibly (flam) and visibly (waveform offset). After running the latency test, the measured value shifts the recording into alignment. Each demo shows the A/B both ways: audibly and as stacked waveforms.

This tier is **research, not just integration**: the target libraries do not yet accept an externally measured latency value to shift a recording. Each demo involves three layers: (1) run the latency test (the component is ready), (2) investigate where the library's recording path can apply a time offset, (3) wire the measured value in — possibly requiring library changes.

### Reference implementation (the blueprint)

https://github.com/gilpanal/waveform-playlist — the Hi-Audio fork of the old waveform-playlist (MediaRecorder-based recording), adapted to apply a measured latency value to shift the recorded track. The place where this fork applies the shift is the working pattern to port to the new libraries.

**Confirmed contract** (from commit [`6900baa`](https://github.com/gilpanal/waveform-playlist/commit/6900baa2d1220318c917b0e3e60e67e67c6b7477), `src/Playlist.js`, verified 2026-06-17): the host calls `ee.emit("record", latencySeconds)` — **seconds**, not the `latency-result` event's milliseconds. The fork stores it and, inside the MediaRecorder `ondataavailable` handler (every 300ms timeslice), destructively trims that many seconds off the **start** of the re-decoded buffer — not a `track.setStartTime()` shift. A second insertion point in the offline-render/WAV-export path was attempted by the same author but is commented out as buggy/unfixed — a known, carried-forward limitation, not something to silently re-fix.

The fork records the **raw mic stream directly** via MediaRecorder (`initRecorder(stream)` wraps `new MediaRecorder(stream)`, no mixing) — confirmed this maps to the component's `recording-mode="mediarecorder-1ch"`, not the 2-channel default `"mediarecorder"`.

### Hi-Audio (parallel external track)

Hi-Audio is the component's primary target. `gilpanal/waveform-playlist`'s build output is a real dependency the Hi-Audio frontend imports — for latency compensation and other features built on top of the original library — but the fork's repo is not the Hi-Audio frontend repo itself; that integration happens **separately and in parallel**, in the Hi-Audio frontend repo, by the user. This repo does **not** represent the Hi-Audio integration — Phase A's demo (below) uses the same fork only to prove the compensation pattern in isolation, pinned to a fixed commit; it is not wired to the Hi-Audio frontend in any way.

### Demo targets

**Phase A (shipped):** `demos/waveform-playlist-legacy` — depends directly on the reference fork above (git-pinned to a specific commit, not the moving branch) to prove the A/B concept fast using its already-working compensation pattern, before tackling the newer libraries below. See `demos/waveform-playlist-legacy/NOTES.md` for findings.

**Phase B (shipped):** `demos/dawcore` — the framework-agnostic Web Components ecosystem (`@dawcore/*`, Lit-based) emerging from the same project's migration plan: https://github.com/naomiaro/waveform-playlist/blob/main/docs/specs/web-components-migration.md. Per that spec (read 2026-06-12): worklet-based per-track recording with "latency compensation" mentioned, `daw-recording-complete` event carries `offsetSamples`, recording backend shipped but arming API not yet. The investigation was how an externally **measured** round-trip latency feeds that pipeline. See `demos/dawcore/NOTES.md` for the full investigation, including the compensation insertion point found and two real bugs uncovered (one in this demo's own alignment-proof code, one filed upstream as [naomiaro/waveform-playlist#501](https://github.com/naomiaro/waveform-playlist/issues/501)).

**Phase C (not started):** waveform-playlist (new React version) — https://github.com/naomiaro/waveform-playlist (`@waveform-playlist/*` packages). Same `@waveform-playlist/engine` backend as dawcore (Phase B), so the mute/solo/volume/pan bug above likely reproduces here too — check early. `src/alignment.js` from the dawcore demo is stack-agnostic and should be reusable as-is.

Stretch goals (explore only if complexity allows; listed so adding them later is natural, not promised):
- **openDAW** — https://github.com/andremichelle/openDAW
- **WAM Online Studio** — https://github.com/Brotherta/wam-studio

### Rules for demos

- **Pipeline matching (most important rule):** the component's three `recording-mode` values measure *different pipelines*. Run the latency test in the mode that matches the demo app's actual capture backend — to be verified per demo, not assumed. New waveform-playlist / dawcore record via AudioWorklet → start from `recording-mode="audioworklet"`; the old fork's direct-mic MediaRecorder capture maps to `"mediarecorder-1ch"`. Compensating with a number measured on a different pipeline is dishonest and will not align.
- **Lower-bound caveat:** the component's `audioworklet` mode measures its own *minimal* capture graph, not the host app's full graph (component repo Decision #15). Treat the measured value as a lower bound unless the demo verifies that the app's graph is equivalent — the residual misalignment after compensation is itself a research finding worth recording.
- **Measurement constraints:** headphones mandatory; mic constraints `echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1`; known limitation: unreliable above 48 kHz or with mismatched device sample rates.
- **Alignment evidence:** use impulse-like metronome clicks and compare alignment in the **sample domain** (offset in samples), not only visually — waveform overlays can mislead via codec padding, resampling, headphone bleed, and UI scaling. The audible A/B and the visual overlay are presentation; the sample-domain number is the proof. **Exception, documented 2026-06-18:** Phase A (`waveform-playlist-legacy`) is exempted — it's a feasibility check proving the compensation pattern works via an already-proven fork, not the project's final research record, so visual/audible comparison is sufficient there. Sample-domain proof is required starting with Phase B and for every demo after it — Phase B's (`dawcore`) proof is recorded in `demos/dawcore/NOTES.md`. See Phase A's `NOTES.md` for the exemption's full reasoning.
- **Each demo keeps a `NOTES.md`:** where the compensation insertion point is, what was tried and rejected, and what the library would need to support this natively. This investigation record is research output — for the maintainers, for Hi-Audio, and for the paper trail.
- **Fork-vs-upstream policy:** prototype in a fork or local patch so the demo ships; then propose the capability upstream as a PR.
- **Version policy:** demos may track the latest published component version (unlike Tier 1's exact pin).

## Deployment

GitHub Pages from this repo: a single GitHub Actions workflow builds all apps into one Pages output with an index page linking each. Every app sets its base path from day one: `/latency-test-examples/<app>/` (Vite `base`, Angular `baseHref`, Next.js `output: 'export'` + `basePath` + `trailingSlash` + `images.unoptimized`). Pages serves HTTPS, so `getUserMedia` works. The index page **links** to each app — never embeds them in iframes (mic permission inside iframes requires `allow="microphone"` and behaves inconsistently across browsers). Verify the deployed URLs, not only local previews. Once live, the deployed demos get linked from the component repo's docs.

## Component quick reference

- API docs: https://idsinge.github.io/latency-test/api
- Host-required before `start()`: `element.audioContext = ac` and `element.inputStream = stream` — emits `latency-error` if missing. The component never creates/closes the context or stops the stream.
- Events (all `bubbles: true, composed: true`): `latency-start`, `latency-recording`, `latency-processing`, `latency-result`, `latency-complete`, `latency-error`.
- `latency-result` detail: `{ latency (ms), ratio (dB), reliable (ratio > 18), timestamp, mode }`.
- `recording-mode`: `"mediarecorder"` (default, 2-channel) | `"mediarecorder-1ch"` (fallback) | `"audioworklet"`.
- `signal-type` is `"mls"` only in v1. `input-gain` does not exist — low mic levels are handled by the host-gain pattern: https://idsinge.github.io/latency-test/examples/host-gain
