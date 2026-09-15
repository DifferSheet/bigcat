'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from '../lib/nav.jsx';
import QRCode from 'qrcode';
import { SiteHeader, SiteFooter, LineNotify } from '../components/EventShell.jsx';
import { Icon, Paw, PageLoader } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { eventDate, baht } from '../lib/format.js';
import { drawMeritCertificate } from '../lib/merit-certificate.js';

const bookingStatus = { pending: ['รอตรวจสอบสลิป', 'muted'], paid: ['ชำระแล้ว · ใช้เข้างานได้', 'open'], rejected: ['ไม่ผ่านการตรวจสอบ', 'full'], checked_in: ['เช็คอินแล้ว', 'live'] };
const donationStatus = { pending: ['รอตรวจสอบ', 'muted'], approved: ['ยืนยันแล้ว', 'open'], rejected: ['ไม่ผ่านการตรวจสอบ', 'full'] };

function QR({ value }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) QRCode.toCanvas(ref.current, value, { width: 180, margin: 1, color: { dark: '#33332f', light: '#ffffff' } }); }, [value]);
  return <canvas ref={ref} className="qr" aria-label={`QR code ${value}`} />;
}

// ใบอนุโมทนาเป็นภาพขนาด IG Story (1080×1920) วาดด้วย canvas ฝั่ง client
async function drawCertificate(item) {
  if (item.slug === 'merit-vassa-2026') return drawMeritCertificate(item);
  const W = 1080, H = 1920;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  // ชื่อ family จริงมาจาก next/font (hashed) — อ่านจาก CSS variable แล้วโหลดก่อนวาด
  const cs = getComputedStyle(document.documentElement);
  const F = { head: cs.getPropertyValue('--font-head').trim() || 'sans-serif', body: cs.getPropertyValue('--font-body').trim() || 'sans-serif', display: cs.getPropertyValue('--font-display').trim() || 'sans-serif' };
  await Promise.all([`600 64px ${F.head}`, `500 72px ${F.head}`, `700 110px ${F.display}`, `400 36px ${F.body}`].map(f => document.fonts.load(f).catch(() => {})));
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#fff8e6'); g.addColorStop(1, '#fcf8f1');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // ภาพปกด้านบน (ครอปเป็นสี่เหลี่ยม)
  if (item.cover) {
    const img = new Image(); img.src = item.cover;
    await new Promise(r => { img.onload = r; img.onerror = r; });
    if (img.naturalWidth) {
      const size = 760, sx = (img.naturalWidth - Math.min(img.naturalWidth, img.naturalHeight)) / 2, sy = (img.naturalHeight - Math.min(img.naturalWidth, img.naturalHeight)) / 2, side = Math.min(img.naturalWidth, img.naturalHeight);
      x.save(); x.beginPath(); x.roundRect((W - size) / 2, 140, size, size, 48); x.clip(); x.drawImage(img, sx, sy, side, side, (W - size) / 2, 140, size, size); x.restore();
    }
  }
  const center = (text, y, font, color = '#33332f') => { x.font = font; x.fillStyle = color; x.textAlign = 'center'; x.fillText(text, W / 2, y); };
  center('ใบอนุโมทนาบัตร', 1000, `600 64px ${F.head}`);
  center(item.title, 1070, `400 36px ${F.body}`, '#8c7460');
  center(item.anonymous ? 'ผู้ไม่ประสงค์ออกนาม' : item.donor_name, 1200, `500 72px ${F.head}`, '#df8190');
  if (item.dedication) center(item.dedication, 1265, `400 40px ${F.body}`, '#8c7460');
  // หลายหมวดในครั้งเดียว → «ข้าวสาร + น้ำดื่ม 2 ชุด · อาสนะ» · หมวดเดียวเหมือนเดิม
  const detail = item.items?.length ? item.items.map(i => `${i.category}${i.units ? ` ${i.units} ${i.unit_name}` : ''}`).join(' · ') : `${item.units ? `${item.units} ${item.unit_name} · ` : ''}${item.category}`;
  center(detail, 1380, `400 40px ${F.body}`);
  center(`฿${Number(item.amount).toLocaleString('th-TH')}`, 1500, `700 110px ${F.display}`, '#33332f');
  center('ขอให้ความสุขเล็ก ๆ ที่คุณส่งให้ ย้อนกลับมาเป็นความสุขก้อนใหญ่ ♡', 1600, `400 34px ${F.body}`, '#8c7460');
  center(`${eventDate(item).long}`, 1660, `400 32px ${F.body}`, '#8c7460');
  center('BIGCAT', 1800, `700 64px ${F.display}`);
  center(item.code, 1850, `400 28px ${F.body}`, '#8c7460');
  return c.toDataURL('image/png');
}

function CertificateButton({ item }) {
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState(null);
  const [error, setError] = useState('');
  const make = async () => { setBusy(true); setError(''); try { setUrl(await drawCertificate(item)); } catch (e) { setError(e.message || 'สร้างภาพไม่สำเร็จ กรุณาลองอีกครั้ง'); } finally { setBusy(false); } };
  if (url) return <div className="cert-preview"><img src={url} alt="ใบอนุโมทนาบัตร" /><a className="button dark" href={url} download={`anumodana-${item.code}.png`}>บันทึกภาพ <Icon name="arrow" /></a></div>;
  return <><button className="button dark" onClick={make} disabled={busy}>{busy ? 'กำลังสร้างภาพ…' : 'สร้างใบอนุโมทนาเป็นภาพ (IG Story)'} <Icon name="heart" /></button>{error && <p className="notice error" role="alert">{error}</p>}</>;
}

// ค้นหาบัตรจากรหัส: ลองการจอง → ลงทะเบียน → ทำบุญ
async function lookup(code) {
  for (const [kind, path] of [['booking', '/bookings/'], ['registration', '/registrations/'], ['donation', '/donations/']]) {
    try { return { kind, item: await api(path + code) }; } catch (e) { if (e.status !== 404) throw e; }
  }
  throw new Error('ไม่พบรหัสนี้ ตรวจสอบตัวสะกดอีกครั้ง');
}

export default function TicketPage({ code }) {
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: code !== 'lookup' });
  const [input, setInput] = useState('');
  useEffect(() => {
    if (code === 'lookup') return setState({});
    setState({ loading: true });
    lookup(code.toUpperCase()).then(r => setState(r)).catch(e => setState({ error: e.message }));
  }, [code]);

  const body = () => {
    if (code === 'lookup' || state.error) return <div className="ticket-lookup">
      <span className="eyebrow">MY TICKET</span><h1>ค้นหาบัตรของฉัน</h1>
      <p>ใส่รหัส 8 หลักที่ได้รับตอนจอง ลงทะเบียน หรือแจ้งยอดทำบุญ</p>
      <form onSubmit={e => { e.preventDefault(); if (input.trim()) navigate(`/ticket/${input.trim().toUpperCase()}`); }}><input id="tk-code" value={input} onChange={e => setInput(e.target.value)} placeholder="เช่น A7K2P9XD" maxLength={16} autoFocus /><button className="button dark">ค้นหา <Icon name="arrow" /></button></form>
      {state.error && <p className="notice error">{state.error}</p>}
    </div>;
    if (state.loading) return <PageLoader label="กำลังค้นหาบัตร…" />;
    const { kind, item } = state;
    const d = item.starts_at ? eventDate(item) : null;
    const [label, tone] = kind === 'booking' ? bookingStatus[item.status] : kind === 'donation' ? donationStatus[item.status] : item.checked_in_at ? ['เช็คอินแล้ว', 'live'] : ['ลงทะเบียนแล้ว', 'open'];
    return <article className={`ticket tone-${item.tone || 'pink'}`}>
      <div className="ticket-main">
        <span className="eyebrow">{kind === 'booking' ? 'E-TICKET' : kind === 'donation' ? 'ใบอนุโมทนาบัตร' : 'REGISTRATION'}</span>
        <h1>{item.title}</h1>
        {d && <p className="muted">{d.long} · {d.time}{item.place ? ` · ${item.place}` : ''}</p>}
        <span className={`status-pill ${tone}`}>{label}</span>
        <dl className="ticket-facts">
          {kind === 'booking' && <><div><dt>ชื่อ</dt><dd>{item.name}</dd></div><div><dt>ที่นั่ง</dt><dd>{item.seats.join(', ')}</dd></div><div><dt>ยอด</dt><dd>{baht(item.amount)}</dd></div></>}
          {kind === 'registration' && <><div><dt>ชื่อ</dt><dd>{item.nickname || item.name}</dd></div><div><dt>หมายเลข</dt><dd>#{String(item.number).padStart(3, '0')}</dd></div>{item.luckyRound && <div><dt>Lucky Fan</dt><dd>รอบที่ {item.luckyRound} 🎉</dd></div>}</>}
          {kind === 'donation' && <><div><dt>ผู้ร่วมบุญ</dt><dd>{item.anonymous ? 'ผู้ไม่ประสงค์ออกนาม' : item.donor_name}</dd></div>{item.dedication && <div><dt>ในนาม / อุทิศให้</dt><dd>{item.dedication}</dd></div>}<div><dt>หมวด</dt><dd>{item.units ? `${item.units} ${item.unit_name} · ` : ''}{item.category}</dd></div><div><dt>จำนวน</dt><dd>{baht(item.amount)}</dd></div></>}
        </dl>
        {kind === 'donation' && item.status === 'approved' && <><p className="blessing">ขออนุโมทนาบุญ ขอให้ความสุขเล็กๆ ที่คุณส่งให้ ย้อนกลับมาหาคุณเป็นความสุขก้อนใหญ่ ♡</p><CertificateButton item={item} /></>}
        {kind === 'donation' && item.status === 'pending' && <p className="muted">เมื่อยอดได้รับการยืนยัน จะสร้างใบอนุโมทนาเป็นภาพได้จากหน้านี้</p>}
        <LineNotify code={item.code} linked={!!item.lineLinked} />
        {kind === 'booking' && item.status === 'pending' && <p className="muted">กำลังตรวจสอบสลิป เมื่อยืนยันแล้วสถานะจะเปลี่ยนเป็น "ชำระแล้ว" และ QR ใช้เข้างานได้</p>}
        <div className="form-actions"><Link className="button ghost" to={`/events/${item.slug}`}>ไปหน้ากิจกรรม</Link><button className="button ghost" onClick={() => window.print()}>พิมพ์ / บันทึก</button></div>
      </div>
      <div className="ticket-stub">
        <QR value={item.code} />
        <strong className="code">{item.code}</strong>
        <Paw />
      </div>
    </article>;
  };

  return <><SiteHeader /><main className="ev-page narrow">{body()}</main><SiteFooter /></>;
}
