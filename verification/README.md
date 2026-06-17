# Verification harness

`verify.sh` (repo root) wires a temporary verification harness into an example app
for a manual browser check session, then cleans up reversibly on exit (Enter or
Ctrl+C).

```
./verify.sh <framework>   # vanilla-js | react | vue | svelte | angular | nextjs
```

It copies the harness file(s) from `verification/<framework>/` into the app, patches
the entry file to import and render the harness, prints the dev/build/preview
commands to run, then waits. On exit it restores all patched files from backups,
removes copied harness files, and confirms `examples/<framework>/` is clean via
`git status` before exiting.

Full verification results: [VERIFICATION.md](../VERIFICATION.md).

## Per-framework harness notes

- [vanilla-js](vanilla-js/README.md)
- [react](react/README.md)
- [vue](vue/README.md)
- [svelte](svelte/README.md)
- [angular](angular/README.md)
- [nextjs](nextjs/README.md)

## Testing the script itself (no browser needed)

| Test | Command | Expected |
|---|---|---|
| No args | `./verify.sh` | Usage message, exit 1 |
| Unknown framework | `./verify.sh badname` | Unknown framework message, exit 1 |
| Happy path | `./verify.sh react`, then Enter immediately | Wires, then cleans up; dirty-check reports clean |
| Collision guard | Run `./verify.sh react` twice in parallel | Second run aborts with "already exists" error |
