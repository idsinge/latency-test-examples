# Session state — resume point

Last session: 2026-06-15. Read this together with `CLAUDE.md` to resume.

## Where we are

Tier 1, app 1 of 6 (vanilla-js): **complete, committed, pushed.**
Tier 1, app 2 of 6 (React): **complete, committed, pushed.**
Tier 1, app 3 of 6 (Vue): **next — plan below, ready to execute.**

## Established per-app workflow

For each app, in order:
1. Read docs page from `/Users/jose/Desktop/rountriplatencytest-webcomponent/docs/examples/<name>.md`
2. Pin docs commit: `git -C /Users/jose/Desktop/rountriplatencytest-webcomponent log --oneline docs/examples/<name>.md`
3. Draft plan: scaffold commands, file layout, content notes, special considerations
4. Write Codex prompt for plan review (user pastes into Codex, no file changes)
5. Update plan with Codex feedback
6. User runs scaffold commands
7. Claude writes all files after user confirms scaffold done
8. User runs `npm run dev`, shares console logs
9. User runs `npm run build && npm run preview`, shares console logs
10. User runs `npm ci && npm ls @adasp/latency-test && grep -E "file:|link:" package-lock.json`
11. Claude updates README matrix row and SESSION_STATE
12. Claude writes Codex sign-off prompt (user pastes into Codex, no file changes)
13. Claude commits + pushes after green light

## Vue — approved plan (execute next)

### Docs commit
`208efe9` — "fix AC/stream ordering in examples". No CDN variant.

### Scaffold commands (user runs from repo root)
    nvm use 22
    npm create vite@9 examples/vue -- --template vue
    cd examples/vue
    npm install
    npm install @adasp/latency-test@1.2.0 --save-exact

### Template cleanup
Delete: src/style.css, src/assets/vue.svg, public/vite.svg (and any other template demo assets).
Also remove their imports from src/main.js and src/App.vue.

### File layout
    examples/vue/
      index.html             unchanged Vite template (update title)
      src/main.js            import '@adasp/latency-test' + createApp(App).mount('#app')
      src/LatencyTester.vue  docs "Basic usage" SFC verbatim (no additions)
      src/App.vue            renders <LatencyTester /> + <Verify /> as siblings
      src/Verify.vue         verification harness as a Vue SFC
      vite.config.js         isCustomElement config + base path

### Content notes

src/main.js — remove CSS import from template; add `import '@adasp/latency-test'` before createApp.

src/LatencyTester.vue — docs "Basic usage (Composition API)" SFC block verbatim. No changes.

src/App.vue — renders <LatencyTester /> then <Verify /> as siblings in a template fragment.
  Clear comment boundary between docs content and harness.

src/Verify.vue — Vue SFC with <script setup>:
  - onMounted: attach all six event listeners SYNCHRONOUSLY on document.querySelector('latency-test')
  - customElements.whenDefined fire-and-forget .then() for upgrade check (separate from listener setup)
  - Same exact cycle pattern verifier as React (recording→processing→result ×N)
  - Negative-path button with 5s timeout; check e.detail.message includes 'inputStream is required'
  - onBeforeUnmount: remove all six listeners

vite.config.js — MUST include isCustomElement: (tag) => tag === 'latency-test' in Vue plugin config
  (docs explicitly requires this to prevent Vue warning about unknown element).
  Also add base: '/latency-test-examples/vue/'.

### Special considerations

- isCustomElement is required — without it Vue warns and may try to resolve latency-test as a
  component. This is documented on the docs page itself.
- number-of-tests="5" is a static string attribute in the template (not :number-of-tests).
  Vue passes it as a DOM attribute. The component accepts this correctly.
- ltRef.start() in the docs template — Vue auto-unwraps refs, so this calls ltRef.value.start().
- No double-mount issue (Vue has no StrictMode equivalent).
- Verify.vue accesses docs element via document.querySelector — safe, only one on page.

### Pass criteria (no CDN)
ev✓ neg✓ reg✓ con✓

## Environment (established — do not re-derive)

- Node: 22.22.3 (nvm)
- Browser: Firefox 151.0.4 (aarch64)
- OS: macOS 15.4 (24E248)
- Audio: beyerdynamic DT 770 PRO 80Ω headphones, built-in mic
