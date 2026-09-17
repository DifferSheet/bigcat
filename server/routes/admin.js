import { Router } from 'express';
import { q, one } from '../db.js';
import { wrap, HttpError, getEvent, seatsOf, donationSummary, registrationSummary, drawsOf, reportOf, emit, gateToken, gateExpiresIn, GATE_TTL, checkinWindow } from '../lib.js';
import { push, multicast, msg, lineEnabled } from '../line.js';
import { upload } from './public.js';
import { uploadMedia, uploadPassportPortrait } from '../upload.js';

const siteUrl = () => process.env.SITE_URL || 'http://localhost:5173';

const r = Router();

// เข้าสู่ระบบด้วยชื่อผู้ใช้/รหัสผ่าน (cookie) — ดู server/adminAuth.js · x-admin-key ยังใช้ได้กับสคริปต์
import { syncStamps } from '../passport.js';
import { importPhoto, deletePhoto, kick as kickAlbumScan, scanPhoto } from '../album.js';
import { facesEnabled, faceProvider } from '../faces.js';
import { requireAdmin, login, logout, me as adminMe, changePassword } from '../adminAuth.js';
export { requireAdmin };
r.post('/login', login);
r.post('/logout', logout);
r.get('/me', adminMe);
r.use(requireAdmin);
r.put('/password', changePassword);

// สมาชิก (ผู้ที่เข้าสู่ระบบด้วย LINE/Google) + จำนวนรายการของแต่ละคน
// passport: มอบสติกเกอร์ (ครบ 3 ดวง) — กดสลับได้
r.post('/members/:id/sticker', wrap(async (req, res) => {
  const u = await one('SELECT id, sticker_given_at FROM users WHERE id=?', [Number(req.params.id)]);
  if (!u) throw new HttpError(404, 'ไม่พบสมาชิก');
  await q('UPDATE users SET sticker_given_at=? WHERE id=?', [u.sticker_given_at ? null : new Date(), u.id]);
  res.json({ ok: true, given: !u.sticker_given_at });
}));

// passport: เล่ม (season) — ชื่อ + ช่วงวัน งานที่อยู่ในช่วงจะถูกจัดเข้าเล่มนั้น
r.get('/seasons', wrap(async (_req, res) => res.json(await q('SELECT * FROM seasons ORDER BY starts_on'))));
r.post('/seasons', wrap(async (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim().slice(0, 80), starts_on = String(b.starts_on || '').slice(0, 10), ends_on = String(b.ends_on || '').slice(0, 10);
  if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(starts_on) || !/^\d{4}-\d{2}-\d{2}$/.test(ends_on)) throw new HttpError(400, 'ใส่ชื่อเล่มและช่วงวันให้ครบ');
  if (b.id) await q('UPDATE seasons SET name=?, starts_on=?, ends_on=? WHERE id=?', [name, starts_on, ends_on, Number(b.id)]);
  else await q('INSERT INTO seasons SET ?', [{ name, starts_on, ends_on }]);
  res.json(await q('SELECT * FROM seasons ORDER BY starts_on'));
}));
r.delete('/seasons/:id', wrap(async (req, res) => { await q('DELETE FROM seasons WHERE id=?', [Number(req.params.id)]); res.json(await q('SELECT * FROM seasons ORDER BY starts_on')); }));

r.get('/members', wrap(async (req, res) => {
  const qs = String(req.query.q || '').trim();
  const where = qs ? 'WHERE u.display_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?' : '';
  const params = qs ? [`%${qs}%`, `%${qs}%`, `%${qs}%`] : [];
  const rows = await q(`SELECT u.id, u.provider, u.display_name, u.avatar, u.email, u.phone, u.address, u.created_at, u.last_login_at, u.line_user_id IS NOT NULL AS lineLinked,
      (SELECT COUNT(*) FROM orders o WHERE o.user_id=u.id) AS orders, (SELECT COALESCE(SUM(o.total),0) FROM orders o WHERE o.user_id=u.id AND o.status IN ('paid','packing','shipped','completed')) AS spent,
      (SELECT COUNT(*) FROM bookings b WHERE b.user_id=u.id) AS bookings, (SELECT COUNT(*) FROM donations d WHERE d.user_id=u.id AND d.status='approved') AS donations,
      (SELECT COALESCE(SUM(d.amount),0) FROM donations d WHERE d.user_id=u.id AND d.status='approved') AS donated, (SELECT COUNT(*) FROM registrations r WHERE r.user_id=u.id) AS registrations,
      (SELECT COUNT(*) FROM stamps s WHERE s.user_id=u.id) AS stamps, u.first_checkin_at, u.sticker_given_at, u.invited_by, (SELECT display_name FROM users i WHERE i.id=u.invited_by) AS invited_by_name,
      (SELECT COUNT(*) FROM users f WHERE f.invited_by=u.id AND f.first_checkin_at IS NOT NULL) AS friends
    FROM users u ${where} ORDER BY u.created_at DESC LIMIT 500`, params);
  const [stats] = await q(`SELECT COUNT(*) AS total, SUM(provider='line') AS line, SUM(provider='google') AS google, SUM(line_user_id IS NOT NULL) AS linked, SUM(created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)) AS week FROM users`);
  res.json({ members: rows, stats });
}));

r.get('/ping', (_req, res) => res.json({ ok: true }));

// ภาพรวมทุกกิจกรรม + งานที่รอตรวจ
r.get('/overview', wrap(async (_req, res) => {
  const events = await q(`SELECT e.id, e.slug, e.type, e.status, e.title, e.starts_at,
      (SELECT COUNT(*) FROM bookings b WHERE b.event_id=e.id AND b.status='pending') AS pendingBookings,
      (SELECT COUNT(*) FROM donations d WHERE d.event_id=e.id AND d.status='pending') AS pendingDonations,
      (SELECT COUNT(*) FROM registrations r WHERE r.event_id=e.id) AS registrations
    FROM events e ORDER BY e.starts_at`);
  res.json(events);
}));

/* ---------- Events: เพิ่ม / แก้ไข / ลบ (เพิ่ม 15 ก.ย. 2026) ---------- */
const EV_TYPES = ['fanmeet', 'merit', 'busking', 'workshop', 'popup'];
const EV_STATUS = ['upcoming', 'open', 'soldout', 'live', 'ended', 'hidden'];
const TONES = ['pink', 'yellow', 'sage', 'blue'];
const clean = (v, n) => String(v ?? '').trim().slice(0, n);
// slug เป็น a-z0-9 เท่านั้น (URL อ่านง่าย) — ชื่อไทยล้วนจะได้ <ประเภท>-<วันที่> เช่น busking-20260926
const slugify = (s, type, starts) => clean(s, 80).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `${type}-${String(starts).slice(0, 10).replace(/-/g, '')}`;
// datetime-local จากฟอร์ม ("2026-09-26T19:00") → MySQL DATETIME · ว่าง = null
const toSql = (v) => { const t = clean(v, 30).replace('T', ' '); if (!t) return null; if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(t)) throw new HttpError(400, 'รูปแบบวันเวลาไม่ถูกต้อง'); return t.length === 16 ? `${t}:00` : t; };
const parseConfig = (c) => { if (c == null || c === '') return {}; if (typeof c === 'object') return c; try { return JSON.parse(c); } catch { throw new HttpError(400, 'config ไม่ใช่ JSON ที่ถูกต้อง'); } };

function eventRow(p, file, cur = null) {
  const title = clean(p.title, 160);
  if (!title) throw new HttpError(400, 'กรุณาใส่ชื่องาน');
  const type = cur ? cur.type : (EV_TYPES.includes(p.type) ? p.type : null);
  if (!type) throw new HttpError(400, 'ประเภทงานไม่ถูกต้อง');
  const starts_at = toSql(p.starts_at);
  if (!starts_at) throw new HttpError(400, 'กรุณาใส่วันเวลาเริ่มงาน');
  const row = {
    type, title,
    status: EV_STATUS.includes(p.status) ? p.status : (cur?.status || 'upcoming'),
    category: clean(p.category, 60) || cur?.category || { fanmeet: 'Meet & greet', merit: 'ทำบุญ', busking: 'Busking', workshop: 'Workshop', popup: 'Pop-up store' }[type],
    subtitle: clean(p.subtitle, 200) || null,
    description: clean(p.description, 5000) || null,
    place: clean(p.place, 200) || null,
    map_url: clean(p.map_url, 400) || null,
    starts_at, ends_at: toSql(p.ends_at),
    tone: TONES.includes(p.tone) ? p.tone : (cur?.tone || 'pink'),
    config: JSON.stringify(parseConfig(p.config)),
  };
  if (file) row.cover = `/uploads/${file.filename}`;
  else if (p.cover !== undefined) row.cover = clean(p.cover, 300) || null;
  return row;
}

// ที่นั่งจาก seatMap (fanmeet) — สร้างเมื่อยังไม่มีที่นั่งของงานนั้น
async function ensureSeats(eventId, cfg) {
  const sm = cfg?.seatMap; if (!sm?.rows?.length || !sm.cols) return;
  const [{ n }] = await q('SELECT COUNT(*) AS n FROM seats WHERE event_id=?', [eventId]);
  if (n > 0) return;
  const values = [];
  for (const r of sm.rows) for (let c = 1; c <= sm.cols; c++) { const z = sm.zones?.[r] || sm.zones?.default || { name: 'Standard', price: 0 }; values.push([eventId, `${r}${c}`, r, c, z.name, z.price, 'available']); }
  await q('INSERT INTO seats (event_id, label, row_label, col_num, zone, price, status) VALUES ?', [values]);
}

// หมวดทำบุญ: [{id?, name, description, goal, unit_name, unit_price}] — แก้ตาม id · เพิ่มใหม่ · ลบที่หายไปเฉพาะเมื่อยังไม่มียอด
async function syncCategories(eventId, cats) {
  if (!Array.isArray(cats)) return;
  const existing = await q('SELECT id FROM donation_categories WHERE event_id=?', [eventId]);
  const keep = new Set();
  for (const [i, c] of cats.entries()) {
    const row = { name: clean(c.name, 80), description: clean(c.description, 300) || null, goal: Math.max(0, Math.round(Number(c.goal) || 0)), unit_name: clean(c.unit_name, 40) || null, unit_price: c.unit_price ? Math.round(Number(c.unit_price)) : null, sort: i };
    if (!row.name) continue;
    if (c.id && existing.some(e => e.id === Number(c.id))) { await q('UPDATE donation_categories SET ? WHERE id=? AND event_id=?', [row, Number(c.id), eventId]); keep.add(Number(c.id)); }
    else { const ins = await q('INSERT INTO donation_categories SET ?', [{ ...row, event_id: eventId }]); keep.add(ins.insertId); }
  }
  for (const e of existing) if (!keep.has(e.id)) {
    const [{ n }] = await q('SELECT COUNT(*) AS n FROM donations WHERE category_id=?', [e.id]);
    if (n === 0) await q('DELETE FROM donation_categories WHERE id=?', [e.id]);
  }
}

// ข้อมูลเต็มสำหรับฟอร์มแก้ไข
r.get('/events/:slug/full', wrap(async (req, res) => {
  const ev = await one('SELECT * FROM events WHERE slug=?', [req.params.slug]);
  if (!ev) throw new HttpError(404, 'ไม่พบกิจกรรมนี้');
  const config = typeof ev.config === 'string' ? JSON.parse(ev.config || '{}') : (ev.config || {});
  const categories = ev.type === 'merit' ? await q('SELECT id, name, description, goal, unit_name, unit_price FROM donation_categories WHERE event_id=? ORDER BY sort', [ev.id]) : [];
  const [[{ bookings }], [{ donations }], [{ registrations }]] = await Promise.all([
    q('SELECT COUNT(*) AS bookings FROM bookings WHERE event_id=?', [ev.id]), q('SELECT COUNT(*) AS donations FROM donations WHERE event_id=?', [ev.id]), q('SELECT COUNT(*) AS registrations FROM registrations WHERE event_id=?', [ev.id])]);
  res.json({ ...ev, config, categories, counts: { bookings, donations, registrations } });
}));

// Resolve the exact member before accepting a private portrait upload.
const portraitOwner = wrap(async (req, _res, next) => {
  const id = Number(req.params.userId);
  if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, 'รหัสสมาชิกไม่ถูกต้อง');
  const owner = await one(`SELECT s.id, u.display_name FROM stamps s JOIN events e ON e.id=s.event_id JOIN users u ON u.id=s.user_id WHERE e.slug=? AND s.user_id=? AND s.kind IN ('checkin','merit') ORDER BY s.earned_at LIMIT 1`, [req.params.slug, id]);
  if (!owner) throw new HttpError(404, 'สมาชิกคนนี้ยังไม่มีแสตมป์ของงานนี้');
  req.portraitOwner = owner; next();
});
r.get('/events/:slug/passport-portrait/:userId', portraitOwner, (req, res) => res.json({ name: req.portraitOwner.display_name }));
r.put('/events/:slug/passport-portrait/:userId', portraitOwner, uploadPassportPortrait.single('portrait'), wrap(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'กรุณาเลือกภาพ');
  await q("UPDATE stamps SET meta=JSON_SET(COALESCE(meta, JSON_OBJECT()), '$.passportPortrait', ?) WHERE id=?", [req.file.filename, req.portraitOwner.id]);
  res.json({ ok: true, name: req.portraitOwner.display_name });
}));
r.delete('/events/:slug/passport-portrait/:userId', portraitOwner, wrap(async (req, res) => {
  await q("UPDATE stamps SET meta=JSON_REMOVE(meta, '$.passportPortrait') WHERE id=?", [req.portraitOwner.id]);
  res.json({ ok: true });
}));

const eventUploads = uploadMedia.fields([{ name: 'cover', maxCount: 1 }, { name: 'gallery', maxCount: 10 }, { name: 'stamp', maxCount: 1 }, { name: 'unlock', maxCount: 1 }, { name: 'memoryNote', maxCount: 1 }, { name: 'memoryGroup', maxCount: 1 }]);
// passport: ลายแสตมป์ของงาน (ภาพ) + เนื้อหาปลดล็อก (ภาพ/เสียง/ข้อความ) — ไฟล์ใหม่ทับของเดิม · ฟอร์มส่ง stamp:null เพื่อลบ
const applyPassportFiles = (cfg, files) => {
  if (cfg.memory) {
    const m = cfg.memory;
    cfg.memory = { layout: ['auto', 'warm', 'playful', 'special', 'merit'].includes(m.layout) ? m.layout : 'auto', author: m.author === 'nobi' ? 'nobi' : 'boota', noteText: Object.hasOwn(m, 'noteText') ? clean(m.noteText, 5000) : undefined, caption: clean(m.caption, 500), noteImage: clean(m.noteImage, 300), groupImage: Object.hasOwn(m, 'groupImage') ? clean(m.groupImage, 300) : undefined };
    for (const [field, key] of [['memoryNote', 'noteImage'], ['memoryGroup', 'groupImage']]) {
      const f = files?.[field]?.[0];
      if (f && !/^image\//.test(f.mimetype)) throw new HttpError(400, 'โน้ตและรูปหมู่ต้องเป็นไฟล์ภาพ');
      if (f) cfg.memory[key] = `/uploads/${f.filename}`;
    }
  }
  if (files?.stamp?.[0]) cfg.stamp = { image: `/uploads/${files.stamp[0].filename}` };
  if (files?.unlock?.[0]) cfg.unlock = { ...(cfg.unlock || {}), type: files.unlock[0].mimetype.startsWith('audio/') ? 'audio' : 'image', src: `/uploads/${files.unlock[0].filename}` };
  if (cfg.unlock && !cfg.unlock.src && !cfg.unlock.text) delete cfg.unlock;
  if (cfg.stamp === null) delete cfg.stamp;
};
// แกลเลอรี = รูปเดิมที่ยังเก็บไว้ (payload.gallery) + ไฟล์ใหม่ที่อัปโหลด
// ฟอร์มส่งลำดับภาพทั้งหมด (ปก = ภาพแรก): ค่าเป็น path เดิม หรือ 'file:<ลำดับไฟล์ใน gallery>' สำหรับไฟล์ใหม่
const resolveImages = (p, files) => {
  if (!Array.isArray(p.images)) return null;
  const up = files?.gallery || [];
  return p.images.map(m => typeof m === 'string' && m.startsWith('file:') ? (up[Number(m.slice(5))] ? `/uploads/${up[Number(m.slice(5))].filename}` : null) : clean(m, 300)).filter(Boolean).slice(0, 11);
};
const mergeGallery = (p, files) => [...(Array.isArray(p.gallery) ? p.gallery.map(x => clean(x, 300)).filter(Boolean) : []), ...((files?.gallery || []).map(f => `/uploads/${f.filename}`))].slice(0, 10);

r.post('/events', eventUploads, wrap(async (req, res) => {
  const p = typeof req.body.payload === 'string' ? JSON.parse(req.body.payload) : req.body;
  const cfg = parseConfig(p.config); const imgs = resolveImages(p, req.files);
  if (imgs) { p.cover = imgs[0] || null; cfg.gallery = imgs.slice(1); } else cfg.gallery = mergeGallery(p, req.files);
  applyPassportFiles(cfg, req.files);
  p.config = cfg;
  const row = eventRow(p, imgs ? null : req.files?.cover?.[0]);
  row.slug = slugify(p.slug || p.title, row.type, row.starts_at);
  if (await one('SELECT id FROM events WHERE slug=?', [row.slug])) throw new HttpError(409, `slug "${row.slug}" มีอยู่แล้ว ตั้งชื่ออื่น`);
  const ins = await q('INSERT INTO events SET ?', [row]);
  await ensureSeats(ins.insertId, JSON.parse(row.config));
  if (row.type === 'merit') await syncCategories(ins.insertId, p.categories);
  res.json({ ok: true, slug: row.slug });
}));

r.put('/events/:slug', eventUploads, wrap(async (req, res) => {
  const cur = await one('SELECT * FROM events WHERE slug=?', [req.params.slug]);
  if (!cur) throw new HttpError(404, 'ไม่พบกิจกรรมนี้');
  const p = typeof req.body.payload === 'string' ? JSON.parse(req.body.payload) : req.body;
  const cfg = parseConfig(p.config); const imgs = resolveImages(p, req.files);
  if (imgs) { p.cover = imgs[0] || null; cfg.gallery = imgs.slice(1); } else cfg.gallery = mergeGallery(p, req.files);
  applyPassportFiles(cfg, req.files);
  p.config = cfg;
  const row = eventRow(p, imgs ? null : req.files?.cover?.[0], cur);
  await q('UPDATE events SET ? WHERE id=?', [row, cur.id]);
  await ensureSeats(cur.id, JSON.parse(row.config));
  if (cur.type === 'merit') await syncCategories(cur.id, p.categories);
  emit(cur.slug, 'event', { status: row.status });
  res.json({ ok: true, slug: cur.slug });
}));

// ลบได้เฉพาะงานที่ยังไม่มีคนจอง/ร่วมบุญ/ลงทะเบียน — ถ้ามี ให้ตั้งสถานะ ended แทน (ข้อมูลลูกค้าจะไม่หาย)
r.delete('/events/:slug', wrap(async (req, res) => {
  const ev = await one('SELECT id FROM events WHERE slug=?', [req.params.slug]);
  if (!ev) throw new HttpError(404, 'ไม่พบกิจกรรมนี้');
  const [[{ b }], [{ d }], [{ g }]] = await Promise.all([q('SELECT COUNT(*) AS b FROM bookings WHERE event_id=?', [ev.id]), q('SELECT COUNT(*) AS d FROM donations WHERE event_id=?', [ev.id]), q('SELECT COUNT(*) AS g FROM registrations WHERE event_id=?', [ev.id])]);
  if (b + d + g > 0) throw new HttpError(400, `ลบไม่ได้ — มีข้อมูลผูกอยู่ (จอง ${b} · ทำบุญ ${d} · ลงทะเบียน ${g}) ให้เปลี่ยนสถานะเป็น ended แทน`);
  await q('DELETE FROM events WHERE id=?', [ev.id]);
  res.json({ ok: true });
}));

r.patch('/events/:slug', wrap(async (req, res) => {
  const ev = await getEvent(req.params.slug);
  const allowed = EV_STATUS;
  if (!allowed.includes(req.body.status)) throw new HttpError(400, 'สถานะไม่ถูกต้อง');
  await q('UPDATE events SET status=? WHERE id=?', [req.body.status, ev.id]);
  emit(ev.slug, 'event', { status: req.body.status });
  res.json({ ok: true });
}));

/* ---------- Bookings ---------- */
r.get('/events/:slug/bookings', wrap(async (req, res) => {
  const ev = await getEvent(req.params.slug);
  const rows = await q('SELECT * FROM bookings WHERE event_id=? ORDER BY created_at DESC', [ev.id]);
  res.json(rows.map(b => ({ ...b, seats: typeof b.seats === 'string' ? JSON.parse(b.seats) : b.seats })));
}));

r.post('/bookings/:id/:action', wrap(async (req, res) => {
  const b = await one('SELECT b.*, e.slug FROM bookings b JOIN events e ON e.id=b.event_id WHERE b.id=?', [Number(req.params.id)]);
  if (!b) throw new HttpError(404, 'ไม่พบการจอง');
  const map = { approve: 'paid', reject: 'rejected', checkin: 'checked_in' };
  const status = map[req.params.action];
  if (!status) throw new HttpError(400, 'คำสั่งไม่ถูกต้อง');
  await q('UPDATE bookings SET status=? WHERE id=?', [status, b.id]);
  if (status === 'rejected') {
    // คืนที่นั่งให้คนอื่นจองต่อ
    await q(`UPDATE seats SET status='available', booking_id=NULL WHERE booking_id=?`, [b.id]);
    emit(b.slug, 'seats', await seatsOf(b.event_id));
  }
  if (b.line_user_id) {
    const ev = await one('SELECT title FROM events WHERE id=?', [b.event_id]);
    const seats = (typeof b.seats === 'string' ? JSON.parse(b.seats) : b.seats).join(', ');
    if (status === 'paid') push(b.line_user_id, msg.bookingPaid({ seats, title: ev.title, url: `${siteUrl()}/ticket/${b.code}` })).catch(() => {});
    if (status === 'rejected') push(b.line_user_id, msg.bookingRejected(b)).catch(() => {});
  }
  res.json({ ok: true, status });
}));

// เช็คอินด้วยรหัสบัตร (สแกน QR หน้างาน)
// ยกเลิกเช็คอิน (กดพลาด/เช็คอินก่อนวันงาน) — คืนสถานะให้ลงทะเบียนแล้วแต่ยังไม่มา
r.post('/registrations/:id/uncheckin', wrap(async (req, res) => {
  const reg = await one('SELECT r.id, r.event_id, r.user_id, e.slug FROM registrations r JOIN events e ON e.id=r.event_id WHERE r.id=?', [Number(req.params.id)]);
  if (!reg) throw new HttpError(404, 'ไม่พบรายการ');
  await q('UPDATE registrations SET checked_in_at=NULL, checkin_via=NULL, checkin_lat=NULL, checkin_lng=NULL, checkin_acc=NULL WHERE id=?', [reg.id]);
  emit(reg.slug, 'registrations', await registrationSummary(reg.event_id));
  if (reg.user_id) syncStamps(reg.user_id).catch(() => {});
  res.json({ ok: true });
}));

// รหัสบัตรอาจมาเป็น URL จาก QR (https://…/admin?checkin=XXXXXXXX) — ดึงเฉพาะรหัส 8 ตัว
const ticketCode = (raw) => { const m = String(raw || '').match(/(?:checkin=|\/ticket\/)([A-Za-z0-9]{6,12})/) || String(raw || '').trim().match(/^([A-Za-z0-9]{6,12})$/); return m ? m[1].toUpperCase() : ''; };

// ดูข้อมูลบัตรก่อนกดยืนยัน (มือถือสแกน QR → การ์ดยืนยัน) — ไม่แก้อะไร
r.get('/checkin/:code', wrap(async (req, res) => {
  const codeUp = ticketCode(req.params.code);
  if (!codeUp) throw new HttpError(400, 'รหัสบัตรไม่ถูกต้อง');
  const b = await one('SELECT b.status, b.name, b.seats, e.title, e.starts_at, e.status AS event_status FROM bookings b JOIN events e ON e.id=b.event_id WHERE b.code=?', [codeUp]);
  if (b) return res.json({ kind: 'booking', code: codeUp, name: b.name, seats: typeof b.seats === 'string' ? JSON.parse(b.seats) : b.seats, status: b.status, already: b.status === 'checked_in', title: b.title, starts_at: b.starts_at, event_status: b.event_status });
  const reg = await one('SELECT r.name, r.nickname, r.number, r.kind, r.checked_in_at, e.title, e.starts_at, e.status AS event_status FROM registrations r JOIN events e ON e.id=r.event_id WHERE r.code=?', [codeUp]);
  if (!reg) throw new HttpError(404, 'ไม่พบรหัสนี้');
  res.json({ kind: 'registration', code: codeUp, name: reg.name, nickname: reg.nickname, number: reg.number, regKind: reg.kind, already: !!reg.checked_in_at, checked_in_at: reg.checked_in_at, title: reg.title, starts_at: reg.starts_at, event_status: reg.event_status });
}));

r.post('/checkin/:code', wrap(async (req, res) => {
  const codeUp = ticketCode(req.params.code);
  if (!codeUp) throw new HttpError(400, 'รหัสบัตรไม่ถูกต้อง');
  const b = await one('SELECT id, status, name, seats FROM bookings WHERE code=?', [codeUp]);
  if (b) {
    if (b.status === 'checked_in') return res.json({ kind: 'booking', already: true, name: b.name });
    if (b.status !== 'paid') throw new HttpError(400, `บัตรนี้ยังไม่ได้ยืนยันการชำระเงิน (${b.status})`);
    await q(`UPDATE bookings SET status='checked_in' WHERE id=?`, [b.id]);
    return res.json({ kind: 'booking', name: b.name, seats: typeof b.seats === 'string' ? JSON.parse(b.seats) : b.seats });
  }
  const reg = await one('SELECT r.id, r.name, r.number, r.checked_in_at, r.event_id, r.user_id, e.slug FROM registrations r JOIN events e ON e.id=r.event_id WHERE r.code=?', [codeUp]);
  if (!reg) throw new HttpError(404, 'ไม่พบรหัสนี้');
  if (!reg.checked_in_at) await q(`UPDATE registrations SET checked_in_at=UTC_TIMESTAMP(), checkin_via='staff' WHERE id=?`, [reg.id]);
  emit(reg.slug, 'registrations', await registrationSummary(reg.event_id));
  if (reg.user_id) syncStamps(reg.user_id).catch(() => {});
  res.json({ kind: 'registration', name: reg.name, number: reg.number, already: !!reg.checked_in_at });
}));

/* ---------- Donations ---------- */
r.get('/events/:slug/donations', wrap(async (req, res) => {
  const ev = await getEvent(req.params.slug);
  res.json(await q(`SELECT d.*, c.name AS category, u.display_name AS member_name, u.avatar AS member_avatar FROM donations d JOIN donation_categories c ON c.id=d.category_id LEFT JOIN users u ON u.id=d.user_id WHERE d.event_id=? ORDER BY FIELD(d.status,'pending','approved','rejected'), d.created_at DESC`, [ev.id]));
}));

async function setDonationStatus(ids, status) {
  if (!ids.length) return [];
  // ขยายไปทั้งกลุ่ม (ทำบุญหลายหมวดในครั้งเดียว) — สลิปเดียว ต้องผ่าน/ตกพร้อมกัน
  const groups = (await q('SELECT DISTINCT group_code FROM donations WHERE id IN (?) AND group_code IS NOT NULL', [ids])).map(g => g.group_code);
  if (groups.length) ids = [...new Set([...ids, ...(await q('SELECT id FROM donations WHERE group_code IN (?)', [groups])).map(r => r.id)])];
  const rows = await q(`SELECT d.id, d.code, d.group_code, d.amount, d.line_user_id, d.event_id, c.name AS category, e.slug, e.title FROM donations d JOIN donation_categories c ON c.id=d.category_id JOIN events e ON e.id=d.event_id WHERE d.id IN (?)`, [ids]);
  if (!rows.length) return [];
  await q('UPDATE donations SET status=? WHERE id IN (?)', [status, rows.map(r => r.id)]);
  for (const slug of new Set(rows.map(r => r.slug))) emit(slug, 'donations', await donationSummary(rows.find(r => r.slug === slug).event_id));
  for (const u of await q('SELECT DISTINCT user_id FROM donations WHERE id IN (?) AND user_id IS NOT NULL', [rows.map(r => r.id)])) syncStamps(u.user_id).catch(() => {});   // แสตมป์ร่วมบุญ
  const notified = new Set();
  for (const d of rows) {
    if (!d.line_user_id) continue;
    const key = d.group_code || d.code; if (notified.has(key)) continue; notified.add(key);   // กลุ่มเดียวแจ้งครั้งเดียว
    const grp = rows.filter(r => (r.group_code || r.code) === key);
    const text = status === 'approved' ? msg.donationApproved({ ...d, amount: grp.reduce((s, r) => s + r.amount, 0), category: grp.map(r => r.category).join(' · '), url: `${siteUrl()}/ticket/${key}` }) : msg.donationRejected({ ...d, code: key });
    push(d.line_user_id, text).catch(() => {});
  }
  return rows;
}

// ผูกรายการทำบุญ (ทั้งกลุ่มที่โอนครั้งเดียว) เข้ากับสมาชิก — สำหรับคนที่ทำบุญก่อนแล้วค่อยสมัครทีหลัง · userId=null = ปลดออก
r.post('/donations/:id/assign', wrap(async (req, res) => {
  const d = await one('SELECT id, code, group_code FROM donations WHERE id=?', [Number(req.params.id)]);
  if (!d) throw new HttpError(404, 'ไม่พบรายการ');
  const userId = req.body.userId ? Number(req.body.userId) : null;
  const user = userId ? await one('SELECT id, display_name, line_user_id FROM users WHERE id=?', [userId]) : null;
  if (userId && !user) throw new HttpError(404, 'ไม่พบสมาชิก');
  const key = d.group_code || d.code;
  const r2 = await q('UPDATE donations SET user_id=?, line_user_id=COALESCE(line_user_id, ?) WHERE code=? OR group_code=?', [userId, user?.line_user_id || null, key, key]);
  res.json({ ok: true, count: r2.affectedRows, member: user ? { id: user.id, display_name: user.display_name } : null });
}));

// ผูกการลงทะเบียน (ไปวัด/บัสกิ้ง/เวิร์กช็อป) กับสมาชิก · userId=null = ปลด
r.post('/registrations/:id/assign', wrap(async (req, res) => {
  const reg = await one('SELECT id FROM registrations WHERE id=?', [Number(req.params.id)]);
  if (!reg) throw new HttpError(404, 'ไม่พบรายการ');
  const userId = req.body.userId ? Number(req.body.userId) : null;
  const user = userId ? await one('SELECT id, display_name, line_user_id FROM users WHERE id=?', [userId]) : null;
  if (userId && !user) throw new HttpError(404, 'ไม่พบสมาชิก');
  await q('UPDATE registrations SET user_id=?, line_user_id=COALESCE(line_user_id, ?) WHERE id=?', [userId, user?.line_user_id || null, reg.id]);
  res.json({ ok: true, member: user ? { id: user.id, display_name: user.display_name } : null });
}));

// สลับ «ไม่แสดงชื่อบนกำแพง» ทั้งกลุ่ม (กรณีผู้ใช้ติ๊กพลาด)
r.post('/donations/:id/anonymous', wrap(async (req, res) => {
  const d = await one('SELECT id, code, group_code FROM donations WHERE id=?', [Number(req.params.id)]);
  if (!d) throw new HttpError(404, 'ไม่พบรายการ');
  const key = d.group_code || d.code; const on = req.body.anonymous ? 1 : 0;
  await q('UPDATE donations SET anonymous=? WHERE code=? OR group_code=?', [on, key, key]);
  const ev = await one('SELECT e.id, e.slug FROM donations dd JOIN events e ON e.id=dd.event_id WHERE dd.id=?', [d.id]);
  emit(ev.slug, 'donations', await donationSummary(ev.id));
  res.json({ ok: true, anonymous: on });
}));

r.post('/donations/bulk', wrap(async (req, res) => {
  const status = { approve: 'approved', reject: 'rejected' }[req.body.action];
  if (!status) throw new HttpError(400, 'คำสั่งไม่ถูกต้อง');
  const rows = await setDonationStatus((req.body.ids || []).map(Number).filter(Boolean), status);
  res.json({ ok: true, count: rows.length });
}));

r.post('/donations/:id/:action', wrap(async (req, res) => {
  const status = { approve: 'approved', reject: 'rejected' }[req.params.action];
  if (!status) throw new HttpError(400, 'คำสั่งไม่ถูกต้อง');
  const rows = await setDonationStatus([Number(req.params.id)], status);
  if (!rows.length) throw new HttpError(404, 'ไม่พบรายการ');
  res.json({ ok: true, status });
}));

// export CSV (เปิดใน Excel / Google Sheets ได้ทันที — มี BOM สำหรับภาษาไทย)
r.get('/events/:slug/donations.csv', wrap(async (req, res) => {
  const ev = await getEvent(req.params.slug);
  const rows = await q(`SELECT d.code, d.created_at, d.donor_name, d.anonymous, d.dedication, c.name AS category, d.units, c.unit_name, d.amount, d.status, d.trans_ref, d.verify_note, d.message FROM donations d JOIN donation_categories c ON c.id=d.category_id WHERE d.event_id=? ORDER BY d.created_at`, [ev.id]);
  const head = ['รหัส', 'วันที่', 'ผู้ร่วมบุญ', 'ไม่แสดงชื่อ', 'อุทิศให้/ในนาม', 'หมวด', 'จำนวนหน่วย', 'หน่วย', 'ยอด', 'สถานะ', 'เลขอ้างอิงสลิป', 'ผลตรวจ', 'ข้อความ'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [head, ...rows.map(r => [r.code, r.created_at, r.donor_name, r.anonymous ? 'ใช่' : '', r.dedication, r.category, r.units, r.unit_name, r.amount, r.status, r.trans_ref, r.verify_note, r.message])].map(row => row.map(esc).join(',')).join('\r\n');
  res.setHeader('content-type', 'text/csv; charset=utf-8');
  res.setHeader('content-disposition', `attachment; filename="${ev.slug}-donations.csv"`);
  res.send('\uFEFF' + csv);
}));

// ส่งข้อความขอบคุณทาง LINE ให้ผู้ร่วมบุญที่ยืนยันแล้วและผูก LINE ไว้ (ส่งซ้ำไม่ได้ถ้าเคยขอบคุณแล้ว)
r.post('/events/:slug/thanks', wrap(async (req, res) => {
  const ev = await getEvent(req.params.slug);
  if (!lineEnabled) throw new HttpError(400, 'ยังไม่ได้ตั้งค่า LINE Messaging API');
  const text = String(req.body.text || '').trim();
  if (!text) throw new HttpError(400, 'กรุณาใส่ข้อความ');
  const rows = await q(`SELECT id, line_user_id FROM donations WHERE event_id=? AND status='approved' AND line_user_id IS NOT NULL AND thanked_at IS NULL`, [ev.id]);
  const sent = await multicast(rows.map(r => r.line_user_id), text);
  if (rows.length) await q('UPDATE donations SET thanked_at=UTC_TIMESTAMP() WHERE id IN (?)', [rows.map(r => r.id)]);
  res.json({ ok: true, sent, recipients: rows.length });
}));

// ยอดแยกหมวด + ผู้ผูก LINE สำหรับหน้า admin
r.get('/events/:slug/donation-stats', wrap(async (req, res) => {
  const ev = await getEvent(req.params.slug);
  const summary = await donationSummary(ev.id);
  const extra = await one(`SELECT COUNT(line_user_id) AS lineLinked, SUM(thanked_at IS NOT NULL) AS thanked, SUM(status='pending') AS pending, SUM(verified_at IS NOT NULL) AS autoVerified FROM donations WHERE event_id=?`, [ev.id]);
  res.json({ ...summary, lineLinked: Number(extra.lineLinked), thanked: Number(extra.thanked || 0), pending: Number(extra.pending || 0), autoVerified: Number(extra.autoVerified || 0) });
}));

/* ---------- รายงานความโปร่งใส ---------- */
r.post('/events/:slug/report', upload.single('image'), wrap(async (req, res) => {
  const ev = await getEvent(req.params.slug);
  const title = String(req.body.title || '').trim().slice(0, 200);
  if (!title) throw new HttpError(400, 'กรุณาใส่หัวข้อ');
  await q('INSERT INTO report_items SET ?', [{ event_id: ev.id, kind: ['receipt', 'photo', 'note'].includes(req.body.kind) ? req.body.kind : 'receipt', title, amount: req.body.amount ? Math.round(Number(req.body.amount)) : null, image_path: req.file ? `/uploads/${req.file.filename}` : null, body: String(req.body.body || '').trim().slice(0, 2000) || null }]);
  const report = await reportOf(ev.id);
  emit(ev.slug, 'report', report);
  res.json(report);
}));

r.delete('/report/:id', wrap(async (req, res) => {
  const item = await one('SELECT r.event_id, e.slug FROM report_items r JOIN events e ON e.id=r.event_id WHERE r.id=?', [Number(req.params.id)]);
  if (!item) throw new HttpError(404, 'ไม่พบรายการ');
  await q('DELETE FROM report_items WHERE id=?', [Number(req.params.id)]);
  emit(item.slug, 'report', await reportOf(item.event_id));
  res.json({ ok: true });
}));

/* ---------- Busking ---------- */
r.get('/events/:slug/registrations', wrap(async (req, res) => {
  const ev = await getEvent(req.params.slug);
  const rows = await q(`SELECT r.id, r.code, r.number, r.name, r.nickname, r.social, r.phone, r.kind, r.line_user_id, r.line_user_id IS NOT NULL AS lineLinked, r.checked_in_at, r.checkin_via, r.checkin_lat, r.checkin_lng, r.checkin_acc, r.created_at, r.user_id, u.display_name AS member_name,
      (u.first_checkin_at IS NULL OR (SELECT MIN(x.checked_in_at) FROM registrations x WHERE x.user_id=u.id AND x.checked_in_at IS NOT NULL) >= COALESCE(r.checked_in_at, UTC_TIMESTAMP())) AS first_time, (SELECT display_name FROM users i WHERE i.id=u.invited_by) AS invited_by_name FROM registrations r LEFT JOIN users u ON u.id=r.user_id WHERE r.event_id=? ORDER BY r.number`, [ev.id]);
  // ติดธง «ซ้ำ» ให้รายการที่มาทีหลัง เมื่อคนเดียวกันลงหลายครั้ง: บัญชีเดียวกัน / LINE เดียวกัน / เบอร์เดียวกัน / ชื่อ+ชื่อเล่นเดียวกัน (ตัดช่องว่าง ไม่สนตัวพิมพ์)
  const seen = new Map();
  const norm = (x) => String(x || '').replace(/\s+/g, '').toLowerCase();
  for (const r of [...rows].sort((a, b) => a.number - b.number)) {
    const keys = [r.user_id && `u:${r.user_id}:${r.kind}`, r.line_user_id && `l:${r.line_user_id}:${r.kind}`, r.phone && `p:${r.phone.replace(/\D/g, '')}:${r.kind}`, norm(r.name) && `n:${norm(r.name)}|${norm(r.nickname)}:${r.kind}`].filter(Boolean);
    const first = keys.map(k => seen.get(k)).find(Boolean);
    if (first) r.duplicate_of = first; else keys.forEach(k => seen.set(k, r.number));
    delete r.line_user_id;
  }
  res.json(rows);
}));

// โทเคนสำหรับจอ QR หน้างาน — จอเรียกซ้ำเมื่อใกล้หมดอายุ (ต้องล็อกอินแอดมิน ไม่งั้นเปิดจอจากบ้านได้)
r.get('/events/:slug/gate', wrap(async (req, res) => {
  const ev = await getEvent(req.params.slug);
  const win = checkinWindow(ev);
  res.json({ token: gateToken(ev.slug), ttl: GATE_TTL, expiresIn: gateExpiresIn(), mode: ev.config.checkinMode || 'self', window: win, title: ev.title, registrations: await registrationSummary(ev.id) });
}));

/* ---------- อัลบั้มรูปงาน ---------- */
// อัปโหลดทีละหลายไฟล์ (ฟอร์มส่งเป็นชุด ชุดละ ≤ 40) → เก็บ 3 ขนาด → เข้าคิวสแกนหน้าอัตโนมัติ
const albumUpload = uploadMedia.array('photos', 40);
r.post('/events/:slug/album', albumUpload, wrap(async (req, res) => {
  const ev = await getEvent(req.params.slug);
  const ids = [];
  for (const f of req.files || []) { if (!f.mimetype.startsWith('image/')) continue; ids.push(await importPhoto(ev.id, f.path, { remove: true })); }
  res.json({ ok: true, added: ids.length });
}));
r.get('/events/:slug/album', wrap(async (req, res) => {
  const ev = await getEvent(req.params.slug);
  const photos = await q(`SELECT p.*, (SELECT COUNT(*) FROM photo_faces f WHERE f.photo_id=p.id AND f.user_id IS NOT NULL AND f.status<>'rejected') AS matched,
      (SELECT GROUP_CONCAT(u.display_name SEPARATOR ' · ') FROM photo_faces f JOIN users u ON u.id=f.user_id WHERE f.photo_id=p.id AND f.status<>'rejected') AS matched_names
    FROM event_photos p WHERE p.event_id=? ORDER BY p.sort_order, p.id`, [ev.id]);
  const removals = await q('SELECT r.id, r.photo_id, r.reason, r.status, r.created_at, u.display_name FROM photo_removals r JOIN users u ON u.id=r.user_id JOIN event_photos p ON p.id=r.photo_id WHERE p.event_id=? ORDER BY r.status, r.created_at DESC', [ev.id]);
  const faceUsers = (await one('SELECT COUNT(DISTINCT user_id) AS n FROM user_faces')).n;
  res.json({ photos, removals, faceUsers, facesEnabled, provider: faceProvider, pending: photos.filter(p => p.scan === 'pending').length });
}));
r.post('/events/:slug/album/:id/featured', wrap(async (req, res) => { await q('UPDATE event_photos SET featured=1-featured WHERE id=?', [Number(req.params.id)]); res.json({ ok: true }); }));
r.post('/events/:slug/album/:id/rescan', wrap(async (req, res) => { await q("UPDATE event_photos SET scan='pending' WHERE id=?", [Number(req.params.id)]); kickAlbumScan(); res.json({ ok: true }); }));
r.post('/events/:slug/album/rescan-all', wrap(async (req, res) => { const ev = await getEvent(req.params.slug); await q("UPDATE event_photos SET scan='pending' WHERE event_id=? AND scan IN ('failed','skipped','done')", [ev.id]); kickAlbumScan(); res.json({ ok: true }); }));
r.delete('/events/:slug/album/:id', wrap(async (req, res) => { await deletePhoto(Number(req.params.id)); res.json({ ok: true }); }));
r.post('/album/removals/:id/:action', wrap(async (req, res) => {
  if (!['done', 'declined'].includes(req.params.action)) throw new HttpError(400, 'คำสั่งไม่ถูกต้อง');
  const rm = await one('SELECT * FROM photo_removals WHERE id=?', [Number(req.params.id)]);
  if (!rm) throw new HttpError(404, 'ไม่พบคำขอ');
  if (req.params.action === 'done') await deletePhoto(rm.photo_id);   // ลบรูป → คำขอหายตาม (cascade)
  else await q("UPDATE photo_removals SET status='declined' WHERE id=?", [rm.id]);
  res.json({ ok: true });
}));

// ลบการลงทะเบียน (ซ้ำ/ลงเล่น) — lucky_draws ลบตาม (FK cascade)
r.delete('/registrations/:id', wrap(async (req, res) => {
  const reg = await one('SELECT r.id, r.event_id, e.slug FROM registrations r JOIN events e ON e.id=r.event_id WHERE r.id=?', [Number(req.params.id)]);
  if (!reg) throw new HttpError(404, 'ไม่พบรายการ');
  await q('DELETE FROM registrations WHERE id=?', [reg.id]);
  emit(reg.slug, 'registrations', await registrationSummary(reg.event_id));
  res.json({ ok: true });
}));

// สุ่ม Lucky Fan จากคนที่เช็คอินแล้วและยังไม่เคยได้
r.post('/events/:slug/draw', wrap(async (req, res) => {
  const ev = await getEvent(req.params.slug);
  const rounds = ev.config.drawRounds || 3;
  const done = await drawsOf(ev.id);
  if (done.length >= rounds) throw new HttpError(400, `สุ่มครบ ${rounds} รอบแล้ว`);
  const pool = await q(`SELECT id FROM registrations WHERE event_id=? AND checked_in_at IS NOT NULL AND id NOT IN (SELECT registration_id FROM lucky_draws WHERE event_id=?)`, [ev.id, ev.id]);
  if (!pool.length) throw new HttpError(400, 'ยังไม่มีผู้เช็คอินที่ยังไม่ได้รางวัล');
  const pick = pool[Math.floor(Math.random() * pool.length)];
  const round = done.length + 1;
  await q('INSERT INTO lucky_draws SET ?', [{ event_id: ev.id, round, registration_id: pick.id }]);
  const winner = await one('SELECT line_user_id, user_id FROM registrations WHERE id=?', [pick.id]);
  if (winner?.line_user_id) push(winner.line_user_id, msg.luckyFan({ round })).catch(() => {});
  if (winner?.user_id) syncStamps(winner.user_id).catch(() => {});
  const draws = await drawsOf(ev.id);
  emit(ev.slug, 'draw', { rounds, draws, latest: draws[draws.length - 1] });
  res.json({ rounds, draws, latest: draws[draws.length - 1] });
}));

r.delete('/events/:slug/draw', wrap(async (req, res) => {
  const ev = await getEvent(req.params.slug);
  await q('DELETE FROM lucky_draws WHERE event_id=?', [ev.id]);
  emit(ev.slug, 'draw', { rounds: ev.config.drawRounds || 3, draws: [], latest: null });
  res.json({ ok: true });
}));

export default r;
