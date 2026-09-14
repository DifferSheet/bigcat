'use client';
import React, { useEffect, useState } from 'react';
import { Link } from '../lib/nav.jsx';
import { SiteHeader, SiteFooter } from '../components/EventShell.jsx';
import { Icon } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { cart, useCart } from '../lib/cart.js';
import { baht } from '../lib/format.js';

export function CartSummary({ subtotal, settings, delivery = 'ship' }) {
  const fee = !settings ? null : delivery === 'pickup' ? 0 : (settings.freeShippingOver && subtotal >= settings.freeShippingOver ? 0 : settings.shippingFee);
  return <div className="cart-sum">
    <div><span>ยอดสินค้า</span><span>{baht(subtotal)}</span></div>
    <div><span>ค่าจัดส่ง</span><span>{fee == null ? '—' : fee === 0 ? 'ฟรี' : baht(fee)}</span></div>
    {settings?.freeShippingOver && delivery === 'ship' && subtotal < settings.freeShippingOver && <small className="muted">ซื้ออีก {baht(settings.freeShippingOver - subtotal)} ส่งฟรี</small>}
    <div className="cart-sum-total"><span>รวมทั้งหมด</span><strong>{baht(subtotal + (fee || 0))}</strong></div>
  </div>;
}

export default function CartPage() {
  const { items, subtotal } = useCart();
  const [settings, setSettings] = useState(null);
  useEffect(() => {
    api('/shop/settings').then(setSettings).catch(() => {});
    api('/shop/products').then(list => cart.sync(list)).catch(() => {});
  }, []);
  return <>
    <SiteHeader />
    <main className="ev-page narrow">
      <div className="ev-section-head"><div><span className="eyebrow">YOUR LITTLE HAPPY BAG</span><h1>ตะกร้าของฉัน</h1></div><Link className="button ghost small" to="/shop">เลือกซื้อต่อ</Link></div>
      {items.length === 0 ? <div className="empty-cart"><Icon name="bag" size={50} /><h3>ตะกร้ายังว่างอยู่เลย</h3><p>เติมความน่ารักชิ้นเล็ก ๆ ลงในถุงกัน</p><Link to="/shop" className="button dark">ไปดูของสะสม <Icon name="arrow" /></Link></div>
        : <div className="cart-layout">
          <ul className="cart-lines">{items.map(i => <li key={i.key} className="cart-line">
            <img src={i.image || '/images/bigcat-merch.png'} alt="" />
            <div className="cart-line-info">
              <Link to={`/shop/${i.slug}`}><strong>{i.name}</strong></Link>
              {i.variantName && <span className="muted variant">{i.variantName}</span>}
              <p className="muted">{baht(i.price)} / ชิ้น</p>
            </div>
            <div className="quantity"><button aria-label="ลด" onClick={() => cart.setQty(i.key, i.qty - 1)}><Icon name="minus" size={14} /></button><span>{i.qty}</span><button aria-label="เพิ่ม" onClick={() => cart.setQty(i.key, i.qty + 1)} disabled={i.max && i.qty >= i.max}><Icon name="plus" size={14} /></button></div>
            <div className="cart-line-end">
              <strong className="cart-line-total">{baht(i.price * i.qty)}</strong>
              <button className="link-button" onClick={() => cart.remove(i.key)} aria-label={`ลบ ${i.name}`}>ลบ</button>
            </div>
          </li>)}</ul>
          <aside className="cart-side">
            <CartSummary subtotal={subtotal} settings={settings} />
            <Link className="button dark" to="/checkout">ไปชำระเงิน <Icon name="arrow" /></Link>
          </aside>
        </div>}
    </main>
    <SiteFooter />
  </>;
}
