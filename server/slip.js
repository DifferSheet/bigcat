// ตรวจสลิปอัตโนมัติ — เลือกผู้ให้บริการด้วย SLIP_PROVIDER ใน .env
//   none     : ไม่ตรวจ ทุกรายการรอแอดมิน (ค่าเริ่มต้น)
//   mock     : จำลองผลสำหรับทดสอบบนเครื่อง (ผ่านเสมอ, transRef = hash ของไฟล์)
//   slipok   : https://slipok.com  (ฟรี 100 สลิป/เดือน)  ต้องมี SLIP_API_KEY + SLIP_BRANCH_ID
//   easyslip : https://easyslip.com                         ต้องมี SLIP_API_KEY
//   thunder  : https://thunder.in.th  (v2, ตรวจสลิปซ้ำในตัว)   ต้องมี SLIP_API_KEY (Bearer) · ตั้ง IP whitelist ให้ EC2 ได้ในแดชบอร์ด
//   SLIP_AUTO_APPROVE=true  → ตรวจผ่านแล้วอนุมัติทันที · ไม่ตั้ง = ตรวจแล้วยังรอแอดมินกดยืนยัน (ค่าเริ่มต้น)
import fs from 'node:fs';
import crypto from 'node:crypto';
import { one } from './db.js';

const provider = (process.env.SLIP_PROVIDER || 'none').toLowerCase();
export const slipEnabled = provider !== 'none';
// ตาข่ายชั้นที่สอง: แม้ตรวจผ่าน ก็ยังเก็บเป็น pending ให้แอดมินกดยืนยันเอง (ค่าเริ่มต้น = ปิด auto-approve)
// เปิดเมื่อมั่นใจ SlipOK แล้ว: SLIP_AUTO_APPROVE=true
export const slipAutoApprove = /^(1|true|yes)$/i.test(process.env.SLIP_AUTO_APPROVE || '');
// credential ที่แต่ละ provider ต้องมี — ยังไม่ครบ = ไม่ยิง API ให้เสียเปล่า ส่งให้แอดมินตรวจเองพร้อมโน้ตชัด ๆ
const REQUIRED = { slipok: ['SLIP_API_KEY', 'SLIP_BRANCH_ID'], easyslip: ['SLIP_API_KEY'], thunder: ['SLIP_API_KEY'], mock: [] };
const missingCreds = () => (REQUIRED[provider] || []).filter(k => !process.env[k]);

const receiverNames = (process.env.SLIP_RECEIVER_NAME || '').split('|').map(s => s.trim()).filter(Boolean);
const MAX_AGE_DAYS = Number(process.env.SLIP_MAX_AGE_DAYS || 7);

const norm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();

/* ---------- ผู้ให้บริการ: คืนค่าเป็นรูปแบบเดียวกัน { transRef, amount, receiverName, senderName, date } ---------- */

async function slipok(filePath, expectedAmount) {
  const form = new FormData();
  form.append('files', new Blob([fs.readFileSync(filePath)]), 'slip.jpg');
  form.append('log', 'true');
  if (expectedAmount) form.append('amount', String(expectedAmount));
  const res = await fetch(`https://api.slipok.com/api/line/apikey/${process.env.SLIP_BRANCH_ID}`, {
    method: 'POST', headers: { 'x-authorization': process.env.SLIP_API_KEY }, body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) throw new Error(json.message || `SlipOK error ${res.status} (code ${json.code || '?'})`);
  const d = json.data || {};
  return {
    transRef: d.transRef, amount: Number(d.amount),
    receiverName: d.receiver?.displayName || d.receiver?.name, senderName: d.sender?.displayName || d.sender?.name,
    date: d.transTimestamp ? new Date(d.transTimestamp) : parseThaiDate(d.transDate, d.transTime), raw: d,
  };
}

async function easyslip(filePath) {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(filePath)]), 'slip.jpg');
  const res = await fetch('https://developer.easyslip.com/api/v1/verify', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.SLIP_API_KEY}` }, body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.status !== 200) throw new Error(json.message || `EasySlip error ${res.status}`);
  const d = json.data || {};
  return {
    transRef: d.transRef, amount: Number(d.amount?.amount ?? d.amount),
    receiverName: d.receiver?.account?.name?.th || d.receiver?.account?.name?.en || d.receiver?.account?.name,
    senderName: d.sender?.account?.name?.th || d.sender?.account?.name?.en || d.sender?.account?.name,
    date: d.date ? new Date(d.date) : null, raw: d,
  };
}

// Thunder v2 — POST multipart {image, checkDuplicate, matchAmount} · https://document.thunder.in.th/en/v2/verify/bank/image
async function thunder(filePath, expectedAmount) {
  const form = new FormData();
  form.append('image', new Blob([fs.readFileSync(filePath)]), 'slip.jpg');
  form.append('checkDuplicate', 'true');
  if (expectedAmount) form.append('matchAmount', String(expectedAmount));
  const res = await fetch('https://api.thunder.in.th/v2/verify/bank', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.SLIP_API_KEY}` }, body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    const code = json.error?.code || json.code || res.status;
    const th = { SLIP_NOT_FOUND: 'ไม่พบ QR ในภาพ (ภาพไม่ชัด/ไม่ใช่สลิป)', SLIP_PENDING: 'สลิปกรุงเทพยังไม่ขึ้นระบบ ลองใหม่อีกครู่', IMAGE_SIZE_TOO_LARGE: 'ไฟล์ใหญ่เกิน 4MB', INVALID_IMAGE_FORMAT: 'ไฟล์ไม่ใช่รูปภาพ' }[code];
    throw new Error(th || json.error?.message || json.message || `Thunder error ${res.status} (${code})`);
  }
  const d = json.data?.rawSlip || json.data || {};
  const name = (a) => a?.account?.name?.th || a?.account?.name?.en || a?.account?.name || a?.name;
  return {
    transRef: d.transRef, amount: Number(d.amount?.amount ?? d.amount),
    receiverName: name(d.receiver), senderName: name(d.sender),
    date: d.date ? new Date(d.date) : null, duplicate: !!json.data?.isDuplicate, raw: d,
  };
}

async function mock(filePath, expectedAmount) {
  const hash = crypto.createHash('sha1').update(fs.readFileSync(filePath)).digest('hex').slice(0, 20).toUpperCase();
  return { transRef: `MOCK${hash}`, amount: expectedAmount, receiverName: receiverNames[0] || 'บัญชีทดสอบ', senderName: 'ผู้ทดสอบ', date: new Date(), raw: { mock: true } };
}

function parseThaiDate(d, t) {
  // SlipOK: transDate "20260919", transTime "10:15:22"
  if (!d) return null;
  const s = String(d);
  return new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${t || '00:00:00'}+07:00`);
}

const providers = { slipok, easyslip, thunder, mock };

/**
 * ตรวจสลิปแล้วตัดสินว่าอนุมัติอัตโนมัติได้ไหม
 * @returns {{ ok: boolean, transRef?: string, note: string, amount?: number }}
 *   ok=true  → อนุมัติได้เลย
 *   ok=false → เก็บเป็น pending พร้อม note บอกเหตุผลให้แอดมิน
 */
export async function verifySlip(filePath, { expectedAmount }) {
  if (!slipEnabled) return { ok: false, note: 'ยังไม่เปิดตรวจสลิปอัตโนมัติ · แอดมินตรวจเอง' };
  const fn = providers[provider];
  if (!fn) return { ok: false, note: `ไม่รู้จัก SLIP_PROVIDER=${provider}` };
  const miss = missingCreds();
  if (miss.length) return { ok: false, note: `รอตั้งค่า ${provider} (ยังไม่มี ${miss.join(', ')}) · แอดมินตรวจเอง` };
  let r;
  try { r = await fn(filePath, expectedAmount); }
  catch (e) { return { ok: false, note: `ตรวจสลิปไม่ผ่าน: ${e.message}` }; }

  const problems = [];
  if (!r.transRef) problems.push('อ่านเลขอ้างอิงไม่ได้');
  if (r.transRef) {
    const dup = await one('SELECT code FROM donations WHERE trans_ref=? UNION SELECT code FROM bookings WHERE trans_ref=?', [r.transRef, r.transRef]);
    if (dup) problems.push(`สลิปซ้ำกับรายการ ${dup.code}`);
    else if (r.duplicate) problems.push('ผู้ให้บริการแจ้งว่าสลิปนี้เคยถูกตรวจแล้ว (ซ้ำ)');
  }
  if (expectedAmount && !(r.amount >= expectedAmount)) problems.push(`ยอดในสลิป ${r.amount} น้อยกว่าที่แจ้ง ${expectedAmount}`);
  if (receiverNames.length && !receiverNames.some(n => norm(r.receiverName).includes(norm(n)))) problems.push(`ชื่อผู้รับ "${r.receiverName || '?'}" ไม่ตรงบัญชีเรา`);
  if (r.date && (Date.now() - r.date.getTime()) > MAX_AGE_DAYS * 864e5) problems.push(`สลิปเก่ากว่า ${MAX_AGE_DAYS} วัน`);

  if (problems.length) return { ok: false, transRef: r.transRef || null, amount: r.amount, note: problems.join(' · ') };
  const who = `ผู้โอน ${r.senderName || '-'} → ${r.receiverName || '-'}`;
  // ตรวจผ่านแล้ว แต่ถ้ายังไม่เปิด auto-approve ให้เก็บ transRef ไว้ (กันสลิปซ้ำ) และรอแอดมินกดยืนยัน
  if (!slipAutoApprove) return { ok: false, verified: true, transRef: r.transRef, amount: r.amount, note: `ตรวจผ่าน ${provider} แล้ว ${who} · รอแอดมินยืนยัน` };
  return { ok: true, verified: true, transRef: r.transRef, amount: r.amount, note: `ตรวจผ่านอัตโนมัติ (${provider}) ${who}` };
}
