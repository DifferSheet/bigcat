// แอดมิน: username + password (scrypt) · session เป็น cookie httpOnly `bigcat_admin` อายุ 12 ชม.
// บัญชีแรกถูกสร้างอัตโนมัติตอน API start ถ้ายังไม่มีแอดมิน: username `admin` รหัสผ่าน = ADMIN_KEY ใน .env (เปลี่ยนได้ในหน้าจัดการ)
// x-admin-key ยังใช้ได้สำหรับสคริปต์/จอสุ่ม (ค่าเดียวกับ ADMIN_KEY)
import crypto from 'node:crypto';
import { q, one } from './db.js';
import { HttpError, wrap } from './lib.js';
import { parseCookies, setCookie, hash } from './auth.js';

const COOKIE = 'bigcat_admin';
const HOURS = 12;
const legacyKey = () => process.env.ADMIN_KEY || 'bigcat-admin';

export const hashPassword = (pw) => { const salt = crypto.randomBytes(16).toString('hex'); return `scrypt$${salt}$${crypto.scryptSync(pw, salt, 64).toString('hex')}`; };
export const checkPassword = (pw, stored) => { const [, salt, h] = String(stored || '').split('$'); if (!salt || !h) return false; const a = Buffer.from(h, 'hex'), b = crypto.scryptSync(pw, salt, 64); return a.length === b.length && crypto.timingSafeEqual(a, b); };

export async function ensureFirstAdmin() {
  const [{ n }] = await q('SELECT COUNT(*) AS n FROM admins');
  if (n === 0) { await q('INSERT INTO admins SET ?', [{ username: 'admin', password_hash: hashPassword(legacyKey()), display_name: 'แอดมิน BIGCAT' }]); console.log('✓ สร้างแอดมินคนแรก: admin (รหัสผ่าน = ADMIN_KEY)'); }
}

async function adminFromRequest(req) {
  const token = parseCookies(req)[COOKIE];
  if (!token) return null;
  return one('SELECT a.id, a.username, a.display_name FROM admin_sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token_hash=? AND s.expires_at > UTC_TIMESTAMP()', [hash(token)]);
}

// ใช้ได้ทั้ง cookie session และ x-admin-key (เดิม)
export const requireAdmin = wrap(async (req, _res, next) => {
  if (req.get('x-admin-key') && req.get('x-admin-key') === legacyKey()) { req.admin = { id: 0, username: 'key', display_name: 'ADMIN_KEY' }; return next(); }
  const admin = await adminFromRequest(req);
  if (!admin) throw new HttpError(401, 'กรุณาเข้าสู่ระบบแอดมิน');
  req.admin = admin; next();
});

// กันเดารหัสผ่าน: ผิดเกิน MAX_FAILS ครั้งต่อ IP ภายใน FAIL_WINDOW → ปฏิเสธ 429 จนกว่าจะพ้นช่วง (เก็บใน memory · รีสตาร์ต API = เริ่มนับใหม่)
const MAX_FAILS = 8, FAIL_WINDOW = 15 * 60e3;
const fails = new Map();   // ip → { n, until }
const clientIp = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '?';

export const login = wrap(async (req, res) => {
  const ip = clientIp(req), f = fails.get(ip);
  if (f && f.n >= MAX_FAILS && Date.now() < f.until) throw new HttpError(429, `ใส่รหัสผิดหลายครั้ง ลองใหม่ได้อีก ${Math.ceil((f.until - Date.now()) / 60e3)} นาที`);
  const username = String(req.body.username || '').trim().toLowerCase(), password = String(req.body.password || '');
  const admin = await one('SELECT * FROM admins WHERE username=?', [username]);
  if (!admin || !checkPassword(password, admin.password_hash)) {
    const cur = f && Date.now() < f.until ? f : { n: 0 };
    fails.set(ip, { n: cur.n + 1, until: Date.now() + FAIL_WINDOW });
    throw new HttpError(401, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  }
  fails.delete(ip);
  const token = crypto.randomBytes(32).toString('base64url');
  await q('INSERT INTO admin_sessions SET ?', [{ token_hash: hash(token), admin_id: admin.id, expires_at: new Date(Date.now() + HOURS * 3600e3) }]);
  await q('UPDATE admins SET last_login_at=UTC_TIMESTAMP() WHERE id=?', [admin.id]);
  await q('DELETE FROM admin_sessions WHERE expires_at < UTC_TIMESTAMP()');
  setCookie(res, COOKIE, token, { maxAge: HOURS * 3600 });
  res.json({ ok: true, admin: { username: admin.username, display_name: admin.display_name } });
});

export const logout = wrap(async (req, res) => {
  const token = parseCookies(req)[COOKIE];
  if (token) await q('DELETE FROM admin_sessions WHERE token_hash=?', [hash(token)]);
  setCookie(res, COOKIE, '', { maxAge: 0 });
  res.json({ ok: true });
});

export const me = wrap(async (req, res) => {
  const admin = await adminFromRequest(req);
  if (!admin) throw new HttpError(401, 'กรุณาเข้าสู่ระบบแอดมิน');
  res.json({ admin });
});

export const changePassword = wrap(async (req, res) => {
  if (!req.admin?.id) throw new HttpError(400, 'เข้าสู่ระบบด้วยชื่อผู้ใช้ก่อนจึงเปลี่ยนรหัสผ่านได้');
  const cur = String(req.body.current || ''), next = String(req.body.next || '');
  if (next.length < 8) throw new HttpError(400, 'รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร');
  const admin = await one('SELECT password_hash FROM admins WHERE id=?', [req.admin.id]);
  if (!checkPassword(cur, admin.password_hash)) throw new HttpError(401, 'รหัสผ่านปัจจุบันไม่ถูกต้อง');
  await q('UPDATE admins SET password_hash=? WHERE id=?', [hashPassword(next), req.admin.id]);
  res.json({ ok: true });
});
