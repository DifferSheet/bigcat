// แปลงคำอธิบายสินค้าที่เป็นข้อความธรรมดาให้เป็น HTML (รันครั้งเดียว ปลอดภัยถ้ารันซ้ำ)
// ใช้: node server/migrate-descriptions.js
import { pool, q } from './db.js';
import { cleanHtml, textToHtml, looksLikeHtml } from './richtext.js';

const rows = await q('SELECT id, name, description FROM products WHERE description IS NOT NULL AND description <> ""');
let changed = 0;
for (const r of rows) {
  if (looksLikeHtml(r.description)) continue;           // แปลงไปแล้ว
  const html = cleanHtml(textToHtml(r.description));
  if (!html) continue;
  await q('UPDATE products SET description=? WHERE id=?', [html, r.id]);
  changed++;
  console.log(`✓ ${r.name.slice(0, 55)}`);
}
console.log(`\nแปลงแล้ว ${changed} จาก ${rows.length} รายการ`);
await pool.end();
