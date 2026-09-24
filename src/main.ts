/* TODOs:
 * - [x] check name existence when saving
 * - [x] imageNameKey in frontmatter
 * - [x] after renaming, cursor should be placed after the image file link
 * - [x] handle image insert from drag'n drop
 * - [ ] select text when opening the renaming modal, make this an option
 * - [ ] add button for use the current file name, imageNameKey, last input name,
 *       segments of last input name
 * - [x] batch rename all pasted images in a file
 * - [ ] add rules for moving matched images to destination folder
 */
import {
  App,
  HeadingCache,
  MarkdownView,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TAbstractFile,
  TFile,
} from 'obsidian';

import { ImageBatchRenameModal } from './batch';
import { renderTemplate } from './template';
import {
  createElementTree,
  DEBUG,
  debugLog,
  escapeRegExp,
  lockInputMethodComposition,
  NameObj,
  path,
  sanitizer,
} from './utils';

interface PluginSettings {
	// {{imageNameKey}}-{{DATE:YYYYMMDD}}
	imageNamePattern: string
	dupNumberAtStart: boolean
	dupNumberDelimiter: string
	dupNumberAlways: boolean
	autoRename: boolean
	handleAllAttachments: boolean
	excludeExtensionPattern: string
	disableRenameNotice: boolean
	defaultJpegConversion: boolean
	preserveTextByDefault: boolean
	defaultJpegQuality: number
}

const DEFAULT_SETTINGS: PluginSettings = {
	imageNamePattern: '{{fileName}}',
	dupNumberAtStart: false,
	dupNumberDelimiter: '-',
	dupNumberAlways: false,
	autoRename: false,
	handleAllAttachments: false,
	excludeExtensionPattern: '',
	disableRenameNotice: false,
	defaultJpegConversion: false,
	preserveTextByDefault: false,
	defaultJpegQuality: 92,
}

const PASTED_IMAGE_PREFIX = 'Pasted image '


export default class PasteImageRenamePlugin extends Plugin {
	settings: PluginSettings
	modals: Modal[] = []
	excludeExtensionRegex: RegExp

	async onload() {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const pkg = require('../package.json')
		console.log(`Plugin loading: ${pkg.name} ${pkg.version} BUILD_ENV=${process.env.BUILD_ENV}`)
		await this.loadSettings();

		this.registerEvent(
			this.app.vault.on('create', (file) => {
				// debugLog('file created', file)
				if (!(file instanceof TFile))
					return
				const timeGapMs = (new Date().getTime()) - file.stat.ctime
				// if the file is created more than 1 second ago, the event is most likely be fired on vault initialization when starting Obsidian app, ignore it
				if (timeGapMs > 1000)
					return
				// always ignore markdown file creation
				if (isMarkdownFile(file))
					return
				if (isPastedImage(file)) {
					debugLog('pasted image created', file)
					this.startRenameProcess(file, this.settings.autoRename)
				} else {
					if (this.settings.handleAllAttachments) {
						debugLog('handleAllAttachments for file', file)
						if (this.testExcludeExtension(file)) {
							debugLog('excluded file by ext', file)
							return
						}
						this.startRenameProcess(file, this.settings.autoRename)
					}
				}
			})
		)
		this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
			if (file instanceof TFile && ['jpg', 'jpeg', 'png', 'webp', 'bmp'].includes(file.extension.toLowerCase())) {
				menu.addItem(item => item.setTitle('Rename or convert image…').setIcon('image').onClick(() => {
					this.openRenameModal(file, file.basename, this.getActiveFile()?.path ?? file.path)
				}))
			}
		}))

		const startBatchRenameProcess = () => {
			this.openBatchRenameModal()
		}
		this.addCommand({
			id: 'batch-rename-embeded-files',
			name: 'Batch rename embeded files (in the current file)',
			callback: startBatchRenameProcess,
		})
		if (DEBUG) {
			this.addRibbonIcon('wand-glyph', 'Batch rename embeded files', startBatchRenameProcess)
		}

		const batchRenameAllImages = () => {
			this.batchRenameAllImages()
		}
		this.addCommand({
			id: 'batch-rename-all-images',
			name: 'Batch rename all images instantly (in the current file)',
			callback: batchRenameAllImages,
		})
		if (DEBUG) {
			this.addRibbonIcon('wand-glyph', 'Batch rename all images instantly (in the current file)', batchRenameAllImages)
		}

		// add settings tab
		this.addSettingTab(new SettingTab(this.app, this));

	}

	async startRenameProcess(file: TFile, autoRename = false) {
		// get active file first
		const activeFile = this.getActiveFile()
		if (!activeFile) {
			new Notice('Error: No active file found.')
			return
		}

		const { stem, newName, isMeaningful }= this.generateNewName(file, activeFile)
		debugLog('generated newName:', newName, isMeaningful)

		const showProcessingPreview = ['jpg', 'jpeg', 'png', 'webp', 'bmp'].includes(file.extension.toLowerCase())
			&& (this.settings.defaultJpegConversion || this.settings.preserveTextByDefault)
		if (!isMeaningful || !autoRename || showProcessingPreview) {
			this.openRenameModal(file, isMeaningful ? stem : '', activeFile.path)
			return
		}
		this.renameFile(file, newName, activeFile.path, true)
	}

	async saveProcessedImage(file: TFile, newName: string, sourcePath: string, processed?: ArrayBuffer) {
		if (!processed) {
			await this.renameFile(file, newName, sourcePath, true)
			return
		}
		const original = await this.app.vault.readBinary(file)
		const oldPath = file.path
		const oldLink = this.app.fileManager.generateMarkdownLink(file, sourcePath)
		// A fresh path prevents Obsidian from reusing cached pixels for the old image.
		const { name } = await this.deduplicateNewName(newName, file)
		const target = path.join(file.parent.path, name)
		try {
			// Write first so the first read of the new path sees processed pixels.
			await this.app.vault.modifyBinary(file, processed)
			await this.app.fileManager.renameFile(file, target)
		} catch (error) {
			try {
				if (file.path !== oldPath) await this.app.fileManager.renameFile(file, oldPath)
				await this.app.vault.modifyBinary(file, original)
			} catch (rollbackError) {
				new Notice(`Image save failed; could not restore the original: ${rollbackError}`)
			}
			throw error
		}
		const newLink = this.app.fileManager.generateMarkdownLink(file, sourcePath)
		const editor = this.getActiveEditor()
		if (editor && this.getActiveFile()?.path === sourcePath) {
			const cursor = editor.getCursor()
			const line = editor.getLine(cursor.line)
			if (line.includes(oldLink)) editor.setLine(cursor.line, line.replace(oldLink, newLink))
		}
		if (!this.settings.disableRenameNotice) new Notice(`Saved ${name}`)
	}

	async renameFile(file: TFile, inputNewName: string, sourcePath: string, replaceCurrentLine?: boolean) {
		if (inputNewName === file.name) return
		// deduplicate name
		const { name:newName } = await this.deduplicateNewName(inputNewName, file)
		debugLog('deduplicated newName:', newName)
		const originName = file.name

		// generate linkText using Obsidian API, linkText is either  ![](filename.png) or ![[filename.png]] according to the "Use [[Wikilinks]]" setting.
		const linkText = this.app.fileManager.generateMarkdownLink(file, sourcePath)

		// file system operation: rename the file
		const newPath = path.join(file.parent.path, newName)
		try {
			await this.app.fileManager.renameFile(file, newPath)
		} catch (err) {
			new Notice(`Failed to rename ${newName}: ${err}`)
			throw err
		}

		if (!replaceCurrentLine) {
			return
		}

		// in case fileManager.renameFile may not update the internal link in the active file,
		// we manually replace the current line by manipulating the editor

		const newLinkText = this.app.fileManager.generateMarkdownLink(file, sourcePath)
		debugLog('replace text', linkText, newLinkText)

		const editor = this.getActiveEditor()
		if (!editor) {
			new Notice(`Failed to rename ${newName}: no active editor`)
			return
		}

		const cursor = editor.getCursor()
		const line = editor.getLine(cursor.line)
		const replacedLine = line.replace(linkText, newLinkText)
		debugLog('current line -> replaced line', line, replacedLine)
		// console.log('editor context', cursor, )
		editor.transaction({
			changes: [
				{
					from: {...cursor, ch: 0},
					to: {...cursor, ch: line.length},
					text: replacedLine,
				}
			]
		})

		if (!this.settings.disableRenameNotice) {
			new Notice(`Renamed ${originName} to ${newName}`)
		}
	}

	openRenameModal(file: TFile, newName: string, sourcePath: string) {
		const modal = new ImageRenameModal(
			this.app, file as TFile, newName, this.settings,
			async (confirmedName: string, processed?: ArrayBuffer) => {
				await this.saveProcessedImage(file, confirmedName, sourcePath, processed)
			},
			() => {
				this.modals.splice(this.modals.indexOf(modal), 1)
			}
		)
		this.modals.push(modal)
		modal.open()
		debugLog('modals count', this.modals.length)
	}

	openBatchRenameModal() {
		const activeFile = this.getActiveFile()
		const modal = new ImageBatchRenameModal(
			this.app,
			activeFile,
			async (file: TFile, name: string) => {
				await this.renameFile(file, name, activeFile.path)
			},
			() => {
				this.modals.splice(this.modals.indexOf(modal), 1)
			}
		)
		this.modals.push(modal)
		modal.open()
	}

	async batchRenameAllImages() {
		const activeFile = this.getActiveFile()
		const fileCache = this.app.metadataCache.getFileCache(activeFile)
		if (!fileCache || !fileCache.embeds) return
		const extPatternRegex = /jpe?g|png|gif|tiff|webp/i

		for (const embed of fileCache.embeds) {
			const file = this.app.metadataCache.getFirstLinkpathDest(embed.link, activeFile.path)
			if (!file) {
				console.warn('file not found', embed.link)
				return
			}
			// match ext
			const m0 = extPatternRegex.exec(file.extension)
			if (!m0) return

			// rename
			const { newName, isMeaningful }= this.generateNewName(file, activeFile)
			debugLog('generated newName:', newName, isMeaningful)
			if (!isMeaningful) {
				new Notice('Failed to batch rename images: the generated name is not meaningful')
				break;
			}

			await this.renameFile(file, newName, activeFile.path, false)
		}
	}

	// returns a new name for the input file, with extension
	generateNewName(file: TFile, activeFile: TFile) {
		let imageNameKey = ''
		let firstHeading = ''
		let frontmatter
		const fileCache = this.app.metadataCache.getFileCache(activeFile)
		if (fileCache) {
			debugLog('frontmatter', fileCache.frontmatter)
			frontmatter = fileCache.frontmatter
			imageNameKey = frontmatter?.imageNameKey || ''
			firstHeading = getFirstHeading(fileCache.headings)
		} else {
			console.warn('could not get file cache from active file', activeFile.name)
		}

		const stem = renderTemplate(
			this.settings.imageNamePattern,
			{
				imageNameKey,
				fileName: activeFile.basename,
				dirName: activeFile.parent.name,
				firstHeading,
			},
			frontmatter)
		const meaninglessRegex = new RegExp(`[${this.settings.dupNumberDelimiter}\\s]`, 'gm')

		return {
			stem,
			newName: stem + '.' + file.extension,
			isMeaningful: stem.replace(meaninglessRegex, '') !== '',
		}
	}

	// newName: foo.ext
	async deduplicateNewName(newName: string, file: TFile): Promise<NameObj> {
		// list files in dir
		const dir = file.parent.path
		const listed = await this.app.vault.adapter.list(dir)
		debugLog('sibling files', listed)

		// parse newName
		const newNameExt = path.extension(newName),
			newNameStem = newName.slice(0, newName.length - newNameExt.length - 1),
			newNameStemEscaped = escapeRegExp(newNameStem),
			delimiter = this.settings.dupNumberDelimiter,
			delimiterEscaped = escapeRegExp(delimiter)

		let dupNameRegex
		if (this.settings.dupNumberAtStart) {
			dupNameRegex = new RegExp(
				`^(?<number>\\d+)${delimiterEscaped}(?<name>${newNameStemEscaped})\\.${newNameExt}$`)
		} else {
			dupNameRegex = new RegExp(
				`^(?<name>${newNameStemEscaped})${delimiterEscaped}(?<number>\\d+)\\.${newNameExt}$`)
		}
		debugLog('dupNameRegex', dupNameRegex)

		const dupNameNumbers: number[] = []
		let isNewNameExist = false
		for (let sibling of listed.files) {
			sibling = path.basename(sibling)
			if (sibling == newName) {
				isNewNameExist = true
				continue
			}

			// match dupNames
			const m = dupNameRegex.exec(sibling)
			if (!m) continue
			// parse int for m.groups.number
			dupNameNumbers.push(parseInt(m.groups.number))
		}

		if (isNewNameExist || this.settings.dupNumberAlways) {
			// get max number
			const newNumber = dupNameNumbers.length > 0 ? Math.max(...dupNameNumbers) + 1 : 1
			// change newName
			if (this.settings.dupNumberAtStart) {
				newName = `${newNumber}${delimiter}${newNameStem}.${newNameExt}`
			} else {
				newName = `${newNameStem}${delimiter}${newNumber}.${newNameExt}`
			}
		}

		return {
			name: newName,
			stem: newName.slice(0, newName.length - newNameExt.length - 1),
			extension: newNameExt,
		}
	}

	getActiveFile() {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView)
		const file = view?.file
		debugLog('active file', file?.path)
		return file
	}
	getActiveEditor() {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView)
		return view?.editor
	}

	onunload() {
		this.modals.map(modal => modal.close())
	}

	testExcludeExtension(file: TFile): boolean {
		const pattern = this.settings.excludeExtensionPattern
		if (!pattern) return false
		return new RegExp(pattern).test(file.extension)
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

function getFirstHeading(headings?: HeadingCache[]) {
	if (headings && headings.length > 0) {
		for (const heading of headings) {
			if (heading.level === 1) {
				return heading.heading
			}
		}
	}
	return ''
}

function isPastedImage(file: TAbstractFile): boolean {
	if (file instanceof TFile) {
		if (file.name.startsWith(PASTED_IMAGE_PREFIX)) {
			return true
		}
	}
	return false
}

function isMarkdownFile(file: TAbstractFile): boolean {
	if (file instanceof TFile) {
		if (file.extension === 'md') {
			return true
		}
	}
	return false
}

const IMAGE_EXTS = [
	'jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg',
]

function isImage(file: TAbstractFile): boolean {
	if (file instanceof TFile) {
		if (IMAGE_EXTS.contains(file.extension.toLowerCase())) {
			return true
		}
	}
	return false
}

class ImageRenameModal extends Modal {
	src: TFile
	stem: string
	settings: PluginSettings
	renameFunc: (path: string, processed?: ArrayBuffer) => Promise<void>
	onCloseExtra: () => void
	previewUrl?: string
	previewTimer?: number
	previewVersion = 0

	constructor(app: App, src: TFile, stem: string, settings: PluginSettings, renameFunc: (path: string, processed?: ArrayBuffer) => Promise<void>, onClose: () => void) {
		super(app);
		this.src = src
		this.stem = stem
		this.settings = settings
		this.renameFunc = renameFunc
		this.onCloseExtra = onClose
	}

	onOpen() {
		this.containerEl.addClass('image-rename-modal')
		const { contentEl, titleEl } = this;
		titleEl.setText('Rename image')

		const imageContainer = contentEl.createDiv({
			cls: 'image-container',
		})
		const previewImage = imageContainer.createEl('img', {
			attr: {
				src: this.app.vault.getResourcePath(this.src),
			}
		})

		let stem = this.stem
		const ext = this.src.extension
		const canEncode = ['jpg', 'jpeg', 'png', 'webp', 'bmp'].includes(ext.toLowerCase())
		type OutputFormat = 'original' | 'jpeg' | 'png'
		let outputFormat: OutputFormat = canEncode
			? this.settings.preserveTextByDefault ? 'png' : this.settings.defaultJpegConversion ? 'jpeg' : 'original'
			: 'original'
		let maxWidth = 0
		let quality = this.settings.defaultJpegQuality
		let processed: ArrayBuffer | undefined
		const getNewName = (stem: string) => stem + '.' + (outputFormat === 'jpeg' ? 'jpg' : outputFormat === 'png' ? 'png' : ext)
		const getNewPath = (stem: string) => {
			const name = getNewName(stem)
			return path.join(this.src.parent.path, name) + (outputFormat !== 'original' && name === this.src.name ? ' (number added on save to refresh image)' : '')
		}

		const infoET = createElementTree(contentEl, {
			tag: 'ul',
			cls: 'info',
			children: [
				{
					tag: 'li',
					children: [
						{
							tag: 'span',
							text: 'Origin path',
						},
						{
							tag: 'span',
							text: this.src.path,
						}
					],
				},
				{
					tag: 'li',
					children: [
						{
							tag: 'span',
							text: 'New path',
						},
						{
							tag: 'span',
							text: getNewPath(stem),
						}
					],
				}
			]
		})

		const errorEl = contentEl.createDiv({ cls: 'error' })
		errorEl.style.display = 'none'
		const previewInfo = contentEl.createDiv({ cls: 'image-preview-info' })
		let busy = false
		let saving = false
		const renderPreview = async () => {
			const version = ++this.previewVersion
			if (outputFormat === 'original') {
				processed = undefined
				if (this.previewUrl) URL.revokeObjectURL(this.previewUrl)
				this.previewUrl = undefined
				previewImage.src = this.app.vault.getResourcePath(this.src)
				previewInfo.setText('Original image; no image data will be changed.')
				busy = false
				return
			}
			busy = true
			processed = undefined
			previewInfo.setText('Preparing preview…')
			try {
				const data = await this.app.vault.readBinary(this.src)
				const sourceExt = ext.toLowerCase()
				const blob = new Blob([data], { type: `image/${sourceExt === 'jpg' ? 'jpeg' : sourceExt}` })
				const sourceUrl = URL.createObjectURL(blob)
				let source: HTMLImageElement
				try {
					source = await new Promise((resolve, reject) => {
						const img = new Image()
						img.onload = () => resolve(img)
						img.onerror = () => reject(new Error('Could not decode this image'))
						img.src = sourceUrl
					})
				} finally {
					URL.revokeObjectURL(sourceUrl)
				}
				if (version !== this.previewVersion) return
				const scale = Math.min(1, maxWidth ? maxWidth / source.naturalWidth : 1)
				const width = Math.max(1, Math.round(source.naturalWidth * scale))
				const height = Math.max(1, Math.round(source.naturalHeight * scale))
				const canvas = document.createElement('canvas')
				canvas.width = width
				canvas.height = height
				const context = canvas.getContext('2d')
				if (!context) throw new Error('Canvas is unavailable')
				context.imageSmoothingQuality = 'high'
				if (outputFormat === 'jpeg') {
					context.fillStyle = '#fff'
					context.fillRect(0, 0, width, height)
				}
				context.drawImage(source, 0, 0, width, height)
				const result = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
					blob => blob ? resolve(blob) : reject(new Error('Image encoding failed')),
					outputFormat === 'png' ? 'image/png' : 'image/jpeg', quality / 100))
				if (version !== this.previewVersion) return
				processed = await result.arrayBuffer()
				if (version !== this.previewVersion) return
				if (this.previewUrl) URL.revokeObjectURL(this.previewUrl)
				this.previewUrl = URL.createObjectURL(result)
				previewImage.src = this.previewUrl
				previewInfo.setText(`${source.naturalWidth} × ${source.naturalHeight} → ${width} × ${height} px · ${(result.size / 1024).toFixed(1)} KB ${outputFormat.toUpperCase()} (original ${(data.byteLength / 1024).toFixed(1)} KB)`)
				errorEl.style.display = 'none'
			} catch (error) {
				if (version === this.previewVersion) {
					errorEl.setText(`Preview failed: ${error}`)
					errorEl.style.display = 'block'
				}
			} finally {
				if (version === this.previewVersion) busy = false
			}
		}
		const schedulePreview = () => {
			if (this.previewTimer) window.clearTimeout(this.previewTimer)
			++this.previewVersion
			busy = true
			processed = undefined
			this.previewTimer = window.setTimeout(() => { void renderPreview() }, 250)
		}
		const doRename = async () => {
			if (saving) return
			if (!stem) {
				errorEl.setText('New name cannot be empty')
				errorEl.style.display = 'block'
				return
			}
			if (busy || (outputFormat !== 'original' && !processed)) {
				errorEl.setText('Wait for the image preview before saving')
				errorEl.style.display = 'block'
				return
			}
			saving = true
			try {
				await this.renameFunc(getNewName(stem), processed)
				this.close()
			} catch (error) {
				errorEl.setText(`Could not save image: ${error}`)
				errorEl.style.display = 'block'
			} finally {
				saving = false
			}
		}

		if (canEncode) {
			new Setting(contentEl).setName('Output format').setDesc('JPEG is smaller for photos; PNG preserves text and sharp edges without lossy compression.').addDropdown(dropdown => dropdown
				.addOption('original', 'Original (rename only)')
				.addOption('jpeg', 'JPEG (photos)')
				.addOption('png', 'PNG (text clarity)')
				.setValue(outputFormat)
				.onChange(value => {
				outputFormat = value as OutputFormat
				infoET.children[1].children[1].el.innerText = getNewPath(stem)
				schedulePreview()
			}))
			const parseLimit = (value: string) => /^\d+$/.test(value) ? Math.min(20000, Number(value)) : 0
			new Setting(contentEl).setName('Maximum width (px)').setDesc('0 keeps the original width. Aspect ratio is preserved; shrinking can make small text unreadable.').addText(text => text.setValue('0').onChange(value => {
				maxWidth = parseLimit(value)
				if (outputFormat !== 'original') schedulePreview()
			}))
			new Setting(contentEl).setName('JPEG quality').setDesc('Applies to JPEG only. PNG uses lossless compression.').addSlider(slider => slider.setLimits(1, 100, 1).setValue(quality).setDynamicTooltip().onChange(value => {
				quality = value
				if (outputFormat === 'jpeg') schedulePreview()
			}))
		}
		void renderPreview()

		const nameSetting = new Setting(contentEl)
			.setName('New name')
			.setDesc('Please input the new name for the image (without extension)')
			.addText(text => text
				.setValue(stem)
				.onChange(async (value) => {
					stem = sanitizer.filename(value)
					infoET.children[1].children[1].el.innerText = getNewPath(stem)
				}
				))

		const nameInputEl = nameSetting.controlEl.children[0] as HTMLInputElement
		nameInputEl.focus()
		const nameInputState = lockInputMethodComposition(nameInputEl)
		nameInputEl.addEventListener('keydown', async (e) => {
			// console.log('keydown', e.key, `lock=${nameInputState.lock}`)
			if (e.key === 'Enter' && !nameInputState.lock) {
				e.preventDefault()
				if (!stem) {
					errorEl.innerText = 'Error: "New name" could not be empty'
					errorEl.style.display = 'block'
					return
				}
				void doRename()
			}
		})

		new Setting(contentEl)
			.addButton(button => {
				button
					.setButtonText('Rename')
					.onClick(() => {
						void doRename()
					})
			})
			.addButton(button => {
				button
					.setButtonText('Cancel')
					.onClick(() => { this.close() })
			})
	}

	onClose() {
		++this.previewVersion
		if (this.previewTimer) window.clearTimeout(this.previewTimer)
		if (this.previewUrl) URL.revokeObjectURL(this.previewUrl)
		const { contentEl } = this;
		contentEl.empty();
		this.onCloseExtra()
	}
}

const imageNamePatternDesc = `
The pattern indicates how the new name should be generated.

Available variables:
- {{fileName}}: name of the active file, without ".md" extension.
- {{dirName}}: name of the directory which contains the document (the root directory of vault results in an empty variable).
- {{imageNameKey}}: this variable is read from the markdown file's frontmatter, from the same key "imageNameKey".
- {{DATE:$FORMAT}}: use "$FORMAT" to format the current date, "$FORMAT" must be a Moment.js format string, e.g. {{DATE:YYYY-MM-DD}}.

Here are some examples from pattern to image names (repeat in sequence), variables: fileName = "My note", imageNameKey = "foo":
- {{fileName}}: My note, My note-1, My note-2
- {{imageNameKey}}: foo, foo-1, foo-2
- {{imageNameKey}}-{{DATE:YYYYMMDD}}: foo-20220408, foo-20220408-1, foo-20220408-2
`

class SettingTab extends PluginSettingTab {
	plugin: PasteImageRenamePlugin;

	constructor(app: App, plugin: PasteImageRenamePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('h2', { text: 'Image processing defaults' })

		new Setting(containerEl)
			.setName('Convert to JPEG by default')
			.setDesc('Preselect JPEG for supported pasted images. The preview dialog still lets you change the format.')
			.addToggle(toggle => toggle.setValue(this.plugin.settings.defaultJpegConversion).onChange(async value => {
				this.plugin.settings.defaultJpegConversion = value
				await this.plugin.saveSettings()
			}))

		new Setting(containerEl)
			.setName('Preserve text by default')
			.setDesc('Preselect lossless PNG for screenshots, diagrams, and text. This takes priority over the JPEG default; choose JPEG in the dialog for photos.')
			.addToggle(toggle => toggle.setValue(this.plugin.settings.preserveTextByDefault).onChange(async value => {
				this.plugin.settings.preserveTextByDefault = value
				await this.plugin.saveSettings()
			}))

		new Setting(containerEl)
			.setName('Default JPEG quality')
			.setDesc('Applied when JPEG is selected. PNG preserves text without lossy compression.')
			.addSlider(slider => slider.setLimits(1, 100, 1).setValue(this.plugin.settings.defaultJpegQuality).setDynamicTooltip().onChange(async value => {
				this.plugin.settings.defaultJpegQuality = value
				await this.plugin.saveSettings()
			}))

		containerEl.createEl('h2', { text: 'Renaming' })

		new Setting(containerEl)
			.setName('Image name pattern')
			.setDesc(imageNamePatternDesc)
			.setClass('long-description-setting-item')
			.addText(text => text
				.setPlaceholder('{{imageNameKey}}')
				.setValue(this.plugin.settings.imageNamePattern)
				.onChange(async (value) => {
					this.plugin.settings.imageNamePattern = value;
					await this.plugin.saveSettings();
				}
			));

		new Setting(containerEl)
			.setName('Duplicate number at start (or end)')
			.setDesc(`If enabled, duplicate number will be added at the start as prefix for the image name, otherwise it will be added at the end as suffix for the image name.`)
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.dupNumberAtStart)
				.onChange(async (value) => {
					this.plugin.settings.dupNumberAtStart = value
					await this.plugin.saveSettings()
				}
				))

		new Setting(containerEl)
			.setName('Duplicate number delimiter')
			.setDesc(`The delimiter to generate the number prefix/suffix for duplicated names. For example, if the value is "-", the suffix will be like "-1", "-2", "-3", and the prefix will be like "1-", "2-", "3-". Only characters that are valid in file names are allowed.`)
			.addText(text => text
				.setValue(this.plugin.settings.dupNumberDelimiter)
				.onChange(async (value) => {
					this.plugin.settings.dupNumberDelimiter = sanitizer.delimiter(value);
					await this.plugin.saveSettings();
				}
			));

		new Setting(containerEl)
			.setName('Always add duplicate number')
			.setDesc(`If enabled, duplicate number will always be added to the image name. Otherwise, it will only be added when the name is duplicated.`)
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.dupNumberAlways)
				.onChange(async (value) => {
					this.plugin.settings.dupNumberAlways = value
					await this.plugin.saveSettings()
				}
				))

		new Setting(containerEl)
			.setName('Auto rename')
			.setDesc('Automatically rename when no image processing default is selected. JPEG and text clarity defaults still open the preview dialog for confirmation.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoRename)
				.onChange(async (value) => {
					this.plugin.settings.autoRename = value;
					await this.plugin.saveSettings();
				}
			));

		new Setting(containerEl)
			.setName('Handle all attachments')
			.setDesc(`By default, the plugin only handles images that starts with "Pasted image " in name,
			which is the prefix Obsidian uses to create images from pasted content.
			If this option is set, the plugin will handle all attachments that are created in the vault.`)
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.handleAllAttachments)
				.onChange(async (value) => {
					this.plugin.settings.handleAllAttachments = value;
					await this.plugin.saveSettings();
				}
			));

		new Setting(containerEl)
			.setName('Exclude extension pattern')
			.setDesc(`This option is only useful when "Handle all attachments" is enabled.
			Write a Regex pattern to exclude certain extensions from being handled. Only the first line will be used.`)
			.setClass('single-line-textarea')
			.addTextArea(text => text
				.setPlaceholder('docx?|xlsx?|pptx?|zip|rar')
				.setValue(this.plugin.settings.excludeExtensionPattern)
				.onChange(async (value) => {
					this.plugin.settings.excludeExtensionPattern = value;
					await this.plugin.saveSettings();
				}
			));

		new Setting(containerEl)
			.setName('Disable rename notice')
			.setDesc(`Turn off this option if you don't want to see the notice when renaming images.
			Note that Obsidian may display a notice when a link has changed, this option cannot disable that.`)
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.disableRenameNotice)
				.onChange(async (value) => {
					this.plugin.settings.disableRenameNotice = value;
					await this.plugin.saveSettings();
				}
			));
	}
}
