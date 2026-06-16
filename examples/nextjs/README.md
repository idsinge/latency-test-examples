# Next.js example — `<latency-test>`

Next.js 16 (App Router) host app for [`@adasp/latency-test`](https://www.npmjs.com/package/@adasp/latency-test),
mirroring the [docs example page](https://idsinge.github.io/latency-test/examples/nextjs).

Verification results are recorded in the root `README.md` matrix.

## Run (dev)

```sh
npm ci
npm run dev
```

Open `http://localhost:3000/latency-test-examples/nextjs/` — note the path prefix,
which applies in dev because of the configured `basePath`. Requires microphone + headphones.

## Build + preview (production)

```sh
npm run build
mkdir -p /tmp/nextjs-preview/latency-test-examples/nextjs
cp -r out/* /tmp/nextjs-preview/latency-test-examples/nextjs/
npx serve -l 3000 /tmp/nextjs-preview
```

Open `http://localhost:3000/latency-test-examples/nextjs/`.

The extra step is needed because the app is built with
`basePath: /latency-test-examples/nextjs` (GitHub Pages path) — serving
`out/` directly at `/` causes asset 404s.

## Next.js + custom element notes

`@adasp/latency-test` uses browser-only APIs. It must be loaded client-side only:
- The component lives in `components/LatencyTester.tsx` with `'use client'` at the top.
- The package is imported lazily inside `useEffect` — never at module level.

A JSX type declaration is required in `types/custom-elements.d.ts` even with React 19.
The docs claim `HTMLElementTagNameMap` is auto-bridged in React 19+ — this is false with
`@types/react` 19.2.17 in Next.js 16. The declaration must use
`declare module 'react' { namespace JSX { ... } }`.

Two further bugs exist in the docs `connect()` code (mirrored faithfully here, not patched):
- No `setError(null)` at the top of `connect()`, so a previous error persists on successful retry.
- The catch block stops mic tracks but does not close the `AudioContext` created before
  `getUserMedia()` fails, leaking it.
