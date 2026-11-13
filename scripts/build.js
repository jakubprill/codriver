// Buduje jeden plik wykonywalny z serwerem i całym interfejsem w środku.
//
//   bun scripts/build.js                           -> dist/codriver      (system, na którym budujesz)
//   bun scripts/build.js --target=bun-windows-x64  -> dist/codriver.exe
//
// Pliki z public/ są dołączane przez wygenerowany moduł src/assets.gen.js
// (import ... with { type: 'file' }), który serwer czyta zamiast dysku.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dir, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const target = process.argv.find((a) => a.startsWith('--target='))?.split('=')[1];
const windows = target ? target.includes('windows') : process.platform === 'win32';
const outfile = path.join(root, 'dist', windows ? 'codriver.exe' : 'codriver');

// 1. lista plików interfejsu
const publicDir = path.join(root, 'public');
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else files.push(p);
  }
})(publicDir);

// 2. moduł z osadzonymi plikami
const genPath = path.join(root, 'src', 'assets.gen.js');
const lines = ['// Wygenerowane przez scripts/build.js – nie edytuj, nie commituj.'];
const entries = [];
files.forEach((f, i) => {
  const rel = '/' + path.relative(publicDir, f).split(path.sep).join('/');
  const imp = path.relative(path.dirname(genPath), f).split(path.sep).join('/');
  lines.push(`import a${i} from '${imp.startsWith('.') ? imp : './' + imp}' with { type: 'file' };`);
  entries.push(`  ${JSON.stringify(rel)}: a${i},`);
});
lines.push('export default {', ...entries, '};', '');
fs.writeFileSync(genPath, lines.join('\n'));

// 3. kompilacja
fs.mkdirSync(path.dirname(outfile), { recursive: true });
try {
  const result = await Bun.build({
    entrypoints: [path.join(root, 'src', 'main.js')],
    compile: target ? { target, outfile } : { outfile },
    define: { CODRIVER_VERSION: JSON.stringify(pkg.version) },
    minify: true,
  });
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    process.exit(1);
  }
  const size = (fs.statSync(outfile).size / 1e6).toFixed(0);
  console.log(`codriver ${pkg.version}: ${path.relative(root, outfile)} (${size} MB, ${files.length} plików interfejsu w środku)`);
} finally {
  fs.rmSync(genPath, { force: true });
}
