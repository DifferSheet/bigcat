// อัลบั้มรูปงาน (ฝั่งสมาชิก) + ใบหน้าของฉัน (opt-in)
//   GET  /events/:slug/album                  เช็คอินแล้ว → ทั้งอัลบั้ม + ธง mine · ไม่ได้เช็คอิน → พรีวิว 3 รูป
//   POST /events/:slug/album/:id/not-me       «นี่ไม่ใช่ฉัน» ปลดการจับคู่ (ยืนยันคู่ = confirm)
//   POST /events/:slug/album/:id/remove       ขอเอารูปออก (แอดมินพิจารณา)
//   GET  /me/face · POST /me/face (multipart selfie + consent) · DELETE /me/face
import { Router } from 'express';
import fs from 'node:fs';
import { q, one, parseJSON } from '../db.js';
import { wrap, HttpError, getEvent } from '../lib.js';
import { requireUser } from '../auth.js';
import { upload } from '../upload.js';
import { canViewAlbum, photosOfUser, registerUserFace, forgetUserFaces } from '../album.js';
import { facesEnabled, faceProvider } from '../faces.js';

const r = Router();
const PREVIEW = 3;

r.get('/events/:slug/album', wrap(async (req, res) => {
  const ev = await getEvent(req.params.slug);
  const total = (await one('SELECT COUNT(*) AS n FROM event_photos WHERE event_id=?', [ev.id])).n;
  const full = await canViewAlbum(req.user, ev.id);
  const base = { total, access: full ? 'full' : 'preview', facesEnabled, provider: faceProvider };
  if (!full) {
    const preview = await q('SELECT id, thumb, width, height FROM event_photos WHERE event_id=? ORDER BY featured DESC, sort_order LIMIT ?', [ev.id, PREVIEW]);
    return res.json({ ...base, photos: preview, me: null });
  }
  const photos = await q('SELECT id, thumb, view, orig, width, height, faces, featured, taken_at FROM event_photos WHERE event_id=? ORDER BY sort_order, id', [ev.id]);
  const mineRows = req.user ? await photosOfUser(req.user.id, ev.id) : [];
  const mine = new Map(mineRows.map(m => [m.id, { similarity: m.similarity, status: m.status, box: parseJSON(m.box, null) }]));
  const me = req.user ? { consented: !!req.user.face_consent_at, registered: !!(await one('SELECT 1 AS ok FROM user_faces WHERE user_id=? LIMIT 1', [req.user.id])), matches: mineRows.length } : null;
  res.set('Cache-Control', 'private, no-store').json({ ...base, photos: photos.map(p => ({ ...p, mine: mine.get(p.id) || null })), me });
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
  if (!(await canViewAlbum(req.user, ev.id))) throw new HttpError(403, 'เฉพาะผู้ที่เช็คอินงานนี้');
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
