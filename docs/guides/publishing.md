# Publishing `@modeling-kit/*`

Public packages ship from a **git tag**. CI on `main` only verifies. The release workflow publishes.

Packages are currently `0.1.0`. The first npm release is tag `v0.1.0`. A later `v1.0.0` is a version bump, not a new pipeline.

## One-time npm setup

1. Create the [`modeling-kit`](https://www.npmjs.com/org/create) npm org if it does not exist.
2. Add a granular or automation token that can publish scoped public packages.
3. In GitHub → Settings → Secrets and variables → Actions, add `NPM_TOKEN`.
4. Optional: on npm, add this GitHub repo as a [trusted publisher](https://docs.npmjs.com/trusted-publishers) for provenance. The workflow already requests OIDC (`id-token: write`) and sets `NPM_CONFIG_PROVENANCE`.

Do not put the token in the repo. Do not publish from a laptop unless you are recovering a failed tag (same version cannot be republished).

## First publish (`v0.1.0`)

Package versions are already `0.1.0`. No Changeset bump is required.

```bash
git checkout main
git pull
pnpm release:check
git tag v0.1.0
git push origin v0.1.0
```

`.github/workflows/release.yml` then:

1. Fails fast if `NPM_TOKEN` is missing.
2. Checks the tag matches every public package version.
3. Runs `pnpm check:release`.
4. Publishes `packages/*` to npm (`publishConfig.access: public`).
5. Opens a GitHub Release with generated notes.

Install after it succeeds:

```bash
pnpm add @modeling-kit/sdk
```

## Later releases

All public `@modeling-kit/*` packages bump together (Changesets `fixed` group). Apps stay private and ignored.

```bash
pnpm changeset
# commit the markdown file under .changeset/ with the feature
# after merge to main:
pnpm version-packages
# review package.json + CHANGELOG.md, then:
git add -A
git commit -m "Release vX.Y.Z"
git tag vX.Y.Z
git push origin main
git push origin vX.Y.Z
```

`pnpm version-packages` is `changeset version`. It must run on the commit you tag. The tag **must** be `v` plus the new `package.json` version (`v0.1.1`, `v1.0.0`, `v1.0.0-rc.1`).

## Local checks

| Command | What it does |
| --- | --- |
| `pnpm release:check` | Lockstep versions, public access, Changesets config |
| `pnpm release:check --require-tag` | Also requires `GITHUB_REF_NAME` or `--tag vX.Y.Z` |
| `pnpm changeset` | Record a version note |
| `pnpm version-packages` | Apply notes; bump every public package |

`pnpm release:publish` is for the tag workflow. It uses `--no-git-checks` because Actions checks out a detached tag.

## What does not publish

- The private workspace root `modeling-kit`
- Host apps under `apps/`
- Source trees (`files: ["dist"]` only)

Internal `workspace:*` dependencies are rewritten to the published version by pnpm on publish.
