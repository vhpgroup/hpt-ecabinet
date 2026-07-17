// ============================================================
// Build KHÔNG cần npm/vite: dùng binary esbuild tải từ CDN.
// Kết quả tương đương `npm run build`: dist/index.html (single-file)
// + các tệp public (favicon, manifest, sw.js).
// Chạy: node scripts/build-cdn.mjs
// ============================================================
import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ESBUILD_VER = '0.21.5';
const BIN = join('scripts', '.esbuild');

// 1) Tải binary esbuild nếu chưa có
if (!existsSync(BIN)) {
  const arch = process.arch === 'arm64' ? 'linux-arm64' : 'linux-x64';
  const url = `https://cdn.jsdelivr.net/npm/@esbuild/${arch}@${ESBUILD_VER}/bin/esbuild`;
  console.log('↓ esbuild binary:', url);
  const r = await fetch(url);
  if (!r.ok) throw new Error('Không tải được esbuild: ' + r.status);
  writeFileSync(BIN, Buffer.from(await r.arrayBuffer()));
  chmodSync(BIN, 0o755);
}

// 2) Đồng bộ seed dùng chung cho server (1 nguồn dữ liệu mẫu duy nhất)
//    --bundle: gộp mọi phụ thuộc runtime của seed.ts vào 1 tệp (vd sha256Hex dùng
//    tính sẵn keyHash khóa API demu) -> seed.mjs TỰ CHỨA, không import ngoài server/.
execFileSync(BIN, ['src/data/seed.ts', '--bundle', '--format=esm', '--outfile=server/src/seed.mjs', '--log-level=warning'], { stdio: 'inherit' });
console.log('✔ Đồng bộ server/src/seed.mjs');

// 3) Bundle ứng dụng (đặt VITE_API_URL=/api để build bản chạy với máy chủ)
mkdirSync('dist/assets', { recursive: true });
const defines = [`--define:process.env.NODE_ENV="production"`];
if (process.env.VITE_API_URL) {
  defines.push(`--define:import.meta.env.VITE_API_URL='"${process.env.VITE_API_URL}"'`);
  console.log('→ Chế độ máy chủ:', process.env.VITE_API_URL);
}
execFileSync(BIN, [
  'src/main.tsx',
  '--bundle',
  '--outfile=dist/assets/main.js',
  '--minify',
  '--format=iife',
  '--target=es2018',
  '--jsx=automatic',
  ...defines,
  '--loader:.css=css',
  '--log-level=warning',
], { stdio: 'inherit' });
console.log('✔ Bundle xong');

// 3) Ghép thành index.html single-file (như vite-plugin-singlefile)
const js = readFileSync('dist/assets/main.js', 'utf8');
const css = existsSync('dist/assets/main.css') ? readFileSync('dist/assets/main.css', 'utf8') : '';
let html = readFileSync('index.html', 'utf8');
html = html.replace('<script type="module" src="/src/main.tsx"></script>', '');
html = html.replace('</head>', `<style>${css}</style>\n</head>`);
html = html.replace('</body>', `<script>${js.replace(/<\/script>/g, '<\\/script>')}</script>\n</body>`);
writeFileSync('dist/index.html', html);

// 4) Copy tài nguyên public
for (const f of ['favicon.svg', 'manifest.webmanifest', 'sw.js', 'icon-192.png', 'icon-512.png']) {
  const src = join('public', f);
  if (existsSync(src)) copyFileSync(src, join('dist', f));
}
console.log('✔ dist/index.html sẵn sàng');
