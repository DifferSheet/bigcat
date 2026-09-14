'use client';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from '../lib/nav.jsx';
import { SiteHeader, SiteFooter, Notice, PayBox } from '../components/EventShell.jsx';
import { Icon } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { cart, useCart } from '../lib/cart.js';
import { baht } from '../lib/format.js';
import { CartSummary } from './CartPage.jsx';

const saved = () => { try { return JSON.parse(localStorage.getItem('bigcat-checkout') || '{}'); } catch { return {}; } };

export default function CheckoutPage() {
  const { items, subtotal } = useCart();
  const navigate = useNavigate();
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', delivery: 'ship', address: '', note: '' });
  // เติมข้อมูลที่จำไว้หลัง hydrate (กัน server/client ไม่ตรงกัน)
  useEffect(() => { const s = saved(); if (Object.keys(s).length) setForm(f => ({ ...f, ...s })); }, []);
  const [slip, setSlip] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { api('/shop/settings').then(setSettings).catch(() => {}); api('/shop/products').then(list => cart.sync(list)).catch(() => {}); }, []);
  const fee = !settings ? 0 : form.delivery === 'pickup' ? 0 : (settings.freeShippingOver && subtotal >= settings.freeShippingOver ? 0 : settings.shippingFee);
  const total = subtotal + fee;

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const fd = new FormData();
      fd.append('payload', JSON.stringify({ ...form, items: items.map(i => ({ productId: i.productId, variantId: i.variantId, qty: i.qty })) }));
      if (slip) fd.append('slip', slip);
      const r = await api('/shop/orders', { method: 'POST', body: fd });
      try { localStorage.setItem('bigcat-checkout', JSON.stringify({ name: form.name, phone: form.phone, email: form.email, address: form.address })); } catch { /* optional */ }
      cart.clear();
      navigate(`/order/${r.code}`, { state: { fresh: true, autoApproved: r.autoApproved } });
    } catch (err) { setError(err.message); if (err.status === 409 || err.status === 400) api('/shop/products').then(list => cart.sync(list)).catch(() => {}); }
    finally { setBusy(false); }
  };

  if (items.length === 0) return <><SiteHeader /><main className="ev-page narrow"><div className="empty-cart"><Icon name="bag" size={50} /><h3>ตะกร้าว่าง</h3><Link to="/shop" className="button dark">ไปเลือกของ <Icon name="arrow" /></Link></div></main><SiteFooter /></>;

  return <>
    <SiteHeader />
    <main className="ev-page">
      <nav className="crumbs"><Link to="/shop">ร้านค้า</Link><span>/</span><Link to="/cart">ตะกร้า</Link><span>/</span><span>ชำระเงิน</span></nav>
      <div className="cart-layout checkout">
        <form className="booking-form" onSubmit={submit} id="checkout-form">
          <h2>ข้อมูลผู้สั่งซื้อ</h2>
          <div className="two"><label>ชื่อ-นามสกุล<input id="co-name" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label><label>เบอร์โทร<input id="co-phone" required inputMode="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label></div>
          <label>อีเมล (ถ้ามี)<input id="co-email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
          <h2>การจัดส่ง</h2>
          <div className="delivery-pick">
            <label className={`delivery-opt ${form.delivery === 'ship' ? 'active' : ''}`}><input type="radio" name="delivery" checked={form.delivery === 'ship'} onChange={() => setForm({ ...form, delivery: 'ship' })} /><span><strong>ส่งไปรษณีย์</strong><small>{settings ? (settings.freeShippingOver ? `ค่าส่ง ${baht(settings.shippingFee)} · ฟรีเมื่อซื้อครบ ${baht(settings.freeShippingOver)}` : `ค่าส่ง ${baht(settings.shippingFee)}`) : ''}</small></span></label>
            {settings?.pickup?.enabled && <label className={`delivery-opt ${form.delivery === 'pickup' ? 'active' : ''}`}><input type="radio" name="delivery" checked={form.delivery === 'pickup'} onChange={() => setForm({ ...form, delivery: 'pickup' })} /><span><strong>รับหน้างาน</strong><small>{settings.pickup.label} · ไม่มีค่าส่ง</small></span></label>}
          </div>
          {form.delivery === 'ship' && <label>ที่อยู่จัดส่ง<textarea id="co-address" required rows={3} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="บ้านเลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์" /></label>}
          <label>หมายเหตุถึงร้าน (ถ้ามี)<input id="co-note" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} maxLength={300} /></label>
          <h2>ชำระเงิน</h2>
          <PayBox payment={settings?.payment} note={`โอน ${baht(total)} แล้วแนบสลิป — ตรวจอัตโนมัติ ยืนยันทันทีเมื่อผ่าน (แนบทีหลังได้ในหน้าคำสั่งซื้อ)`} />
          <label>สลิปโอนเงิน<input id="co-slip" type="file" accept="image/*" onChange={e => setSlip(e.target.files?.[0] || null)} /></label>
          {error && <Notice tone="error">{error}</Notice>}
        </form>
        <aside className="cart-side">
          <ul className="mini-lines">{items.map(i => <li key={i.key}><img src={i.image || '/images/bigcat-merch.png'} alt="" /><span>{i.name}{i.variantName ? ` · ${i.variantName}` : ''} × {i.qty}</span><strong>{baht(i.price * i.qty)}</strong></li>)}</ul>
          <CartSummary subtotal={subtotal} settings={settings} delivery={form.delivery} />
          <button className="button dark" form="checkout-form" disabled={busy}>{busy ? 'กำลังส่งคำสั่งซื้อ…' : `ยืนยันสั่งซื้อ ${baht(total)}`} <Icon name="check" /></button>
          <small className="muted">สต็อกจะถูกจองให้ทันทีที่กดยืนยัน</small>
        </aside>
      </div>
    </main>
    <SiteFooter />
  </>;
}
