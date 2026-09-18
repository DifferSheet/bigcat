// ย้ายรูปอัลบั้มที่อยู่บนดิสก์ขึ้น S3 (รันเมื่อเปิดใช้ MEDIA_BUCKET) — รันซ้ำได้ ข้ามรูปที่ขึ้นไปแล้ว
//   node server/migrate-album-s3.js [--dry] [--keep]     (--keep = ไม่ลบไฟล์บนดิสก์หลังอัป)
// ตรวจก่อนรัน: ต้องมี MEDIA_BUCKET + สิทธิ์ (IAM role บน EC2 หรือ AWS_ACCESS_KEY_* ในเครื่อง)
import fs from 'node:fs';
import path from 'node:path';
import { q, pool } from './db.js';
import * as store from './storage.js';

if (!store.usingS3) { console.log('!! ยังไม่ได้ตั้ง MEDIA_BUCKET — ไม่มีอะไรให้ย้าย'); process.exit(1); }
const dry = process.argv.includes('--dry'), keep = process.argv.includes('--keep');
const UPLOADS = path.join(process.cwd(), 'server', 'uploads');
const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

const rows = await q("SELECT id, orig, view, thumb FROM event_photos WHERE orig LIKE '/uploads/%' OR view LIKE '/uploads/%' OR thumb LIKE '/uploads/%'");
console.log(`→ รูปที่ยังอยู่บนดิสก์: ${rows.length}`);
let moved = 0, missing = 0;
for (const r of rows) {
  const next = {};
  for (const field of ['orig', 'view', 'thumb']) {
    const cur = r[field];
    if (!cur?.startsWith('/uploads/')) continue;
    const file = path.join(UPLOADS, cur.replace(/^\/uploads\//, ''));
    if (!fs.existsSync(file)) { missing++; continue; }
    if (dry) { next[field] = `s3:${cur.replace(/^\/uploads\//, '')}`; continue; }
    next[field] = await store.put(cur.replace(/^\/uploads\//, ''), file, TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream');
    if (!keep) fs.rm(file, { force: true }, () => {});
  }
  if (!Object.keys(next).length) continue;
  if (!dry) await q('UPDATE event_photos SET ? WHERE id=?', [next, r.id]);
  moved++;
  if (moved % 25 === 0) console.log(`  ${moved}/${rows.length}`);
}
console.log(`${dry ? '(dry) ' : ''}✓ ย้าย ${moved} รูป${missing ? ` · หาไฟล์ไม่เจอ ${missing} ไฟล์ (ข้าม)` : ''}`);
await pool.end();
