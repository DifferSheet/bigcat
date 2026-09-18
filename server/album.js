// อัลบั้มรูปงาน — เก็บไฟล์ 3 ขนาด · คิวสแกนหน้าหลังบ้าน · จับคู่กับสมาชิกที่ยินยอม
// ไฟล์อยู่ที่ server/uploads/albums/<eventId>/ (เสิร์ฟผ่าน /uploads เหมือนรูปอื่น — สิทธิ์การ «เห็นรายการ» คุมที่ API ไม่ใช่ที่ไฟล์)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { q, one, parseJSON } from './db.js';
import { code } from './lib.js';
import * as faces from './faces.js';
import * as store from './storage.js';
const MAX_FACES = 3;     // รูปเดี่ยว/คู่/สามคน = ส่งจับคู่ · มากกว่านั้น = รูปหมู่ ไม่ส่ง

/* ---------- นำเข้ารูป: ต้นฉบับ(≤2400) · view 1400 · thumb 480 (webp) ---------- */
export async function importPhoto(eventId, srcPath, { takenAt = null, remove = false } = {}) {
  // กันอัปซ้ำ: ไฟล์เดิมของงานเดิม (ลายนิ้วมือ sha1 ของไฟล์ต้นทาง) → คืน id เดิม ไม่สร้างรูปใหม่
  const sha = crypto.createHash('sha1').update(fs.readFileSync(srcPath)).digest('hex');
  const dup = await one('SELECT id FROM event_photos WHERE event_id=? AND sha=?', [eventId, sha]);
  if (dup) { if (remove) fs.rm(srcPath, { force: true }, () => {}); return { id: dup.id, duplicate: true }; }
  const base = `${Date.now().toString(36)}-${code(6).toLowerCase()}`;
  const key = (f) => `albums/${eventId}/${f}`;
  const tmp = path.join(os.tmpdir(), `bigcat-${crypto.randomUUID()}`);
  fs.mkdirSync(tmp, { recursive: true });
  try {
    const meta = await sharp(srcPath).metadata();
    const big = path.join(tmp, `${base}.jpg`), mid = path.join(tmp, `${base}-v.webp`), small = path.join(tmp, `${base}-t.webp`);
    const orig = await sharp(srcPath).rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88, mozjpeg: true }).toFile(big);
    await sharp(srcPath).rotate().resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(mid);
    await sharp(srcPath).rotate().resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 76 }).toFile(small);
    const [origStored, viewStored, thumbStored] = await Promise.all([
      store.put(key(`${base}.jpg`), big, 'image/jpeg'),
      store.put(key(`${base}-v.webp`), mid, 'image/webp'),
      store.put(key(`${base}-t.webp`), small, 'image/webp'),
    ]);
    const exifDate = meta.exif ? exifTaken(meta.exif) : null;
    const next = (await one('SELECT COALESCE(MAX(sort_order),0)+1 AS n FROM event_photos WHERE event_id=?', [eventId])).n;
    const bytes = [big, mid, small].reduce((n, f) => n + (fs.statSync(f).size || 0), 0);
    const ins = await q('INSERT INTO event_photos SET ?', [{ event_id: eventId, orig: origStored, view: viewStored, thumb: thumbStored, width: orig.width, height: orig.height, taken_at: takenAt || exifDate, sort_order: next, sha, bytes }]);
    if (remove) fs.rm(srcPath, { force: true }, () => {});
    kick();
    return { id: ins.insertId, duplicate: false };
  } finally { fs.rm(tmp, { recursive: true, force: true }, () => {}); }
}
// วันที่ถ่ายจาก EXIF (DateTimeOriginal) — ไว้เรียงลำดับ · หาไม่เจอก็ไม่เป็นไร
function exifTaken(buf) {
  try { const s = buf.toString('latin1'); const m = s.match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/); return m ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}` : null; } catch { return null; }
}

/* ---------- คิวสแกน (ทีละรูป ในโปรเซสเดียว) ---------- */
let running = false;
export function kick() { if (!running) { running = true; drain().catch(e => console.error('album scan:', e.message)).finally(() => { running = false; }); } }
async function drain() {
  for (;;) {
    const p = await one("SELECT id, event_id, orig FROM event_photos WHERE scan='pending' ORDER BY id LIMIT 1");
    if (!p) return;
    try { await scanPhoto(p); }
    catch (e) { console.error(`album scan #${p.id}:`, e.message); await q("UPDATE event_photos SET scan='failed' WHERE id=?", [p.id]); }
  }
}
const dropCrops = (faceIds) => { for (const id of faceIds) for (const s of [200]) fs.rm(path.join(CROP_DIR, `${id}-${s}.webp`), { force: true }, () => {}); };

export async function scanPhoto(p) {
  if (!faces.facesEnabled) { await q("UPDATE event_photos SET scan='skipped', faces=NULL WHERE id=?", [p.id]); return; }
  const copy = await store.localCopy(p.orig);   // S3 → โหลดมาไว้ temp ชั่วคราว
  try { await scanFile(p, copy.file); } finally { copy.done(); }
}
async function scanFile(p, file) {
  const det = await faces.detect(file);
  const n = det.faces.length;                          // นับทุกหน้า (รวมหน้าเล็กไกล ๆ) → รูปหมู่ = ข้าม
  const usable = det.faces.filter(faces.usable).length;
  if (n < 1 || n > MAX_FACES || usable === 0) { await q("UPDATE event_photos SET scan='skipped', faces=? WHERE id=?", [n, p.id]); return; }
  const idx = await faces.index(file, `p:${p.id}`, det);
  dropCrops((await q('SELECT id FROM photo_faces WHERE photo_id=?', [p.id])).map(r => r.id));
  await q('DELETE FROM photo_faces WHERE photo_id=?', [p.id]);
  for (const f of idx.faces) await q('INSERT INTO photo_faces SET ?', [{ photo_id: p.id, face_ref: f.ref, box: JSON.stringify(f.box), score: f.score, descriptor: f.descriptor ? JSON.stringify(f.descriptor) : null }]);
  await q("UPDATE event_photos SET scan='done', faces=? WHERE id=?", [idx.faces.length, p.id]);
  await matchPhoto(p.id);
}

/* ---------- จับคู่ ---------- */
// รูป → สมาชิก: แต่ละหน้าในรูปเทียบกับใบหน้าสมาชิกที่ยินยอมไว้ทั้งหมด
export async function matchPhoto(photoId) {
  const pf = await q('SELECT id, face_ref, descriptor, user_id, status FROM photo_faces WHERE photo_id=?', [photoId]);
  const users = await q('SELECT user_id, face_ref, descriptor FROM user_faces');
  if (!pf.length || !users.length) return;
  const pool = users.map(u => ({ ref: u.face_ref, descriptor: parseJSON(u.descriptor, null), user_id: u.user_id }));
  for (const f of pf) {
    if (f.status !== 'auto' && f.user_id) continue;                        // คนยืนยันแล้ว ไม่ทับ
    const hits = await faces.similar({ ref: f.face_ref, descriptor: parseJSON(f.descriptor, null) }, pool);
    const best = hits.map(h => ({ ...h, user_id: pool.find(p => p.ref === h.ref)?.user_id })).find(h => h.user_id);
    if (best && f.status !== 'rejected') await q('UPDATE photo_faces SET user_id=?, similarity=?, status=\'auto\' WHERE id=?', [best.user_id, best.similarity, f.id]);
  }
}
// สมาชิก → รูป: หลังลงทะเบียนใบหน้า ไล่เทียบกับทุกหน้าในอัลบั้มที่สแกนแล้ว
export async function matchUser(userId) {
  const mine = await q('SELECT face_ref, descriptor FROM user_faces WHERE user_id=?', [userId]);
  if (!mine.length) return 0;
  // เทียบเฉพาะใบหน้าในอัลบั้มของงานที่คนนี้เช็คอิน (สิทธิ์ดูอัลบั้มก็จำกัดแบบเดียวกัน)
  const pf = await q(`SELECT f.id, f.face_ref, f.descriptor, f.user_id, f.status FROM photo_faces f JOIN event_photos p ON p.id=f.photo_id
    WHERE p.event_id IN (SELECT event_id FROM registrations WHERE user_id=? AND checked_in_at IS NOT NULL
                         UNION SELECT event_id FROM bookings WHERE user_id=? AND status='checked_in')`, [userId, userId]);
  const pool = pf.map(f => ({ ref: f.face_ref, descriptor: parseJSON(f.descriptor, null), id: f.id, user_id: f.user_id, status: f.status }));
  if (!pool.length) return 0;
  const allowed = new Set(pool.map(p => p.ref));
  let n = 0;
  for (const uf of mine) {
    let found;
    try { found = await faces.similar({ ref: uf.face_ref, descriptor: parseJSON(uf.descriptor, null) }, pool); }
    catch (e) {
      if (!/not found in the collection/i.test(e.message || '')) throw e;
      await q('DELETE FROM user_faces WHERE user_id=? AND face_ref=?', [userId, uf.face_ref]);   // ใบหน้าหายจากฝั่งผู้ให้บริการ → ถือว่ายังไม่ลงทะเบียน
      continue;
    }
    const hits = found.filter(h => allowed.has(h.ref));
    for (const h of hits) {
      const f = pool.find(p => p.ref === h.ref);
      if (!f || f.status === 'rejected' || (f.status === 'confirmed' && f.user_id && f.user_id !== userId)) continue;
      if (f.user_id === userId) continue;
      // มีคนอื่นจับคู่อยู่แบบ auto ด้วยความคล้ายต่ำกว่า → แย่งได้
      const cur = await one('SELECT similarity, status FROM photo_faces WHERE id=?', [f.id]);
      if (cur.status === 'auto' && (cur.similarity == null || h.similarity > cur.similarity)) { await q('UPDATE photo_faces SET user_id=?, similarity=? WHERE id=?', [userId, h.similarity, f.id]); n++; }
    }
  }
  return n;
}

/* ---------- ใบหน้าสมาชิก (opt-in) ---------- */
// ลงทะเบียนใบหน้าทีละคน (กันกดซ้ำ/กดสองครั้งรัวๆ แล้วสองคำขอสลับลำดับกันจนลบใบหน้าที่เพิ่งสร้าง)
const registering = new Map();
export function registerUserFace(userId, selfiePath) {
  const run = (registering.get(userId) || Promise.resolve()).catch(() => {}).then(() => registerFaceNow(userId, selfiePath));
  registering.set(userId, run.catch(() => {}));
  return run;
}
async function registerFaceNow(userId, selfiePath) {
  const det = await faces.detect(selfiePath);
  if (det.faces.length !== 1) throw new Error(det.faces.length ? 'ในรูปมีหลายคน — ใช้รูปที่มีหน้าคุณคนเดียวชัด ๆ' : 'ไม่พบใบหน้าในรูป — ลองรูปหน้าตรง แสงพอ ไม่ใส่แมสก์');
  await forgetUserFaces(userId);                       // ลบของเดิมก่อนเสมอ แล้วค่อยสร้างใหม่ (ลำดับกลับกันจะลบของใหม่ทิ้ง)
  const idx = await faces.index(selfiePath, `u:${userId}`, det);
  const f = idx.faces[0];
  await q('INSERT INTO user_faces SET ?', [{ user_id: userId, face_ref: f.ref, descriptor: f.descriptor ? JSON.stringify(f.descriptor) : null }]);
  await q('UPDATE users SET face_consent_at=COALESCE(face_consent_at, UTC_TIMESTAMP()) WHERE id=?', [userId]);
  fs.rm(selfiePath, { force: true }, () => {});   // ไม่เก็บเซลฟี่ — เก็บเฉพาะเวกเตอร์/FaceId
  return matchUser(userId);
}
export async function forgetUserFaces(userId, { revokeConsent = false } = {}) {
  const rows = await q('SELECT face_ref FROM user_faces WHERE user_id=?', [userId]);
  await faces.forget(rows.map(r => r.face_ref));
  await q('DELETE FROM user_faces WHERE user_id=?', [userId]);
  await q("UPDATE photo_faces SET user_id=NULL, similarity=NULL, status='auto' WHERE user_id=? AND status<>'confirmed'", [userId]);
  if (revokeConsent) { await q("UPDATE photo_faces SET user_id=NULL, similarity=NULL, status='auto' WHERE user_id=?", [userId]); await q('UPDATE users SET face_consent_at=NULL WHERE id=?', [userId]); }
}

/* ---------- สิทธิ์ดูอัลบั้ม: เช็คอินงานนั้น (ลงทะเบียน/บัตร) หรือแอดมิน ---------- */
export const albumPublished = (cfg) => (cfg?.album?.published ?? true);   // ค่าเริ่มต้น = เผยแพร่ (อัลบั้มเก่าไม่หายไป) · อัลบั้มใหม่ตั้งเป็นยังไม่เผยแพร่ตอนอัปรูปแรก

export async function canViewAlbum(user, eventId) {
  if (!user) return false;
  const r = await one('SELECT 1 AS ok FROM registrations WHERE event_id=? AND user_id=? AND checked_in_at IS NOT NULL LIMIT 1', [eventId, user.id]);
  if (r) return true;
  const b = await one("SELECT 1 AS ok FROM bookings WHERE event_id=? AND user_id=? AND status='checked_in' LIMIT 1", [eventId, user.id]);
  return !!b;
}

// รูปที่มีสมาชิกคนนี้ (ยังไม่ปฏิเสธ) — เรียงรูปคู่ (2 หน้า) ก่อน แล้วค่อยเดี่ยว
export async function photosOfUser(userId, eventId = null) {
  return q(`SELECT p.id, p.event_id, p.thumb, p.view, p.orig, p.width, p.height, p.faces, f.similarity, f.status, f.box
    FROM photo_faces f JOIN event_photos p ON p.id=f.photo_id WHERE f.user_id=? AND f.status<>'rejected' ${eventId ? 'AND p.event_id=?' : ''}
    ORDER BY (p.faces=2) DESC, f.similarity DESC`, eventId ? [userId, eventId] : [userId]);
}

// ตัดเฉพาะใบหน้าจากรูป (ใช้ในหน้าทบทวนใบหน้าของแอดมิน) — คืน buffer webp
const CROP_DIR = path.join(os.tmpdir(), 'bigcat-face-crops');
export async function faceCrop(faceId, size = 200) {
  const cached = path.join(CROP_DIR, `${faceId}-${size}.webp`);
  if (fs.existsSync(cached)) return fs.readFileSync(cached);
  const f = await one('SELECT f.box, p.view FROM photo_faces f JOIN event_photos p ON p.id=f.photo_id WHERE f.id=?', [faceId]);
  if (!f) return null;
  const box = parseJSON(f.box, null); if (!box) return null;
  const copy = await store.localCopy(f.view);
  try {
    const im = sharp(copy.file).rotate();
    const { width, height } = await im.metadata();
    const pad = 0.45;   // เผื่อรอบหน้าให้เห็นทรงผม/บริบท
    const left = Math.max(0, Math.round((box.x - box.w * pad) * width));
    const top = Math.max(0, Math.round((box.y - box.h * pad) * height));
    const w = Math.min(width - left, Math.round(box.w * (1 + pad * 2) * width));
    const h = Math.min(height - top, Math.round(box.h * (1 + pad * 2) * height));
    const buf = await im.extract({ left, top, width: Math.max(8, w), height: Math.max(8, h) }).resize(size, size, { fit: 'cover' }).webp({ quality: 80 }).toBuffer();
    fs.mkdirSync(CROP_DIR, { recursive: true });
    fs.writeFile(cached, buf, () => {});
    return buf;
  } finally { copy.done(); }
}

export async function deletePhoto(id) {
  const p = await one('SELECT * FROM event_photos WHERE id=?', [id]);
  if (!p) return;
  const rows = await q('SELECT id, face_ref FROM photo_faces WHERE photo_id=?', [id]);
  dropCrops(rows.map(r => r.id));
  const refs = rows.map(r => r.face_ref);
  await faces.forget(refs).catch(() => {});
  await q('DELETE FROM event_photos WHERE id=?', [id]);
  for (const f of [p.orig, p.view, p.thumb]) await store.remove(f).catch(() => {});
}
