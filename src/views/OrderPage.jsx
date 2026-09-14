'use client';
import React, { useEffect, useState } from 'react';
import { Link, useLocation } from '../lib/nav.jsx';
import { SiteHeader, SiteFooter, Notice, LineNotify } from '../components/EventShell.jsx';
import { Icon, PageLoader } from '../components/ui.jsx';
import { FileDrop } from '../components/forms.jsx';
import { api } from '../lib/api.js';
import { baht } from '../lib/format.js';

const STEPS = [['pending', 'รอชำระ'], ['paid', 'ชำระแล้ว'], ['packing', 'กำลังแพ็ก'], ['shipped', 'จัดส่งแล้ว'], ['completed', 'สำเร็จ']];
const trackUrl = (carrier, no) => {
  const c = String(carrier || '').toLowerCase();
  if (c.includes('kerry')) return `https://th.kerryexpress.com/th/track/?track=${no}`;
  if (c.includes('flash')) return `https://www.flashexpress.com/fle/tracking?se=${no}`;
  if (c.includes('j&t') || c.includes('jt')) return `https://www.jtexpress.co.th/index/query/gzquery.html?bills=${no}`;
  if (c.includes('ไปรษณีย์') || c.includes('thailand post')) return `https://track.thailandpost.co.th/?trackNumber=${no}`;
  return null;
};

export default function OrderPage({ code }) {
  const { state } = useLocation();
  const [o, setO] = useState(null);
  const [error, setError] = useState('');
  const [slip, setSlip] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const load = () => api(`/orders/${code}`).then(setO).catch(e => setError(e.message));
  useEffect(() => { load(); }, [code]);

  const uploadSlip = async (e) => {
    e.preventDefault(); if (!slip) return; setBusy(true); setMsg('');
    try { const fd = new FormData(); fd.append('slip', slip); const r = await api(`/orders/${code}/slip`, { method: 'POST', body: fd }); setMsg(r.autoApproved ? 'ตรวจสลิปผ่านแล้ว ยืนยันการชำระเงินเรียบร้อย' : `รับสลิปแล้ว ทีมงานจะตรวจสอบ (${r.note})`); load(); }
    catch (err) { setMsg(err.message); } finally { setBusy(false); }
  };

  if (error) return <><SiteHeader /><main className="ev-page narrow"><div className="ev-hero-simple"><h1>{error}</h1><Link className="button dark" to="/shop">ไปร้านค้า</Link></div></main><SiteFooter /></>;
  if (!o) return <><SiteHeader /><PageLoader /></>;
  const idx = STEPS.findIndex(([s]) => s === o.status);
  const track = trackUrl(o.carrier, o.tracking_no);

  return <>
    <SiteHeader />
    <main className="ev-page narrow">
      {state?.fresh && <Notice tone={state.autoApproved ? 'info' : 'muted'}>{state.autoApproved ? 'สั่งซื้อสำเร็จและตรวจสลิปผ่านแล้ว ขอบคุณที่อุดหนุนแก๊ง Bigcat ♡' : 'รับคำสั่งซื้อแล้ว สต็อกถูกจองให้แล้ว รอตรวจสอบการชำระเงิน'}</Notice>}
      <div className="ev-section-head"><div><span className="eyebrow">ORDER</span><h1>คำสั่งซื้อ <span className="code">{o.code}</span></h1></div><span className={`status-pill ${o.status === 'cancelled' ? 'full' : o.status === 'pending' ? 'muted' : 'open'}`}>{o.statusLabel}</span></div>

      {o.status !== 'cancelled' && <ol className="order-steps">{STEPS.map(([s, label], i) => <li key={s} className={i < idx ? 'done' : i === idx ? 'now' : ''}><span className="dot" /><span>{label}</span></li>)}</ol>}

      <div className="order-grid">
        <section className="order-box">
          <span className="eyebrow">รายการ</span>
          <ul className="mini-lines">{o.items.map(i => <li key={i.id}><img src={i.image || '/images/bigcat-merch.png'} alt="" /><span>{i.name}{i.variant_name ? ` · ${i.variant_name}` : ''} × {i.qty}</span><strong>{baht(i.price * i.qty)}</strong></li>)}</ul>
          <div className="cart-sum"><div><span>ยอดสินค้า</span><span>{baht(o.subtotal)}</span></div><div><span>ค่าจัดส่ง</span><span>{o.shipping_fee ? baht(o.shipping_fee) : 'ฟรี'}</span></div><div className="cart-sum-total"><span>รวม</span><strong>{baht(o.total)}</strong></div></div>
        </section>
        <section className="order-box">
          <span className="eyebrow">จัดส่ง</span>
          <p><strong>{o.name}</strong><br />{o.phone}{o.email ? <><br />{o.email}</> : null}</p>
          <p className="muted">{o.delivery === 'pickup' ? 'รับหน้างาน — แสดงรหัสคำสั่งซื้อนี้กับทีมงาน' : o.address}</p>
          {o.tracking_no && <div className="tracking"><span className="eyebrow">เลขพัสดุ</span><strong className="code">{o.tracking_no}</strong><span className="muted">{o.carrier}</span>{track && <a className="button ghost small" href={track} target="_blank" rel="noreferrer">ติดตามพัสดุ ↗</a>}</div>}
          {o.note && <p className="muted">หมายเหตุ: {o.note}</p>}
        </section>
      </div>

      {o.status === 'pending' && <section className="order-box">
        <span className="eyebrow">ชำระเงิน</span>
        <p>{o.slip_path ? `แนบสลิปแล้ว รอทีมงานตรวจสอบ${o.verify_note ? ` (${o.verify_note})` : ''}` : 'ยังไม่ได้แนบสลิป โอนแล้วแนบได้ที่นี่'}</p>
        <form className="booking-form inline" onSubmit={uploadSlip}><FileDrop file={slip} onChange={setSlip} label={`สลิปโอนเงิน ${baht(o.total)}`} /><div className="form-actions"><button className="button dark small" disabled={!slip || busy}>ส่งสลิป</button></div></form>
        {msg && <Notice>{msg}</Notice>}
      </section>}

      <LineNotify code={o.code} linked={o.lineLinked} />
      <div className="form-actions"><Link className="button ghost" to="/shop">เลือกซื้อต่อ</Link></div>
    </main>
    <SiteFooter />
  </>;
}
