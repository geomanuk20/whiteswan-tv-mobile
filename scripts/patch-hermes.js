const fs = require('fs');
const path = require('path');

const webapisDir = path.join(__dirname, '..', 'node_modules', 'react-native', 'src', 'private', 'webapis');

function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach((f) => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else if (f.endsWith('.js')) {
      callback(dirPath);
    }
  });
}

let patchedCount = 0;

walkDir(webapisDir, (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('#')) {
    // Replace private field definitions and accesses: #field -> __field
    const patched = content.replace(/#([a-zA-Z0-9_]+)/g, '__$1');
    fs.writeFileSync(filePath, patched, 'utf8');
    patchedCount++;
    console.log(`Patched: ${path.relative(process.cwd(), filePath)}`);
  }
});

console.log(`Successfully patched ${patchedCount} files for Hermes compatibility.`);
