# Verification harness — vanilla-js

## Files

- `verify.js` — harness for the npm variant (`examples/vanilla-js/`)
- `cdn-verify.js` — harness for the CDN variant (`examples/vanilla-js/public/cdn.html`)

## How to wire in for a verification session

### npm variant

In `examples/vanilla-js/index.html`, add before `</body>`:

    <!-- verification harness — not part of docs example -->
    <script type="module" src="/src/verify.js"></script>

Copy `verify.js` into `examples/vanilla-js/src/verify.js`.

Run `npm run dev`, verify, run `npm run build && npm run preview`, verify.

**Before committing:** remove the script tag and delete `src/verify.js`.

### CDN variant

In `examples/vanilla-js/public/cdn.html`, add before `</body>`:

    <!-- verification harness — not part of docs example -->
    <script type="module" src="cdn-verify.js"></script>

Copy `cdn-verify.js` into `examples/vanilla-js/public/cdn-verify.js`.

The CDN variant has no build step — "dev" and "production" are the same static file.
Serve it locally (e.g. `npx serve public`) and run the full verification cycle twice:
once on first load (cold), once after a page reload (warm cache). Both passes count as
the dev + production equivalent for the CDN variant.

**Before committing:** remove the script tag and delete `public/cdn-verify.js`.
