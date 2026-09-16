# Changesets

Version notes for `@modeling-kit/*`. Apps are ignored; public packages bump together.

```bash
pnpm changeset
pnpm version-packages
git tag vX.Y.Z
git push origin vX.Y.Z
```

Pushing that tag runs `.github/workflows/release.yml`. See `docs/guides/publishing.md`.
