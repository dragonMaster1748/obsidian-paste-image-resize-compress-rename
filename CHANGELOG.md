# Changelog

## 0.1.4 — 2026-09-24

- Align normal JPEG encoding with ImgCompress's 4:2:0, progressive, optimized approach; set the new-install quality default to 85 while retaining existing saved settings.
- Keep text-edge mode as 4:4:4 JPEG, show the installed version in settings, and document how to replace a stale plugin build showing the removed PNG option.
- Make Android compatibility a primary repository rule and check the offline bundled encoder and absent PNG option in GitHub Actions.

## 0.1.3 — 2026-09-24

- Replace PNG text clarity output with a JPEG text-edge mode using MozJPEG 4:4:4 chroma sampling, a higher starting quality, and optimized progressive encoding.
- Keep Original and JPEG as the only output choices. The existing preserve-text default now selects JPEG text-edge encoding.
- Bundle the encoder within `main.js` and include its license notices in the installable ZIP.

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
