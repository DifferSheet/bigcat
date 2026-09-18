// Passport — แสตมป์สะสมของสมาชิก คำนวณจากข้อมูลจริง (registrations / donations / lucky_draws) แล้ว materialize ลงตาราง stamps
// syncStamps(userId) เรียกซ้ำได้เสมอ: เพิ่มดวงที่ควรมี ลบดวงที่ต้นทางหายไป (เช่น ยกเลิกเช็คอิน) — ยกเว้น first/friend ที่ให้แล้วไม่ถอน
//
// ชนิดแสตมป์
//   checkin  มางาน (busking/workshop/popup/fanmeet) — 1 ดวงต่องาน
//   merit    ร่วมบุญ (ไปวัดเช็คอิน หรือยอดอนุมัติแล้ว) — 1 ดวงต่องาน โทนอ่อน
//   lucky    ฟอยล์ — ถูกสุ่ม Lucky Fan
//   tier     ฟอยล์ — ยอดร่วมบุญรวมในงานนั้น ≥ TIER_FOIL บาท
//   dayone   งานที่แอดมินติ๊ก «งานเปิดตัว passport» (config.dayOne)
//   first    มาครั้งแรกกับเพื่อน (คนถูกชวน · event_id = งานที่มาครั้งแรก · meta.inviter)
//   friend   พามาเจอ (คนชวน · event_id 0 · meta.count = จำนวนเพื่อนที่มาจริงแล้ว)
import { q, one, parseJSON } from './db.js';
import { code } from './lib.js';

export const TIER_FOIL = 500;
export const STICKER_AT = 3;   // ครบ 3 ดวง (ทุกชนิด) รับสติกเกอร์ที่งานถัดไป
const INVITE_COOKIE = 'bigcat_invite';

// เวลาจาก MySQL เป็น UTC string (pool timezone 'Z') → ต่อ Z · ค่าที่เป็น Date อยู่แล้วส่งคืนตรง ๆ
const dt = (v) => (v instanceof Date ? v : v ? new Date(String(v).replace(' ', 'T') + (/Z|[+-]\d\d:\d\d$/.test(String(v)) ? '' : 'Z')) : new Date());

export async function syncStamps(userId) {
  if (!userId) return;
  const want = new Map();   // key `${event_id}:${kind}` → { event_id, kind, meta, earned_at }
  const add = (event_id, kind, earned_at, meta = null) => { const k = `${event_id}:${kind}`; if (!want.has(k) || dt(earned_at) < dt(want.get(k).earned_at)) want.set(k, { event_id, kind, meta, earned_at: dt(earned_at) }); };

  const regs = await q('SELECT r.event_id, r.checked_in_at, e.type, e.config FROM registrations r JOIN events e ON e.id=r.event_id WHERE r.user_id=? AND r.checked_in_at IS NOT NULL', [userId]);
  for (const r of regs) add(r.event_id, r.type === 'merit' ? 'merit' : 'checkin', r.checked_in_at);

  const dons = await q(`SELECT d.event_id, SUM(d.amount) AS amount, MIN(d.created_at) AS first_at FROM donations d WHERE d.user_id=? AND d.status='approved' GROUP BY d.event_id`, [userId]);
  for (const d of dons) {
    add(d.event_id, 'merit', d.first_at);
    if (Number(d.amount) >= TIER_FOIL) add(d.event_id, 'tier', d.first_at, { amount: Number(d.amount) });
  }

  const wins = await q('SELECT l.event_id, l.round, l.drawn_at FROM lucky_draws l JOIN registrations r ON r.id=l.registration_id WHERE r.user_id=?', [userId]);
  for (const w of wins) add(w.event_id, 'lucky', w.drawn_at, { round: w.round });

  // Day One: มีแสตมป์ของงานที่ติ๊ก dayOne
  const dayOne = await q("SELECT id FROM events WHERE JSON_EXTRACT(config, '$.dayOne') = true");
  for (const e of dayOne) if (want.has(`${e.id}:checkin`) || want.has(`${e.id}:merit`)) add(e.id, 'dayone', (want.get(`${e.id}:checkin`) || want.get(`${e.id}:merit`)).earned_at);

  // เขียนลงตาราง (เพิ่มที่ขาด · ลบที่เกิน — ยกเว้น first/friend)
  const have = await q('SELECT id, event_id, kind FROM stamps WHERE user_id=?', [userId]);
  for (const h of have) if (!['first', 'friend'].includes(h.kind) && !want.has(`${h.event_id}:${h.kind}`)) await q('DELETE FROM stamps WHERE id=?', [h.id]);
  for (const w of want.values()) await q('INSERT IGNORE INTO stamps SET ?', [{ user_id: userId, event_id: w.event_id, kind: w.kind, meta: w.meta ? JSON.stringify(w.meta) : null, earned_at: w.earned_at }]);

  // เช็คอินครั้งแรกในชีวิต → ปลดล็อกแสตมป์เพื่อน (ถ้ามีคนชวน)
  const firstReg = regs.length ? regs.reduce((a, b) => (dt(a.checked_in_at) < dt(b.checked_in_at) ? a : b)) : null;
  if (firstReg) {
    const u = await one('SELECT first_checkin_at, invited_by FROM users WHERE id=?', [userId]);
    if (u && !u.first_checkin_at) {
      await q('UPDATE users SET first_checkin_at=? WHERE id=?', [dt(firstReg.checked_in_at), userId]);
      if (u.invited_by) {
        await q('INSERT IGNORE INTO stamps SET ?', [{ user_id: userId, event_id: firstReg.event_id, kind: 'first', meta: JSON.stringify({ inviter: u.invited_by }), earned_at: dt(firstReg.checked_in_at) }]);
        await refreshFriendStamp(u.invited_by);
      }
    }
  }
}

// แสตมป์ «พามาเจอ» ของคนชวน — ดวงเดียว นับเพื่อนที่มาจริง
export async function refreshFriendStamp(inviterId) {
  const rows = await q('SELECT id, display_name, first_checkin_at FROM users WHERE invited_by=? AND first_checkin_at IS NOT NULL ORDER BY first_checkin_at', [inviterId]);
  if (!rows.length) return;
  const meta = JSON.stringify({ count: rows.length, friends: rows.map(r => r.display_name).slice(0, 12) });
  await q('INSERT INTO stamps SET ? ON DUPLICATE KEY UPDATE meta=VALUES(meta), earned_at=VALUES(earned_at)', [{ user_id: inviterId, event_id: 0, kind: 'friend', meta, earned_at: dt(rows[rows.length - 1].first_checkin_at) }]);
}

// sync ให้ทุกคนที่มีข้อมูลต้นทาง — ใช้ตอน backfill (เปิดตัว passport) และหลังแก้กติกา
export async function syncAllStamps() {
  const ids = await q(`SELECT DISTINCT user_id AS id FROM registrations WHERE user_id IS NOT NULL AND checked_in_at IS NOT NULL
    UNION SELECT DISTINCT user_id FROM donations WHERE user_id IS NOT NULL AND status='approved'`);
  for (const { id } of ids) await syncStamps(id);
  return ids.length;
}

// backfill ครั้งเดียวตอน API start ถ้าตารางยังว่างแต่มีข้อมูลต้นทาง (prod ไม่ต้อง ssh ไปรันสคริปต์)
export async function backfillIfEmpty() {
  const { n } = await one('SELECT COUNT(*) AS n FROM stamps');
  if (n > 0) return;
  const c = await syncAllStamps();
  if (c) console.log(`✓ passport: backfill แสตมป์ให้สมาชิก ${c} คน`);
}

/* ---------- ลิงก์ชวนเพื่อน ---------- */
export async function inviteCodeOf(user) {
  if (user.invite_code) return user.invite_code;
  for (let i = 0; i < 5; i++) {
    const c = code(6);
    try { await q('UPDATE users SET invite_code=? WHERE id=? AND invite_code IS NULL', [c, user.id]); break; } catch { /* ชนกัน ลองใหม่ */ }
  }
  return (await one('SELECT invite_code FROM users WHERE id=?', [user.id]))?.invite_code;
}

// ผูก «คนชวน» ให้ผู้ใช้ที่ล็อกอิน ถ้ามี cookie จากลิงก์ชวน และผู้ใช้ยังไม่เคยมางาน/ยังไม่มีคนชวน (ทำครั้งเดียว ไม่เปลี่ยนภายหลัง)
export async function attachInvite(req, res, { parseCookies, setCookie }) {
  const c = parseCookies(req)[INVITE_COOKIE];
  if (!c || !req.user) return null;
  const u = await one('SELECT id, invited_by, first_checkin_at, invite_code FROM users WHERE id=?', [req.user.id]);
  if (!u || u.invited_by || u.first_checkin_at) { setCookie(res, INVITE_COOKIE, '', { maxAge: 0 }); return null; }
  const inviter = await one('SELECT id, display_name FROM users WHERE invite_code=?', [String(c).toUpperCase()]);
  setCookie(res, INVITE_COOKIE, '', { maxAge: 0 });
  if (!inviter || inviter.id === u.id) return null;
  await q('UPDATE users SET invited_by=? WHERE id=? AND invited_by IS NULL', [inviter.id, u.id]);
  return inviter;
}
export const INVITE_COOKIE_NAME = INVITE_COOKIE;

/* ---------- ข้อมูลหน้า passport ---------- */
export async function passportOf(user) {
  const events = await q(`SELECT id, slug, type, status, title, starts_at, place, cover, tone, config FROM events WHERE status <> 'hidden' ORDER BY starts_at`);
  const stamps = await q('SELECT event_id, kind, meta, earned_at FROM stamps WHERE user_id=? ORDER BY earned_at', [user.id]);
  const byEvent = new Map();
  for (const s of stamps) { if (!byEvent.has(s.event_id)) byEvent.set(s.event_id, []); byEvent.get(s.event_id).push({ kind: s.kind, meta: parseJSON(s.meta, null), earned_at: s.earned_at }); }
  const now = Date.now();
  // รูปคู่อัตโนมัติจากอัลบั้ม: รูปที่ระบบจับคู่ว่าเป็นคนนี้ (ไม่ถูกปฏิเสธ) — รูปคู่ (2 หน้า) มาก่อน แล้วค่อยเดี่ยว · ต่องาน
  const autoPortrait = new Map();
  for (const r of await q(`SELECT p.event_id, p.view, p.id FROM photo_faces f JOIN event_photos p ON p.id=f.photo_id WHERE f.user_id=? AND f.status<>'rejected' ORDER BY (p.faces=2) DESC, (f.status='confirmed') DESC, f.similarity DESC`, [user.id])) if (!autoPortrait.has(r.event_id)) autoPortrait.set(r.event_id, r);
  const list = await Promise.all(events.map(async e => {
    const cfg = parseJSON(e.config, {});
    const mine = byEvent.get(e.id) || [];
    const earned = mine.find(s => s.kind === 'checkin' || s.kind === 'merit') || null;
    const start = dt(String(e.starts_at).replace(' ', 'T') + '+07:00').getTime();
    return {
      slug: e.slug, type: e.type, status: e.status, title: e.title, starts_at: e.starts_at, place: e.place, cover: e.cover, tone: e.tone,
      // รูปคู่: (1) ไฟล์ส่วนตัวที่แอดมิน/สมาชิกอัปโหลด (2) รูปจากอัลบั้มที่สมาชิกเลือกเอง (3) อัตโนมัติจากการจับคู่ใบหน้า
      memory: earned && (e.status === 'ended' || start < now - 6 * 3600e3) ? { ...(cfg.memory || {}),
        portraitImage: earned.meta?.passportPortrait ? `/api/passport/${encodeURIComponent(e.slug)}/portrait?v=${encodeURIComponent(earned.meta.passportPortrait)}` : earned.meta?.portraitPhoto?.view || autoPortrait.get(e.id)?.view || null,
        portraitSource: earned.meta?.passportPortrait ? 'upload' : earned.meta?.portraitPhoto ? 'chosen' : autoPortrait.has(e.id) ? 'auto' : null,
        // รูปหมู่: ที่สมาชิกเลือกเอง > ที่แอดมินตั้งให้ทั้งงาน
        groupImage: earned.meta?.groupPhoto?.view || cfg.memory?.groupImage || null,
        groupSource: earned.meta?.groupPhoto ? 'chosen' : cfg.memory?.groupImage ? 'event' : null,
        myPhotos: (await q('SELECT COUNT(*) AS n FROM photo_faces f JOIN event_photos p ON p.id=f.photo_id WHERE f.user_id=? AND f.status<>\'rejected\' AND p.event_id=?', [user.id, e.id]))[0].n,
      } : null,
      stamp: cfg.stamp || null,                      // { image } ลายแสตมป์ของงาน (แอดมินอัปโหลด) — ไม่มี = วาดจากปก
      dayOne: !!cfg.dayOne,
      earned, extras: mine.filter(s => !['checkin', 'merit'].includes(s.kind)),
      // ปลดล็อกเนื้อหาเฉพาะคนที่มีแสตมป์งานนี้
      unlock: earned && cfg.unlock ? cfg.unlock : null, hasUnlock: !!cfg.unlock,
      phase: e.status === 'ended' || start < now - 6 * 3600e3 ? 'past' : e.status === 'live' ? 'live' : 'upcoming',
    };
  }));
  const seasons = await q('SELECT id, name, starts_on, ends_on, cover FROM seasons ORDER BY starts_on');
  const season = (ev) => seasons.find(s => String(ev.starts_at).slice(0, 10) >= String(s.starts_on).slice(0, 10) && String(ev.starts_at).slice(0, 10) <= String(s.ends_on).slice(0, 10));
  const books = [];
  for (const ev of list) {
    const s = season(ev);
    const key = s ? `s${s.id}` : `y${String(ev.starts_at).slice(0, 4)}`;
    let b = books.find(x => x.key === key);
    if (!b) { b = { key, name: s ? s.name : `เล่ม ${Number(String(ev.starts_at).slice(0, 4)) + 543}`, cover: s?.cover || null, events: [] }; books.push(b); }
    b.events.push(ev);
  }
  const friend = stamps.find(s => s.kind === 'friend');
  const total = stamps.length;
  const inviter = user.invited_by ? await one('SELECT display_name, avatar FROM users WHERE id=?', [user.invited_by]) : null;
  return {
    user: { display_name: user.display_name, avatar: user.avatar, first_checkin_at: user.first_checkin_at, invite_code: await inviteCodeOf(user), inviter },
    total, books,
    friend: friend ? { ...friend, meta: parseJSON(friend.meta, null) } : null,
    sticker: { at: STICKER_AT, eligible: total >= STICKER_AT, given_at: user.sticker_given_at || null },
  };
}
