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
  const [mine, setMine] = useState(null);     // [{ code, number, kind }]
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);     // { number, name, already }

  useEffect(() => {
    setToken(new URLSearchParams(location.search).get('t') || '');
    api(`/events/${slug}`).then(d => {
      setEv(d.event);
      const list = d.mine?.length ? d.mine : (rememberedCode(slug) ? [{ code: rememberedCode(slug) }] : []);
      setMine(list);
      if (list.length === 1) setCode(list[0].code);
    }).catch(e => setError(e.message));
  }, [slug]);

  const checkin = async (e) => {
    e?.preventDefault();
    const c = code.trim().toUpperCase();
    if (!c) return setError('ใส่รหัสบัตร 8 ตัว');
    try { localStorage.setItem(`bigcat-reg-${slug}`, c); } catch { /* optional */ }   // จำรหัสไว้ — ถ้า QR หมดอายุแล้วต้องสแกนใหม่ ไม่ต้องพิมพ์ซ้ำ
    setBusy(true); setError('');
    const geo = await locate();
    try {
      const r = await api(`/registrations/${c}/checkin`, { method: 'POST', body: { gate: token, geo } });
      setDone(r);
      if (navigator.vibrate) navigator.vibrate(120);
    } catch (err) { setError(err.status === 410 ? 'QR หมดอายุแล้ว — สแกน QR หน้างานอีกครั้ง (รหัสบัตรจำไว้ให้แล้ว ไม่ต้องพิมพ์ใหม่)' : err.message); } finally { setBusy(false); }
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
    return <form className="gate-form" onSubmit={checkin}>
      <span className="eyebrow">CHECK-IN</span>
      <h1>{ev.title}</h1>
      {win && start && <p className="muted">เช็คอินได้ {hhmm(start.getTime() - win.before * 60e3)}–{hhmm(start.getTime() + win.after * 60e3)} น.</p>}
      {mine.length > 1
        ? <label>บัตรของคุณ<select value={code} onChange={e => setCode(e.target.value)}>{mine.map(m => <option key={m.code} value={m.code}>#{String(m.number).padStart(3, '0')} · {m.code}</option>)}</select></label>
        : mine.length === 1
          ? <p className="gate-code">รหัสบัตร <strong>{code}</strong> <button type="button" className="link-button" onClick={() => { setMine([]); setCode(''); }}>ไม่ใช่บัตรฉัน</button></p>
          : <label>รหัสบัตร 8 ตัว <small>ดูได้ในหน้า <Tag>บัตรของฉัน</Tag> หรือข้อความ LINE</small><input value={code} onChange={e => setCode(e.target.value)} placeholder="เช่น A7K2P9XD" maxLength={12} autoCapitalize="characters" autoFocus /></label>}
      <button className="button dark big" disabled={busy || !code.trim()}>{busy ? 'กำลังเช็คอิน…' : 'เช็คอิน'} <Icon name="check" /></button>
      {error && <Notice tone="error">{error}</Notice>}
      <p className="small-note">ระบบจะขอตำแหน่งของเครื่อง (ไม่ให้ก็เช็คอินได้) เพื่อช่วยทีมจัดงานดูภาพรวมหน้างาน</p>
    </form>;
  };

  return <><SiteHeader /><main className="ev-page narrow gate-page">{body()}<Paw /></main><SiteFooter /></>;
}
