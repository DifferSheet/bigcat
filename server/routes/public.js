import { Router } from 'express';
import { requirePhone } from '../validate.js';
import { q, one, tx } from '../db.js';
import { wrap, HttpError, code, getEvent, shapeEvent, eventDetail, seatsOf, donationSummary, registrationSummary, drawsOf, songsOf, pollSummary, emit, bkk, hhmm, gateValid, checkinWindow } from '../lib.js';
import { verifySlip, slipEnabled } from '../slip.js';
import { ownerFields, authProviders } from '../auth.js';
import { lineEnabled, lineOaId, notifyStaff, push, msg } from '../line.js';

import { upload } from '../upload.js';
export { upload };   // (ย้ายไป server/upload.js — คง re-export ให้ route อื่นที่ import จากที่นี่)

const r = Router();
const clean = (v, max = 200) => String(v ?? '').trim().slice(0, max);

// ค่าที่ frontend ต้องรู้ (ไม่มีความลับ)
r.get('/config', (_req, res) => res.json({ slipEnabled, lineEnabled, lineOaId, authProviders, siteUrl: process.env.SITE_URL || '' }));

/* ---------- Events ---------- */
r.get('/events', wrap(async (_req, res) => {
  const rows = (await q("SELECT * FROM events WHERE status <> 'hidden' ORDER BY starts_at")).map(shapeEvent);
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

// งานที่ซ่อนอยู่: คนทั่วไปเห็น 404 · แอดมิน (ส่ง x-admin-key) พรีวิวได้
r.get('/events/:slug', wrap(async (req, res) => {
  const d = await eventDetail(req.params.slug);
  // การลงทะเบียนของบัญชีที่ล็อกอินอยู่ (ใช้ในโหมด self ให้หน้าเว็บรู้ว่าลงแล้ว)
  if (req.user) d.mine = await q('SELECT code, number, kind FROM registrations WHERE event_id=? AND user_id=?', [d.event.id, req.user.id]);
  if (d.event.status === 'hidden' && req.get('x-admin-key') !== (process.env.ADMIN_KEY || 'bigcat-admin')) throw new HttpError(404, 'ไม่พบกิจกรรมนี้');
  res.json(d);
}));

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
  const name = clean(req.body.name, 120), email = clean(req.body.email, 160);
  if (!token || !name) throw new HttpError(400, 'กรุณากรอกชื่อและเบอร์โทร');
  const phone = requirePhone(req.body.phone);
  const held = await q(`SELECT price FROM seats WHERE event_id=? AND status='held' AND hold_token=? AND hold_expires_at > UTC_TIMESTAMP()`, [ev.id, token]);
  if (!held.length) throw new HttpError(410, 'ที่นั่งที่เลือกหมดเวลาแล้ว กรุณาเลือกใหม่');
  const expected = held.reduce((s, x) => s + x.price, 0);
  const verify = req.file ? await verifySlip(req.file.path, { expectedAmount: expected }) : { ok: false, note: 'ยังไม่แนบสลิป' };
  const booking = await tx(async ({ q }) => {
    const seats = await q(`SELECT id, label, price FROM seats WHERE event_id=? AND status='held' AND hold_token=? AND hold_expires_at > UTC_TIMESTAMP() FOR UPDATE`, [ev.id, token]);
    if (!seats.length) throw new HttpError(410, 'ที่นั่งที่เลือกหมดเวลาแล้ว กรุณาเลือกใหม่');
    const amount = seats.reduce((s, x) => s + x.price, 0);
    const bookingCode = code(8);
    const ins = await q('INSERT INTO bookings SET ?', [{ code: bookingCode, event_id: ev.id, name, phone, email: email || null, seats: JSON.stringify(seats.map(s => s.label)), amount, slip_path: req.file ? `/uploads/${req.file.filename}` : null, trans_ref: verify.transRef || null, verified_at: verify.verified ? new Date() : null, verify_note: verify.note, status: verify.ok ? 'paid' : 'pending', ...ownerFields(req) }]);
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
  if (ev.config.donateUntil && bkk(ev.config.donateUntil) < new Date()) throw new HttpError(400, 'ปิดรับยอดออนไลน์แล้ว');
  // รายการที่เลือก: items = [{categoryId, units?, amount?}] (JSON) หรือแบบเดิม categoryId+units/amount รายการเดียว
  let items = [];
  try { items = req.body.items ? JSON.parse(req.body.items) : [{ categoryId: req.body.categoryId, units: req.body.units, amount: req.body.amount }]; } catch { throw new HttpError(400, 'รายการไม่ถูกต้อง'); }
  if (!Array.isArray(items) || !items.length) throw new HttpError(400, 'กรุณาเลือกหมวดที่ต้องการทำบุญ');
  const cats = await q('SELECT id, name, unit_price, unit_name FROM donation_categories WHERE event_id=?', [ev.id]);
  const lines = [];
  for (const it of items) {
    const category = cats.find(c => c.id === Number(it.categoryId));
    if (!category) throw new HttpError(400, 'กรุณาเลือกหมวดที่ต้องการทำบุญ');
    if (lines.some(l => l.category.id === category.id)) continue;   // กันหมวดซ้ำ
    // หมวดที่มีหน่วยของจริง: ส่ง units มาแล้วคำนวณยอดจากราคาต่อหน่วย
    const units = category.unit_price && it.units ? Math.max(1, Math.round(Number(it.units))) : null;
    const amount = units ? units * category.unit_price : Math.round(Number(it.amount));
    if (!(amount >= 1)) throw new HttpError(400, `กรุณาระบุจำนวนเงินของหมวด ${category.name}`);
    lines.push({ category, units, amount });
  }
  const amount = lines.reduce((s, l) => s + l.amount, 0);
  const donor = clean(req.body.name, 120) || 'ผู้ไม่ประสงค์ออกนาม';
  if (!req.file) throw new HttpError(400, 'กรุณาแนบสลิปโอนเงิน');
  const verify = await verifySlip(req.file.path, { expectedAmount: amount });   // ตรวจครั้งเดียวกับยอดรวม
  const groupCode = code(8);
  const common = {
    event_id: ev.id, donor_name: donor, dedication: clean(req.body.dedication, 160) || null,
    message: clean(req.body.message, 300) || null, anonymous: req.body.anonymous === '1' || req.body.anonymous === 'true' ? 1 : 0,
    slip_path: `/uploads/${req.file.filename}`, verified_at: verify.verified ? new Date() : null, verify_note: verify.note,
    status: verify.ok ? 'approved' : 'pending', group_code: groupCode, ...ownerFields(req),
  };
  // trans_ref เก็บที่แถวแรกแถวเดียว (unique) — ใช้กันสลิปซ้ำ
  for (const [i, l] of lines.entries()) {
    await q('INSERT INTO donations SET ?', [{ ...common, code: i === 0 ? groupCode : code(8), category_id: l.category.id, amount: l.amount, units: l.units, trans_ref: i === 0 ? (verify.transRef || null) : null }]);
  }
  const detail = lines.map(l => `${l.category.name}${l.units ? ` ${l.units} ${l.category.unit_name}` : ''} ฿${l.amount}`).join(' · ');
  if (verify.ok) emit(ev.slug, 'donations', await donationSummary(ev.id));
  else notifyStaff(msg.staffNew('ยอดทำบุญ', ev.title, `${donor} · ฿${amount}\n${detail}\n${verify.note}`)).catch(() => {});
  res.json({ code: groupCode, status: verify.ok ? 'approved' : 'pending', autoApproved: verify.ok, note: verify.note, amount, items: lines.map(l => ({ category: l.category.name, units: l.units, amount: l.amount })) });
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
  const codeUp = req.params.code.toUpperCase();
  // แถวหลัก + แถวอื่นในกลุ่มเดียวกัน (ทำบุญหลายหมวดครั้งเดียว) → ตอบเป็นรายการเดียวพร้อม items และยอดรวม
  const rows = await q(`SELECT d.code, d.group_code, d.donor_name, d.dedication, d.message, d.anonymous, d.amount, d.units, d.status, d.verified_at, d.line_user_id IS NOT NULL AS lineLinked, d.created_at, c.name AS category, c.unit_name, e.title, e.slug, e.cover, e.starts_at, e.place, e.tone
    FROM donations d JOIN donation_categories c ON c.id=d.category_id JOIN events e ON e.id=d.event_id WHERE d.code=? OR d.group_code=? ORDER BY d.id`, [codeUp, codeUp]);
  const main = rows.find(r => r.code === codeUp) || rows[0];
  if (!main) throw new HttpError(404, 'ไม่พบรายการนี้');
  const items = rows.map(r => ({ category: r.category, units: r.units, unit_name: r.unit_name, amount: r.amount }));
  res.json({ ...main, code: codeUp, amount: rows.reduce((s, r) => s + r.amount, 0), category: items.map(i => i.category).join(' · '), items });
}));

/* ---------- Busking: ลงทะเบียน / เช็คอิน / Lucky Fan / ขอเพลง ---------- */
r.post('/events/:slug/registrations', wrap(async (req, res) => {
  const ev = await getEvent(req.params.slug);
  if (!['open', 'live', 'upcoming'].includes(ev.status)) throw new HttpError(400, 'กิจกรรมนี้ปิดลงทะเบียนแล้ว');
  const name = clean(req.body.name, 120);
  if (!name) throw new HttpError(400, 'กรุณากรอกชื่อ');
  // โหมดลงทะเบียน: anyone (ค่าเริ่มต้น) ใครลงให้ใครก็ได้ · self ต้องล็อกอินและ 1 บัญชี = 1 การลงทะเบียน
  if ((ev.config?.registerMode || 'anyone') === 'self') {
    if (!req.user) throw new HttpError(401, 'งานนี้ลงทะเบียนด้วยตนเองเท่านั้น — เข้าสู่ระบบด้วย LINE หรือ Google ก่อน');
    const dup = await one('SELECT code, number FROM registrations WHERE event_id=? AND user_id=? AND kind=?', [ev.id, req.user.id, clean(req.body.kind, 20) || 'attend']);
    if (dup) return res.json({ ...dup, existing: true });
  }
  const reg = await tx(async ({ q, one }) => {
    const n = await one('SELECT COALESCE(MAX(number),0)+1 AS next FROM registrations WHERE event_id=? FOR UPDATE', [ev.id]);
    const c = code(8);
    await q('INSERT INTO registrations SET ?', [{ code: c, event_id: ev.id, number: n.next, name, nickname: clean(req.body.nickname, 60) || null, social: clean(req.body.social, 120) || null, phone: requirePhone(req.body.phone, { required: false }) || null, kind: clean(req.body.kind, 20) || 'attend', ...ownerFields(req) }]);
    return { code: c, number: n.next };
  });
  emit(ev.slug, 'registrations', await registrationSummary(ev.id));
  res.json(reg);
}));

r.get('/registrations/:code', wrap(async (req, res) => {
  const reg = await one(`SELECT r.*, r.line_user_id IS NOT NULL AS lineLinked, e.slug, e.title, e.status AS event_status, e.starts_at, e.place, e.tone, JSON_UNQUOTE(JSON_EXTRACT(e.config, '$.checkinMode')) AS checkin_mode, JSON_EXTRACT(e.config, '$.checkinWindow') AS checkin_window FROM registrations r JOIN events e ON e.id=r.event_id WHERE r.code=?`, [req.params.code.toUpperCase()]);
  if (!reg) throw new HttpError(404, 'ไม่พบการลงทะเบียนนี้');
  const win = await one('SELECT round FROM lucky_draws WHERE registration_id=?', [reg.id]);
  delete reg.line_user_id;
  res.json({ ...reg, luckyRound: win?.round || null });
}));

// เช็คอินด้วยตัวเอง — ตาม config.checkinMode ของงาน
//   self  (ค่าเริ่มต้น) กดบนบัตร/หน้างานได้ — ในหน้าต่างเวลา (checkinWindow) หรือถ้าไม่ได้ตั้ง ต้องสถานะงาน live
//   gate  ต้องสแกน QR หน้างาน (โทเคนหมุนทุก 45 วิ) แล้วส่ง body.gate มาด้วย · เคารพหน้าต่างเวลาเหมือนกัน
//   staff ปฏิเสธ — พี่ ๆ หน้างานสแกนบัตรเท่านั้น
// body.geo = { lat, lng, acc } (ถ้ามือถือให้พิกัด) เก็บไว้ดูทีหลังว่าคนเช็คอินอยู่ตรงไหนจริง ๆ — ไม่ใช้ตัดสิทธิ์
r.post('/registrations/:code/checkin', wrap(async (req, res) => {
  const reg = await one(`SELECT r.id, r.number, r.name, r.nickname, r.event_id, r.checked_in_at, e.slug, e.status, e.starts_at, e.config FROM registrations r JOIN events e ON e.id=r.event_id WHERE r.code=?`, [req.params.code.toUpperCase()]);
  if (!reg) throw new HttpError(404, 'ไม่พบการลงทะเบียนนี้');
  const ev = shapeEvent(reg);
  const mode = ev.config.checkinMode || 'self';
  if (mode === 'staff') throw new HttpError(403, 'งานนี้ให้พี่ ๆ หน้างานสแกน QR บนบัตรเพื่อเช็คอิน');
  if (mode === 'gate' && !gateValid(ev.slug, req.body?.gate)) throw new HttpError(req.body?.gate ? 410 : 403, req.body?.gate ? 'QR หมดอายุแล้ว — สแกน QR หน้างานอีกครั้ง' : 'งานนี้ต้องสแกน QR ที่หน้างานเพื่อเช็คอิน');
  const win = checkinWindow(ev), now = new Date();
  if (win) {
    if (now < win.opens) throw new HttpError(400, `เช็คอินเปิดเวลา ${hhmm(win.opens)} น.`);
    if (now > win.closes) throw new HttpError(400, `ปิดเช็คอินแล้วเมื่อ ${hhmm(win.closes)} น. — ดูโชว์ได้ แต่ไม่ได้สิทธิ์ที่ต้องเช็คอิน`);
  } else if (ev.status !== 'live') throw new HttpError(400, 'เช็คอินได้เฉพาะระหว่างเวลางาน');
  const already = !!reg.checked_in_at;
  if (!already) {
    const g = req.body?.geo || {};
    const num = (v, max) => (Number.isFinite(Number(v)) && Math.abs(Number(v)) <= max ? Number(v) : null);
    await q('UPDATE registrations SET checked_in_at=UTC_TIMESTAMP(), checkin_via=?, checkin_lat=?, checkin_lng=?, checkin_acc=? WHERE id=?', [mode, num(g.lat, 90), num(g.lng, 180), g.acc != null ? Math.min(Math.round(Number(g.acc)) || 0, 99999) : null, reg.id]);
    emit(ev.slug, 'registrations', await registrationSummary(reg.event_id));
  }
  res.json({ ok: true, already, number: reg.number, name: reg.nickname || reg.name });
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
