// Packs the built app (dist/) into a zip that installed phone apps download as a live update.
// Writes dist-update/bundle-<version>.zip and dist-update/latest.json; the server serves them at /updates/.
// The version is a hash of the files, so it changes only when the app's screens actually change.
// Run after `vite build` (see the Dockerfile). No dependencies: Node's zlib makes the zip.
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';

const SOURCE = 'dist';
const OUT = 'dist-update';

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else files.push(path);
  }
})(SOURCE);
if (!files.some((f) => relative(SOURCE, f) === 'index.html')) throw new Error('dist/index.html missing: run vite build first');

const hash = createHash('sha256');
const entries = files.map((path) => {
  const name = relative(SOURCE, path).split(sep).join('/');
  const data = readFileSync(path);
  hash.update(name).update(data);
  return { name: Buffer.from(name), data, packed: deflateRawSync(data), crc: crc32(data) };
});
const version = hash.digest('hex').slice(0, 12);

// A plain zip: local headers + data, then the central directory (no timestamps, so the same files give the same zip)
const parts = [];
const central = [];
let offset = 0;
for (const e of entries) {
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4); // version needed
  local.writeUInt16LE(0x0800, 6); // UTF-8 names
  local.writeUInt16LE(8, 8); // deflate
  local.writeUInt32LE(0x00210000, 10); // 1 Jan 1980
  local.writeUInt32LE(e.crc, 14);
  local.writeUInt32LE(e.packed.length, 18);
  local.writeUInt32LE(e.data.length, 22);
  local.writeUInt16LE(e.name.length, 26);
  parts.push(local, e.name, e.packed);

  const dirEntry = Buffer.alloc(46);
  dirEntry.writeUInt32LE(0x02014b50, 0);
  dirEntry.writeUInt16LE(20, 4);
  dirEntry.writeUInt16LE(20, 6);
  dirEntry.writeUInt16LE(0x0800, 8);
  dirEntry.writeUInt16LE(8, 10);
  dirEntry.writeUInt32LE(0x00210000, 12);
  dirEntry.writeUInt32LE(e.crc, 16);
  dirEntry.writeUInt32LE(e.packed.length, 20);
  dirEntry.writeUInt32LE(e.data.length, 24);
  dirEntry.writeUInt16LE(e.name.length, 28);
  dirEntry.writeUInt32LE(offset, 42);
  central.push(dirEntry, e.name);
  offset += local.length + e.name.length + e.packed.length;
}
const centralSize = central.reduce((n, b) => n + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(entries.length, 8);
end.writeUInt16LE(entries.length, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(offset, 16);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const file = `bundle-${version}.zip`;
const zip = Buffer.concat([...parts, ...central, end]);
writeFileSync(join(OUT, file), zip);
// The app checks the downloaded zip against this SHA-256 before using it
const checksum = createHash('sha256').update(zip).digest('hex');
writeFileSync(join(OUT, 'latest.json'), JSON.stringify({ version, file, checksum, builtAt: new Date().toISOString() }) + '\n');
console.log(`Live update ${version}: ${entries.length} files, ${(zip.length / 1024).toFixed(0)} KB`);
