import { Router } from 'express';
import { q, one } from '../db.js';
import { wrap, HttpError, getEvent, seatsOf, donationSummary, registrationSummary, drawsOf, reportOf, emit } from '../lib.js';
import { push, multicast, msg, lineEnabled } from '../line.js';
import { upload } from './public.js';

const siteUrl = () => process.env.SITE_URL || 'http://localhost:5173';

const r = Router();

// ป้องกันด้วย header x-admin-key (ตั้งค่าใน .env → ADMIN_KEY)
export const requireAdmin = (req, _res, next) => {
  const key = process.env.ADMIN_KEY || 'bigcat-admin';
  if (req.get('x-admin-key') !== key) return next(new HttpError(401, 'รหัสผู้ดูแลไม่ถูกต้อง'));
  next();
};
r.use(requireAdmin);

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
const EV_STATUS = ['upcoming', 'open', 'soldout', 'live', 'ended'];
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

r.post('/events', upload.single('cover'), wrap(async (req, res) => {
  const p = typeof req.body.payload === 'string' ? JSON.parse(req.body.payload) : req.body;
  const row = eventRow(p, req.file);
  row.slug = slugify(p.slug || p.title, row.type, row.starts_at);
  if (await one('SELECT id FROM events WHERE slug=?', [row.slug])) throw new HttpError(409, `slug "${row.slug}" มีอยู่แล้ว ตั้งชื่ออื่น`);
  const ins = await q('INSERT INTO events SET ?', [row]);
  await ensureSeats(ins.insertId, JSON.parse(row.config));
  if (row.type === 'merit') await syncCategories(ins.insertId, p.categories);
  res.json({ ok: true, slug: row.slug });
}));

r.put('/events/:slug', upload.single('cover'), wrap(async (req, res) => {
  const cur = await one('SELECT * FROM events WHERE slug=?', [req.params.slug]);
  if (!cur) throw new HttpError(404, 'ไม่พบกิจกรรมนี้');
  const p = typeof req.body.payload === 'string' ? JSON.parse(req.body.payload) : req.body;
  const row = eventRow(p, req.file, cur);
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
  const allowed = ['upcoming', 'open', 'soldout', 'live', 'ended'];
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
r.post('/checkin/:code', wrap(async (req, res) => {
  const codeUp = req.params.code.toUpperCase();
  const b = await one('SELECT id, status, name, seats FROM bookings WHERE code=?', [codeUp]);
  if (b) {
    if (b.status === 'checked_in') return res.json({ kind: 'booking', already: true, name: b.name });
    if (b.status !== 'paid') throw new HttpError(400, `บัตรนี้ยังไม่ได้ยืนยันการชำระเงิน (${b.status})`);
    await q(`UPDATE bookings SET status='checked_in' WHERE id=?`, [b.id]);
    return res.json({ kind: 'booking', name: b.name, seats: typeof b.seats === 'string' ? JSON.parse(b.seats) : b.seats });
  }
  const reg = await one('SELECT r.id, r.name, r.number, r.checked_in_at, r.event_id, e.slug FROM registrations r JOIN events e ON e.id=r.event_id WHERE r.code=?', [codeUp]);
  if (!reg) throw new HttpError(404, 'ไม่พบรหัสนี้');
  if (!reg.checked_in_at) await q('UPDATE registrations SET checked_in_at=UTC_TIMESTAMP() WHERE id=?', [reg.id]);
  emit(reg.slug, 'registrations', await registrationSummary(reg.event_id));
  res.json({ kind: 'registration', name: reg.name, number: reg.number, already: !!reg.checked_in_at });
}));

/* ---------- Donations ---------- */
r.get('/events/:slug/donations', wrap(async (req, res) => {
  const ev = await getEvent(req.params.slug);
  res.json(await q(`SELECT d.*, c.name AS category FROM donations d JOIN donation_categories c ON c.id=d.category_id WHERE d.event_id=? ORDER BY FIELD(d.status,'pending','approved','rejected'), d.created_at DESC`, [ev.id]));
}));

async function setDonationStatus(ids, status) {
  if (!ids.length) return [];
  const rows = await q(`SELECT d.id, d.code, d.amount, d.line_user_id, d.event_id, c.name AS category, e.slug, e.title FROM donations d JOIN donation_categories c ON c.id=d.category_id JOIN events e ON e.id=d.event_id WHERE d.id IN (?)`, [ids]);
  if (!rows.length) return [];
  await q('UPDATE donations SET status=? WHERE id IN (?)', [status, rows.map(r => r.id)]);
  for (const slug of new Set(rows.map(r => r.slug))) emit(slug, 'donations', await donationSummary(rows.find(r => r.slug === slug).event_id));
  for (const d of rows) {
    if (!d.line_user_id) continue;
    const text = status === 'approved' ? msg.donationApproved({ ...d, url: `${siteUrl()}/ticket/${d.code}` }) : msg.donationRejected(d);
    push(d.line_user_id, text).catch(() => {});
  }
  return rows;
}

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
  res.json(await q('SELECT id, code, number, name, nickname, social, phone, kind, line_user_id IS NOT NULL AS lineLinked, checked_in_at, created_at FROM registrations WHERE event_id=? ORDER BY number', [ev.id]));
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
  const winner = await one('SELECT line_user_id FROM registrations WHERE id=?', [pick.id]);
  if (winner?.line_user_id) push(winner.line_user_id, msg.luckyFan({ round })).catch(() => {});
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
