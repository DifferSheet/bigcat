'use client';
import React, { useEffect, useState } from 'react';
import { useUser, prefillFrom } from '../lib/auth.js';
import { Link, useNavigate } from '../lib/nav.jsx';
import { SiteHeader, SiteFooter, Notice, PayBox } from '../components/EventShell.jsx';
import { Icon } from '../components/ui.jsx';
import { PhoneInput, AddressForm, FileDrop } from '../components/forms.jsx';
import { api } from '../lib/api.js';
import { cart, useCart } from '../lib/cart.js';
import { baht } from '../lib/format.js';
import { CartSummary } from './CartPage.jsx';
import { allowFunctional } from '../lib/consent.js';

const saved = () => { try { return JSON.parse(localStorage.getItem('bigcat-checkout') || '{}'); } catch { return {}; } };

export default function CheckoutPage() {
  const { items, subtotal } = useCart();
  const navigate = useNavigate();
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', delivery: 'ship', address: '', note: '' });
  const { user, providers } = useUser();
  // เติมข้อมูลที่จำไว้หลัง hydrate (กัน server/client ไม่ตรงกัน) — ความจำของ guest
  useEffect(() => { const s = saved(); if (Object.keys(s).length) setForm(f => ({ ...f, ...s })); }, []);
  // สมาชิก: โปรไฟล์ชนะความจำ guest (แก้ในฟอร์มได้ตามปกติ)
  useEffect(() => { setForm(f => prefillFrom(user, f, { name: 'display_name', phone: 'phone', email: 'email', address: 'address' }, true)); }, [user]);
  const [slip, setSlip] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { api('/shop/settings').then(setSettings).catch(() => {}); api('/shop/products').then(list => cart.sync(list)).catch(() => {}); }, []);
  // จัดส่งไปรษณีย์อย่างเดียว (ตัดตัวเลือกรับหน้างานออกตามแด๊ดสั่ง 15 ก.ย. 2026 — ฝั่ง server ยังรองรับ pickup อยู่)
  const fee = !settings ? 0 : (settings.freeShippingOver && subtotal >= settings.freeShippingOver ? 0 : settings.shippingFee);
  const total = subtotal + fee;

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const fd = new FormData();
      fd.append('payload', JSON.stringify({ ...form, delivery: 'ship', items: items.map(i => ({ productId: i.productId, variantId: i.variantId, qty: i.qty })) }));
      if (slip) fd.append('slip', slip);
      const r = await api('/shop/orders', { method: 'POST', body: fd });
      if (allowFunctional()) try { localStorage.setItem('bigcat-checkout', JSON.stringify({ name: form.name, phone: form.phone, email: form.email, address: form.address })); } catch { /* optional */ }
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
          {!user && (providers.line || providers.google) && <p className="login-hint">มีบัญชี LINE/Google? <a href={`/login?next=${encodeURIComponent('/checkout')}`}>เข้าสู่ระบบ</a> เพื่อให้กรอกอัตโนมัติและดูคำสั่งซื้อย้อนหลังได้</p>}
          <div className="two"><label>ชื่อ-นามสกุล<input id="co-name" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label><label>เบอร์โทร<PhoneInput id="co-phone" required value={form.phone} onChange={phone => setForm({ ...form, phone })} /></label></div>
          <label>อีเมล (ถ้ามี)<input id="co-email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
          <h2>การจัดส่ง</h2>
          <div className="delivery-card"><Icon name="truck" size={20} /><span><strong>ส่งไปรษณีย์ถึงบ้าน</strong><small>{settings ? (settings.freeShippingOver ? `ค่าส่ง ${baht(settings.shippingFee)} · ฟรีเมื่อซื้อครบ ${baht(settings.freeShippingOver)}` : `ค่าส่ง ${baht(settings.shippingFee)}`) : ''}</small></span></div>
          <AddressForm idPrefix="co" value={form.address} onChange={address => setForm(f => ({ ...f, address }))} />
          <label>หมายเหตุถึงร้าน (ถ้ามี)<input id="co-note" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} maxLength={300} /></label>
          <h2>ชำระเงิน</h2>
          <PayBox payment={settings?.payment} note={`โอน ${baht(total)} แล้วแนบสลิป — ตรวจอัตโนมัติ ยืนยันทันทีเมื่อผ่าน (แนบทีหลังได้ในหน้าคำสั่งซื้อ)`} />
          <FileDrop id="co-slip" file={slip} onChange={setSlip} hint="โอนแล้วแนบได้เลย หรือแนบทีหลังในหน้าคำสั่งซื้อ · JPG / PNG" />
          {error && <Notice tone="error">{error}</Notice>}
        </form>
        <aside className="cart-side">
          <ul className="mini-lines">{items.map(i => <li key={i.key}><img src={i.image || '/images/bigcat-merch.png'} alt="" /><span>{i.name}{i.variantName ? ` · ${i.variantName}` : ''} × {i.qty}</span><strong>{baht(i.price * i.qty)}</strong></li>)}</ul>
          <CartSummary subtotal={subtotal} settings={settings} />
          <button className="button dark" form="checkout-form" disabled={busy}>{busy ? 'กำลังส่งคำสั่งซื้อ…' : `ยืนยันสั่งซื้อ ${baht(total)}`} <Icon name="check" /></button>
          <small className="muted">สต็อกจะถูกจองให้ทันทีที่กดยืนยัน</small>
        </aside>
      </div>
    </main>
    <SiteFooter />
  </>;
}
