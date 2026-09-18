// สมาชิก: เข้าสู่ระบบด้วย LINE Login / Google (OAuth 2.0 + OpenID Connect) — ไม่มีรหัสผ่านของเราเอง
//   LINE   : LINE_LOGIN_CHANNEL_ID + LINE_LOGIN_CHANNEL_SECRET  (channel ชนิด "LINE Login" คนละตัวกับ Messaging API)
//            callback URL ที่ต้องกรอกใน LINE Developers = {SITE_URL}/api/auth/line/callback
//   Google : GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET             (Google Cloud → OAuth client, Web application)
//            Authorized redirect URI = {SITE_URL}/api/auth/google/callback
//   LINE_LOGIN_SAME_PROVIDER=true → LINE Login กับ OA อยู่ provider เดียวกัน userId ตรงกัน จึงผูกแจ้งเตือน OA ให้อัตโนมัติ
// session = token สุ่ม 32 ไบต์ เก็บ sha256 ในตาราง sessions · cookie httpOnly · อายุ 90 วัน
import crypto from 'node:crypto';
import express from 'express';
import { q, one } from './db.js';
import { HttpError, wrap } from './lib.js';
import { requirePhone } from './validate.js';
import { upload } from './upload.js';

const SITE = (process.env.SITE_URL || 'http://localhost:3100').replace(/\/$/, '');
const COOKIE = 'bigcat_sid';
const SESSION_DAYS = 90;
const secure = SITE.startsWith('https://');

const providers = {
  line: {
    id: process.env.LINE_LOGIN_CHANNEL_ID || '', secret: process.env.LINE_LOGIN_CHANNEL_SECRET || '',
    authorize: 'https://access.line.me/oauth2/v2.1/authorize', token: 'https://api.line.me/oauth2/v2.1/token',
    scope: 'profile openid email',
    // LINE ให้ id_token มา — ตรวจกับ LINE เองแล้วได้ sub/name/picture/email
    async profile(tok) {
      const body = new URLSearchParams({ id_token: tok.id_token, client_id: providers.line.id });
      const r = await fetch('https://api.line.me/oauth2/v2.1/verify', { method: 'POST', body });
      if (!r.ok) throw new Error(`line verify ${r.status}`);
      const p = await r.json();
      return { provider_id: p.sub, display_name: p.name || 'สมาชิก LINE', avatar: p.picture || null, email: p.email || null, line_user_id: p.sub };
    },
  },
  google: {
    id: process.env.GOOGLE_CLIENT_ID || '', secret: process.env.GOOGLE_CLIENT_SECRET || '',
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
    async profile(tok) {
      const r = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tok.access_token}` } });
      if (!r.ok) throw new Error(`google userinfo ${r.status}`);
      const p = await r.json();
      return { provider_id: p.sub, display_name: p.name || p.email || 'สมาชิก Google', avatar: p.picture || null, email: p.email_verified ? p.email : null, line_user_id: null };
    },
  },
};
export const authProviders = Object.fromEntries(Object.entries(providers).map(([k, v]) => [k, !!(v.id && v.secret)]));
export const authEnabled = Object.values(authProviders).some(Boolean);
const sameProviderLine = /^(1|true|yes)$/i.test(process.env.LINE_LOGIN_SAME_PROVIDER || '');

/* ---------- cookie helpers (ไม่ใช้ cookie-parser) ---------- */
export const parseCookies = (req) => Object.fromEntries((req.headers.cookie || '').split(';').map(s => s.trim()).filter(Boolean).map(s => { const i = s.indexOf('='); return [s.slice(0, i), decodeURIComponent(s.slice(i + 1))]; }));
export const setCookie = (res, name, value, { maxAge, path = '/' } = {}) => {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, 'HttpOnly', 'SameSite=Lax'];
  if (secure) parts.push('Secure');
  if (maxAge != null) parts.push(`Max-Age=${maxAge}`);
  res.append('Set-Cookie', parts.join('; '));
};
export const hash = (t) => crypto.createHash('sha256').update(t).digest('hex');

/* ---------- session ---------- */
async function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400e3);
  await q('INSERT INTO sessions SET ?', [{ token_hash: hash(token), user_id: userId, expires_at: expires }]);
  setCookie(res, COOKIE, token, { maxAge: SESSION_DAYS * 86400 });
}

export const publicUser = (u) => u && ({ id: u.id, provider: u.provider, display_name: u.display_name, avatar: u.avatar, email: u.email, phone: u.phone, address: u.address, line_linked: !!u.line_user_id, created_at: u.created_at });

// ติด req.user ให้ทุก request (null ถ้าไม่ได้ล็อกอิน) — เบา: 1 query เฉพาะเมื่อมี cookie
export const attachUser = wrap(async (req, _res, next) => {
  req.user = null;
  const token = parseCookies(req)[COOKIE];
  if (token) {
    const u = await one('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at > NOW()', [hash(token)]);
    if (u) req.user = u;
  }
  next();
});
export const requireUser = (req, _res, next) => (req.user ? next() : next(new HttpError(401, 'กรุณาเข้าสู่ระบบก่อน')));

// ค่าที่ route สร้างรายการ (จอง/ทำบุญ/ลงทะเบียน/สั่งซื้อ) ใส่เพิ่มเมื่อผู้ใช้ล็อกอินอยู่
export const ownerFields = (req) => ({ user_id: req.user?.id || null, ...(sameProviderLine && req.user?.line_user_id ? { line_user_id: req.user.line_user_id } : {}) });

/* ---------- routes ---------- */
const r = express.Router();
const safeNext = (s) => (typeof s === 'string' && /^\/(?!\/)[\w\-./?=&%#]*$/.test(s) ? s : '/account');

r.get('/:provider/start', wrap(async (req, res) => {
  const p = providers[req.params.provider];
  if (!p || !authProviders[req.params.provider]) throw new HttpError(404, 'ยังไม่เปิดให้เข้าสู่ระบบด้วยช่องทางนี้');
  const state = crypto.randomBytes(16).toString('base64url');
  setCookie(res, 'bigcat_oauth', JSON.stringify({ state, next: safeNext(req.query.next), p: req.params.provider }), { maxAge: 600, path: '/api/auth' });
  const u = new URL(p.authorize);
  u.search = new URLSearchParams({ response_type: 'code', client_id: p.id, redirect_uri: `${SITE}/api/auth/${req.params.provider}/callback`, scope: p.scope, state, ...(req.params.provider === 'google' ? { prompt: 'select_account' } : { bot_prompt: 'aggressive' }) }).toString();
  res.redirect(u.toString());
}));

r.get('/:provider/callback', wrap(async (req, res) => {
  const name = req.params.provider, p = providers[name];
  let saved = {};
  try { saved = JSON.parse(parseCookies(req).bigcat_oauth || '{}'); } catch { /* ไม่มี */ }
  setCookie(res, 'bigcat_oauth', '', { maxAge: 0, path: '/api/auth' });
  const fail = (msg) => res.redirect(`/login?error=${encodeURIComponent(msg)}`);
  if (!p || !authProviders[name]) return fail('ช่องทางนี้ยังไม่เปิด');
  if (req.query.error) return fail(name === 'line' ? 'ยกเลิกการเข้าสู่ระบบด้วย LINE' : 'ยกเลิกการเข้าสู่ระบบด้วย Google');
  if (!req.query.code || !saved.state || saved.state !== req.query.state || saved.p !== name) return fail('การเข้าสู่ระบบหมดอายุ กรุณาลองใหม่');
  const tokRes = await fetch(p.token, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code: String(req.query.code), redirect_uri: `${SITE}/api/auth/${name}/callback`, client_id: p.id, client_secret: p.secret }) });
  if (!tokRes.ok) { console.error('[auth]', name, 'token', tokRes.status, await tokRes.text().catch(() => '')); return fail('เชื่อมต่อผู้ให้บริการไม่สำเร็จ'); }
  const prof = await p.profile(await tokRes.json());
  let user = await one('SELECT * FROM users WHERE provider=? AND provider_id=?', [name, prof.provider_id]);
  if (user) {
    // อัปเดตชื่อ/รูปให้ตามผู้ให้บริการ แต่ไม่ทับอีเมล/เบอร์ที่ผู้ใช้กรอกเองแล้ว
    await q('UPDATE users SET ?, last_login_at=NOW() WHERE id=?', [{ display_name: prof.display_name, avatar: prof.avatar, email: user.email || prof.email, line_user_id: user.line_user_id || prof.line_user_id }, user.id]);
  } else {
    const ins = await q('INSERT INTO users SET ?', [{ provider: name, provider_id: prof.provider_id, display_name: prof.display_name, avatar: prof.avatar, email: prof.email, line_user_id: prof.line_user_id, last_login_at: new Date() }]);
    user = { id: ins.insertId };
  }
  await createSession(res, user.id);
  res.redirect(saved.next || '/account');
}));

r.post('/logout', wrap(async (req, res) => {
  const token = parseCookies(req)[COOKIE];
  if (token) await q('DELETE FROM sessions WHERE token_hash=?', [hash(token)]);
  setCookie(res, COOKIE, '', { maxAge: 0 });
  res.json({ ok: true });
}));

export default r;

/* ---------- /api/me ---------- */
// ── เฉพาะเครื่อง dev ─────────────────────────────────────────────────────────────
// เข้าสู่ระบบเป็นสมาชิกคนหนึ่งเพื่อทดสอบหน้าเว็บบนเครื่อง (OAuth จริงใช้ในเครื่องไม่ได้)
// เปิดได้เมื่อใส่ DEV_LOGIN=1 ใน .env ของเครื่อง และ NODE_ENV ไม่ใช่ production เท่านั้น — สคริปต์ sync ไม่ส่งค่านี้ขึ้น EC2
export const devLoginEnabled = process.env.DEV_LOGIN === '1' && process.env.NODE_ENV !== 'production';
export const devLogin = wrap(async (req, res) => {
  if (!devLoginEnabled) throw new HttpError(404, 'ไม่พบหน้านี้');
  const u = await one('SELECT id FROM users WHERE id=?', [Number(req.query.u) || 0]);
  if (!u) throw new HttpError(404, 'ไม่พบสมาชิกคนนี้');
  await createSession(res, u.id);
  res.redirect(String(req.query.next || '/account'));
});

export const me = express.Router();
me.get('/', (req, res) => res.json({ user: publicUser(req.user), providers: authProviders }));
me.put('/', requireUser, wrap(async (req, res) => {
  const clean = (v, n) => (v == null ? null : String(v).trim().slice(0, n) || null);
  // อัปเดตเฉพาะช่องที่ส่งมา — ช่องที่ไม่ส่ง (undefined) ไม่แตะ
  const row = {};
  if (req.body.display_name !== undefined) row.display_name = clean(req.body.display_name, 120) || req.user.display_name;
  for (const [k, n] of [['email', 160], ['address', 500]]) if (req.body[k] !== undefined) row[k] = clean(req.body[k], n);
  if (req.body.phone !== undefined) row.phone = requirePhone(req.body.phone, { required: false }) || null;
  if (!Object.keys(row).length) return res.json({ user: publicUser(req.user) });
  await q('UPDATE users SET ? WHERE id=?', [row, req.user.id]);
  res.json({ user: publicUser(await one('SELECT * FROM users WHERE id=?', [req.user.id])) });
}));
// ประวัติของฉัน — ทุกอย่างที่ทำตอนล็อกอินอยู่ (รายการที่ทำก่อนสมัครไม่ขึ้นที่นี่ ใช้ «บัตรของฉัน» ค้นด้วยรหัสได้เหมือนเดิม)
// เปลี่ยนรูปประจำตัว (อัปโหลดเอง แทนรูปจาก LINE/Google)
me.put('/avatar', requireUser, upload.single('avatar'), wrap(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'กรุณาเลือกรูป');
  await q('UPDATE users SET avatar=? WHERE id=?', [`/uploads/${req.file.filename}`, req.user.id]);
  res.json({ user: publicUser(await one('SELECT * FROM users WHERE id=?', [req.user.id])) });
}));

me.get('/activity', requireUser, wrap(async (req, res) => {
  const uid = req.user.id;
  const [orders, bookings, donations, registrations] = await Promise.all([
    q('SELECT o.code, o.status, o.total, o.delivery, o.created_at, (SELECT i.image FROM order_items i WHERE i.order_id=o.id ORDER BY i.id LIMIT 1) AS image, (SELECT COUNT(*) FROM order_items i WHERE i.order_id=o.id) AS itemCount FROM orders o WHERE o.user_id=? ORDER BY o.created_at DESC LIMIT 50', [uid]),
    q('SELECT b.code, b.status, b.seats, b.amount, b.created_at, e.title, e.slug, e.starts_at, e.cover FROM bookings b JOIN events e ON e.id=b.event_id WHERE b.user_id=? ORDER BY b.created_at DESC LIMIT 50', [uid]),
    // ทำบุญหลายหมวดครั้งเดียว → รวมเป็นรายการเดียวต่อกลุ่ม
    q('SELECT COALESCE(d.group_code, d.code) AS code, MIN(d.status) AS status, SUM(d.amount) AS amount, MIN(d.created_at) AS created_at, e.title, e.slug, e.cover, GROUP_CONCAT(c.name ORDER BY d.id SEPARATOR " · ") AS category FROM donations d JOIN events e ON e.id=d.event_id JOIN donation_categories c ON c.id=d.category_id WHERE d.user_id=? GROUP BY COALESCE(d.group_code, d.code), e.title, e.slug, e.cover ORDER BY created_at DESC LIMIT 50', [uid]),
    q('SELECT r.code, r.number, r.kind, r.checked_in_at, r.created_at, e.title, e.slug, e.starts_at, e.cover FROM registrations r JOIN events e ON e.id=r.event_id WHERE r.user_id=? ORDER BY r.created_at DESC LIMIT 50', [uid]),
  ]);
  res.json({ orders, bookings: bookings.map(b => ({ ...b, seats: typeof b.seats === 'string' ? JSON.parse(b.seats) : b.seats })), donations, registrations });
}));
