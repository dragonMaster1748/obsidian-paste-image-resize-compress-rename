# Repository instructions

## Branches and delivery

- `main` is the customized plugin and the default branch. Make requested changes here.
- `dev` is a reference to the original fork. Do not commit custom changes to `dev` unless the user explicitly asks.
- Every push to `main` runs the build in GitHub Actions. GitHub provides the downloadable artifact as a ZIP containing `main.js`, `manifest.json`, and `styles.css` for manual installation in an Obsidian vault. Do not commit generated build files or provide a separate local ZIP as the primary deliverable.
- The user downloads and tests the artifact manually in Obsidian. Do not emulate a live vault or set up extra testing infrastructure. Run the repository build and any focused checks needed for a concrete change.

## Versions and changelog

- The custom version series starts at `0.1.0` on `main`, independently of the upstream fork's version.
- For each subsequent code modification, increment the patch version (`0.1.1`, `0.1.2`, and so on) unless the user requests a different version. Keep `package.json`, `package-lock.json`, `manifest.json`, and `versions.json` synchronized. `npm version <version> --no-git-tag-version` runs this repository's version script; inspect the resulting files before committing.
- Add a concise entry to `CHANGELOG.md` with the new version and the user-visible change for each versioned code modification. Update documentation when behavior changes.
- Keep work focused on the requested change and repository build; avoid unrelated refactors and redundant checks.
