// พาธภาพที่แปลงชนิดไฟล์ (PNG → WebP/JPG เพื่อลดขนาด) — แก้ที่อ้างในฐานข้อมูล · รันซ้ำได้
//   node server/migrate-images-15sep.js   (prod: bash tools/prod-migrate.sh migrate-images-15sep.js)
import { q, pool } from './db.js';
const MAP = [
  ['/images/bigcat-hero.png', '/images/bigcat-hero.jpg'],
  ['/images/bigcat-merch.png', '/images/bigcat-merch.jpg'],
  ['/images/merit-vassa-2026.png', '/images/merit-vassa-2026.webp'],
  ['/images/cozy/hero.png', '/images/cozy/hero.webp'],
];
for (const [from, to] of MAP) {
  const e = await q('UPDATE events SET cover=REPLACE(cover, ?, ?), config=REPLACE(config, ?, ?) WHERE cover LIKE ? OR config LIKE ?', [from, to, from, to, `%${from}%`, `%${from}%`]);
  const p = await q('UPDATE products SET image=REPLACE(image, ?, ?), images=REPLACE(images, ?, ?) WHERE image LIKE ? OR images LIKE ?', [from, to, from, to, `%${from}%`, `%${from}%`]);
  const v = await q('UPDATE product_variants SET image=REPLACE(image, ?, ?) WHERE image LIKE ?', [from, to, `%${from}%`]);
  const o = await q('UPDATE order_items SET image=REPLACE(image, ?, ?) WHERE image LIKE ?', [from, to, `%${from}%`]);
  console.log(`✓ ${from} → ${to}: events ${e.affectedRows} · products ${p.affectedRows} · variants ${v.affectedRows} · order_items ${o.affectedRows}`);
}
await pool.end();
