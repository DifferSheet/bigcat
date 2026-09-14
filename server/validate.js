// ตรวจค่าจากฟอร์ม — เบอร์โทรใช้กติกาเดียวกับ src/lib/phone.js
import { HttpError } from './lib.js';

export const normalizePhone = (s) => {
  let d = String(s || '').replace(/\D/g, '');
  if (d.startsWith('66') && (d.length === 11 || d.length === 10)) d = '0' + d.slice(2);
  return d;
};
export const PHONE_RE = /^(0[689]\d{8}|0[2-7]\d{7})$/;
export const isPhone = (s) => PHONE_RE.test(normalizePhone(s));

// คืนเบอร์แบบตัวเลขล้วน · โยน 400 ถ้าผิดรูปแบบ (ถ้าไม่ required และว่าง → '')
export const requirePhone = (s, { required = true } = {}) => {
  const d = normalizePhone(s);
  if (!d) { if (required) throw new HttpError(400, 'กรุณากรอกเบอร์โทร'); return ''; }
  if (!PHONE_RE.test(d)) throw new HttpError(400, 'เบอร์โทรไม่ถูกต้อง — กรอก 10 หลัก เช่น 0812345678');
  return d;
};
