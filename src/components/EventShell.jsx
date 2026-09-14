'use client';
import React, { useEffect, useState } from 'react';
import { Link } from '../lib/nav.jsx';
import { Icon, Paw, Logo } from './ui.jsx';
import { statusLabel, parseDate } from '../lib/format.js';
import { siteConfig } from '../lib/api.js';
import { useCart } from '../lib/cart.js';

export function SiteHeader({ live }) {
  const { count } = useCart();
  return <header className="header">
    <div className="nav-shell">
      <Link to="/" className="logo" aria-label="Bigcat หน้าแรก"><Logo /></Link>
      <nav className="nav-links" aria-label="เมนู">
        <Link to="/">หน้าแรก</Link>
        <Link to="/events">กิจกรรม</Link>
        <Link to="/shop" className="shop-nav">SHOP <span>↗</span></Link>
        <Link to="/ticket/lookup">บัตรของฉัน</Link>
      </nav>
      <div className="nav-actions">
        {live != null && <span className={`live-dot ${live ? 'on' : ''}`} title={live ? 'เชื่อมต่อ realtime แล้ว' : 'กำลังเชื่อมต่อ…'}><span />{live ? 'LIVE' : 'OFFLINE'}</span>}
        <Link className="icon-button cart-button" to="/cart" aria-label={`ตะกร้า ${count} ชิ้น`}><Icon name="bag" size={23} />{count > 0 && <span className="cart-count">{count}</span>}</Link>
      </div>
    </div>
  </header>;
}

export function SiteFooter() {
  return <footer className="footer"><div className="footer-top"><Link to="/" className="logo"><Logo /></Link><p>แมวตัวโต แต่มีหัวใจเล็ก ๆ ที่รักคุณเสมอ ♡</p><Link to="/admin" className="back-top">สำหรับทีมงาน</Link></div><div className="footer-bottom"><span>© {new Date().getFullYear()} BIGCAT. Made with a whole lot of love.</span></div></footer>;
}

export function StatusPill({ status }) {
  const [label, tone] = statusLabel[status] || [status, 'muted'];
  return <span className={`status-pill ${tone}`}>{tone === 'live' && <span className="status-dot" />}{label}</span>;
}

export function Countdown({ to, endedLabel = 'เริ่มแล้ว' }) {
  const target = parseDate(to).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const diff = target - now;
  if (diff <= 0) return <div className="countdown ended" suppressHydrationWarning>{endedLabel}</div>;
  const d = Math.floor(diff / 864e5), h = Math.floor(diff / 36e5) % 24, m = Math.floor(diff / 6e4) % 60, s = Math.floor(diff / 1e3) % 60;
  const cells = [[d, 'วัน'], [h, 'ชม.'], [m, 'นาที'], [s, 'วิ']];
  // เวลาฝั่ง server กับ client ต่างกันเป็นวินาทีเสมอ — บอก React ว่าไม่ต้องเตือน แล้วให้ค่าจริงมาตอน mount
  return <div className="countdown" aria-label="นับถอยหลังถึงวันงาน">{cells.map(([v, l]) => <span key={l}><strong suppressHydrationWarning>{String(v).padStart(2, '0')}</strong><small>{l}</small></span>)}</div>;
}

export function Section({ eyebrow, title, children, className = '', aside }) {
  return <section className={`ev-section ${className}`}>
    <div className="ev-section-head"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}{title && <h2>{title}</h2>}</div>{aside}</div>
    {children}
  </section>;
}

export function Notice({ tone = 'info', children }) {
  return <div className={`notice ${tone}`}><Icon name={tone === 'error' ? 'close' : 'check'} size={16} />{children}</div>;
}

// ปุ่มเพิ่มลงปฏิทิน (.ics) — สร้างไฟล์ตอนคลิก (ใช้ location ได้เฉพาะฝั่ง client)
export function CalendarButton({ event }) {
  const download = () => {
    const toICS = (d) => parseDate(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BIGCAT//TH', 'BEGIN:VEVENT', `UID:${event.slug}@bigcat`, `DTSTART:${toICS(event.starts_at)}`, `DTEND:${toICS(event.ends_at || event.starts_at)}`, `SUMMARY:${event.title}`, `LOCATION:${event.place || ''}`, `URL:${window.location.origin}/events/${event.slug}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `${event.slug}.ics`; a.click();
    URL.revokeObjectURL(url);
  };
  return <button className="button ghost" onClick={download}><Icon name="clock" size={16} /> เพิ่มลงปฏิทิน</button>;
}

// กล่องชำระเงิน: QR จริงถ้ามี (payment.qrImage) หรือเลข PromptPay
export function PayBox({ payment = {}, note }) {
  return <div className={`pay-box ${payment.qrImage ? 'with-qr' : ''}`}>
    {payment.qrImage && <img className="pay-qr" src={payment.qrImage} alt={`QR code สำหรับโอนเงิน ${payment.accountName || ''}`} />}
    <div className="pay-info">
      <span className="eyebrow">{payment.qrImage ? 'สแกนจ่ายผ่านแอปธนาคาร' : 'โอนผ่าน PromptPay'}</span>
      {payment.promptpay && <strong>{payment.promptpay}</strong>}
      {payment.accountName && <span className="pay-name">{payment.accountName}</span>}
      {note && <span>{note}</span>}
    </div>
  </div>;
}

// ชวนผูก LINE เพื่อรับแจ้งเตือน: เพิ่มเพื่อน OA แล้วส่งรหัส (ลิงก์ oaMessage เปิดแชทพร้อมข้อความ)
export function LineNotify({ code, linked }) {
  const [cfg, setCfg] = useState(null);
  useEffect(() => { siteConfig().then(setCfg); }, []);
  if (!cfg?.lineEnabled || !cfg.lineOaId) return null;
  const oa = cfg.lineOaId.replace(/^@/, '');
  if (linked) return <div className="line-box linked"><span className="line-logo">LINE</span><span>ผูกบัญชี LINE แล้ว — จะได้รับแจ้งเตือนเมื่อสถานะเปลี่ยน</span></div>;
  return <div className="line-box">
    <span className="line-logo">LINE</span>
    <div><strong>รับแจ้งเตือนทาง LINE</strong><span>เพิ่มเพื่อน @{oa} แล้วส่งรหัส <b className="code">{code}</b> — ระบบจะแจ้งทันทีเมื่อยืนยันยอด/บัตร หรือเมื่อคุณเป็น Lucky Fan</span></div>
    <a className="button dark small" href={`https://line.me/R/oaMessage/@${oa}/?${encodeURIComponent(code)}`} target="_blank" rel="noreferrer">เปิด LINE ↗</a>
  </div>;
}
