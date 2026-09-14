// แก้ข้อความในฐานข้อมูลตามใบสั่งทีม marketing รอบ 1 (15 ก.ย. 2026) — รันซ้ำได้ ไม่พังถ้าแก้ไปแล้ว
//   node server/migrate-copy-15sep.js            (บน EC2: cd /var/www/bigcat && sudo -u deploy -H node server/migrate-copy-15sep.js)
// สิ่งที่ทำ: ตัดคำ «ทีมงาน» · สะกดแบรนด์ BIGCAT · งาน 26 ก.ย. แก้พิมพ์ผิด + FAQ ใหม่ · งานทำบุญ 19 ก.ย. ข้อความใหม่
import { q, one, pool } from './db.js';

const BRAND = (s) => (s == null ? s : String(s).replace(/\bBigCat\b|\bBigcat\b/g, 'BIGCAT'));

async function updateEvent(slug, fn) {
  const ev = await one('SELECT id, title, subtitle, description, config FROM events WHERE slug=?', [slug]);
  if (!ev) { console.log(`- ${slug}: ไม่มีในฐานข้อมูล (ข้าม)`); return; }
  const cfg = typeof ev.config === 'string' ? JSON.parse(ev.config || '{}') : (ev.config || {});
  const next = fn({ title: ev.title, subtitle: ev.subtitle, description: ev.description, config: cfg });
  await q('UPDATE events SET title=?, subtitle=?, description=?, config=? WHERE id=?', [next.title, next.subtitle, next.description, JSON.stringify(next.config), ev.id]);
  console.log(`✓ ${slug}`);
}

// ---------- งาน 26 ก.ย. ----------
await updateEvent('nobi-busking-26sep-2026', (e) => {
  e.description = e.description.replace('โมยังเป็นโนคนเดิมนะคะ แต่ซ้อมมาให้ฟังเยอะกว่าเดิม', 'โนยังเป็นโนคนเดิมนะคะ แต่ซ้อมมาให้ฟังเยอะกว่าเดิม');
  const faq = (e.config.faq || []).filter(([qq]) => !['ไปยังไง', 'มากี่โมงดี', 'ถ่ายคลิปได้ไหม'].includes(qq));
  // ⚠️ «ประมาณ 10 นาที» และ «มีที่จอด» รอยืนยันจากคนสำรวจพื้นที่ 13 ก.ย. — ถ้าไม่ตรงแก้ตัวเลข ไม่ต้องแก้โครงประโยค
  const how = ['ไปยังไง', 'BTS ห้าแยกลาดพร้าว ทางออก 4 ลงบันไดแล้วเดินตามถนนพหลโยธินไปทางตลาดเลียบด่วนแดนเนรมิต ประมาณ 10 นาที (มีทางเท้าตลอด) พอเข้าตลาดให้มองหาปราสาทแดนเนรมิต — โนยืนร้องอยู่หน้าปราสาทค่ะ · ขับรถมา: ตลาดมีที่จอด · กดชื่อสถานที่ด้านบนเพื่อเปิดแผนที่'];
  const when = ['มากี่โมงดี', 'เริ่ม 19:00 ตรง ถ้าอยากได้แถวหน้ามาก่อน 18:30 นะคะ ร้องสดต่อเนื่องถึง 21:00'];
  const clip = ['ถ่ายคลิปได้ไหม', 'ได้เลย ถ่ายแล้วติด #น้องโนบิ #ด้อมบิ๊กแคท โนจะเข้าไปดูทุกคลิป และคลิปที่ถ่ายโนได้สวยที่สุดของคืนนั้น โนจะอัดเสียงเรียกชื่อเจ้าของคลิปให้เอง'];
  // วาง «ไปยังไง» ไว้ตำแหน่งเดิม (หลังค่าเข้า) แล้วต่อท้ายด้วย 2 ข้อใหม่
  const i = faq.findIndex(([qq]) => qq === 'ต้องเสียค่าเข้าไหม');
  faq.splice(i >= 0 ? i + 1 : 0, 0, how);
  e.config.faq = [...faq, when, clip];
  return e;
});

// ---------- งานทำบุญ 19 ก.ย. ----------
await updateEvent('merit-vassa-2026', (e) => {
  e.description = e.description.replace('แจ้งยอดพร้อมสลิป ทีมงานตรวจสอบแล้วยอดจะขึ้นบนหน้านี้ทันที', 'แจ้งยอดพร้อมสลิป พี่ ๆ ที่ดูแลบูตะตรวจสอบแล้ว ยอดจะขึ้นบนหน้านี้ทันที');
  e.config.faq = (e.config.faq || []).map(([qq, a]) => [qq, a.replace('ถ้าไม่ผ่านทีมงานตรวจภายใน 24 ชั่วโมง', 'ถ้าไม่ผ่าน พี่ ๆ ที่ดูแลจะตรวจให้ภายใน 24 ชั่วโมง')]);
  if (e.config.report?.accountNote) e.config.report.accountNote = e.config.report.accountNote.replace('บัญชีของทีม Bigcat', 'บัญชีของ BIGCAT');
  e.config.schedule = (e.config.schedule || []).map(([t, s]) => [t, s.replace('Talk กับทีมโนบิ', 'Talk กับโนบิ')]);
  return e;
});

// ---------- สะกดแบรนด์ + ตัด «ทีมงาน» ทุกงาน/สินค้า ----------
for (const ev of await q('SELECT id, slug, title, subtitle, description, config FROM events')) {
  const cfg = typeof ev.config === 'string' ? ev.config : JSON.stringify(ev.config || {});
  const next = { title: BRAND(ev.title), subtitle: BRAND(ev.subtitle), description: BRAND(ev.description)?.replace(/ทีมงาน/g, 'พี่ ๆ ที่ดูแล'), config: BRAND(cfg).replace(/ทีมงาน/g, 'พี่ ๆ ที่ดูแล') };
  if (next.title !== ev.title || next.subtitle !== ev.subtitle || next.description !== ev.description || next.config !== cfg) {
    await q('UPDATE events SET title=?, subtitle=?, description=?, config=? WHERE id=?', [next.title, next.subtitle, next.description, next.config, ev.id]);
    console.log(`✓ brand/ทีมงาน: ${ev.slug}`);
  }
}
for (const p of await q('SELECT id, slug, name, name_th, description FROM products')) {
  const next = { name: BRAND(p.name), name_th: BRAND(p.name_th), description: BRAND(p.description) };
  if (next.name !== p.name || next.name_th !== p.name_th || next.description !== p.description) {
    await q('UPDATE products SET name=?, name_th=?, description=? WHERE id=?', [next.name, next.name_th, next.description, p.id]);
    console.log(`✓ brand: product ${p.slug}`);
  }
}
// (BINARY เพราะ collation ไม่แยกตัวพิมพ์ · «NobiBigcat» เป็นชื่อเฉพาะ/แฮนเดิล ไม่นับ)
const left = await q("SELECT slug FROM events WHERE description LIKE '%ทีมงาน%' OR config LIKE '%ทีมงาน%' OR REPLACE(CONCAT(title, description), 'NobiBigcat', '') LIKE BINARY '%Bigcat%'");
console.log(left.length ? `!! ยังเหลือ: ${left.map(r => r.slug).join(', ')}` : 'เสร็จ — ไม่เหลือ «ทีมงาน» / «Bigcat» ในตาราง events');
await pool.end();
