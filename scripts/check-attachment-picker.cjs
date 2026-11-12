// Focused command-adapter checks; no running Obsidian vault is required.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

let shown = 0;
let selected = [];
class Menu {
  items = [];
  addItem(build) {
    const item = {
      setTitle() { return this; },
      setIcon(icon) {
        this.iconEl = { querySelector: selector => selector === `.${icon}` };
        return this;
      },
      onClick(callback) { this.callback = callback; return this; }
    };
    build(item);
    this.items.push(item);
    return this;
  }
  showAtPosition() { shown++; return this; }
}
const originalShow = Menu.prototype.showAtPosition;
const context = {
  exports: {},
  require: name => { assert.equal(name, 'obsidian'); return { Menu }; },
  MouseEvent: class {}
};
const source = fs.readFileSync('src/attachment-picker.ts', 'utf8');
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS }
}).outputText, context);
const { installDirectAttachmentPicker } = context.exports;

// Obsidian Android's native command builds Camera/Files synchronously.
// https://github.com/obsidianmd/obsidian-releases/releases/tag/v1.15.1
function nativeCommand(editor) {
  assert.equal(editor, 'editor');
  return new Menu()
    .addItem(item => item.setIcon('lucide-camera').onClick(() => selected.push('camera')))
    .addItem(item => item.setIcon('lucide-folder').onClick(() => {
      assert.equal(Menu.prototype.showAtPosition, originalShow);
      selected.push('files');
    }))
    .showAtPosition({ x: 0, y: 0 });
}
let enabled = false;
const command = { editorCallback: nativeCommand };
const app = { commands: { commands: { 'editor:attach-file': command } } };
const restore = installDirectAttachmentPicker(app, () => enabled);
command.editorCallback('editor');
assert.equal(shown, 1, 'default off preserves the menu');
assert.deepEqual(selected, []);
enabled = true;
command.editorCallback('editor');
assert.equal(shown, 1, 'enabled bypasses the menu');
assert.deepEqual(selected, ['files']);
assert.equal(Menu.prototype.showAtPosition, originalShow);
new Menu().showAtPosition({ x: 0, y: 0 });
assert.equal(shown, 2, 'other menus are unaffected');
restore();
assert.equal(command.editorCallback, nativeCommand);

for (const callback of [
  () => new Menu().addItem(item => item.setIcon('lucide-folder')).showAtPosition({ x: 0, y: 0 }),
  () => new Menu().showAtPosition({ x: 0, y: 0 })
]) {
  command.editorCallback = callback;
  const cleanup = installDirectAttachmentPicker(app, () => true);
  const before = shown;
  command.editorCallback();
  assert.equal(shown, before + 1, 'unknown menu layouts fall back normally');
  cleanup();
}
command.editorCallback = () => { throw new Error('native failure'); };
const cleanup = installDirectAttachmentPicker(app, () => true);
assert.throws(() => command.editorCallback(), /native failure/);
assert.equal(Menu.prototype.showAtPosition, originalShow, 'errors restore the menu method');
cleanup();
installDirectAttachmentPicker({}, () => true)();
console.log('Attachment picker defaults, bypass, fallback, isolation, unload, and error checks passed.');
