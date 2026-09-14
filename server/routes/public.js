import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { q, one, tx } from '../db.js';
import { wrap, HttpError, code, getEvent, shapeEvent, eventDetail, seatsOf, donationSummary, registrationSummary, drawsOf, songsOf, pollSummary, emit } from '../lib.js';
import { verifySlip, slipEnabled } from '../slip.js';
import { lineEnabled, lineOaId, notifyStaff, push, msg } from '../line.js';

export const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(process.cwd(), 'server', 'uploads'),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${code(6)}${path.extname(file.originalname || '').toLowerCase() || '.jpg'}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
});

const r = Router();
const clean = (v, max = 200) => String(v ?? '').trim().slice(0, max);

// ค่าที่ frontend ต้องรู้ (ไม่มีความลับ)
r.get('/config', (_req, res) => res.json({ slipEnabled, lineEnabled, lineOaId, siteUrl: process.env.SITE_URL || '' }));

/* ---------- Events ---------- */
r.get('/events', wrap(async (_req, res) => {
  const rows = (await q('SELECT * FROM events ORDER BY starts_at')).map(shapeEvent);
  const list = await Promise.all(rows.map(async ev => {
    const summary = {};
    if (ev.type === 'fanmeet') {
      const s = await one(`SELECT COUNT(*) AS total, SUM(status='available') AS free FROM seats WHERE event_id=?`, [ev.id]);
      summary.seats = { total: Number(s.total), free: Number(s.free || 0) };
    }
    if (ev.type === 'merit') { const d = await donationSummary(ev.id); summary.donation = { total: d.total, goal: d.goal, percent: d.percent, donors: d.donors }; }
    if (ev.type === 'busking') summary.registrations = await registrationSummary(ev.id);
    return { ...ev, summary };
  }));
  res.json(list);
}));

r.get('/events/:slug', wrap(async (req, res) => res.json(await eventDetail(req.params.slug))));

/* ---------- Fan meet: ที่นั่ง ---------- */
r.get('/events/:slug/seats', wrap(async (req, res) => res.json(await seatsOf((await getEvent(req.params.slug)).id))));

// จองชั่วคราว (hold) — เลือกได้สูงสุด maxPerBooking, หมดอายุใน holdMinutes
r.post('/events/:slug/seats/hold', wrap(async (req, res) => {
  const ev = await getEvent(req.params.slug);
  if (ev.status !== 'open') throw new HttpError(400, 'กิจกรรมนี้ยังไม่เปิดจอง');
  const cfg = ev.config.seatMap || {};
  const max = cfg.maxPerBooking || 4;
  const minutes = cfg.holdMinutes || 10;
  const token = clean(req.body.holdToken, 64) || code(24);
  const wanted = [...new Set((req.body.seatIds || []).map(Number).filter(Boolean))];
  if (!wanted.length) throw new HttpError(400, 'กรุณาเลือกที่นั่งอย่างน้อย 1 ที่');
  if (wanted.length > max) throw new HttpError(400, `จองได้สูงสุด ${max} ที่ต่อครั้ง`);

  const result = await tx(async ({ q }) => {
    // ปล่อยที่นั่งที่ token นี้เคยถืออยู่ก่อน (กรณีเปลี่ยนใจ)
    await q(`UPDATE seats SET status='available', hold_token=NULL, hold_expires_at=NULL WHERE event_id=? AND status='held' AND hold_token=?`, [ev.id, token]);
    const rows = await q(`SELECT id, label, status, hold_expires_at FROM seats WHERE event_id=? AND id IN (?) FOR UPDATE`, [ev.id, wanted]);
    const taken = rows.filter(s => s.status === 'booked' || (s.status === 'held' && new Date(String(s.hold_expires_at).replace(' ', 'T') + 'Z') > new Date()));
    if (taken.length) throw new HttpError(409, `ที่นั่ง ${taken.map(s => s.label).join(', ')} ถูกจองไปแล้ว`);
    await q(`UPDATE seats SET status='held', hold_token=?, hold_expires_at=DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE) WHERE event_id=? AND id IN (?)`, [token, minutes, ev.id, wanted]);
    return { holdToken: token, expiresAt: new Date(Date.now() + minutes * 60000).toISOString(), seats: rows.map(s => s.label) };
  });
  emit(ev.slug, 'seats', await seatsOf(ev.id));
  res.json(result);
}));

r.post('/events/:slug/seats/release', wrap(async (req, res) => {
  const ev = await getEvent(req.params.slug);
  await q(`UPDATE seats SET status='available', hold_token=NULL, hold_expires_at=NULL WHERE event_id=? AND status='held' AND hold_token=?`, [ev.id, clean(req.body.holdToken, 64)]);
  emit(ev.slug, 'seats', await seatsOf(ev.id));
  res.json({ ok: true });
}));

// ยืนยันการจอง: แปลง held → booked, สร้าง booking (รอตรวจสลิป)
r.post('/events/:slug/bookings', upload.single('slip'), wrap(async (req, res) => {
  const ev = await getEvent(req.params.slug);
  const token = clean(req.body.holdToken, 64);
  const name = clean(req.body.name, 120), phone = clean(req.body.phone, 30), email = clean(req.body.email, 160);
  if (!token || !name || !phone) throw new HttpError(400, 'กรุณากรอกชื่อและเบอร์โทร');
  const held = await q(`SELECT price FROM seats WHERE event_id=? AND status='held' AND hold_token=? AND hold_expires_at > UTC_TIMESTAMP()`, [ev.id, token]);
  if (!held.length) throw new HttpError(410, 'ที่นั่งที่เลือกหมดเวลาแล้ว กรุณาเลือกใหม่');
  const expected = held.reduce((s, x) => s + x.price, 0);
  const verify = req.file ? await verifySlip(req.file.path, { expectedAmount: expected }) : { ok: false, note: 'ยังไม่แนบสลิป' };
  const booking = await tx(async ({ q }) => {
    const seats = await q(`SELECT id, label, price FROM seats WHERE event_id=? AND status='held' AND hold_token=? AND hold_expires_at > UTC_TIMESTAMP() FOR UPDATE`, [ev.id, token]);
    if (!seats.length) throw new HttpError(410, 'ที่นั่งที่เลือกหมดเวลาแล้ว กรุณาเลือกใหม่');
    const amount = seats.reduce((s, x) => s + x.price, 0);
    const bookingCode = code(8);
    const ins = await q('INSERT INTO bookings SET ?', [{ code: bookingCode, event_id: ev.id, name, phone, email: email || null, seats: JSON.stringify(seats.map(s => s.label)), amount, slip_path: req.file ? `/uploads/${req.file.filename}` : null, trans_ref: verify.ok ? verify.transRef : null, verified_at: verify.ok ? new Date() : null, verify_note: verify.note, status: verify.ok ? 'paid' : 'pending' }]);
    await q(`UPDATE seats SET status='booked', booking_id=?, hold_token=NULL, hold_expires_at=NULL WHERE id IN (?)`, [ins.insertId, seats.map(s => s.id)]);
    return { code: bookingCode, amount, seats: seats.map(s => s.label), status: verify.ok ? 'paid' : 'pending', autoApproved: verify.ok, note: verify.note };
  });
  emit(ev.slug, 'seats', await seatsOf(ev.id));
  if (!verify.ok) notifyStaff(msg.staffNew('การจอง', ev.title, `${name} · ${booking.seats.join(', ')} · ฿${expected}\n${verify.note}`)).catch(() => {});
  res.json(booking);
}));

r.get('/bookings/:code', wrap(async (req, res) => {
  const b = await one(`SELECT b.*, b.line_user_id IS NOT NULL AS lineLinked, e.title, e.slug, e.starts_at, e.place, e.tone FROM bookings b JOIN events e ON e.id=b.event_id WHERE b.code=?`, [req.params.code.toUpperCase()]);
  if (!b) throw new HttpError(404, 'ไม่พบการจองนี้');
  delete b.line_user_id;
  res.json({ ...b, seats: typeof b.seats === 'string' ? JSON.parse(b.seats) : b.seats });
}));

/* ---------- ทำบุญ ---------- */
r.get('/events/:slug/donations', wrap(async (req, res) => res.json(await donationSummary((await getEvent(req.params.slug)).id))));

r.post('/events/:slug/donations', upload.single('slip'), wrap(async (req, res) => {
  const ev = await getEvent(req.params.slug);
  if (!['open', 'live'].includes(ev.status)) throw new HttpError(400, 'กิจกรรมนี้ปิดรับแล้ว');
  // ปิดรับยอดออนไลน์ตามกำหนด (config.donateUntil) แยกจากวันงาน
  if (ev.config.donateUntil && new Date(String(ev.config.donateUntil).replace(' ', 'T')) < new Date()) throw new HttpError(400, 'ปิดรับยอดออนไลน์แล้ว');
  const category = await one('SELECT id, unit_price, unit_name FROM donation_categories WHERE id=? AND event_id=?', [Number(req.body.categoryId), ev.id]);
  if (!category) throw new HttpError(400, 'กรุณาเลือกหมวดที่ต้องการทำบุญ');
  // หมวดที่มีหน่วยของจริง: ส่ง units มาแล้วคำนวณยอดจากราคาต่อหน่วย
  const units = category.unit_price && req.body.units ? Math.max(1, Math.round(Number(req.body.units))) : null;
  const amount = units ? units * category.unit_price : Math.round(Number(req.body.amount));
  if (!(amount >= 1)) throw new HttpError(400, 'กรุณาระบุจำนวนเงิน');
  const donor = clean(req.body.name, 120) || 'ผู้ไม่ประสงค์ออกนาม';
  const verify = req.file ? await verifySlip(req.file.path, { expectedAmount: amount }) : { ok: false, note: 'ยังไม่แนบสลิป' };
  const c = code(8);
  await q('INSERT INTO donations SET ?', [{
    code: c, event_id: ev.id, category_id: category.id, donor_name: donor, dedication: clean(req.body.dedication, 160) || null,
    message: clean(req.body.message, 300) || null, anonymous: req.body.anonymous === '1' || req.body.anonymous === 'true' ? 1 : 0,
    amount, units, slip_path: req.file ? `/uploads/${req.file.filename}` : null,
    trans_ref: verify.ok ? verify.transRef : null, verified_at: verify.ok ? new Date() : null, verify_note: verify.note, status: verify.ok ? 'approved' : 'pending',
  }]);
  if (verify.ok) emit(ev.slug, 'donations', await donationSummary(ev.id));
  else notifyStaff(msg.staffNew('ยอดทำบุญ', ev.title, `${donor} · ฿${amount}${units ? ` (${units} ${category.unit_name})` : ''}\n${verify.note}`)).catch(() => {});
  res.json({ code: c, status: verify.ok ? 'approved' : 'pending', autoApproved: verify.ok, note: verify.note, amount });
}));

// โหวตใน milestone (1 เสียง/เบราว์เซอร์ ต่อ poll)
r.post('/events/:slug/polls/:key/vote', wrap(async (req, res) => {
  const ev = await getEvent(req.params.slug);
  const key = clean(req.params.key, 60), option = Number(req.body.option), voter = clean(req.body.voterToken, 64);
  if (!voter || !(option >= 0)) throw new HttpError(400, 'ข้อมูลโหวตไม่ถูกต้อง');
  await q('INSERT INTO poll_votes SET ? ON DUPLICATE KEY UPDATE option_index=VALUES(option_index)', [{ event_id: ev.id, poll_key: key, option_index: option, voter_token: voter }]);
  const polls = await pollSummary(ev.id);
  emit(ev.slug, 'polls', polls);
  res.json(polls);
}));

r.get('/donations/:code', wrap(async (req, res) => {
  const d = await one(`SELECT d.code, d.donor_name, d.dedication, d.message, d.anonymous, d.amount, d.units, d.status, d.verified_at, d.line_user_id IS NOT NULL AS lineLinked, d.created_at, c.name AS category, c.unit_name, e.title, e.slug, e.cover, e.starts_at, e.place, e.tone FROM donations d JOIN donation_categories c ON c.id=d.category_id JOIN events e ON e.id=d.event_id WHERE d.code=?`, [req.params.code.toUpperCase()]);
  if (!d) throw new HttpError(404, 'ไม่พบรายการนี้');
  res.json(d);
}));

/* ---------- Busking: ลงทะเบียน / เช็คอิน / Lucky Fan / ขอเพลง ---------- */
r.post('/events/:slug/registrations', wrap(async (req, res) => {
  const ev = await getEvent(req.params.slug);
  if (!['open', 'live', 'upcoming'].includes(ev.status)) throw new HttpError(400, 'กิจกรรมนี้ปิดลงทะเบียนแล้ว');
  const name = clean(req.body.name, 120);
  if (!name) throw new HttpError(400, 'กรุณากรอกชื่อ');
  const reg = await tx(async ({ q, one }) => {
    const n = await one('SELECT COALESCE(MAX(number),0)+1 AS next FROM registrations WHERE event_id=? FOR UPDATE', [ev.id]);
    const c = code(8);
    await q('INSERT INTO registrations SET ?', [{ code: c, event_id: ev.id, number: n.next, name, nickname: clean(req.body.nickname, 60) || null, social: clean(req.body.social, 120) || null, phone: clean(req.body.phone, 30) || null, kind: clean(req.body.kind, 20) || 'attend' }]);
    return { code: c, number: n.next };
  });
  emit(ev.slug, 'registrations', await registrationSummary(ev.id));
  res.json(reg);
}));

r.get('/registrations/:code', wrap(async (req, res) => {
  const reg = await one(`SELECT r.*, r.line_user_id IS NOT NULL AS lineLinked, e.slug, e.title, e.status AS event_status, e.starts_at, e.place, e.tone FROM registrations r JOIN events e ON e.id=r.event_id WHERE r.code=?`, [req.params.code.toUpperCase()]);
  if (!reg) throw new HttpError(404, 'ไม่พบการลงทะเบียนนี้');
  const win = await one('SELECT round FROM lucky_draws WHERE registration_id=?', [reg.id]);
  delete reg.line_user_id;
  res.json({ ...reg, luckyRound: win?.round || null });
}));

// เช็คอินด้วยตัวเอง — เปิดเฉพาะตอนงานกำลังจัด (status = live)
r.post('/registrations/:code/checkin', wrap(async (req, res) => {
  const reg = await one(`SELECT r.id, r.event_id, r.checked_in_at, e.slug, e.status FROM registrations r JOIN events e ON e.id=r.event_id WHERE r.code=?`, [req.params.code.toUpperCase()]);
  if (!reg) throw new HttpError(404, 'ไม่พบการลงทะเบียนนี้');
  if (reg.status !== 'live') throw new HttpError(400, 'เช็คอินได้เฉพาะระหว่างเวลางาน');
  if (!reg.checked_in_at) await q('UPDATE registrations SET checked_in_at=UTC_TIMESTAMP() WHERE id=?', [reg.id]);
  emit(reg.slug, 'registrations', await registrationSummary(reg.event_id));
  res.json({ ok: true });
}));

r.get('/events/:slug/draw', wrap(async (req, res) => {
  const ev = await getEvent(req.params.slug);
  res.json({ rounds: ev.config.drawRounds || 3, draws: await drawsOf(ev.id), registrations: await registrationSummary(ev.id) });
}));

r.get('/events/:slug/songs', wrap(async (req, res) => res.json(await songsOf((await getEvent(req.params.slug)).id))));
r.post('/events/:slug/songs', wrap(async (req, res) => {
  const ev = await getEvent(req.params.slug);
  const title = clean(req.body.title, 160);
  if (!title) throw new HttpError(400, 'กรุณาใส่ชื่อเพลง');
  await q('INSERT INTO song_requests SET ?', [{ event_id: ev.id, title, artist: clean(req.body.artist, 120) || null }]);
  const songs = await songsOf(ev.id);
  emit(ev.slug, 'songs', songs);
  res.json(songs);
}));
r.post('/events/:slug/songs/:id/vote', wrap(async (req, res) => {
  const ev = await getEvent(req.params.slug);
  await q('UPDATE song_requests SET votes=votes+1 WHERE id=? AND event_id=?', [Number(req.params.id), ev.id]);
  const songs = await songsOf(ev.id);
  emit(ev.slug, 'songs', songs);
  res.json(songs);
}));

export default r;
