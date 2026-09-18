// เปิดตัว Passport (16 ก.ย. 2026) — ใส่ลายแสตมป์ที่วาดไว้ให้ 2 งานจริง + ติ๊ก Day One ให้งานทำบุญ 19 ก.ย. (งานแรกหลังเปิดตัว)
// รันซ้ำได้ · ไม่ทับลายที่แอดมินอัปโหลดเองภายหลัง · แสตมป์ของสมาชิกที่เช็คอิน/ร่วมบุญไปแล้วจะถูกให้ย้อนหลังตอน API start (backfill)
//   node server/migrate-passport-16sep.js   (prod: bash tools/prod-migrate.sh migrate-passport-16sep.js — หรือ deploy รันให้)
import { q, one, pool } from './db.js';
import { syncAllStamps } from './passport.js';

const set = async (slug, patch) => {
  const ev = await one('SELECT id, config FROM events WHERE slug=?', [slug]);
  if (!ev) { console.log(`- ${slug}: ไม่มีในฐานข้อมูล (ข้าม)`); return; }
  const cfg = typeof ev.config === 'string' ? JSON.parse(ev.config || '{}') : (ev.config || {});
  let changed = false;
  if (patch.stamp && !cfg.stamp?.image?.startsWith('/uploads/')) { cfg.stamp = { image: patch.stamp }; changed = true; }
  if (patch.dayOne && !cfg.dayOne) { cfg.dayOne = true; changed = true; }
  if (changed) await q('UPDATE events SET config=? WHERE id=?', [JSON.stringify(cfg), ev.id]);
  console.log(`${changed ? '✓' : '·'} ${slug}${patch.dayOne ? ' (Day One)' : ''}`);
};
await set('merit-vassa-2026', { stamp: '/images/stamps/event-merit-19sep.webp', dayOne: true });
await set('nobi-busking-26sep-2026', { stamp: '/images/stamps/event-busking-26sep.webp' });
console.log(`✓ sync แสตมป์ให้สมาชิก ${await syncAllStamps()} คน`);
await pool.end();
