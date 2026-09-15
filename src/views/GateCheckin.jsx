'use client';
// หน้าที่แฟนเปิดหลังสแกน QR หน้างาน (/checkin/:slug?t=โทเคน) — หาบัตรของคนนี้ → กดเช็คอิน → จอเขียวโชว์หมายเลข
// หาบัตรจาก: บัญชีที่ล็อกอิน (event.mine) → รหัสที่เครื่องนี้จำไว้ตอนลงทะเบียน (localStorage) → พิมพ์รหัส 8 ตัวเอง
import React, { useEffect, useState } from 'react';
import { Link } from '../lib/nav.jsx';
import { SiteHeader, SiteFooter, Notice } from '../components/EventShell.jsx';
import { Icon, Paw, PageLoader, Tag } from '../components/ui.jsx';
import { api } from '../lib/api.js';

const hhmm = (d) => new Date(d).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });
const rememberedCode = (slug) => { try { return localStorage.getItem(`bigcat-reg-${slug}`) || JSON.parse(localStorage.getItem(`bigcat-attend-${slug}`) || 'null')?.code || ''; } catch { return ''; } };

// ขอพิกัดแบบไม่บังคับ — ไม่ให้/ไม่รองรับ/ช้าเกิน 6 วิ ก็เช็คอินต่อได้ (เก็บไว้ดูทีหลังเท่านั้น)
const locate = () => new Promise(resolve => {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
  const done = (v) => { clearTimeout(t); resolve(v); };
  const t = setTimeout(() => done(null), 6000);
  navigator.geolocation.getCurrentPosition(p => done({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }), () => done(null), { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 });
});

export default function GateCheckin({ slug }) {
  const [token, setToken] = useState('');
  const [ev, setEv] = useState(null);
  const [mine, setMine] = useState(null);     // [{ code, number, kind }] บัตรที่หาเจอเอง
  const [code, setCode] = useState('');       // รหัสที่พิมพ์ (กรณีหาไม่เจอ)
  const [ticket, setTicket] = useState(null); // ข้อมูลบัตรเต็มจาก /registrations/:code → โชว์เป็นตั๋วให้ตรวจก่อนกด
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);     // { number, name, already }

  // ดึงข้อมูลบัตรมาแสดงเป็นตั๋ว (ชื่อ · หมายเลข · งาน · รหัส) ให้ผู้ใช้เห็นก่อนว่ากำลังจะเช็คอินบัตรไหน
  const showTicket = async (c) => {
    setBusy(true); setError('');
    try {
      const t = await api(`/registrations/${c.trim().toUpperCase()}`);
      if (t.slug !== slug) throw new Error('รหัสนี้เป็นบัตรของงานอื่น');
      setTicket(t);
      try { localStorage.setItem(`bigcat-reg-${slug}`, t.code); } catch { /* optional */ }   // จำไว้ — สแกนใหม่ไม่ต้องพิมพ์ซ้ำ
    } catch (err) { setTicket(null); setError(err.message); } finally { setBusy(false); }
  };

  useEffect(() => {
    setToken(new URLSearchParams(location.search).get('t') || '');
    api(`/events/${slug}`).then(d => {
      setEv(d.event);
      const list = d.mine?.length ? d.mine : (rememberedCode(slug) ? [{ code: rememberedCode(slug) }] : []);
      setMine(list);
      if (list.length >= 1) showTicket(list[0].code);
    }).catch(e => setError(e.message));
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const lookup = (e) => { e.preventDefault(); if (!code.trim()) return setError('ใส่รหัสบัตร 8 ตัว'); showTicket(code); };
  const notMine = () => { setTicket(null); setMine([]); setCode(''); setError(''); try { localStorage.removeItem(`bigcat-reg-${slug}`); } catch { /* optional */ } };

  const checkin = async () => {
    setBusy(true); setError('');
    const geo = await locate();
    try {
      const r = await api(`/registrations/${ticket.code}/checkin`, { method: 'POST', body: { gate: token, geo } });
      setDone(r);
      if (navigator.vibrate) navigator.vibrate(120);
    } catch (err) { setError(err.status === 410 ? 'QR หมดอายุแล้ว — สแกน QR หน้างานอีกครั้ง (บัตรจำไว้ให้แล้ว ไม่ต้องพิมพ์ใหม่)' : err.message); } finally { setBusy(false); }
  };

  const cfg = ev?.config || {};
  const win = cfg.checkinWindow && ev ? { before: cfg.checkinWindow.before ?? 30, after: cfg.checkinWindow.after ?? 30 } : null;
  const start = ev ? new Date(String(ev.starts_at).replace(' ', 'T') + '+07:00') : null;

  const body = () => {
    if (error && !ev) return <Notice tone="error">{error}</Notice>;
    if (!ev || mine === null) return <PageLoader label="กำลังหาบัตรของคุณ…" />;
    if (done) return <div className="gate-done">
      <Icon name="check" size={56} />
      <span className="eyebrow">{done.already ? 'เช็คอินไว้แล้ว' : 'เช็คอินสำเร็จ'}</span>
      <strong>#{String(done.number).padStart(3, '0')}</strong>
      <h1>{done.name}</h1>
      <p>{ev.type === 'busking' ? 'คุณอยู่ในกลุ่มลุ้น Lucky Fan แล้ว สนุกกับโชว์นะคะ ♡' : 'ขอบคุณที่มานะคะ ♡'}</p>
      <Link className="button ghost" to={`/events/${slug}`}>ไปหน้างาน</Link>
    </div>;
    if (!token) return <Notice tone="error">ลิงก์นี้ไม่มีรหัสจาก QR หน้างาน — สแกน QR ที่จุดเช็คอินอีกครั้ง</Notice>;
    const windowText = win && start ? <p className="muted">เช็คอินได้ {hhmm(start.getTime() - win.before * 60e3)}–{hhmm(start.getTime() + win.after * 60e3)} น.</p> : null;
    // มีบัตรแล้ว → โชว์เป็นตั๋วให้ตรวจ แล้วกดเช็คอิน
    if (ticket) return <div className="gate-form">
      <span className="eyebrow">CHECK-IN</span>
      <h1>บัตรของคุณใช่ไหม</h1>
      {windowText}
      {mine.length > 1 && <label>บัตรของคุณ<select value={ticket.code} onChange={e => showTicket(e.target.value)}>{mine.map(m => <option key={m.code} value={m.code}>#{String(m.number).padStart(3, '0')} · {m.code}</option>)}</select></label>}
      <article className={`mini-ticket tone-${ticket.tone || 'pink'}`}>
        <div className="mini-ticket-main">
          <span className="eyebrow">{ticket.title}</span>
          <strong className="mini-ticket-name">{ticket.nickname || ticket.name}</strong>
          {ticket.nickname && <span className="muted">{ticket.name}</span>}
          <span className="mini-ticket-num">หมายเลข #{String(ticket.number).padStart(3, '0')}{ticket.checked_in_at ? ' · เช็คอินแล้ว ✓' : ''}</span>
        </div>
        <div className="mini-ticket-stub"><span className="eyebrow">รหัสบัตร</span><strong className="code">{ticket.code}</strong><Paw /></div>
      </article>
      {ticket.checked_in_at
        ? <Notice>บัตรนี้เช็คอินไว้แล้ว ไม่ต้องกดซ้ำ</Notice>
        : <button type="button" className="button dark big" onClick={checkin} disabled={busy}>{busy ? 'กำลังเช็คอิน…' : 'ใช่ เช็คอินเลย'} <Icon name="check" /></button>}
      <button type="button" className="link-button" onClick={notMine}>ไม่ใช่บัตรฉัน — ใส่รหัสอื่น</button>
      {error && <Notice tone="error">{error}</Notice>}
      <p className="small-note">ระบบจะขอตำแหน่งของเครื่อง (ไม่ให้ก็เช็คอินได้) เพื่อช่วยทีมจัดงานดูภาพรวมหน้างาน</p>
    </div>;
    // ยังไม่รู้ว่าบัตรไหน → พิมพ์รหัส แล้วค่อยโชว์ตั๋วให้ตรวจ
    return <form className="gate-form" onSubmit={lookup}>
      <span className="eyebrow">CHECK-IN</span>
      <h1>{ev.title}</h1>
      {windowText}
      <label>รหัสบัตร 8 ตัว <small>ดูได้ในหน้า <Tag>บัตรของฉัน</Tag> หรือข้อความ LINE</small><input value={code} onChange={e => setCode(e.target.value)} placeholder="เช่น A7K2P9XD" maxLength={12} autoCapitalize="characters" autoFocus /></label>
      <button className="button dark big" disabled={busy || !code.trim()}>{busy ? 'กำลังหาบัตร…' : 'ค้นหาบัตร'} <Icon name="arrow" /></button>
      {error && <Notice tone="error">{error}</Notice>}
    </form>;
  };

  return <><SiteHeader /><main className="ev-page narrow gate-page">{body()}<Paw /></main><SiteFooter /></>;
}
