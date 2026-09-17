// นำเข้าอัลบั้มจากโฟลเดอร์บนเครื่อง (ใช้ตอน dev/ทดสอบ หรือแอดมินส่งโฟลเดอร์มาให้รันบน EC2)
//   node server/import-album.js <slug> "<โฟลเดอร์>" [--limit N] [--wait]
// ไฟล์ต้นทางไม่ถูกลบ · รูปเข้าคิวสแกนหน้าอัตโนมัติ (--wait = รอสแกนจนครบแล้วค่อยจบ)
import fs from 'node:fs';
import path from 'node:path';
import { one, q, pool } from './db.js';
import { importPhoto, kick } from './album.js';

const [slug, dir, ...rest] = process.argv.slice(2);
if (!slug || !dir) { console.log('ใช้: node server/import-album.js <slug> "<โฟลเดอร์>" [--limit N] [--wait]'); process.exit(1); }
const limit = rest.includes('--limit') ? Number(rest[rest.indexOf('--limit') + 1]) : Infinity;
const ev = await one('SELECT id, title FROM events WHERE slug=?', [slug]);
if (!ev) { console.log('ไม่พบงาน', slug); process.exit(1); }
const files = fs.readdirSync(dir).filter(f => /\.(jpe?g|png|webp|heic)$/i.test(f)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).slice(0, limit);
console.log(`→ ${ev.title}: นำเข้า ${files.length} รูป`);
let n = 0;
for (const f of files) { await importPhoto(ev.id, path.join(dir, f)); if (++n % 20 === 0) console.log(`  ${n}/${files.length}`); }
console.log(`✓ นำเข้า ${n} รูป · กำลังสแกนหน้าหลังบ้าน`);
if (rest.includes('--wait')) {
  kick();
  for (;;) { const { p } = await one("SELECT COUNT(*) AS p FROM event_photos WHERE event_id=? AND scan='pending'", [ev.id]); if (!p) break; process.stdout.write(`\r  รอสแกน เหลือ ${p}   `); await new Promise(r => setTimeout(r, 2000)); }
  const st = await q('SELECT scan, COUNT(*) AS n FROM event_photos WHERE event_id=? GROUP BY scan', [ev.id]);
  console.log('\n', st.map(s => `${s.scan}: ${s.n}`).join(' · '));
}
await pool.end();
