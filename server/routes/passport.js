// Passport + ลิงก์ชวนเพื่อน — /api/passport (ต้องล็อกอิน) · /api/invite/:code (ตั้ง cookie คนชวน)
import { Router } from 'express';
import { q, one, parseJSON } from '../db.js';
import { passportPrivateRoot } from '../upload.js';
import { wrap, HttpError, getEvent } from '../lib.js';
import { requireUser, parseCookies, setCookie } from '../auth.js';
import { passportOf, attachInvite, INVITE_COOKIE_NAME, syncStamps } from '../passport.js';
import { photosOfUser } from '../album.js';
import { withUrls, url as mediaUrl, localCopy } from '../storage.js';
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
// รูปในสมุด (รูปคู่/รูปหมู่) แบบสตรีมผ่านโดเมนเรา — ใช้ตอนวาดภาพแชร์ด้วย canvas (ลิงก์ S3 ข้ามโดเมนวาดไม่ได้)
r.get('/passport/:slug/image/:kind', requireUser, wrap(async (req, res) => {
  const st = await myStamp(req.user.id, req.params.slug);
  const ev = await getEvent(req.params.slug);
  const meta = parseJSON(st.meta, {});
  let stored = null;
  if (req.params.kind === 'group') stored = meta.groupPhoto?.view || ev.config.memory?.groupImage || null;
  else if (meta.passportPortrait) {   // ไฟล์ส่วนตัวที่อัปโหลดเอง
    if (!/^[\w-]+\.(jpg|png|webp)$/.test(meta.passportPortrait)) throw new HttpError(404, 'ไม่พบรูป');
    return res.set('Cache-Control', 'private, no-store').sendFile(meta.passportPortrait, { root: passportPrivateRoot });
  } else {
    stored = meta.portraitPhoto?.view || null;
    if (!stored) {
      const auto = await one(`SELECT p.view FROM photo_faces f JOIN event_photos p ON p.id=f.photo_id WHERE f.user_id=? AND p.event_id=? AND f.status<>'rejected' ORDER BY (p.faces=2) DESC, (f.status='confirmed') DESC, f.similarity DESC LIMIT 1`, [req.user.id, ev.id]);
      stored = auto?.view || null;
    }
  }
  if (!stored) throw new HttpError(404, 'ยังไม่มีรูป');
  const copy = await localCopy(stored);
  res.set('Cache-Control', 'private, max-age=600').sendFile(copy.file, {}, () => copy.done());
}));

r.get('/passport/:slug/photos', requireUser, wrap(async (req, res) => {
  const st = await myStamp(req.user.id, req.params.slug);
  const mine = await photosOfUser(req.user.id, st.event_id);
  // รูปหมู่: เลือกจากรูปในอัลบั้มของงาน — เอารูปที่มีคนหลายคนขึ้นก่อน
  const marked = (await one('SELECT COUNT(*) AS n FROM event_photos WHERE event_id=? AND group_ok=1', [st.event_id])).n;
  const album = await q(`SELECT id, thumb, view, faces FROM event_photos WHERE event_id=? AND ${marked ? 'group_ok=1' : '(faces IS NULL OR faces>=3)'} ORDER BY featured DESC, sort_order LIMIT 60`, [st.event_id]);
  res.set('Cache-Control', 'private, no-store').json({
    photos: await withUrls(mine.map(p => ({ id: p.id, thumb: p.thumb, view: p.view, faces: p.faces, status: p.status }))),
    album: await withUrls(album.map(p => ({ id: p.id, thumb: p.thumb, view: p.view, faces: p.faces }))),
    current: parseJSON(st.meta, {}),
  });
}));

// ข้อความในหน้าสมุดของฉัน (หัวข้อ · คำบรรยายใต้รูปแต่ละใบ · บรรทัดปิดท้าย) — ส่งค่าว่างเพื่อกลับไปใช้ข้อความเริ่มต้น
const TEXT_KEYS = ['heading', 'groupCaption', 'portraitCaption', 'caption'];
r.put('/passport/:slug/texts', requireUser, wrap(async (req, res) => {
  const st = await myStamp(req.user.id, req.params.slug);
  const texts = {};
  for (const k of TEXT_KEYS) { const v = String(req.body?.[k] ?? '').trim().slice(0, 120); if (v) texts[k] = v; }
  if (Object.keys(texts).length) await q("UPDATE stamps SET meta=JSON_SET(COALESCE(meta, JSON_OBJECT()), '$.texts', CAST(? AS JSON)) WHERE id=?", [JSON.stringify(texts), st.id]);
  else await q("UPDATE stamps SET meta=JSON_REMOVE(COALESCE(meta, JSON_OBJECT()), '$.texts') WHERE id=?", [st.id]);
  res.json({ ok: true, texts });
}));

// รูปหมู่ของงานนี้ในสมุดของฉัน — เลือกจากอัลบั้ม หรือไม่ส่ง id = กลับไปใช้รูปที่แอดมินตั้งไว้
r.put('/passport/:slug/group', requireUser, wrap(async (req, res) => {
  const st = await myStamp(req.user.id, req.params.slug);
  const photoId = Number(req.body?.photoId) || 0;
  if (!photoId) { await q("UPDATE stamps SET meta=JSON_REMOVE(COALESCE(meta, JSON_OBJECT()), '$.groupPhoto') WHERE id=?", [st.id]); return res.json({ ok: true, source: 'event' }); }
  const p = await one('SELECT id, view FROM event_photos WHERE id=? AND event_id=?', [photoId, st.event_id]);
  if (!p) throw new HttpError(400, 'เลือกได้เฉพาะรูปในอัลบั้มของงานนี้');
  await q("UPDATE stamps SET meta=JSON_SET(COALESCE(meta, JSON_OBJECT()), '$.groupPhoto', JSON_OBJECT('id', ?, 'view', ?)) WHERE id=?", [p.id, p.view, st.id]);
  res.json({ ok: true, source: 'chosen' });
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
  const data = await passportOf(fresh);
  for (const b of data.books) for (const ev of b.events) if (ev.memory) {
    if (ev.memory.portraitImage) ev.memory.portraitImage = await mediaUrl(ev.memory.portraitImage);
    if (ev.memory.groupImage) ev.memory.groupImage = await mediaUrl(ev.memory.groupImage);
  }
  res.set('Cache-Control', 'private, no-store').json(data);
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
