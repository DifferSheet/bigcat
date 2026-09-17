// Passport + ลิงก์ชวนเพื่อน — /api/passport (ต้องล็อกอิน) · /api/invite/:code (ตั้ง cookie คนชวน)
import { Router } from 'express';
import { q, one, parseJSON } from '../db.js';
import { passportPrivateRoot } from '../upload.js';
import { wrap, HttpError } from '../lib.js';
import { requireUser, parseCookies, setCookie } from '../auth.js';
import { passportOf, attachInvite, INVITE_COOKIE_NAME, syncStamps } from '../passport.js';
import { photosOfUser } from '../album.js';
import { uploadPassportPortrait } from '../upload.js';

const r = Router();

r.get('/passport/:slug/portrait', requireUser, wrap(async (req, res) => {
  const stamp = await one(`SELECT s.meta FROM stamps s JOIN events e ON e.id=s.event_id WHERE s.user_id=? AND e.slug=? AND e.status <> 'hidden' AND (e.status='ended' OR e.starts_at < DATE_SUB(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR), INTERVAL 6 HOUR)) AND s.kind IN ('checkin','merit') ORDER BY s.earned_at LIMIT 1`, [req.user.id, req.params.slug]);
  const file = parseJSON(stamp?.meta, {})?.passportPortrait;
  if (!file || !/^[\w-]+\.(jpg|png|webp)$/.test(file)) throw new HttpError(404, 'ยังไม่มีรูปคู่');
  res.set('Cache-Control', 'private, no-store');
  res.sendFile(file, { root: passportPrivateRoot });
}));

// รูปคู่ใน passport — เลือกจากรูปที่มีฉันในอัลบั้ม / อัปโหลดเอง / กลับไปใช้อัตโนมัติ (เก็บใน stamps.meta ของงานนั้น)
const myStamp = async (userId, slug) => {
  const st = await one(`SELECT s.id, s.meta, e.id AS event_id FROM stamps s JOIN events e ON e.id=s.event_id WHERE s.user_id=? AND e.slug=? AND s.kind IN ('checkin','merit') LIMIT 1`, [userId, slug]);
  if (!st) throw new HttpError(404, 'คุณยังไม่มีแสตมป์ของงานนี้');
  return st;
};
r.get('/passport/:slug/photos', requireUser, wrap(async (req, res) => {
  const st = await myStamp(req.user.id, req.params.slug);
  const photos = await photosOfUser(req.user.id, st.event_id);
  res.set('Cache-Control', 'private, no-store').json({ photos: photos.map(p => ({ id: p.id, thumb: p.thumb, view: p.view, faces: p.faces, status: p.status })), current: parseJSON(st.meta, {}) });
}));
r.put('/passport/:slug/portrait', requireUser, uploadPassportPortrait.single('portrait'), wrap(async (req, res) => {
  const st = await myStamp(req.user.id, req.params.slug);
  if (req.file) {   // อัปโหลดเอง → ไฟล์ส่วนตัว (เหมือนแอดมินอัปให้)
    await q("UPDATE stamps SET meta=JSON_REMOVE(JSON_SET(COALESCE(meta, JSON_OBJECT()), '$.passportPortrait', ?), '$.portraitPhoto') WHERE id=?", [req.file.filename, st.id]);
    return res.json({ ok: true, source: 'upload' });
  }
  const photoId = Number(req.body?.photoId);
  if (photoId) {    // เลือกจากอัลบั้ม — ต้องเป็นรูปที่จับคู่กับตัวเอง
    const p = (await photosOfUser(req.user.id, st.event_id)).find(x => x.id === photoId);
    if (!p) throw new HttpError(400, 'เลือกได้เฉพาะรูปที่มีคุณในอัลบั้มงานนี้');
    await q("UPDATE stamps SET meta=JSON_REMOVE(JSON_SET(COALESCE(meta, JSON_OBJECT()), '$.portraitPhoto', JSON_OBJECT('id', ?, 'view', ?)), '$.passportPortrait') WHERE id=?", [p.id, p.view, st.id]);
    return res.json({ ok: true, source: 'chosen' });
  }
  // ไม่ส่งอะไร = กลับไปใช้อัตโนมัติ
  await q("UPDATE stamps SET meta=JSON_REMOVE(COALESCE(meta, JSON_OBJECT()), '$.portraitPhoto', '$.passportPortrait') WHERE id=?", [st.id]);
  res.json({ ok: true, source: 'auto' });
}));

r.get('/passport', requireUser, wrap(async (req, res) => {
  await syncStamps(req.user.id);   // กันตกหล่น (ถูก ~4 query)
  const inviter = await attachInvite(req, res, { parseCookies, setCookie });
  const fresh = inviter ? await one('SELECT * FROM users WHERE id=?', [req.user.id]) : req.user;
  res.set('Cache-Control', 'private, no-store').json(await passportOf(fresh));
}));

// เปิดลิงก์ชวน /i/:code → หน้าเว็บเรียกอันนี้: จำคนชวนไว้ 30 วัน (cookie) · ถ้าล็อกอินอยู่และยังไม่เคยมางาน ผูกทันที
r.post('/invite/:code', wrap(async (req, res) => {
  const inviter = await one('SELECT id, display_name, avatar FROM users WHERE invite_code=?', [String(req.params.code || '').toUpperCase()]);
  if (!inviter) throw new HttpError(404, 'ลิงก์ชวนนี้ใช้ไม่ได้แล้ว');
  if (req.user?.id === inviter.id) return res.json({ self: true, inviter: { display_name: inviter.display_name } });
  setCookie(res, INVITE_COOKIE_NAME, inviter.invite_code || String(req.params.code).toUpperCase(), { maxAge: 30 * 86400 });
  let attached = null;
  if (req.user) { req.headers.cookie = `${req.headers.cookie || ''}; ${INVITE_COOKIE_NAME}=${String(req.params.code).toUpperCase()}`; attached = await attachInvite(req, res, { parseCookies, setCookie }); }
  const next = await one("SELECT slug, title, starts_at, cover FROM events WHERE status IN ('open','upcoming','live') AND starts_at >= UTC_TIMESTAMP() - INTERVAL 1 DAY ORDER BY starts_at LIMIT 1");
  res.json({ inviter: { display_name: inviter.display_name, avatar: inviter.avatar }, attached: !!attached, alreadyMember: !!req.user, next });
}));

export default r;
