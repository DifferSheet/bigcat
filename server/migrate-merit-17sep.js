// อัปเดตงานทำบุญน้องบูตะ (merit-vassa-2026) ตามรายการบุญที่ทีมส่งมา 15 ก.ย. 2026 — รันซ้ำได้
//   node server/migrate-merit-17sep.js                    แก้ config/FAQ + หมวดบุญ (ถ้ามียอดร่วมบุญอยู่แล้วจะไม่ลบหมวดเก่า แค่เพิ่ม/แก้)
//   node server/migrate-merit-17sep.js --reset-donations  ล้างยอดร่วมบุญเดิม (ใช้เมื่อยอดเดิมเป็นข้อมูลตัวอย่าง/ทดสอบเท่านั้น)
import { q, one, pool } from './db.js';

const reset = process.argv.includes('--reset-donations');
const ev = await one("SELECT id, config FROM events WHERE slug='merit-vassa-2026'");
if (!ev) { console.log('ไม่พบงาน merit-vassa-2026'); process.exit(1); }
const cfg = typeof ev.config === 'string' ? JSON.parse(ev.config || '{}') : (ev.config || {});

// ปิดยอดบุญ พฤหัส 17 ก.ย. 69 เวลา 24.00 น.
cfg.donateUntil = '2026-09-17 23:59:59';
cfg.faq = (cfg.faq || []).map(([qq, a]) => [qq, a.replace('ปิดรับยอดออนไลน์ 18 ก.ย. 20:00 น.', 'ปิดรับยอดออนไลน์ พฤหัส 17 ก.ย. เที่ยงคืน')]);
cfg.report = { ...(cfg.report || {}),
  excessPolicy: 'หากหมวดไหนได้ยอดเกินมา บูตะจะให้พี่ ๆ ที่ดูแลนำไปทำบุญต่อยอดให้หม่าม้าปะป๊าที่ จ.นครพนม และประเทศลาว ในเดือน ต.ค. นี้ — ห่มผ้าพระธาตุพนม · ผ้าไตรจีวรฝั่งไทย/ลาว · สังฆทาน · อาสนะ — และแสดงหลักฐานไว้ในหน้านี้' };
await q('UPDATE events SET config=? WHERE id=?', [JSON.stringify(cfg), ev.id]);
console.log('✓ config: ปิดยอด 17 ก.ย. 23:59 · FAQ · นโยบายยอดเกิน');

// รายการบุญ: [ชื่อ, คำอธิบาย, เป้า(บาท), หน่วย, บาท/หน่วย] — เป้า 0 = ตามศรัทธา (ไม่มีแถบ %)
const CATS = [
  ['ข้าวสาร + น้ำดื่ม', 'ข้าวสาร 39 ถุง และน้ำดื่ม 39 แพ็ค ถวายวัด (1 ชุด = ข้าวสาร 1 ถุง + น้ำดื่ม 1 แพ็ค)', 6669, 'ชุด', 171],
  ['พระปางมารวิชัย 8.5 นิ้ว', 'ร่วมบุญสร้างพระพุทธรูปปางมารวิชัย ขนาด 8.5 นิ้ว ถวายวัด', 926, null, null],
  ['ร่มกันแดด/ฝน', 'ร่มสำหรับพระสงฆ์ใช้กันแดดกันฝน', 1089, null, null],
  ['อาสนะ', 'อาสนะสำหรับพระสงฆ์ ร่วมได้ตามศรัทธา', 0, null, null],
  ['กฐิน', 'ร่วมบุญกฐิน ร่วมได้ตามศรัทธา', 0, null, null],
  ['ผ้าไตร', 'ผ้าไตรจีวรถวายพระสงฆ์ สมทบเพิ่มเติมได้ตามศรัทธา', 0, null, null],
];
const existing = await q('SELECT id, name FROM donation_categories WHERE event_id=?', [ev.id]);
const [{ n: donationCount }] = await q('SELECT COUNT(*) AS n FROM donations WHERE event_id=?', [ev.id]);
if (reset) {
  await q('DELETE FROM donations WHERE event_id=?', [ev.id]);
  await q('DELETE FROM donation_categories WHERE event_id=?', [ev.id]);
  console.log(`✓ ล้างยอดเดิม ${donationCount} รายการ และหมวดเดิม ${existing.length} หมวด`);
} else if (donationCount > 0) {
  console.log(`! มียอดร่วมบุญอยู่ ${donationCount} รายการ — จะไม่ลบหมวดเก่า (${existing.map(e => e.name).join(', ')}) ถ้าเป็นข้อมูลทดสอบให้รันด้วย --reset-donations`);
}
const now = await q('SELECT id, name FROM donation_categories WHERE event_id=?', [ev.id]);
for (const [i, [name, description, goal, unit_name, unit_price]] of CATS.entries()) {
  const row = { name, description, goal, unit_name, unit_price, sort: i };
  const cur = now.find(c => c.name === name);
  if (cur) await q('UPDATE donation_categories SET ? WHERE id=?', [row, cur.id]);
  else await q('INSERT INTO donation_categories SET ?', [{ ...row, event_id: ev.id }]);
}
// หมวดเก่าที่ไม่อยู่ในรายการใหม่: ย้ายไปท้ายลิสต์ (ลบไม่ได้ถ้ามียอด)
for (const c of now) if (!CATS.some(([name]) => name === c.name)) {
  const [{ n }] = await q('SELECT COUNT(*) AS n FROM donations WHERE category_id=?', [c.id]);
  if (n === 0) { await q('DELETE FROM donation_categories WHERE id=?', [c.id]); console.log(`  ลบหมวดเก่าที่ไม่มียอด: ${c.name}`); }
  else await q('UPDATE donation_categories SET sort=? WHERE id=?', [90, c.id]);
}
const list = await q('SELECT name, goal, unit_name, unit_price FROM donation_categories WHERE event_id=? ORDER BY sort', [ev.id]);
console.log('✓ หมวดบุญตอนนี้:'); for (const c of list) console.log(`   - ${c.name} · เป้า ${c.goal || 'ตามศรัทธา'}${c.unit_price ? ` · ${c.unit_name}ละ ${c.unit_price}` : ''}`);
await pool.end();
