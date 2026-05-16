const fs = require('node:fs');
const path = require('node:path');

const KEEP_LOCALES = new Set(['en-US.pak', 'zh-CN.pak']);

const OPTIONAL_RUNTIME_FILES = ['resources/default_app.asar'];

function removeIfExists(targetPath) {
  fs.rmSync(targetPath, { force: true, recursive: true });
}

module.exports = async function afterPack(context) {
  const appOutDir = context.appOutDir;

  const localesDir = path.join(appOutDir, 'locales');
  if (fs.existsSync(localesDir)) {
    for (const fileName of fs.readdirSync(localesDir)) {
      if (fileName.endsWith('.pak') && !KEEP_LOCALES.has(fileName)) {
        removeIfExists(path.join(localesDir, fileName));
      }
    }
  }

  for (const relativePath of OPTIONAL_RUNTIME_FILES) {
    removeIfExists(path.join(appOutDir, relativePath));
  }
};
