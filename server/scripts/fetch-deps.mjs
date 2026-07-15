// ============================================================
// Tải đệ quy dependencies từ CDN unpkg (khi không truy cập được
// registry.npmjs.org). unpkg tự phân giải semver qua redirect.
// Chạy: node scripts/fetch-deps.mjs   (trong thư mục server/)
// ============================================================
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const ROOTS = [
  ['@electric-sql/pglite', '^0.2.0'],
  ['pg', '^8.12.0'],
];

const SKIP = [/\.map$/, /\/test\//, /\/docs?\//, /\.md$/i, /\.ts$/, /\/esm-dev\//];
const done = new Set();

async function resolveVersion(name, range) {
  const res = await fetch(`https://unpkg.com/${name}@${encodeURIComponent(range)}/package.json`);
  if (!res.ok) throw new Error(`Không phân giải được ${name}@${range} (${res.status})`);
  const pkg = await res.json();
  return { version: pkg.version, deps: pkg.dependencies ?? {} };
}

async function downloadPkg(name, version) {
  const key = `${name}@${version}`;
  if (done.has(key)) return;
  done.add(key);
  const metaRes = await fetch(`https://unpkg.com/${key}/?meta`);
  if (!metaRes.ok) { console.warn(`  bỏ qua ${key} (meta ${metaRes.status})`); return; }
  const meta = await metaRes.json();
  const files = (meta.files ?? []).map((f) => f.path).filter((p) => !SKIP.some((rx) => rx.test(p)));
  console.log(`↓ ${key} — ${files.length} tệp`);
  const base = join('node_modules', name);
  for (const p of files) {
    const r = await fetch(`https://unpkg.com/${key}${p}`);
    if (!r.ok) continue;
    const buf = Buffer.from(await r.arrayBuffer());
    const dest = join(base, p);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, buf);
  }
}

async function install(name, range) {
  const { version, deps } = await resolveVersion(name, range);
  await downloadPkg(name, version);
  for (const [depName, depRange] of Object.entries(deps)) {
    await install(depName, depRange);
  }
}

for (const [name, range] of ROOTS) {
  try {
    await install(name, range);
  } catch (e) {
    console.warn(`⚠ ${name}: ${e.message} (bỏ qua — chỉ cần khi dùng nhánh tương ứng)`);
  }
}
console.log('✔ Hoàn tất tải dependencies server');
