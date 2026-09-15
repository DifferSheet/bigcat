// Passport + ลิงก์ชวนเพื่อน — /api/passport (ต้องล็อกอิน) · /api/invite/:code (ตั้ง cookie คนชวน)
import { Router } from 'express';
import { q, one } from '../db.js';
import { wrap, HttpError } from '../lib.js';
import { requireUser, parseCookies, setCookie } from '../auth.js';
import { passportOf, attachInvite, INVITE_COOKIE_NAME, syncStamps } from '../passport.js';

const r = Router();

r.get('/passport', requireUser, wrap(async (req, res) => {
  await syncStamps(req.user.id);   // กันตกหล่น (ถูก ~4 query)
  const inviter = await attachInvite(req, res, { parseCookies, setCookie });
  const fresh = inviter ? await one('SELECT * FROM users WHERE id=?', [req.user.id]) : req.user;
  res.json(await passportOf(fresh));
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
