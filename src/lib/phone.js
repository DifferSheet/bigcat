// เบอร์โทรไทย — ใช้ร่วมกันทุกฟอร์ม (ฝั่ง server มีสำเนาที่ server/validate.js ให้ตรงกัน)
// รับ: มือถือ 10 หลัก (06/08/09) · เบอร์บ้าน 9 หลัก (02–07) · +66 นำหน้า
export const normalizePhone = (s) => {
  let d = String(s || '').replace(/\D/g, '');
  if (d.startsWith('66') && (d.length === 11 || d.length === 10)) d = '0' + d.slice(2);
  return d;
};
export const PHONE_RE = /^(0[689]\d{8}|0[2-7]\d{7})$/;
export const isPhone = (s) => PHONE_RE.test(normalizePhone(s));
export const PHONE_HINT = 'กรอกเบอร์โทร 10 หลัก เช่น 081-234-5678';

// จัดรูปแบบระหว่างพิมพ์: 081-234-5678 (เบอร์บ้าน 02-123-4567)
export const formatPhone = (s) => {
  const d = normalizePhone(s).slice(0, 10);
  if (!d) return '';
  const head = d.startsWith('02') ? 2 : 3;
  const parts = [d.slice(0, head), d.slice(head, head + 3), d.slice(head + 3)].filter(Boolean);
  return parts.join('-');
};
