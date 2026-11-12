import { App, Command, Menu } from 'obsidian'

// Obsidian has no public hook for replacing the Android attachment source menu.
// Keep this adapter scoped to the native command and fall back if its menu changes.
export function installDirectAttachmentPicker(app: App, enabled: () => boolean): () => void {
	const commands = (app as App & { commands?: { commands?: Record<string, Command> } }).commands?.commands
	const command = commands?.['editor:attach-file']
	const original = command?.editorCallback
	if (!command || !original) return () => {}

	const wrapped: NonNullable<Command['editorCallback']> = function (...args) {
		if (!enabled()) return original.apply(this, args)
		const show = Menu.prototype.showAtPosition
		Menu.prototype.showAtPosition = function (...position) {
			// Restore before opening the native picker or running any other callbacks.
			Menu.prototype.showAtPosition = show
			const items = (this as Menu & { items?: Array<{
				iconEl?: HTMLElement
				callback?: (event: MouseEvent) => void
			}> }).items
			const files = items?.find(item => item.iconEl?.querySelector('.lucide-folder'))
			const camera = items?.find(item => item.iconEl?.querySelector('.lucide-camera'))
			if (items?.length === 2 && camera && typeof files?.callback === 'function') {
				files.callback(new MouseEvent('click'))
				return this
			}
			return show.apply(this, position)
		}
		try {
			return original.apply(this, args)
		} finally {
			Menu.prototype.showAtPosition = show
		}
	}
	command.editorCallback = wrapped
	return () => {
		if (command.editorCallback === wrapped) command.editorCallback = original
	}
}
