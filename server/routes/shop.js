import { Router } from 'express';
import { q, one, tx, parseJSON } from '../db.js';
import { wrap, HttpError, code, emit } from '../lib.js';
import { verifySlip } from '../slip.js';
import { requirePhone } from '../validate.js';
import { ownerFields } from '../auth.js';
import { notifyStaff, push, msg } from '../line.js';
import { upload } from './public.js';

const r = Router();
const clean = (v, max = 200) => String(v ?? '').trim().slice(0, max);

/* ---------- helpers (ใช้ร่วมกับ admin) ---------- */
export async function shopSettings() {
  const row = await one('SELECT value FROM settings WHERE `key`=?', ['shop']);
  return { shippingFee: 50, freeShippingOver: null, pickup: { enabled: false, label: 'รับหน้างาน' }, payment: {}, carriers: [], ...parseJSON(row?.value, {}) };
}

export function shapeProduct(p, variants = []) {
  const vs = variants.filter(v => v.product_id === p.id).map(v => ({ ...v, price: p.price + v.price_delta }));
  const stock = vs.length ? vs.reduce((s, v) => s + v.stock, 0) : p.stock;
  return { ...p, images: parseJSON(p.images, p.image ? [p.image] : []), variants: vs, stock, available: p.status === 'active' && stock > 0 };
}

export async function listProducts({ all = false } = {}) {
  const rows = await q(`SELECT * FROM products ${all ? '' : "WHERE status <> 'hidden'"} ORDER BY sort, id`);
  if (!rows.length) return [];
  const variants = await q('SELECT * FROM product_variants WHERE product_id IN (?) ORDER BY sort, id', [rows.map(p => p.id)]);
  return rows.map(p => shapeProduct(p, variants));
}

export const broadcastProducts = async () => emit('shop', 'products', await listProducts());

export async function orderByCode(codeUp) {
  const o = await one('SELECT * FROM orders WHERE code=?', [codeUp]);
  if (!o) return null;
  const items = await q('SELECT * FROM order_items WHERE order_id=? ORDER BY id', [o.id]);
  const { line_user_id, ...rest } = o;
  return { ...rest, lineLinked: !!line_user_id, items };
}

export const statusTh = { pending: 'รอตรวจสอบการชำระเงิน', paid: 'ชำระแล้ว · กำลังเตรียมของ', packing: 'กำลังแพ็ก', shipped: 'จัดส่งแล้ว', completed: 'สำเร็จ', cancelled: 'ยกเลิก' };

/* ---------- public ---------- */
r.get('/shop/settings', wrap(async (_req, res) => {
  const s = await shopSettings();
  res.json({ shippingFee: s.shippingFee, freeShippingOver: s.freeShippingOver, pickup: s.pickup, payment: s.payment });
}));

r.get('/shop/products', wrap(async (_req, res) => res.json(await listProducts())));

r.get('/shop/products/:slug', wrap(async (req, res) => {
  const p = await one("SELECT * FROM products WHERE slug=? AND status <> 'hidden'", [req.params.slug]);
  if (!p) throw new HttpError(404, 'ไม่พบสินค้านี้');
  res.json(shapeProduct(p, await q('SELECT * FROM product_variants WHERE product_id=? ORDER BY sort, id', [p.id])));
}));

// สั่งซื้อ: ตรวจสต็อกใน transaction, คำนวณราคาฝั่ง server, ตัดสต็อกทันที (คืนถ้ายกเลิก)
r.post('/shop/orders', upload.single('slip'), wrap(async (req, res) => {
  const body = req.body.payload ? parseJSON(req.body.payload, {}) : req.body;
  const items = (body.items || []).map(i => ({ productId: Number(i.productId), variantId: i.variantId ? Number(i.variantId) : null, qty: Math.max(1, Math.min(99, Math.round(Number(i.qty) || 1))) })).filter(i => i.productId);
  const name = clean(body.name, 120), email = clean(body.email, 160), note = clean(body.note, 300);
  const delivery = body.delivery === 'pickup' ? 'pickup' : 'ship';
  const address = clean(body.address, 600);
  if (!items.length) throw new HttpError(400, 'ตะกร้าว่าง');
  if (!name) throw new HttpError(400, 'กรุณากรอกชื่อ');
  const phone = requirePhone(body.phone);
  if (delivery === 'ship' && !address) throw new HttpError(400, 'กรุณากรอกที่อยู่จัดส่ง');
  const settings = await shopSettings();
  if (delivery === 'pickup' && !settings.pickup?.enabled) throw new HttpError(400, 'ยังไม่เปิดรับหน้างาน');

  const order = await tx(async ({ q, one }) => {
    const lines = [];
    for (const it of items) {
      const p = await one("SELECT id, name, price, image, stock, status FROM products WHERE id=? AND status='active' FOR UPDATE", [it.productId]);
      if (!p) throw new HttpError(400, 'มีสินค้าที่ปิดขายแล้วในตะกร้า');
      let v = null;
      if (it.variantId) {
        v = await one('SELECT id, name, price_delta, stock FROM product_variants WHERE id=? AND product_id=? FOR UPDATE', [it.variantId, p.id]);
        if (!v) throw new HttpError(400, `ตัวเลือกของ ${p.name} ไม่ถูกต้อง`);
        if (v.stock < it.qty) throw new HttpError(409, `${p.name} (${v.name}) เหลือ ${v.stock} ชิ้น`);
        await q('UPDATE product_variants SET stock = stock - ? WHERE id=?', [it.qty, v.id]);
      } else {
        const hasVariants = await one('SELECT id FROM product_variants WHERE product_id=? LIMIT 1', [p.id]);
        if (hasVariants) throw new HttpError(400, `กรุณาเลือกตัวเลือกของ ${p.name}`);
        if (p.stock < it.qty) throw new HttpError(409, `${p.name} เหลือ ${p.stock} ชิ้น`);
        await q('UPDATE products SET stock = stock - ? WHERE id=?', [it.qty, p.id]);
      }
      lines.push({ product_id: p.id, variant_id: v?.id || null, name: p.name, variant_name: v?.name || null, image: p.image, price: p.price + (v?.price_delta || 0), qty: it.qty });
    }
    const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
    const shipping_fee = delivery === 'pickup' ? 0 : (settings.freeShippingOver && subtotal >= settings.freeShippingOver ? 0 : Number(settings.shippingFee || 0));
    const total = subtotal + shipping_fee;
    const verify = req.file ? await verifySlip(req.file.path, { expectedAmount: total }) : { ok: false, note: 'ยังไม่แนบสลิป' };
    const orderCode = code(7) + 'X'; // ลงท้าย X = ออเดอร์ (แยกจากรหัสกิจกรรม 8 หลัก)
    const ins = await q('INSERT INTO orders SET ?', [{ code: orderCode, status: verify.ok ? 'paid' : 'pending', name, phone, email: email || null, delivery, address: address || null, note: note || null, subtotal, shipping_fee, total, slip_path: req.file ? `/uploads/${req.file.filename}` : null, trans_ref: verify.transRef || null, verified_at: verify.verified ? new Date() : null, verify_note: verify.note, ...ownerFields(req) }]);
    for (const l of lines) await q('INSERT INTO order_items SET ?', [{ ...l, order_id: ins.insertId }]);
    return { code: orderCode, total, subtotal, shipping_fee, status: verify.ok ? 'paid' : 'pending', autoApproved: verify.ok, note: verify.note, lines };
  });
  await broadcastProducts();
  if (!order.autoApproved) notifyStaff(msg.staffNew('ออเดอร์', 'ร้านค้า', `${name} · ${order.lines.map(l => `${l.name}${l.variant_name ? ` (${l.variant_name})` : ''} ×${l.qty}`).join(', ')} · ฿${order.total}\n${order.note}`)).catch(() => {});
  res.json(order);
}));

r.get('/orders/:code', wrap(async (req, res) => {
  const o = await orderByCode(req.params.code.toUpperCase());
  if (!o) throw new HttpError(404, 'ไม่พบคำสั่งซื้อนี้');
  res.json({ ...o, statusLabel: statusTh[o.status] });
}));

// แนบสลิปทีหลัง (ออเดอร์ที่ยัง pending)
r.post('/orders/:code/slip', upload.single('slip'), wrap(async (req, res) => {
  const o = await one('SELECT id, total, status, line_user_id FROM orders WHERE code=?', [req.params.code.toUpperCase()]);
  if (!o) throw new HttpError(404, 'ไม่พบคำสั่งซื้อนี้');
  if (o.status !== 'pending') throw new HttpError(400, 'คำสั่งซื้อนี้ยืนยันการชำระเงินแล้ว');
  if (!req.file) throw new HttpError(400, 'กรุณาแนบสลิป');
  const verify = await verifySlip(req.file.path, { expectedAmount: o.total });
  await q('UPDATE orders SET ?, status=? WHERE id=?', [{ slip_path: `/uploads/${req.file.filename}`, trans_ref: verify.transRef || null, verified_at: verify.verified ? new Date() : null, verify_note: verify.note }, verify.ok ? 'paid' : 'pending', o.id]);
  if (verify.ok && o.line_user_id) push(o.line_user_id, msg.orderStatus({ code: req.params.code.toUpperCase(), status: 'paid', url: `${process.env.SITE_URL || 'http://localhost:5173'}/order/${req.params.code.toUpperCase()}` })).catch(() => {});
  if (!verify.ok) notifyStaff(msg.staffNew('สลิปออเดอร์', 'ร้านค้า', `${req.params.code.toUpperCase()} · ฿${o.total}\n${verify.note}`)).catch(() => {});
  res.json({ ok: true, autoApproved: verify.ok, note: verify.note, status: verify.ok ? 'paid' : 'pending' });
}));

export default r;
