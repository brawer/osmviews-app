<!--
SPDX-FileCopyrightText: 2026 Sascha Brawer <sascha@brawer.ch>
SPDX-License-Identifier: MIT
-->

# Releasing

Releases are automated with [release-please](https://github.com/googleapis/release-please)
and deployed to `osmviews.brawer.ch` by GitHub Actions, into the `osmviews-app`
Bunny storage zone defined in `brawer/production`.

## How it works

1. Every pull request has a [Conventional Commits](https://www.conventionalcommits.org)
   title (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `build:`, `ci:`,
   `chore:`). PRs are squash-merged, so the title becomes the commit on `main`.
   `.github/workflows/pr-title-lint.yml` enforces this.
2. `.github/workflows/release-please.yml` watches `main` and keeps a single open
   **"chore(main): release x.y.z"** pull request, bumping `version` in
   `package.json` and updating `CHANGELOG.md` from the commit history. It runs
   as the account-wide **`brawer-release-bot`** GitHub App (see
   [One-time setup](#one-time-setup)) — a workflow run started by the built-in
   `GITHUB_TOKEN` cannot itself start further workflow runs, so the App
   identity is what lets the tag launch `deploy.yml`.
3. Review that PR and squash-merge it when you want to ship. release-please
   then pushes the `vX.Y.Z` tag and creates the GitHub release.
4. The release launches `.github/workflows/deploy.yml`, which runs `npm ci &&
   npm run build` and uploads `dist/` to the `osmviews-app` Bunny storage zone
   over its native Storage HTTP API (`scripts/deploy.mjs`; that zone is
   `type = "Standard"` in `brawer/production`'s `storage.tf`, not S3). No cache
   purge: the deploy pipeline never holds the Bunny account API key, so the
   pull zone's short default TTL on non-hashed files is what makes a deploy
   show up within minutes.

## One-time setup

- **`brawer-release-bot` GitHub App** — shared with the other `osmviews`
  repositories; see `osmviews-rs`'s `RELEASING.md` for how to rebuild it if
  needed. This repo additionally needs:
  1. Adding to the App's repository access list (App settings → Install App →
     add `osmviews-app`).
  2. Its own copies of the repo-level config: **Settings → Secrets and
     variables → Actions** → variable `RELEASE_PLEASE_APP_CLIENT_ID` and
     secret `RELEASE_PLEASE_APP_PRIVATE_KEY`. Until the variable exists,
     `release-please.yml` is skipped rather than failing every push.
- **`BUNNY_OSMVIEWS_APP_ACCESS_KEY` secret** — the `osmviews-app` storage
  zone's write password, from `brawer/production/bunny`:
  `tofu output -json passwords | jq -r '."osmviews-app"'`. Add it as a repo
  secret (**Settings → Secrets and variables → Actions**).

## Choosing the version number

release-please picks the bump from the commit types since the last release:
`fix:` → patch, `feat:` → minor, and a `!` after the type or a `BREAKING
CHANGE:` footer → a breaking bump. While the app is `0.x` (pre-1.0),
`bump-minor-pre-major` maps a breaking change to a **minor** bump and
everything else to a **patch** bump.

Only `feat:` and `fix:` commits cut a release (and appear in `CHANGELOG.md`).
`docs:`, `refactor:`, `test:`, `build:`, `ci:` and `chore:` are silent — they
ride along with the next real release. Use `Release-As:` in a commit body to
force a specific version.
