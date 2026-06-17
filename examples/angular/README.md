# Angular example — `<latency-test>`

Angular 22 host app for [`@adasp/latency-test`](https://www.npmjs.com/package/@adasp/latency-test),
mirroring the [docs example page](https://idsinge.github.io/latency-test/examples/angular).

Verification results are recorded in [`VERIFICATION.md`](../../VERIFICATION.md).

## Run (dev)

```sh
npm ci
npm start
```

Open `http://localhost:4200`. Requires microphone + headphones.

## Build + preview (production)

```sh
npm run build
mkdir -p /tmp/ng-preview/latency-test-examples/angular
cp -r dist/angular/browser/* /tmp/ng-preview/latency-test-examples/angular/
npx serve -l 3000 /tmp/ng-preview
```

Open `http://localhost:3000/latency-test-examples/angular/`.

The extra step is needed because the app is built with
`baseHref: /latency-test-examples/angular/` (GitHub Pages path) — serving
`dist/angular/browser` directly at `/` causes asset 404s.

## Angular 22 note

The Angular 22 CLI scaffold used here is zoneless by default. This app adds `zone.js` manually
(`npm install zone.js`) and configures it with `provideZoneChangeDetection()` in
`app.config.ts` to match the docs example, which was written for zone.js Angular.
