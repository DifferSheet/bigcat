// เมนู «อัลบั้ม» ในหน้าจัดการ — รวมทุกงาน: อัปโหลด · คัดรูป · เผยแพร่ · คิวสแกน · ทบทวนใบหน้า · คำขอเอารูปออก
import { Router } from 'express';
import { q, one, parseJSON } from '../db.js';
import { wrap, HttpError, getEvent, MASCOTS, mascotOf } from '../lib.js';
import { uploadMedia } from '../upload.js';
import { importPhoto, deletePhoto, kick as kickAlbumScan, faceCrop, matchPhoto, albumPublished, GROUP_MIN_FACES } from '../album.js';
import { facesEnabled, faceProvider, MATCH_THRESHOLD } from '../faces.js';
import { withUrls, usingS3 } from '../storage.js';
import { requireAdmin, applyPassportFiles } from './admin.js';

const r = Router();
r.use(requireAdmin);   // ทุกเส้นทางในไฟล์นี้ต้องล็อกอินแอดมิน
const setCfg = async (ev, patch) => {
  const cfg = { ...ev.config, album: { ...(ev.config.album || {}), ...patch } };
  await q('UPDATE events SET config=? WHERE id=?', [JSON.stringify(cfg), ev.id]);
  return cfg.album;
};

/* ---------- ภาพรวมทุกอัลบั้ม ---------- */
r.get('/albums', wrap(async (_req, res) => {
  const rows = await q(`SELECT e.id, e.slug, e.title, e.type, e.status, e.starts_at, e.cover, e.config,
      COUNT(p.id) AS photos, SUM(p.scan='pending') AS pending, SUM(p.scan='failed') AS failed, SUM(p.scan='done') AS scanned, SUM(p.featured) AS featured, SUM(p.bytes) AS bytes,
      (SELECT COUNT(DISTINCT f.user_id) FROM photo_faces f JOIN event_photos x ON x.id=f.photo_id WHERE x.event_id=e.id AND f.user_id IS NOT NULL AND f.status<>'rejected') AS members,
      (SELECT COUNT(*) FROM photo_removals rm JOIN event_photos x ON x.id=rm.photo_id WHERE x.event_id=e.id AND rm.status='open') AS removals,
      (SELECT p2.thumb FROM event_photos p2 WHERE p2.event_id=e.id ORDER BY p2.featured DESC, p2.sort_order LIMIT 1) AS preview
    FROM events e LEFT JOIN event_photos p ON p.event_id=e.id
    GROUP BY e.id ORDER BY e.starts_at DESC`);
  const albums = rows.map(({ config, ...a }) => ({ ...a, photos: Number(a.photos), published: albumPublished(parseJSON(config, {})) }));
  res.json({
    albums: await withUrls(albums, ['preview']),
    facesEnabled, provider: faceProvider, threshold: MATCH_THRESHOLD, storage: usingS3 ? 's3' : 'disk',
    totals: { photos: albums.reduce((n, a) => n + a.photos, 0), bytes: albums.reduce((n, a) => n + Number(a.bytes || 0), 0), pending: albums.reduce((n, a) => n + Number(a.pending || 0), 0), removals: albums.reduce((n, a) => n + Number(a.removals || 0), 0) },
  });
}));

/* ---------- อัลบั้มของงานเดียว ---------- */
r.get('/albums/:slug', wrap(async (req, res) => {
  const ev = await getEvent(req.params.slug);
  const photos = await q(`SELECT p.*, (SELECT COUNT(*) FROM photo_faces f WHERE f.photo_id=p.id AND f.user_id IS NOT NULL AND f.status<>'rejected') AS matched,
      (SELECT GROUP_CONCAT(u.display_name SEPARATOR ' · ') FROM photo_faces f JOIN users u ON u.id=f.user_id WHERE f.photo_id=p.id AND f.status<>'rejected') AS matched_names,
      (SELECT COUNT(*) FROM photo_faces f WHERE f.photo_id=p.id AND f.user_id IS NULL AND f.status<>'rejected') AS unknown
    FROM event_photos p WHERE p.event_id=? ORDER BY p.sort_order, p.id`, [ev.id]);
  const removals = await q(`SELECT rm.id, rm.photo_id, rm.reason, rm.status, rm.created_at, u.display_name FROM photo_removals rm JOIN users u ON u.id=rm.user_id JOIN event_photos p ON p.id=rm.photo_id WHERE p.event_id=? AND rm.status='open' ORDER BY rm.created_at DESC`, [ev.id]);
  const groupPhotoId = ev.config.memory?.groupImage ? (photos.find(p => p.view === ev.config.memory.groupImage)?.id || null) : null;   // หา id ก่อนเซ็น URL
  res.json({
    event: { slug: ev.slug, title: ev.title, type: ev.type, status: ev.status, starts_at: ev.starts_at, published: albumPublished(ev.config), groupPhotoId, layout: ev.config.memory?.layout || 'auto', mascot: mascotOf(ev), mascotName: MASCOTS[mascotOf(ev)], memory: ev.config.memory || {} },
    photos: await withUrls(photos), removals, facesEnabled, provider: faceProvider, threshold: MATCH_THRESHOLD, groupMinFaces: GROUP_MIN_FACES, storage: usingS3 ? 's3' : 'disk',
  });
}));

r.post('/albums/:slug/publish', wrap(async (req, res) => {
  const ev = await getEvent(req.params.slug);
  res.json(await setCfg(ev, { published: !!req.body?.published }));
}));

// อัปโหลดชุดละไม่เกิน 20 ไฟล์ (client แบ่งชุดเอง) — ไฟล์ซ้ำถูกข้าม · อัลบั้มใหม่เริ่มที่ «ยังไม่เผยแพร่»
r.post('/albums/:slug/photos', uploadMedia.array('photos', 20), wrap(async (req, res) => {
  const ev = await getEvent(req.params.slug);
  const had = (await one('SELECT COUNT(*) AS n FROM event_photos WHERE event_id=?', [ev.id])).n;
  if (!had && ev.config.album?.published === undefined) await setCfg(ev, { published: false });
  let added = 0, duplicate = 0;
  for (const f of req.files || []) {
    if (!f.mimetype.startsWith('image/')) continue;
    const out = await importPhoto(ev.id, f.path, { remove: true });
    out.duplicate ? duplicate++ : added++;
  }
  res.json({ ok: true, added, duplicate });
}));

// คำสั่งกับหลายรูปพร้อมกัน
r.post('/albums/:slug/bulk', wrap(async (req, res) => {
  const ev = await getEvent(req.params.slug);
  const ids = (req.body?.ids || []).map(Number).filter(Boolean);
  const action = String(req.body?.action || '');
  if (action === 'group-auto') { const r2 = await q('UPDATE event_photos SET group_ok=1 WHERE event_id=? AND faces>=?', [ev.id, GROUP_MIN_FACES]); return res.json({ ok: true, count: r2.affectedRows, threshold: GROUP_MIN_FACES }); }
  if (!ids.length) throw new HttpError(400, 'ยังไม่ได้เลือกรูป');
  const mine = (await q('SELECT id FROM event_photos WHERE event_id=? AND id IN (?)', [ev.id, ids])).map(p => p.id);
  if (!mine.length) throw new HttpError(404, 'ไม่พบรูปที่เลือก');
  if (action === 'feature' || action === 'unfeature') await q('UPDATE event_photos SET featured=? WHERE id IN (?)', [action === 'feature' ? 1 : 0, mine]);
  else if (action === 'group') await q('UPDATE event_photos SET group_ok=1 WHERE id IN (?)', [mine]);
  else if (action === 'ungroup') await q('UPDATE event_photos SET group_ok=0 WHERE id IN (?)', [mine]);
  else if (action === 'mascot' || action === 'unmascot') await q('UPDATE event_photos SET mascot_ok=? WHERE id IN (?)', [action === 'mascot' ? 1 : 0, mine]);
  else if (action === 'rescan') { await q("UPDATE event_photos SET scan='pending' WHERE id IN (?)", [mine]); kickAlbumScan(); }
  else if (action === 'delete') { for (const id of mine) await deletePhoto(id); }
  else throw new HttpError(400, 'คำสั่งไม่ถูกต้อง');
  res.json({ ok: true, count: mine.length });
}));

// เทมเพลตการวางภาพในสมุด passport ของงานนี้
const LAYOUTS = ['auto', 'warm', 'playful', 'special', 'merit'];
// สมุดความทรงจำของงาน (รูป/ข้อความในหน้า passport) — ย้ายมาจากฟอร์มแก้ไขงาน แด๊ดสั่ง 19 ก.ย. 2026
const memoryUpload = uploadMedia.fields([{ name: 'memoryNote', maxCount: 1 }, { name: 'memoryGroup', maxCount: 1 }]);
r.post('/albums/:slug/memory', memoryUpload, wrap(async (req, res) => {
  const ev = await getEvent(req.params.slug);
  let memory;
  try { memory = JSON.parse(req.body?.memory || '{}'); } catch { throw new HttpError(400, 'ข้อมูลสมุดไม่ถูกต้อง'); }
  const cfg = { ...ev.config, memory };
  applyPassportFiles(cfg, req.files);   // ใช้กติกาเดียวกับฟอร์มงาน (ตัดความยาว · รับเฉพาะไฟล์ภาพ)
  await q('UPDATE events SET config=? WHERE id=?', [JSON.stringify(cfg), ev.id]);
  res.json({ ok: true, memory: cfg.memory });
}));

// เลือกว่าตัวเอกของงานนี้คือใคร
r.post('/albums/:slug/mascot', wrap(async (req, res) => {
  const ev = await getEvent(req.params.slug);
  const key = String(req.body?.mascot || '');
  if (!MASCOTS[key]) throw new HttpError(400, 'ไม่รู้จักตัวละครนี้');
  const cfg = { ...ev.config, album: { ...(ev.config.album || {}), mascot: key } };
  await q('UPDATE events SET config=? WHERE id=?', [JSON.stringify(cfg), ev.id]);
  res.json({ ok: true, mascot: key, mascotName: MASCOTS[key] });
}));

r.post('/albums/:slug/layout', wrap(async (req, res) => {
  const ev = await getEvent(req.params.slug);
  const layout = LAYOUTS.includes(req.body?.layout) ? req.body.layout : 'auto';
  const cfg = { ...ev.config, memory: { ...(ev.config.memory || {}), layout } };
  await q('UPDATE events SET config=? WHERE id=?', [JSON.stringify(cfg), ev.id]);
  res.json({ ok: true, layout });
}));

// ตั้ง/ยกเลิก «รูปหมู่ของงาน» ที่ไปโชว์ในสมุด passport ของทุกคนที่ได้แสตมป์งานนี้ (สมาชิกเปลี่ยนเป็นรูปอื่นในสมุดตัวเองได้)
r.post('/albums/:slug/group-photo', wrap(async (req, res) => {
  const ev = await getEvent(req.params.slug);
  const id = Number(req.body?.id) || 0;
  if (!id) { const cfg = { ...ev.config, memory: { ...(ev.config.memory || {}) } }; delete cfg.memory.groupImage; await q('UPDATE events SET config=? WHERE id=?', [JSON.stringify(cfg), ev.id]); return res.json({ ok: true, groupImage: null }); }
  const p = await one('SELECT id, view FROM event_photos WHERE id=? AND event_id=?', [id, ev.id]);
  if (!p) throw new HttpError(404, 'ไม่พบรูปนี้ในอัลบั้มของงาน');
  const cfg = { ...ev.config, memory: { ...(ev.config.memory || {}), groupImage: p.view } };
  await q('UPDATE events SET config=? WHERE id=?', [JSON.stringify(cfg), ev.id]);
  res.json({ ok: true, groupImage: p.view, photoId: p.id });
}));

/* ---------- ทบทวนใบหน้า ---------- */
// ใบหน้าที่ยังไม่รู้ว่าใคร (หรือทั้งหมด) ในอัลบั้มของงานนี้ + รายชื่อสมาชิกที่เช็คอินงานนี้ให้เลือกผูก
r.get('/albums/:slug/faces', wrap(async (req, res) => {
  const ev = await getEvent(req.params.slug);
  const state = req.query.state === 'all' ? '' : "AND f.user_id IS NULL AND f.status<>'rejected'";
  const faces = await q(`SELECT f.id, f.photo_id, f.score, f.similarity, f.status, f.user_id, u.display_name, p.faces
    FROM photo_faces f JOIN event_photos p ON p.id=f.photo_id LEFT JOIN users u ON u.id=f.user_id
    WHERE p.event_id=? ${state} ORDER BY p.sort_order, f.id LIMIT 300`, [ev.id]);
  // ผูกได้เฉพาะสมาชิกที่เช็คอินงานนี้ (ตามที่ตกลงเรื่องความเป็นส่วนตัว)
  const members = await q(`SELECT DISTINCT u.id, u.display_name, u.avatar FROM users u
    WHERE u.id IN (SELECT user_id FROM registrations WHERE event_id=? AND user_id IS NOT NULL AND checked_in_at IS NOT NULL
                   UNION SELECT user_id FROM bookings WHERE event_id=? AND user_id IS NOT NULL AND status='checked_in') ORDER BY u.display_name`, [ev.id, ev.id]);
  res.json({ faces, members });
}));
r.get('/album/faces/:id/crop', wrap(async (req, res) => {
  const buf = await faceCrop(Number(req.params.id));
  if (!buf) throw new HttpError(404, 'ไม่พบใบหน้านี้');
  res.set('Content-Type', 'image/webp').set('Cache-Control', 'private, max-age=600').send(buf);
}));
// ผูก/ปลด/ทำเครื่องหมายว่าไม่ใช่คน — เจ้าตัวยังกด «ไม่ใช่ฉัน» ถอนได้เสมอ
r.post('/album/faces/:id/assign', wrap(async (req, res) => {
  const f = await one('SELECT f.id, p.event_id FROM photo_faces f JOIN event_photos p ON p.id=f.photo_id WHERE f.id=?', [Number(req.params.id)]);
  if (!f) throw new HttpError(404, 'ไม่พบใบหน้านี้');
  const userId = req.body?.userId ? Number(req.body.userId) : null;
  if (req.body?.notPerson) { await q("UPDATE photo_faces SET status='rejected', user_id=NULL, similarity=NULL WHERE id=?", [f.id]); return res.json({ ok: true }); }
  if (!userId) { await q("UPDATE photo_faces SET user_id=NULL, similarity=NULL, status='auto' WHERE id=?", [f.id]); return res.json({ ok: true }); }
  const ok = await one(`SELECT 1 AS ok FROM users u WHERE u.id=? AND (u.id IN (SELECT user_id FROM registrations WHERE event_id=? AND checked_in_at IS NOT NULL) OR u.id IN (SELECT user_id FROM bookings WHERE event_id=? AND status='checked_in'))`, [userId, f.event_id, f.event_id]);
  if (!ok) throw new HttpError(400, 'ผูกได้เฉพาะสมาชิกที่เช็คอินงานนี้');
  await q("UPDATE photo_faces SET user_id=?, similarity=NULL, status='confirmed' WHERE id=?", [userId, f.id]);
  res.json({ ok: true });
}));

/* ---------- คำขอเอารูปออก (ทุกงาน) ---------- */
r.get('/album/removals', wrap(async (_req, res) => {
  const rows = await q(`SELECT rm.id, rm.reason, rm.status, rm.created_at, u.display_name, e.slug, e.title, p.id AS photo_id, p.thumb
    FROM photo_removals rm JOIN users u ON u.id=rm.user_id JOIN event_photos p ON p.id=rm.photo_id JOIN events e ON e.id=p.event_id
    WHERE rm.status='open' ORDER BY rm.created_at`);
  res.json(await withUrls(rows, ['thumb']));
}));

export default r;
