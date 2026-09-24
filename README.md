# Paste Image Resize Compress Rename

An Obsidian fork of [Paste image rename](https://github.com/reorx/obsidian-paste-image-rename) that adds image conversion and preview before saving. The original plugin's attachment renaming features are still available; see the [original README](https://github.com/reorx/obsidian-paste-image-rename#readme) for their full documentation.

## What this fork adds

- **JPEG conversion:** Keep the original image or convert supported JPG, PNG, WebP, and BMP images to JPEG. GIF and SVG files remain rename-only.
- **Maximum width:** Set a width limit in pixels; height follows the original aspect ratio. Set the limit to 0 to retain the original dimensions. Images are never enlarged. Large reductions are resized in stages from the decoded original before JPEG compression; the preview warns when a small width may make text hard to read.
- **Quality control:** Adjust JPEG quality before saving. Standard JPEG encoding uses progressive encoding, optimized coding, and 4:2:0 color sampling, with a default quality of 85 for new installations.
- **Text clarity mode:** For screenshots, diagrams, and images containing text, use JPEG with 4:4:4 color sampling and a starting quality of at least 95. This may increase file size; shrinking text too far can still make it unreadable.
- **Preview before saving:** See the processed image, output dimensions, and estimated file size in the rename dialog. Cancel to leave the image unchanged.
- **Process existing images:** Right-click an image in Obsidian's file explorer and select **Rename or convert image…**.
- **Processing defaults:** In plugin settings, optionally select JPEG conversion, text clarity, and a starting JPEG quality. A processing default still opens the preview dialog, including when Auto rename is enabled.
- **Fresh image display:** When processing would otherwise reuse the same image path, the plugin assigns a numbered filename so Obsidian shows the updated image instead of cached pixels.

JPEG conversion replaces transparency with white. The text clarity option remains lossy JPEG; re-encoding cannot recover detail that was already lost. This fork bundles its JPEG encoder for offline use on Android as well as desktop.

## Install this fork

1. Open the [Build Obsidian plugin ZIP workflow](https://github.com/dragonMaster1748/obsidian-paste-image-resize-compress-rename/actions/workflows/build-zip.yml), select the latest successful run on `main`, and download its artifact under **Artifacts**. Every push to `main` creates a new downloadable ZIP.
2. Extract the ZIP into your vault's `.obsidian/plugins/` directory. The result should be `.obsidian/plugins/paste-image-resize-compress-rename/main.js`, `manifest.json`, and `styles.css` in the same folder, alongside the bundled license notices. On Android, use the same path inside your Android vault.
3. Restart Obsidian, then enable **Paste Image Resize Compress Rename** under **Settings → Community plugins → Installed plugins**. This manually installed fork will not appear in the online **Browse** catalog.

When updating, replace `main.js`, `manifest.json`, and `styles.css` in that same plugin folder, then restart Obsidian. Keep `data.json` to preserve your settings. The **Installed plugin version** setting shows the version currently loaded. The fork has its own plugin ID, so it can coexist with the original plugin.

## Branches and versions

`main` contains the customized fork; `dev` serves as a reference to the original fork. See [CHANGELOG.md](CHANGELOG.md) for this fork's version history. The fork's versions start at `0.1.0` and are independent of the original plugin.
