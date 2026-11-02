import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');
const files = ['index.html', 'styles.css', 'app.js', 'audio.js', 'sculpture.js', 'assets/favicon.svg', 'assets/social.svg'];
await mkdir(path.join(output, 'assets'), { recursive: true });
let bytes = 0;
for (const file of files) {
  await copyFile(path.join(root, file), path.join(output, file));
  bytes += (await stat(path.join(output, file))).size;
}
await writeFile(path.join(output, '.nojekyll'), '');
console.log('Built ' + files.length + ' static files (' + (bytes / 1024).toFixed(1) + ' KiB) into ' + output);
console.log('No runtime packages, API keys, external assets, or build dependencies.');
