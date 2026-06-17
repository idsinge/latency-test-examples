# React example — `<latency-test>`

React 19 + Vite host app for [`@adasp/latency-test`](https://www.npmjs.com/package/@adasp/latency-test),
mirroring the [docs example page](https://idsinge.github.io/latency-test/examples/react).

Verification results are recorded in [`VERIFICATION.md`](../../VERIFICATION.md).

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

## React note

React StrictMode double-mounts components in development — the upgrade check logs twice in
the console. This is expected and does not affect production behavior.
