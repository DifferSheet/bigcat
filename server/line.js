// LINE Messaging API — แจ้งเตือนแฟนคลับและแอดมิน
// ต้องมี LINE Official Account + Messaging API channel: LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET, LINE_OA_ID (@xxxx)
// วิธีผูกบัญชี: ผู้ใช้เพิ่มเพื่อน OA แล้วส่งรหัส 8 หลักที่ได้จากเว็บ → webhook จับคู่ line_user_id กับรายการนั้น
import crypto from 'node:crypto';
import { q, one } from './db.js';

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const SECRET = process.env.LINE_CHANNEL_SECRET || '';
export const lineEnabled = !!TOKEN;
export const lineOaId = process.env.LINE_OA_ID || '';
export const staffTarget = process.env.LINE_STAFF_TARGET || ''; // userId หรือ groupId ของแอดมิน

async function call(path, body) {
  if (!lineEnabled) return false;
  const res = await fetch(`https://api.line.me/v2/bot/message/${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(body),
  });
  if (!res.ok) console.error('[line]', path, res.status, await res.text().catch(() => ''));
  return res.ok;
}

export const push = async (to, text) => (to && text ? call("push", { to, messages: [{ type: "text", text: text.slice(0, 4900) }] }) : false);
export const reply = (replyToken, text) => call('reply', { replyToken, messages: [{ type: 'text', text: text.slice(0, 4900) }] });
export const notifyStaff = async (text) => push(staffTarget, text);

// ส่งหลายคน (multicast สูงสุด 500 ต่อครั้ง)
export async function multicast(userIds, text) {
  const ids = [...new Set(userIds.filter(Boolean))];
  let sent = 0;
  for (let i = 0; i < ids.length; i += 500) {
    if (await call('multicast', { to: ids.slice(i, i + 500), messages: [{ type: 'text', text: text.slice(0, 4900) }] })) sent += Math.min(500, ids.length - i);
  }
  return sent;
}

export function verifySignature(rawBody, signature) {
  if (!SECRET) return false;
  const expected = crypto.createHmac('sha256', SECRET).update(rawBody).digest('base64');
  return signature && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

// หา record จากรหัส 8 หลัก แล้วผูก line_user_id
async function linkCode(code, userId) {
  const tables = [
    ['donations', 'ทำบุญ', 'd.status'],
    ['bookings', 'จองที่นั่ง', 'b.status'],
    ['registrations', 'ลงทะเบียน', null],
    ['orders', 'คำสั่งซื้อ', 'o.status'],
  ];
  for (const [table, label] of tables) {
    const row = await one(`SELECT t.id, t.code, e.title, ${table === 'registrations' ? "IF(t.checked_in_at IS NULL,'ลงทะเบียนแล้ว','เช็คอินแล้ว')" : 't.status'} AS status FROM ${table} t JOIN events e ON e.id=t.event_id WHERE t.code=?`, [code]);
    if (row) {
      await q(`UPDATE ${table} SET line_user_id=? WHERE id=?`, [userId, row.id]);
      return { label, ...row };
    }
  }
  return null;
}

const statusTh = { pending: 'รอตรวจสอบสลิป', approved: 'ยืนยันแล้ว ✓', paid: 'ชำระแล้ว ✓', rejected: 'ไม่ผ่านการตรวจสอบ', checked_in: 'เช็คอินแล้ว', packing: 'กำลังแพ็ก', shipped: 'จัดส่งแล้ว', completed: 'สำเร็จ', cancelled: 'ยกเลิก' };

export async function handleWebhookEvent(ev) {
  if (ev.type === 'follow') {
    return reply(ev.replyToken, 'สวัสดีจากแก๊ง BIGCAT 🐾\nส่งรหัส 8 หลักที่ได้จากเว็บ (เช่น A7K2P9XD) มาที่นี่ เพื่อรับแจ้งเตือนเมื่อยอดได้รับการยืนยัน หรือเมื่อคุณเป็น Lucky Fan');
  }
  if (ev.type === 'message' && ev.message?.type === 'text') {
    const userId = ev.source?.userId;
    const m = ev.message.text.toUpperCase().match(/[A-Z2-9]{8}/);
    if (!m) return reply(ev.replyToken, 'พิมพ์รหัส 8 หลักจากหน้าบัตร/ใบอนุโมทนาของคุณได้เลยครับ 🐾');
    const linked = await linkCode(m[0], userId);
    if (!linked) return reply(ev.replyToken, `ไม่พบรหัส ${m[0]} ลองตรวจสอบตัวสะกดอีกครั้งนะครับ`);
    return reply(ev.replyToken, `ผูกรหัส ${linked.code} (${linked.label}) กับงาน "${linked.title}" แล้ว ✓\nสถานะตอนนี้: ${statusTh[linked.status] || linked.status}\nเมื่อมีอัปเดตเราจะแจ้งที่นี่ทันที`);
  }
  return false;
}

/* ---------- ข้อความสำเร็จรูป ---------- */
export const msg = {
  donationApproved: (d) => `🙏 อนุโมทนาบุญ\nยอด ฿${Number(d.amount).toLocaleString('th-TH')} หมวด "${d.category}" ของคุณได้รับการยืนยันแล้ว\nงาน: ${d.title}\nดูใบอนุโมทนา: ${d.url}`,
  donationRejected: (d) => `รายการ ${d.code} ยังไม่ผ่านการตรวจสอบ ทักมาที่นี่พร้อมสลิปอีกครั้งได้เลยครับ`,
  bookingPaid: (b) => `🎫 ยืนยันการชำระเงินแล้ว\nที่นั่ง ${b.seats} งาน "${b.title}"\nเปิดบัตร (QR เข้างาน): ${b.url}`,
  bookingRejected: (b) => `การจอง ${b.code} ไม่ผ่านการตรวจสอบ ที่นั่งถูกปล่อยคืนแล้ว จองใหม่ได้เลย หรือทักมาที่นี่ครับ`,
  luckyFan: (r) => `🎉 คุณคือ Lucky Fan รอบที่ ${r.round}!\nมาข้างเวทีเพื่อถ่ายรูปคู่กับโนบิได้เลย`,
  staffNew: (kind, ev, detail) => `🔔 ${kind}ใหม่ · ${ev}\n${detail}`,
  orderStatus: (o) => {
    const line = { paid: '✅ ยืนยันการชำระเงินแล้ว กำลังเตรียมของให้', packing: '📦 กำลังแพ็กของ', shipped: `🚚 จัดส่งแล้ว${o.carrier ? ` ทาง ${o.carrier}` : ''}${o.tracking ? `\nเลขพัสดุ: ${o.tracking}` : ''}`, completed: '🎉 ส่งถึงแล้ว ขอบคุณที่อุดหนุนแก๊ง BIGCAT', cancelled: '❌ คำสั่งซื้อถูกยกเลิก หากมีข้อสงสัยทักมาที่นี่ได้เลย', pending: '⏳ รอตรวจสอบการชำระเงิน' }[o.status] || o.status;
    return `คำสั่งซื้อ ${o.code}\n${line}\nดูรายละเอียด: ${o.url}`;
  },
};
