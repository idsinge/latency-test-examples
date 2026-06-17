# Vanilla JS example — `<latency-test>`

Vanilla JS host app for [`@adasp/latency-test`](https://www.npmjs.com/package/@adasp/latency-test),
mirroring the [docs example page](https://idsinge.github.io/latency-test/examples/vanilla-js).
Covers two install paths: npm (Vite bundler) and CDN (static HTML).

Verification results are recorded in [`VERIFICATION.md`](../../VERIFICATION.md).

## npm variant — Run (dev)

```sh
npm ci
npm run dev
```

Open `http://localhost:5173`. Requires microphone + headphones.

## npm variant — Build + preview (production)

```sh
npm run build
npm run preview
```

## CDN variant

No build step. Serve `public/cdn.html` with any static server:

```sh
npx serve -l 3001 public
```

Open `http://localhost:3001/cdn.html`. Requires microphone + headphones.
