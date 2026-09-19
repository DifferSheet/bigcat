// อัลบั้มรูปงาน (ฝั่งสมาชิก) + ใบหน้าของฉัน (opt-in)
//   GET  /events/:slug/album                  เช็คอินแล้ว → ทั้งอัลบั้ม + ธง mine · ไม่ได้เช็คอิน → พรีวิว 3 รูป
//   POST /events/:slug/album/:id/not-me       «นี่ไม่ใช่ฉัน» ปลดการจับคู่ (ยืนยันคู่ = confirm)
//   POST /events/:slug/album/:id/remove       ขอเอารูปออก (แอดมินพิจารณา)
//   GET  /me/face · POST /me/face (multipart selfie + consent) · DELETE /me/face
import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { q, one, parseJSON } from '../db.js';
import { wrap, HttpError, getEvent, MASCOTS, mascotOf } from '../lib.js';
import { requireUser } from '../auth.js';
import { upload } from '../upload.js';
import { canViewAlbum, photosOfUser, registerUserFace, forgetUserFaces, albumPublished } from '../album.js';
import { facesEnabled, faceProvider } from '../faces.js';
import { withUrls, localCopy, url as mediaUrl } from '../storage.js';

const { ZipArchive } = createRequire(import.meta.url)('archiver');   // archiver รุ่นนี้ส่งออกคลาส ไม่ใช่ฟังก์ชัน default

const r = Router();
const PREVIEW = 3;

// แบ่งหน้าแบบ keyset (sort_order, id) — อัลบั้มใหญ่ ๆ ไม่ต้องส่งทั้งก้อน แด๊ดสั่ง 19 ก.ย. 2026
//   ?tab=all|me|group|mascot  ?cursor=<sort_order>.<id>  ?limit=
// ลิงก์ไฟล์ต้นฉบับไม่ส่งมาในลิสต์แล้ว (presigned URL ก้อนใหญ่) — ขอทีละใบที่ /album/:id/orig ตอนเปิดรูปเต็ม
const PAGE = 60;
const TABS = { all: '', me: '', group: 'AND p.group_ok=1', mascot: 'AND p.mascot_ok=1' };

r.get('/events/:slug/album', wrap(async (req, res) => {
  const ev = await getEvent(req.params.slug);
  const total = (await one('SELECT COUNT(*) AS n FROM event_photos WHERE event_id=?', [ev.id])).n;
  // อัลบั้มที่ยังไม่เผยแพร่ = ทีมกำลังคัดรูป ยังไม่มีใครเห็น (แม้แต่คนที่เช็คอิน)
  if (!albumPublished(ev.config)) return res.set('Cache-Control', 'private, no-store').json({ total: 0, access: 'unpublished', photos: [], me: null, facesEnabled, provider: faceProvider });
  const full = await canViewAlbum(req.user, ev.id);
  const base = { total, access: full ? 'full' : 'preview', facesEnabled, provider: faceProvider };
  if (!full) {
    const preview = await q('SELECT id, thumb, width, height FROM event_photos WHERE event_id=? ORDER BY featured DESC, sort_order LIMIT ?', [ev.id, PREVIEW]);
    return res.set('Cache-Control', 'private, no-store').json({ ...base, photos: await withUrls(preview, ['thumb']), me: null });
  }
  const tab = Object.hasOwn(TABS, req.query.tab) ? req.query.tab : 'all';
  const limit = Math.min(120, Math.max(1, Number(req.query.limit) || PAGE));
  const mineRows = req.user ? await photosOfUser(req.user.id, ev.id) : [];
  const mine = new Map(mineRows.map(m => [m.id, { similarity: m.similarity, status: m.status, box: parseJSON(m.box, null) }]));
  const args = [ev.id];
  let where = `p.event_id=? ${TABS[tab]}`;
  if (tab === 'me') {
    if (!mine.size) where += ' AND 1=0';
    else { where += ` AND p.id IN (?)`; args.push([...mine.keys()]); }
  }
  const [co, ci] = String(req.query.cursor || '').split('.').map(Number);   // ต่อจากรูปสุดท้ายของหน้าก่อน
  if (Number.isFinite(co) && Number.isFinite(ci)) { where += ' AND (p.sort_order, p.id) > (?, ?)'; args.push(co, ci); }
  const rows = await q(`SELECT p.id, p.thumb, p.view, p.width, p.height, p.faces, p.featured, p.taken_at, p.sort_order, p.group_ok, p.mascot_ok
    FROM event_photos p WHERE ${where} ORDER BY p.sort_order, p.id LIMIT ?`, [...args, limit + 1]);
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  const out = page.map(({ group_ok, mascot_ok, sort_order, ...p }) => ({ ...p, mine: mine.get(p.id) || null, group: !!group_ok, mascot: !!mascot_ok }));
  const n = await one('SELECT COUNT(*) AS all_n, COALESCE(SUM(group_ok),0) AS group_n, COALESCE(SUM(mascot_ok),0) AS mascot_n FROM event_photos WHERE event_id=?', [ev.id]);
  const me = req.user ? { consented: !!req.user.face_consent_at, registered: !!(await one('SELECT 1 AS ok FROM user_faces WHERE user_id=? LIMIT 1', [req.user.id])), matches: mineRows.length } : null;
  res.set('Cache-Control', 'private, no-store').json({
    ...base, tab, photos: await withUrls(out, ['thumb', 'view']), me,
    counts: { all: Number(n.all_n), me: mineRows.length, group: Number(n.group_n), mascot: Number(n.mascot_n) },
    nextCursor: rows.length > limit && last ? `${last.sort_order}.${last.id}` : null,
    mascot: mascotOf(ev), mascotName: MASCOTS[mascotOf(ev)],
  });
}));

// ลิงก์ไฟล์ต้นฉบับของรูปเดียว — เซ็นตอนกดจริง แล้วพาไปที่ไฟล์เลย
r.get('/events/:slug/album/:id/orig', wrap(async (req, res) => {
  const ev = await getEvent(req.params.slug);
  if (!albumPublished(ev.config) || !(await canViewAlbum(req.user, ev.id))) throw new HttpError(403, 'เฉพาะผู้ที่เช็คอินงานนี้');
  const p = await one('SELECT orig FROM event_photos WHERE id=? AND event_id=?', [Number(req.params.id), ev.id]);
  if (!p) throw new HttpError(404, 'ไม่พบรูป');
  res.set('Cache-Control', 'private, no-store').redirect(await mediaUrl(p.orig));
}));

// ยืนยัน/ปฏิเสธการจับคู่ของตัวเอง
r.post('/events/:slug/album/:id/:verdict', requireUser, wrap(async (req, res) => {
  if (!['me', 'not-me'].includes(req.params.verdict)) throw new HttpError(400, 'คำสั่งไม่ถูกต้อง');
  const ev = await getEvent(req.params.slug);
  const faces_ = await q('SELECT id FROM photo_faces WHERE photo_id=? AND user_id=?', [Number(req.params.id), req.user.id]);
  if (!faces_.length) throw new HttpError(404, 'รูปนี้ไม่ได้จับคู่กับคุณ');
  const ids = faces_.map(f => f.id);
  if (req.params.verdict === 'me') await q("UPDATE photo_faces SET status='confirmed' WHERE id IN (?)", [ids]);
  else await q("UPDATE photo_faces SET status='rejected' WHERE id IN (?)", [ids]);
  res.json({ ok: true, event: ev.slug });
}));

r.post('/events/:slug/album/:id/remove', requireUser, wrap(async (req, res) => {
  const ev = await getEvent(req.params.slug);
  if (!albumPublished(ev.config) || !(await canViewAlbum(req.user, ev.id))) throw new HttpError(403, 'เฉพาะผู้ที่เช็คอินงานนี้');
  const p = await one('SELECT id FROM event_photos WHERE id=? AND event_id=?', [Number(req.params.id), ev.id]);
  if (!p) throw new HttpError(404, 'ไม่พบรูป');
  const dup = await one("SELECT id FROM photo_removals WHERE photo_id=? AND user_id=? AND status='open'", [p.id, req.user.id]);
  if (!dup) await q('INSERT INTO photo_removals SET ?', [{ photo_id: p.id, user_id: req.user.id, reason: String(req.body?.reason || '').slice(0, 300) || null }]);
  res.json({ ok: true });
}));

/* ---------- ใบหน้าของฉัน ---------- */
r.get('/me/face', requireUser, wrap(async (req, res) => {
  const registered = await one('SELECT created_at FROM user_faces WHERE user_id=? ORDER BY id DESC LIMIT 1', [req.user.id]);
  const matches = await q(`SELECT p.event_id, e.slug, e.title, COUNT(*) AS n FROM photo_faces f JOIN event_photos p ON p.id=f.photo_id JOIN events e ON e.id=p.event_id WHERE f.user_id=? AND f.status<>'rejected' GROUP BY p.event_id, e.slug, e.title`, [req.user.id]);
  res.set('Cache-Control', 'private, no-store').json({ enabled: facesEnabled, provider: faceProvider, consented_at: req.user.face_consent_at || null, registered_at: registered?.created_at || null, matches });
}));
// รูปที่มีฉันทั้งหมด (ทุกงานที่เช็คอิน) — ใช้ในแท็บ «รูปของฉัน» ของหน้าบัญชี
r.get('/me/photos', requireUser, wrap(async (req, res) => {
  const rows = await q(`SELECT p.id, p.thumb, p.view, p.orig, p.width, p.height, p.faces, p.event_id, f.similarity, f.status,
      e.slug, e.title, e.starts_at, e.cover, JSON_UNQUOTE(JSON_EXTRACT(e.config, '$.album.published')) AS published
    FROM photo_faces f JOIN event_photos p ON p.id=f.photo_id JOIN events e ON e.id=p.event_id
    WHERE f.user_id=? AND f.status<>'rejected' ORDER BY e.starts_at DESC, (p.faces=2) DESC, f.similarity DESC`, [req.user.id]);
  const shown = rows.filter(r2 => r2.published !== 'false');   // อัลบั้มที่ทีมยังไม่เผยแพร่ ไม่ต้องโผล่
  // แมตช์ได้แล้วแต่ยังไม่เผยแพร่ — บอกจำนวนไว้ ไม่งั้นสมาชิกเห็นแค่หน้าว่างทั้งที่ระบบเจอรูปแล้ว
  const waiting = rows.filter(r2 => r2.published === 'false');
  const events = [];
  for (const p of shown) {
    let g = events.find(x => x.slug === p.slug);
    if (!g) { g = { slug: p.slug, title: p.title, starts_at: p.starts_at, photos: [] }; events.push(g); }
    g.photos.push({ id: p.id, thumb: p.thumb, view: p.view, orig: p.orig, faces: p.faces, similarity: p.similarity, status: p.status });
  }
  for (const g of events) await withUrls(g.photos);
  res.set('Cache-Control', 'private, no-store').json({ total: shown.length, events, waiting: waiting.length, waitingEvents: [...new Set(waiting.map(w => w.title))] });
}));

// รูปของฉันที่เลือกไว้หลายรูป — ตรวจก่อนเสมอว่าเป็นรูปที่จับคู่กับบัญชีนี้จริง
const myPhotos = async (userId, ids) => {
  const list = (ids || []).map(Number).filter(Boolean).slice(0, 60);
  if (!list.length) throw new HttpError(400, 'ยังไม่ได้เลือกรูป');
  return q(`SELECT DISTINCT p.id, p.orig, e.slug FROM photo_faces f JOIN event_photos p ON p.id=f.photo_id JOIN events e ON e.id=p.event_id
    WHERE f.user_id=? AND f.status<>'rejected' AND p.id IN (?)`, [userId, list]);
};

// «ไม่ใช่ฉัน» หลายรูปพร้อมกัน
r.post('/me/photos/not-me', requireUser, wrap(async (req, res) => {
  const rows = await myPhotos(req.user.id, req.body?.ids);
  if (!rows.length) throw new HttpError(404, 'ไม่พบรูปที่เลือก');
  await q("UPDATE photo_faces SET status='rejected' WHERE user_id=? AND photo_id IN (?)", [req.user.id, rows.map(p => p.id)]);
  res.json({ ok: true, count: rows.length });
}));

// ดาวน์โหลดหลายรูปเป็น zip (ไฟล์ต้นฉบับ) — สตรีมออกไปเลย ไม่เก็บไฟล์กลาง
r.post('/me/photos/zip', requireUser, wrap(async (req, res) => {
  const rows = await myPhotos(req.user.id, req.body?.ids);
  if (!rows.length) throw new HttpError(404, 'ไม่พบรูปที่เลือก');
  res.set('Content-Type', 'application/zip').set('Content-Disposition', `attachment; filename="bigcat-photos-${rows.length}.zip"`).set('Cache-Control', 'private, no-store');
  const zip = new ZipArchive({ zlib: { level: 0 } });   // ภาพบีบอีกไม่ได้ผล — level 0 เร็วกว่า
  const cleanups = [];
  zip.on('error', () => res.destroy());
  zip.on('end', () => cleanups.forEach(fn => fn()));
  zip.pipe(res);
  for (const p of rows) {
    const copy = await localCopy(p.orig);
    cleanups.push(copy.done);
    zip.file(copy.file, { name: `${p.slug}/${p.id}${path.extname(p.orig) || '.jpg'}` });
  }
  await zip.finalize();
}));

r.post('/me/face', requireUser, upload.single('selfie'), wrap(async (req, res) => {
  if (!facesEnabled) throw new HttpError(400, 'ระบบค้นหาใบหน้ายังไม่เปิดใช้');
  if (!req.file) throw new HttpError(400, 'แนบรูปหน้าของคุณ 1 รูป');
  if (String(req.body?.consent) !== 'true') { fs.rm(req.file.path, { force: true }, () => {}); throw new HttpError(400, 'ต้องยอมรับข้อกำหนดการใช้ข้อมูลใบหน้าก่อน'); }
  let n;
  try { n = await registerUserFace(req.user.id, req.file.path); }
  catch (e) { fs.rm(req.file.path, { force: true }, () => {}); throw new HttpError(400, e.message); }
  res.json({ ok: true, matches: n });
}));
r.delete('/me/face', requireUser, wrap(async (req, res) => { await forgetUserFaces(req.user.id, { revokeConsent: true }); res.json({ ok: true }); }));

export default r;
