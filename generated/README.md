Tracked indexes (regenerate with `pnpm repo:indexes`):

- `repo-map.md` — packages, versions, dependencies
- `package-graph.md` — workspace edges
- `public-api-index.md` — public exports (reads `src/`, not `dist/`)
- `test-index.md` — test files and invariant hints

Not tracked (created on demand, gitignored):

- `context-<preset>.md` from `pnpm repo:context -- --preset mesh`

Host-facing documentation lives in [`docs/README.md`](../docs/README.md).
