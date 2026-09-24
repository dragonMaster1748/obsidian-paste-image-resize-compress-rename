# Changelog

## 0.1.2 — 2026-09-24

- Write processed pixels before changing the image path; use a new numbered path when necessary so Obsidian loads the current image instead of cached pixels.
- Remove the maximum height field and preserve aspect ratio using the maximum width only.
- Add a lossless PNG text clarity option for screenshots and other images with text.
- Add settings for default JPEG conversion, default text clarity, and starting JPEG quality; processing defaults still open the preview dialog.

## 0.1.1 — 2026-09-24

- Gave this fork a distinct plugin ID and display name so it appears separately from the original Paste image rename plugin.
- Packaged the built files inside the matching plugin folder for direct extraction into `.obsidian/plugins/`.
- Clarified the manual installation steps and where to find locally installed plugins in Obsidian.

## 0.1.0 — 2026-09-24

- Added JPEG conversion, maximum dimensions, quality control, and a result preview to the image rename dialog.
- Added a file menu action to process images already in the vault.
- Added an automatic `main` branch build with a downloadable ZIP artifact for manual installation.
- Established `main` as the customized branch and `dev` as the original fork reference.
