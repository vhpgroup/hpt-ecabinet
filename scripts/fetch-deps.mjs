// ============================================================
// Tải các gói runtime từ CDN unpkg (dùng khi không truy cập được
// registry.npmjs.org — vd mạng nội bộ). Chỉ tải gói cần cho build.
// Chạy: node scripts/fetch-deps.mjs
// ============================================================
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const PKGS = [
  ['react', '18.3.1'],
  ['react-dom', '18.3.1'],
  ['scheduler', '0.23.2'],
  ['react-router-dom', '6.26.2'],
  ['react-router', '6.26.2'],
  ['@remix-run/router', '1.19.2'],
];

const SKIP = [/^\/umd\//, /\.map$/, /^\/profiling/, /server/i, /test-utils/i];

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

async function downloadPkg(name, version) {
  // unpkg ?meta trả về mảng phẳng: [{ path, size, type: <mime> }, ...]
  const meta = await fetchJson(`https://unpkg.com/${name}@${version}/?meta`);
  const files = (meta.files ?? []).map((f) => f.path).filter((p) => !SKIP.some((rx) => rx.test(p)));
  console.log(`↓ ${name}@${version} — ${files.length} tệp`);
  const base = join('node_modules', name);
  for (const p of files) {
    const r = await fetch(`https://unpkg.com/${name}@${version}${p}`);
    if (!r.ok) { console.warn(`  bỏ qua ${p} (${r.status})`); continue; }
    const buf = Buffer.from(await r.arrayBuffer());
    const dest = join(base, p);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, buf);
  }
}

for (const [name, version] of PKGS) {
  await downloadPkg(name, version);
}
console.log('✔ Hoàn tất tải dependencies');
