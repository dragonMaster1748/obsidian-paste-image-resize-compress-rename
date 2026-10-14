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

## Validate before pushing

- Before pushing code or build-configuration changes, use an accessible, compatible local checkout or the user's VM first. Confirm the agent actually has access and the required runtime, dependencies, and build tools; do not infer access from the device type.
- If local/VM validation is unavailable, use a compatible Codex cloud environment or the current cloud workspace. If neither is available, run the lightweight checks possible and use GitHub Actions for the remaining validation. Report exactly which checks could not run and why.
- Run inexpensive syntax/configuration checks first, then relevant existing tests and the smallest useful compile/build check. Review changes against the last successful build when useful, especially dependency, runtime, workflow, and packaging changes; comparison alone is not proof of compilation.
- Fix genuine code, test, or compilation failures before pushing. Missing tools, unavailable access, or infrastructure failures justify the fallback; do not disguise a code failure as an environment limitation.
- For documentation/agent-instruction-only changes, review the diff and skip compilation unless the change affects build inputs. Use existing documentation path filters or a supported CI skip marker for purely documentation-only commits where applicable; do not trigger manual application builds just to validate Markdown.
- Reuse existing development environments and project commands. A local checkout used for edits/testing is allowed; commit and push the completed changes to GitHub rather than leaving a separate uncommitted project. Do not install large toolchains, create extra environments, or claim VM/cloud access merely to satisfy this rule.
- Repeat checks only after relevant changes, failures, or a concrete unresolved concern. Keep generated validation outputs temporary and uncommitted; GitHub remains the source of truth and the existing release workflow remains the distribution path.
- Report actual validation results, including GitHub results when relied upon. A successful local compile does not prove packaging/upload success or resolve GitHub storage quotas. This validation order replaces any older GitHub-first validation preference in this file.
