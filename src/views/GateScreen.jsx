'use client';
// จอ QR เช็คอินหน้างาน — วางมือถือ/iPad ไว้ที่จุดเช็คอิน แฟนสแกนเองแล้วกดยืนยัน
// QR เปลี่ยนทุก 45 วิ (โทเคนจาก server) → รูปถ่าย QR ที่ส่งต่อไปใช้จากที่บ้านไม่ได้ · ต้องล็อกอินแอดมินก่อนเปิดจอ
import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Link } from '../lib/nav.jsx';
import { Flower, Logo, PageLoader } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useEventSocket } from '../lib/socket.js';

const hhmm = (d) => new Date(d).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });

export default function GateScreen({ slug }) {
  const [gate, setGate] = useState(null);     // { token, ttl, expiresIn, mode, window, title, registrations }
  const [left, setLeft] = useState(0);        // วินาทีที่เหลือก่อน QR เปลี่ยน
  const [error, setError] = useState('');
  const canvas = useRef(null);
  const timer = useRef(null);

  const load = async () => {
    try {
      const g = await api(`/admin/events/${slug}/gate`, { admin: true });
      setGate(g); setLeft(g.expiresIn); setError('');
      clearTimeout(timer.current);
      timer.current = setTimeout(load, Math.max(1, g.expiresIn) * 1000 + 300);   // ดึงโทเคนใหม่ทันทีที่ช่องเวลาเปลี่ยน
    } catch (e) { setError(e.status === 401 ? 'ต้องเข้าสู่ระบบแอดมินก่อนเปิดจอนี้' : e.message); setTimeout(load, 5000); }
  };
  useEffect(() => { load(); return () => clearTimeout(timer.current); }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setInterval(() => setLeft(x => Math.max(0, x - 1)), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!gate?.token || !canvas.current) return;
    QRCode.toCanvas(canvas.current, `${location.origin}/checkin/${slug}?t=${gate.token}`, { width: 520, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#33332f', light: '#ffffff' } });
  }, [gate?.token, slug]);
  useEventSocket(slug, { registrations: (registrations) => setGate(g => g && { ...g, registrations }) });

  const win = gate?.window;
  const now = Date.now();
  const state = !win ? 'open' : now < new Date(win.opens).getTime() ? 'before' : now > new Date(win.closes).getTime() ? 'closed' : 'open';

  return <main className="draw-screen gate-screen">
    <Flower className="draw-flower one" /><Flower className="draw-flower two" />
    <header className="draw-head"><Link to={`/events/${slug}`} className="logo"><Logo /></Link><span className="eyebrow">CHECK-IN · {gate?.title || ''}</span><span className="eyebrow">เช็คอินแล้ว {gate?.registrations?.checkedIn || 0} / {gate?.registrations?.total || 0} คน</span></header>

    <section className="gate-stage">
      {error ? <div className="gate-msg"><h1>{error}</h1>{error.includes('เข้าสู่ระบบ') && <Link className="button dark" to="/admin">ไปหน้าเข้าสู่ระบบ</Link>}</div>
        : !gate ? <PageLoader />
          : <>
            <h1>สแกนเพื่อเช็คอิน</h1>
            <div className={`gate-qr ${state !== 'open' ? 'dim' : ''}`}><canvas ref={canvas} /></div>
            {state === 'open' && <p className="gate-hint">เปิดกล้องมือถือ สแกน แล้วกด «เช็คอิน» — QR เปลี่ยนใน <strong>{left}</strong> วิ</p>}
            {state === 'before' && <p className="gate-hint warn">เช็คอินเปิดเวลา {hhmm(win.opens)} น. — สแกนก่อนหน้านั้นระบบจะยังไม่รับ</p>}
            {state === 'closed' && <p className="gate-hint warn">ปิดเช็คอินแล้ว (หลัง {hhmm(win.closes)} น.) — ขอบคุณที่มานะคะ ดูโชว์ต่อได้เลย</p>}
            {win && state === 'open' && <p className="small-note">เช็คอินได้ถึง {hhmm(win.closes)} น. เท่านั้น</p>}
            {gate.mode !== 'gate' && <p className="small-note warn">⚠ งานนี้ตั้งวิธีเช็คอินเป็น «{gate.mode === 'staff' ? 'ทีมงานสแกนเท่านั้น' : 'กดเองได้'}» — QR นี้จะยังไม่ทำงาน เปลี่ยนใน แก้ไขงาน → เช็คอินหน้างาน → สแกน QR หน้างาน</p>}
          </>}
    </section>
  </main>;
}
