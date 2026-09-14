import { Router } from 'express';
import { q, one, tx, parseJSON } from '../db.js';
import { wrap, HttpError } from '../lib.js';
import { push, msg } from '../line.js';
import { upload } from './public.js';
import { shopSettings, listProducts, broadcastProducts, orderByCode, statusTh } from './shop.js';
import { requireAdmin } from './admin.js';
import { cleanHtml, textToHtml, looksLikeHtml } from '../richtext.js';

const r = Router();
r.use(requireAdmin);
const slugify = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9ก-๙]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || `item-${Date.now()}`;
const siteUrl = () => process.env.SITE_URL || 'http://localhost:5173';

/* ---------- สินค้า ---------- */
r.get('/products', wrap(async (_req, res) => res.json(await listProducts({ all: true }))));

// สร้าง/แก้ไข: multipart (image) + field `payload` เป็น JSON { name, name_th, description, category, price, compare_price, stock, status, featured, sort, variants:[{id?, name, price_delta, stock, sku, image?}] }
async function saveProduct(req, id) {
  const p = parseJSON(req.body.payload, {});
  if (!p.name) throw new HttpError(400, 'กรุณาใส่ชื่อสินค้า');
  const row = {
    name: String(p.name).slice(0, 160), name_th: p.name_th ? String(p.name_th).slice(0, 160) : null,
    // รับได้ทั้ง HTML จากตัวแก้ไข และข้อความดิบที่ paste มา
    description: p.description ? cleanHtml(looksLikeHtml(p.description) ? p.description : textToHtml(p.description)) || null : null,
    category: p.category || 'ของสะสม', price: Math.max(0, Math.round(Number(p.price) || 0)), compare_price: p.compare_price ? Math.round(Number(p.compare_price)) : null,
    stock: Math.max(0, Math.round(Number(p.stock) || 0)), status: ['active', 'hidden', 'soldout'].includes(p.status) ? p.status : 'active',
    featured: p.featured ? 1 : 0, sort: Math.round(Number(p.sort) || 0),
  };
  if (req.file) row.image = `/uploads/${req.file.filename}`;
  else if (p.image) row.image = p.image;
  return tx(async ({ q, one }) => {
    if (id) {
      await q('UPDATE products SET ? WHERE id=?', [row, id]);
    } else {
      let slug = slugify(p.slug || p.name);
      if (await one('SELECT id FROM products WHERE slug=?', [slug])) slug = `${slug}-${Date.now().toString(36)}`;
      id = (await q('INSERT INTO products SET ?', [{ ...row, slug }])).insertId;
    }
    if (Array.isArray(p.variants)) {
      const keep = [];
      for (const [i, v] of p.variants.entries()) {
        if (!v.name) continue;
        const vr = { product_id: id, name: String(v.name).slice(0, 80), price_delta: Math.round(Number(v.price_delta) || 0), stock: Math.max(0, Math.round(Number(v.stock) || 0)), sku: v.sku || null, image: typeof v.image === 'string' && /^\/(uploads|images)\//.test(v.image) ? v.image.slice(0, 300) : null, sort: i };
        if (v.id && await one('SELECT id FROM product_variants WHERE id=? AND product_id=?', [v.id, id])) { await q('UPDATE product_variants SET ? WHERE id=?', [vr, v.id]); keep.push(Number(v.id)); }
        else keep.push((await q('INSERT INTO product_variants SET ?', [vr])).insertId);
      }
      await q(keep.length ? 'DELETE FROM product_variants WHERE product_id=? AND id NOT IN (?)' : 'DELETE FROM product_variants WHERE product_id=?', keep.length ? [id, keep] : [id]);
    }
    const saved = await one('SELECT * FROM products WHERE id=?', [id]);
    if (!saved.images || req.file) await q('UPDATE products SET images=? WHERE id=?', [JSON.stringify([saved.image].filter(Boolean)), id]);
    return id;
  });
}

r.post('/products', upload.single('image'), wrap(async (req, res) => { const id = await saveProduct(req); await broadcastProducts(); res.json((await listProducts({ all: true })).find(p => p.id === id)); }));
r.put('/products/:id', upload.single('image'), wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!await one('SELECT id FROM products WHERE id=?', [id])) throw new HttpError(404, 'ไม่พบสินค้า');
  await saveProduct(req, id); await broadcastProducts();
  res.json((await listProducts({ all: true })).find(p => p.id === id));
}));
r.delete('/products/:id', wrap(async (req, res) => {
  await q('DELETE FROM products WHERE id=?', [Number(req.params.id)]);
  await broadcastProducts();
  res.json({ ok: true });
}));

/* ---------- ออเดอร์ ---------- */
r.get('/orders', wrap(async (req, res) => {
  const where = req.query.status && req.query.status !== 'all' ? 'WHERE o.status=?' : '';
  const rows = await q(`SELECT o.*, o.line_user_id IS NOT NULL AS lineLinked FROM orders o ${where} ORDER BY FIELD(o.status,'pending','paid','packing','shipped','completed','cancelled'), o.created_at DESC`, where ? [req.query.status] : []);
  if (!rows.length) return res.json([]);
  const items = await q('SELECT * FROM order_items WHERE order_id IN (?)', [rows.map(o => o.id)]);
  res.json(rows.map(({ line_user_id, ...o }) => ({ ...o, items: items.filter(i => i.order_id === o.id) })));
}));

r.get('/orders/summary', wrap(async (_req, res) => {
  const s = await one(`SELECT COUNT(*) AS total, SUM(status='pending') AS pending, SUM(status='paid') AS paid, SUM(status='packing') AS packing, SUM(status='shipped') AS shipped,
    SUM(CASE WHEN status IN ('paid','packing','shipped','completed') THEN total ELSE 0 END) AS revenue FROM orders`);
  res.json(Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Number(v || 0)])));
}));

// เปลี่ยนสถานะ / ใส่เลขพัสดุ → แจ้ง LINE ลูกค้า; ยกเลิก → คืนสต็อก
r.patch('/orders/:id', wrap(async (req, res) => {
  const o = await one('SELECT * FROM orders WHERE id=?', [Number(req.params.id)]);
  if (!o) throw new HttpError(404, 'ไม่พบคำสั่งซื้อ');
  const patch = {};
  if (req.body.status) {
    if (!statusTh[req.body.status]) throw new HttpError(400, 'สถานะไม่ถูกต้อง');
    patch.status = req.body.status;
  }
  if (req.body.carrier !== undefined) patch.carrier = String(req.body.carrier || '').slice(0, 60) || null;
  if (req.body.tracking_no !== undefined) patch.tracking_no = String(req.body.tracking_no || '').slice(0, 80) || null;
  if (patch.tracking_no && !patch.status && o.status === 'packing') patch.status = 'shipped';
  await tx(async ({ q }) => {
    await q('UPDATE orders SET ? WHERE id=?', [patch, o.id]);
    if (patch.status === 'cancelled' && o.status !== 'cancelled') {
      for (const it of await q('SELECT product_id, variant_id, qty FROM order_items WHERE order_id=?', [o.id])) {
        if (it.variant_id) await q('UPDATE product_variants SET stock = stock + ? WHERE id=?', [it.qty, it.variant_id]);
        else if (it.product_id) await q('UPDATE products SET stock = stock + ? WHERE id=?', [it.qty, it.product_id]);
      }
    }
  });
  if (patch.status === 'cancelled') await broadcastProducts();
  if (o.line_user_id && (patch.status || patch.tracking_no)) {
    const status = patch.status || o.status;
    push(o.line_user_id, msg.orderStatus({ code: o.code, status, carrier: patch.carrier ?? o.carrier, tracking: patch.tracking_no ?? o.tracking_no, url: `${siteUrl()}/order/${o.code}` })).catch(() => {});
  }
  res.json(await orderByCode(o.code));
}));

r.get('/orders.csv', wrap(async (_req, res) => {
  const rows = await q(`SELECT o.code, o.created_at, o.status, o.name, o.phone, o.email, o.delivery, o.address, o.subtotal, o.shipping_fee, o.total, o.carrier, o.tracking_no, o.trans_ref, o.verify_note,
    (SELECT GROUP_CONCAT(CONCAT(i.name, IFNULL(CONCAT(' (', i.variant_name, ')'), ''), ' x', i.qty) SEPARATOR ' | ') FROM order_items i WHERE i.order_id=o.id) AS items FROM orders o ORDER BY o.created_at`);
  const head = ['รหัส', 'วันที่', 'สถานะ', 'ชื่อ', 'เบอร์', 'อีเมล', 'จัดส่ง', 'ที่อยู่', 'ยอดสินค้า', 'ค่าส่ง', 'รวม', 'ขนส่ง', 'เลขพัสดุ', 'เลขอ้างอิงสลิป', 'ผลตรวจ', 'รายการ'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  res.setHeader('content-type', 'text/csv; charset=utf-8');
  res.setHeader('content-disposition', 'attachment; filename="orders.csv"');
  res.send('﻿' + [head, ...rows.map(o => Object.values(o))].map(row => row.map(esc).join(',')).join('\r\n'));
}));

/* ---------- ตั้งค่าร้าน ---------- */
r.get('/settings', wrap(async (_req, res) => res.json(await shopSettings())));
r.put('/settings', upload.single('qr'), wrap(async (req, res) => {
  const cur = await shopSettings();
  const p = parseJSON(req.body.payload, {});
  const next = {
    ...cur,
    shippingFee: Math.max(0, Math.round(Number(p.shippingFee ?? cur.shippingFee) || 0)),
    freeShippingOver: p.freeShippingOver ? Math.round(Number(p.freeShippingOver)) : null,
    pickup: { enabled: !!p.pickup?.enabled, label: String(p.pickup?.label || cur.pickup.label || 'รับหน้างาน').slice(0, 160) },
    carriers: Array.isArray(p.carriers) ? p.carriers.map(c => String(c).slice(0, 40)).filter(Boolean) : cur.carriers,
    // ผู้ส่งบนจ่าหน้าพัสดุ (พิมพ์จากหน้าแอดมิน)
    sender: { name: String(p.sender?.name ?? cur.sender?.name ?? '').slice(0, 120), phone: String(p.sender?.phone ?? cur.sender?.phone ?? '').slice(0, 30), address: String(p.sender?.address ?? cur.sender?.address ?? '').slice(0, 500) },
    payment: { ...cur.payment, promptpay: p.payment?.promptpay ?? cur.payment.promptpay, accountName: p.payment?.accountName ?? cur.payment.accountName, ...(req.file ? { qrImage: `/uploads/${req.file.filename}` } : {}) },
  };
  await q('INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value=VALUES(value)', ['shop', JSON.stringify(next)]);
  res.json(next);
}));

export default r;
