# Vue example — `<latency-test>`

Vue 3 + Vite host app for [`@adasp/latency-test`](https://www.npmjs.com/package/@adasp/latency-test),
mirroring the [docs example page](https://idsinge.github.io/latency-test/examples/vue).

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

## Vue note

`isCustomElement` must be set in `vite.config.js` so Vue does not try to resolve
`<latency-test>` as a Vue component. This is documented on the docs page.
