import { q, one, parseJSON } from './db.js';

let io = null;
export const setIO = (instance) => { io = instance; };
export const room = (slug) => `event:${slug}`;
export const emit = (slug, name, payload) => io?.to(room(slug)).emit(name, payload);

export const code = (len = 8) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function shapeEvent(row) {
  if (!row) return null;
  return { ...row, config: parseJSON(row.config, {}) };
}

export async function getEvent(slug) {
  const ev = shapeEvent(await one('SELECT * FROM events WHERE slug = ?', [slug]));
  if (!ev) throw new HttpError(404, 'ไม่พบกิจกรรมนี้');
  return ev;
}

/* ---------- ข้อมูลสรุปของแต่ละโมดูล (ใช้ทั้ง REST และ socket) ---------- */

export async function seatsOf(eventId) {
  const rows = await q('SELECT id, label, row_label, col_num, zone, price, status, hold_token, hold_expires_at FROM seats WHERE event_id = ? ORDER BY row_label, col_num', [eventId]);
  // ไม่ส่ง hold_token ออกไปให้คนอื่น — client เทียบ token ตัวเองจาก response ตอน hold
  return rows.map(({ hold_token, ...s }) => ({ ...s, heldBy: hold_token ? hold_token.slice(0, 6) : null }));
}

export async function donationSummary(eventId) {
  const categories = await q(`SELECT c.id, c.name, c.description, c.goal, c.unit_name, c.unit_price, c.sort,
      COALESCE(SUM(CASE WHEN d.status='approved' THEN d.amount END),0) AS raised,
      COUNT(CASE WHEN d.status='approved' THEN 1 END) AS donors
    FROM donation_categories c LEFT JOIN donations d ON d.category_id = c.id
    WHERE c.event_id = ? GROUP BY c.id ORDER BY c.sort`, [eventId]);
  const rows = await q(`SELECT d.id, d.code, d.group_code, d.donor_name, d.dedication, d.message, d.anonymous, d.amount, d.units, d.created_at, c.name AS category, c.unit_name, IF(d.anonymous, NULL, u.avatar) AS avatar
    FROM donations d JOIN donation_categories c ON c.id = d.category_id LEFT JOIN users u ON u.id = d.user_id
    WHERE d.event_id = ? AND d.status = 'approved' ORDER BY d.created_at DESC, d.id LIMIT 120`, [eventId]);
  // โอนครั้งเดียวหลายหมวด (group_code เดียวกัน) → แสดงเป็นรายการเดียว มี items + ยอดรวม
  const groups = new Map();
  for (const r of rows) {
    const k = r.group_code || r.code;
    if (!groups.has(k)) groups.set(k, { id: r.id, donor_name: r.donor_name, dedication: r.dedication, message: r.message, anonymous: r.anonymous, avatar: r.avatar, created_at: r.created_at, amount: 0, items: [] });
    const g = groups.get(k); g.amount += Number(r.amount); g.items.push({ category: r.category, units: r.units, unit_name: r.unit_name, amount: Number(r.amount) });
  }
  const wall = [...groups.values()].slice(0, 60);
  const total = categories.reduce((s, c) => s + Number(c.raised), 0);
  const goal = categories.reduce((s, c) => s + Number(c.goal), 0);
  return {
    categories: categories.map(c => ({
      ...c, raised: Number(c.raised), goal: Number(c.goal), donors: Number(c.donors),
      // หน่วยของจริง เช่น เทียน 1 ต้น = 500 → ถวายแล้ว x/y ต้น
      unitsDone: c.unit_price ? Math.floor(Number(c.raised) / c.unit_price) : null,
      unitsGoal: c.unit_price ? Math.ceil(Number(c.goal) / c.unit_price) : null,
    })),
    wall: wall.map(w => ({ ...w, donor_name: w.anonymous ? 'ผู้ไม่ประสงค์ออกนาม' : w.donor_name })),
    total, goal, donors: categories.reduce((s, c) => s + Number(c.donors), 0),
    percent: goal ? Math.min(100, Math.round(total / goal * 100)) : 0,
  };
}

export async function registrationSummary(eventId) {
  const r = await one('SELECT COUNT(*) AS total, COUNT(checked_in_at) AS checkedIn FROM registrations WHERE event_id = ?', [eventId]);
  return { total: Number(r.total), checkedIn: Number(r.checkedIn) };
}

// ผลโหวตของ poll ใน milestone: { [pollKey]: { counts: [n,...], total } }
export async function pollSummary(eventId) {
  const rows = await q('SELECT poll_key, option_index, COUNT(*) AS n FROM poll_votes WHERE event_id = ? GROUP BY poll_key, option_index', [eventId]);
  const out = {};
  for (const r of rows) {
    out[r.poll_key] ??= { counts: [], total: 0 };
    out[r.poll_key].counts[r.option_index] = Number(r.n);
    out[r.poll_key].total += Number(r.n);
  }
  return out;
}

export const reportOf = (eventId) => q('SELECT id, kind, title, amount, image_path, body, created_at FROM report_items WHERE event_id = ? ORDER BY created_at', [eventId]);

export async function drawsOf(eventId) {
  return q(`SELECT l.round, l.drawn_at, r.number, r.nickname, r.name, r.social
    FROM lucky_draws l JOIN registrations r ON r.id = l.registration_id
    WHERE l.event_id = ? ORDER BY l.round`, [eventId]);
}

export async function songsOf(eventId) {
  return q('SELECT id, title, artist, votes FROM song_requests WHERE event_id = ? ORDER BY votes DESC, id', [eventId]);
}

// payload เต็มของหน้า /events/:slug — เลือกส่วนตามประเภทงาน
export async function eventDetail(slug) {
  const ev = await getEvent(slug);
  const detail = { event: ev };
  if (ev.type === 'fanmeet') detail.seats = await seatsOf(ev.id);
  if (ev.type === 'merit') {
    detail.donations = await donationSummary(ev.id);
    detail.polls = await pollSummary(ev.id);
    detail.report = await reportOf(ev.id);
    detail.registrations = await registrationSummary(ev.id);
  }
  if (ev.type === 'busking') {
    detail.registrations = await registrationSummary(ev.id);
    detail.draws = await drawsOf(ev.id);
    detail.songs = await songsOf(ev.id);
  }
  return detail;
}

// ปล่อยที่นั่งที่หมดเวลา hold แล้วแจ้ง client ทุกคนในห้อง
export async function releaseExpiredHolds() {
  const expired = await q(`SELECT DISTINCT e.slug, s.event_id FROM seats s JOIN events e ON e.id = s.event_id
    WHERE s.status = 'held' AND s.hold_expires_at < UTC_TIMESTAMP()`);
  if (!expired.length) return;
  await q(`UPDATE seats SET status='available', hold_token=NULL, hold_expires_at=NULL WHERE status='held' AND hold_expires_at < UTC_TIMESTAMP()`);
  for (const { slug, event_id } of expired) emit(slug, 'seats', await seatsOf(event_id));
}
