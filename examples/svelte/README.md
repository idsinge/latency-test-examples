# Svelte example — `<latency-test>`

Svelte 5 + Vite host app for [`@adasp/latency-test`](https://www.npmjs.com/package/@adasp/latency-test),
mirroring the [docs example page](https://idsinge.github.io/latency-test/examples/svelte).

Verification results are recorded in the root `README.md` matrix.

## Run (dev)

```sh
npm ci
npm run dev
```

Open `http://localhost:5173`. Requires microphone + headphones.

## Build + preview (production)

```sh
npm run build
npm run preview
```

## Svelte note

The docs example uses Svelte 4 syntax (`on:click`, bare `let`). This works verbatim in
Svelte 5 via legacy mode — no `runes={false}` directive needed.

**Docs finding:** `<latency-test ... />` self-closing tag triggers a Svelte build warning.
The docs should use `<latency-test ...></latency-test>` instead.
