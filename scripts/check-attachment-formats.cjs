// Check the actual format classifiers without opening an Obsidian vault.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('src/main.ts', 'utf8');
const ast = ts.createSourceFile('main.ts', source, ts.ScriptTarget.Latest, true);
const declarations = ast.statements.filter(node =>
  (ts.isFunctionDeclaration(node) && ['isImage', 'canEncodeImage'].includes(node.name?.text)) ||
  (ts.isVariableStatement(node) && node.declarationList.declarations.some(d => d.name.getText(ast) === 'IMAGE_EXTS'))
).map(node => node.getText(ast)).join('\n');
const context = { TFile: class {} };
vm.runInNewContext('Array.prototype.contains = Array.prototype.includes;', context);
vm.runInNewContext(ts.transpileModule(declarations, {}).outputText, context);
const jpeg = ['png', 'jpg', 'jpeg', 'webp', 'bmp'];
const previewOnly = ['avif', 'gif', 'svg'];
const nonImages = ['pdf', 'flac', 'm4a', 'mp3', 'ogg', 'wav', 'webm', '3gp', 'mkv', 'mov', 'mp4', 'ogv', 'md', 'base', 'canvas', 'zip', ''];
for (const ext of [...jpeg, ...previewOnly, ...nonImages]) {
  for (const extension of [ext, ext.toUpperCase()]) {
    const file = Object.assign(new context.TFile(), { extension });
    assert.equal(context.isImage(file), !nonImages.includes(ext), `preview: ${extension}`);
    assert.equal(context.canEncodeImage(extension), jpeg.includes(ext), `JPEG: ${extension}`);
  }
}
console.log('Obsidian image, audio, video, PDF, document, and unknown format checks passed.');
