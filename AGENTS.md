# Repository instructions

## Android compatibility

- Android compatibility is a core requirement for every plugin change. Keep `manifest.json` at `isDesktopOnly: false` and use Obsidian and browser APIs available on Android.
- Do not add Node.js, Electron, native binaries, desktop filesystem access, or codecs that require a runtime network request. Bundle the JPEG WebAssembly encoder into `main.js` so the downloaded plugin works offline on Android.
- Check the TypeScript build and the installable ZIP's required files after code changes. The user tests the plugin manually on Android and desktop; do not emulate a live vault.

## Branches and delivery

- `main` is the customized plugin and the default branch. Make requested changes here.
- `dev` is a reference to the original fork. Do not commit custom changes to `dev` unless the user explicitly asks.
- Every push to `main` runs the build in GitHub Actions. GitHub provides the downloadable artifact as a ZIP containing `main.js`, `manifest.json`, and `styles.css` for manual installation in an Obsidian vault. Do not commit generated build files or provide a separate local ZIP as the primary deliverable.
- The ZIP must contain one top-level folder named exactly like `manifest.json`'s `id`, with `main.js`, `manifest.json`, and `styles.css` directly inside it. Give the fork its own valid ID and display name so it can coexist with the upstream plugin.
- If bundled third-party codecs require license notices, include those notices beside the installable plugin files in the artifact.
- The user downloads and tests the artifact manually in Obsidian. Do not emulate a live vault or set up extra testing infrastructure. Run the repository build and any focused checks needed for a concrete change.

## Versions and changelog

- The custom version series starts at `0.1.0` on `main`, independently of the upstream fork's version.
- For each subsequent code modification, increment the patch version (`0.1.1`, `0.1.2`, and so on) unless the user requests a different version. Keep `package.json`, `package-lock.json`, `manifest.json`, and `versions.json` synchronized. `npm version <version> --no-git-tag-version` runs this repository's version script; inspect the resulting files before committing.
- Add a concise entry to `CHANGELOG.md` with the new version and the user-visible change for each versioned code modification. Update documentation when behavior changes.
- Keep work focused on the requested change and repository build; avoid unrelated refactors and redundant checks.

## ZIP build artifact retention

- Keep only the five newest available successful install/source ZIP artifacts in this repository, ordered by creation time (five builds, even when version numbers repeat). Automatically delete older ZIPs and artifacts from failed/cancelled ZIP builds after completion. Preserve artifacts from active runs.
- Maintain automatic GitHub Actions cleanup whenever a ZIP artifact upload workflow exists or is added. Keep cleanup limited to the repository's install/source ZIP workflows and their known artifact names; retain related screenshots only for retained builds. Paginate artifact listings and verify completed run outcomes before deletion.
- This policy concerns GitHub Actions build artifacts. Do not delete source code, commit history, tags, GitHub Releases, Docker images, personal backups, or unrelated artifacts. Users archive downloaded versions locally.
- Add the policy to future ZIP workflows; do not add ZIP builds to projects that do not use them. Agent-instruction/CI maintenance changes alone do not require application version bumps or manual application builds.
- Confirm cleanup succeeds. Report quota blockers honestly: account-wide storage and delayed GitHub usage recalculation can still block uploads.
