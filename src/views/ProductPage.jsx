'use client';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from '../lib/nav.jsx';
import { SiteHeader, SiteFooter, Notice } from '../components/EventShell.jsx';
import { Icon, PageLoader } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { cart } from '../lib/cart.js';
import { useEventSocket } from '../lib/socket.js';
import { baht } from '../lib/format.js';

export default function ProductPage({ slug, initialProduct = null }) {
  const navigate = useNavigate();
  const [p, setP] = useState(initialProduct);
  const [error, setError] = useState('');
  const [variantId, setVariantId] = useState(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [shot, setShot] = useState(0);   // รูปที่กำลังแสดงในแกลเลอรี
  useEffect(() => { if (!initialProduct) api(`/shop/products/${slug}`).then(setP).catch(e => setError(e.message)); }, [slug, initialProduct]);
  useEventSocket('shop', { products: list => { const n = list.find(x => x.slug === slug); if (n) setP(n); } });
  useEffect(() => { setShot(0); setVariantId(null); setQty(1); }, [slug]);   // scroll ไปบนสุดจัดการรวมที่ components/ScrollManager.jsx

  if (error) return <><SiteHeader /><main className="ev-page"><div className="ev-hero-simple"><h1>{error}</h1><Link className="button dark" to="/shop">กลับไปร้านค้า</Link></div></main><SiteFooter /></>;
  if (!p) return <><SiteHeader /><PageLoader /></>;
  const gallery = (p.images?.length ? p.images : [p.image]).filter(Boolean);
  const variant = p.variants.find(v => v.id === variantId) || null;
  const needVariant = p.variants.length > 0 && !variant;
  const max = variant ? variant.stock : p.stock;
  const price = variant ? variant.price : p.price;
  const canBuy = p.available && !needVariant && max > 0;
  // ไซส์ล้วน (S/M/L/XL/2XL/ตัวเลข) ไม่ต้องย้ำว่าเลือกอะไร · สี/แบบ/ตัวละคร ต้องบอกให้ชัด (แด๊ดสั่ง 14 ก.ย.)
  const isSizeOnly = (name) => /^\s*(xs|s|m|l|xl|xxl|\d?xl|free|f|\d+)\s*$/i.test(name || '');
  const showChosen = variant && (variant.image || !isSizeOnly(variant.name));
  const pickVariant = (v) => {
    setVariantId(v.id); setQty(1);
    if (v.image) { const i = gallery.indexOf(v.image); if (i >= 0) setShot(i); }
  };
  const add = (go) => {
    if (!canBuy) return;
    cart.add(p, variant, qty); setAdded(true);
    if (go) navigate('/cart');
  };

  return <>
    <SiteHeader />
    <main className="ev-page">
      <nav className="crumbs"><Link to="/">หน้าแรก</Link><span>/</span><Link to="/shop">ร้านค้า</Link><span>/</span><span>{p.name}</span></nav>
      <div className="product-layout">
        <div className="product-media">
          <div className="product-gallery">
            <img src={gallery[shot] || '/images/bigcat-merch.png'} alt={`${p.name_th || p.name}${variant?.name ? ` — ${variant.name}` : ''} ของแก๊ง BIGCAT รูปที่ ${shot + 1}`} />
            {!p.available && <span className="shop-badge">หมดแล้ว</span>}
            {gallery.length > 1 && <>
              <button className="gal-nav prev" aria-label="รูปก่อนหน้า" onClick={() => setShot((shot + gallery.length - 1) % gallery.length)}>←</button>
              <button className="gal-nav next" aria-label="รูปถัดไป" onClick={() => setShot((shot + 1) % gallery.length)}>→</button>
              <span className="gal-count">{shot + 1}/{gallery.length}</span>
            </>}
          </div>
          {gallery.length > 1 && <div className="product-thumbs">{gallery.map((src, i) => <button key={src} className={i === shot ? 'active' : ''} onClick={() => setShot(i)} aria-label={`ดูรูปที่ ${i + 1}`}><img src={src} alt="" loading="lazy" /></button>)}</div>}
        </div>
        <div className="product-info-col">
          <span className="eyebrow">{p.category}</span>
          <h1>{p.name}</h1>
          <p className="ev-subtitle">{p.name_th}</p>
          <div className="price big">{baht(price)}{p.compare_price && <s>{baht(p.compare_price)}</s>}</div>
          {p.variants.length > 0 && <div className="variant-pick">
            <span className="eyebrow">เลือกแบบ</span>
            <div className="chips">{p.variants.map(v => <button key={v.id} className={`chip ${v.image ? 'with-img' : ''} ${variantId === v.id ? 'active' : ''} ${v.stock <= 0 ? 'off' : ''}`} disabled={v.stock <= 0} aria-pressed={variantId === v.id} onClick={() => pickVariant(v)}>{v.image && <img src={v.image} alt="" loading="lazy" />}{v.name}{v.price_delta ? ` +${baht(v.price_delta)}` : ''}{v.stock <= 0 ? ' (หมด)' : ''}</button>)}</div>
            {showChosen && <p className="variant-chosen">{variant.image && <img src={variant.image} alt={`แบบ ${variant.name}`} />}<span>แบบที่เลือก: <strong>{variant.name}</strong>{variant.price_delta ? ` (+${baht(variant.price_delta)})` : ''}</span></p>}
          </div>}
          <div className="unit-row">
            <span className="eyebrow">จำนวน</span>
            <div className="stepper"><button type="button" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="ลด">−</button><input type="number" min="1" max={max || 1} value={qty} onChange={e => setQty(Math.max(1, Math.min(max || 1, Number(e.target.value) || 1)))} aria-label="จำนวน" /><button type="button" onClick={() => setQty(Math.min(max || 1, qty + 1))} aria-label="เพิ่ม">+</button></div>
            <span className="muted">{needVariant ? 'เลือกแบบก่อน' : max > 0 ? `เหลือ ${max} ชิ้น` : 'หมดแล้ว'}</span>
          </div>
          {added && <Notice>เพิ่มลงตะกร้าแล้ว <Link to="/cart">ดูตะกร้า →</Link></Notice>}
          <div className="form-actions">
            <button className="button dark" disabled={!canBuy} onClick={() => add(false)}>เพิ่มลงตะกร้า <Icon name="bag" size={16} /></button>
            <button className="button ghost" disabled={!canBuy} onClick={() => add(true)}>ซื้อเลย <Icon name="arrow" size={16} /></button>
          </div>
          {p.description && <div className="product-desc rich" dangerouslySetInnerHTML={{ __html: p.description }} />}
          <div className="trust-grid small">
            <div className="trust-item"><span className="eyebrow">จัดส่ง</span><p>ส่งไปรษณีย์ทั่วไทย หรือรับหน้างานกิจกรรม</p></div>
            <div className="trust-item"><span className="eyebrow">ชำระเงิน</span><p>สแกน QR แล้วแนบสลิป ระบบตรวจอัตโนมัติ</p></div>
          </div>
        </div>
      </div>
    </main>
    <SiteFooter />
  </>;
}
