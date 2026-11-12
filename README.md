# Paste Image Resize Compress Rename

An Obsidian fork of [Paste image rename](https://github.com/reorx/obsidian-paste-image-rename) that adds image conversion and preview before saving. The original plugin's attachment renaming features are still available; see the [original README](https://github.com/reorx/obsidian-paste-image-rename#readme) for their full documentation.

## What this fork adds

- **Direct attachment picker on Android:** Enable **Open Files directly on Android** in plugin settings to skip the Camera/Files menu in Obsidian’s existing **Insert attachment** command (command palette or mobile toolbar). Off by default; Windows and other platforms keep their normal behavior. The system file picker and Obsidian’s normal attachment import and renaming flow are retained. This uses a guarded adapter for Obsidian’s internal Android menu; if a future update changes the menu, it falls back to showing the normal menu.

- **JPEG conversion:** Keep the original image or convert supported JPG, PNG, WebP, and BMP images to JPEG. Selecting Original (rename only) shows the original resolution and file size while hiding JPEG processing controls and processing details. AVIF, GIF, and SVG images keep their original format and can be previewed. PDFs, audio, video, and other non-image attachments show only Original (rename only) and their file size; image preview, zoom, position, and processing controls are hidden. The image format list follows [Obsidian’s accepted file formats](https://obsidian.md/help/file-formats).
- **Maximum width:** Use the pixel slider, starting at the original width on the right, and slide left toward 0 to shrink. The left number shows the selected width; the right number stays fixed at the original maximum width; 0 uses a 1-pixel minimum so the output remains a valid image. Height follows the original aspect ratio, with a 1-pixel minimum. Images are never enlarged. Large reductions are resized in stages from the decoded original before JPEG compression; the preview warns when a small width may make text hard to read.
- **Quality control:** Adjust JPEG quality before saving. Standard JPEG encoding uses progressive encoding, optimized coding, and 4:2:0 color sampling, with a default quality of 85 for new installations.
- **Text clarity mode:** For screenshots, diagrams, and images containing text, use JPEG with 4:4:4 color sampling and a starting quality of at least 95. This may increase file size; shrinking text too far can still make it unreadable.
- **Preview before saving:** Compare original and output file sizes side by side, see the amount saved or added, and check whether the result is under your optional size target. Use the draggable red focus box on the full image and the adjustable zoom window beside it to inspect lettering; the preview adapts to screen height and can be resized with the handle below it. Each app-window size remembers its preview height. The image and zoom panel stay side by side, including in Android split screen; the resize handle also supports smaller heights. Extreme proportions stop shrinking when the shorter edge reaches 120 pixels (without enlarging the source), then use position sliders to view the cropped preview. The zoom controls stay inside the dialog. The dialog also shows output dimensions. Cancel to leave the image unchanged.
- **Process existing images:** Right-click an image in Obsidian's file explorer and select **Rename or convert image…**.
- **Processing defaults:** In plugin settings, optionally select JPEG conversion, text clarity, a starting JPEG quality, and an image size target (for example, `100 KB` or `2 MB`). The target starts at `100 KB`; leave it blank or set it to `0` to hide the target status without hiding the size comparison. Sizes use 1,024 bytes per KB and 1,024 KB per MB. A processing default still opens the preview dialog, including when Auto rename is enabled.
- **Fresh image display:** When processing would otherwise reuse the same image path, the plugin assigns a numbered filename so Obsidian shows the updated image instead of cached pixels.

JPEG conversion replaces transparency with white. The text clarity option remains lossy JPEG; re-encoding cannot recover detail that was already lost. This fork bundles its JPEG encoder for offline use on Android as well as desktop.

## Install this fork

1. Open the [Build Obsidian plugin ZIP workflow](https://github.com/dragonMaster1748/obsidian-paste-image-resize-compress-rename/actions/workflows/build-zip.yml), select the latest successful run on `main`, and download its artifact under **Artifacts**. Every push to `main` creates a new downloadable ZIP.
2. Extract the ZIP into your vault's `.obsidian/plugins/` directory. The result should be `.obsidian/plugins/paste-image-resize-compress-rename/main.js`, `manifest.json`, and `styles.css` in the same folder, alongside the bundled license notices. On Android, use the same path inside your Android vault.
3. Restart Obsidian, then enable **Paste Image Resize Compress Rename** under **Settings → Community plugins → Installed plugins**. This manually installed fork will not appear in the online **Browse** catalog.

When updating, replace `main.js`, `manifest.json`, and `styles.css` in that same plugin folder, then restart Obsidian. Keep `data.json` to preserve your settings. The **Installed plugin version** setting shows the version currently loaded. The fork has its own plugin ID, so it can coexist with the original plugin.

## Branches and versions

`main` contains the customized fork; `dev` serves as a reference to the original fork. See [CHANGELOG.md](CHANGELOG.md) for this fork's version history. The fork's versions start at `0.1.0` and are independent of the original plugin.

### Preview opacity

Under Settings → Community plugins → Paste Image Resize Compress Rename, set **Preview opacity** from 0% (hidden) to 100% (fully opaque, default). This preference is saved and applied whenever you open an image dialog. It affects only the locked preview section, including its background and zoom preview. At 0%, the invisible section cannot intercept clicks or keyboard focus; its layout space is retained. Exported images and compression settings are unaffected.
