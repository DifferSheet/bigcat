'use client';
import React, { useEffect, useState } from 'react';
import { Link } from '../lib/nav.jsx';
import { SiteHeader, SiteFooter } from '../components/EventShell.jsx';
import { Icon, PageLoader } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { cart } from '../lib/cart.js';
import { useEventSocket } from '../lib/socket.js';
import { baht } from '../lib/format.js';

export function ProductCard({ p, onAdd }) {
  const simple = !p.variants.length;
  return <article className={`shop-card ${!p.available ? 'soldout' : ''}`}>
    <Link to={`/shop/${p.slug}`} className="shop-card-img"><img src={p.image || '/images/bigcat-merch.png'} alt={`${p.name_th || p.name} — ของแก๊ง BIGCAT`} loading="lazy" />{!p.available && <span className="shop-badge">หมดแล้ว</span>}{p.compare_price && p.available && <span className="shop-badge sale">-{Math.round((1 - p.price / p.compare_price) * 100)}%</span>}</Link>
    <div className="shop-card-body">
      <span className="eyebrow">{p.category}</span>
      <h3><Link to={`/shop/${p.slug}`}>{p.name}</Link></h3>
      <p>{p.name_th}</p>
      <div className="shop-card-foot">
        <span className="price">{baht(p.price)}{p.compare_price && <s>{baht(p.compare_price)}</s>}{p.variants.length > 0 && <small> · {p.variants.length} แบบ</small>}</span>
        {simple && p.available
          ? <button className="icon-button product-add" onClick={() => onAdd(p)} aria-label={`เพิ่ม ${p.name} ลงตะกร้า`}><Icon name="plus" /></button>
          : <Link className="button ghost small" to={`/shop/${p.slug}`}>{p.available ? 'เลือกแบบ' : 'ดู'}</Link>}
      </div>
      {p.available && p.stock <= 5 && <small className="low-stock">เหลือ {p.stock} ชิ้น</small>}
    </div>
  </article>;
}

export default function ShopPage({ initialProducts = null }) {
  const [products, setProducts] = useState(initialProducts);
  const [filter, setFilter] = useState('ทั้งหมด');
  const [toast, setToast] = useState('');
  useEffect(() => { api('/shop/products').then(list => { setProducts(list); cart.sync(list); }).catch(() => setProducts(p => p || [])); }, []);
  useEventSocket('shop', { products: list => { setProducts(list); cart.sync(list); } });
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 2500); return () => clearTimeout(t); } }, [toast]);
  const cats = ['ทั้งหมด', ...new Set((products || []).map(p => p.category))];
  const list = (products || []).filter(p => filter === 'ทั้งหมด' || p.category === filter);
  const add = (p) => { if (cart.add(p, null, 1)) setToast(`เพิ่ม ${p.name} ลงตะกร้าแล้ว`); else setToast('สินค้าหมดแล้ว'); };

  return <>
    <SiteHeader />
    <main className="ev-page">
      <div className="ev-hero-simple">
        <span className="eyebrow">THE LITTLE BIGCAT SHOP</span>
        <h1>Little things. Big love.</h1>
        <p>ของสะสมจากแก๊ง BIGCAT ส่งถึงบ้านหรือรับหน้างาน สต็อกอัปเดตสด</p>
        <div className="filter-tabs">{cats.map(c => <button key={c} className={filter === c ? 'active' : ''} aria-pressed={filter === c} onClick={() => setFilter(c)}>{c}</button>)}</div>
      </div>
      {!products ? <PageLoader /> : <div className="shop-grid">{list.map(p => <ProductCard key={p.id} p={p} onAdd={add} />)}</div>}
      {products && list.length === 0 && <p className="small-note">ยังไม่มีสินค้าในหมวดนี้</p>}
    </main>
    {toast && <div className="toast" role="status"><Icon name="check" />{toast} <Link to="/cart" className="toast-link">ดูตะกร้า →</Link></div>}
    <SiteFooter />
  </>;
}
