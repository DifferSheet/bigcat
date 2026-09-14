'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Link } from '../lib/nav.jsx';
import { Paw, Flower, Logo } from '../components/ui.jsx';
import { api, getAdminKey } from '../lib/api.js';
import { useMounted } from '../lib/useMounted.js';
import { useEventSocket } from '../lib/socket.js';

// จอใหญ่สำหรับเปิดโชว์หน้างานตอนสุ่ม Lucky Fan — ทุกเครื่องที่เปิดหน้านี้จะเห็นผลพร้อมกัน
export default function DrawScreen({ slug }) {
  const [state, setState] = useState(null);      // { rounds, draws, registrations }
  const [title, setTitle] = useState('');
  const [rolling, setRolling] = useState(null);  // { number, name } ที่กำลังหมุน
  const [reveal, setReveal] = useState(null);    // ผู้โชคดีที่เพิ่งเปิด
  const [error, setError] = useState('');
  const timer = useRef(null);
  const mounted = useMounted();
  const isAdmin = mounted && !!getAdminKey();

  useEffect(() => {
    api(`/events/${slug}/draw`).then(setState).catch(e => setError(e.message));
    api(`/events/${slug}`).then(d => setTitle(d.event.title)).catch(() => {});
  }, [slug]);

  // หมุนเลขสุ่มก่อน แล้วค่อยเปิดผล + อัปเดตประวัติพร้อมกัน (ไม่สปอยล์ก่อนเฉลย)
  const animate = (latest, total, apply) => {
    clearInterval(timer.current); setReveal(null);
    let ticks = 0;
    timer.current = setInterval(() => {
      ticks++;
      setRolling({ number: 1 + Math.floor(Math.random() * Math.max(total, 1)) });
      if (ticks > 28) { clearInterval(timer.current); setRolling(null); setReveal(latest); apply(); }
    }, 90);
  };

  useEventSocket(slug, {
    draw: ({ rounds, draws, latest }) => {
      const apply = () => setState(s => ({ ...(s || {}), rounds, draws }));
      if (latest) animate(latest, state?.registrations?.total || 99, apply); else apply();
    },
    registrations: registrations => setState(s => s && { ...s, registrations }),
  });

  const draw = async () => { setError(''); try { await api(`/admin/events/${slug}/draw`, { method: 'POST', admin: true }); } catch (e) { setError(e.message); } };
  const reset = async () => { if (!confirm('ล้างผลสุ่มทั้งหมด?')) return; try { await api(`/admin/events/${slug}/draw`, { method: 'DELETE', admin: true }); setReveal(null); } catch (e) { setError(e.message); } };

  const done = state?.draws?.length || 0;
  const rounds = state?.rounds || 3;
  const eligible = state?.registrations?.checkedIn || 0;

  return <main className="draw-screen">
    <Flower className="draw-flower one" /><Flower className="draw-flower two" />
    <header className="draw-head"><Link to={`/events/${slug}`} className="logo"><Logo /></Link><span className="eyebrow">LUCKY FAN · {title}</span><span className="eyebrow">เช็คอิน {eligible} คน · สุ่มแล้ว {done}/{rounds}</span></header>

    <section className="draw-stage" aria-live="polite">
      {rolling && <div className="draw-number rolling"><span className="eyebrow">กำลังสุ่ม…</span><strong>#{String(rolling.number).padStart(3, '0')}</strong></div>}
      {!rolling && reveal && <div className="draw-number reveal"><span className="eyebrow">LUCKY FAN รอบที่ {reveal.round}</span><strong>#{String(reveal.number).padStart(3, '0')}</strong><h1>{reveal.nickname || reveal.name}</h1>{reveal.social && <p>{reveal.social}</p>}<p className="draw-cta">มาถ่ายรูปคู่กับโนบิได้เลย ♡</p></div>}
      {!rolling && !reveal && <div className="draw-number idle"><Paw /><h1>{done >= rounds ? 'สุ่มครบทุกรอบแล้ว' : 'เตรียมตัวลุ้น Lucky Fan'}</h1><p>{done >= rounds ? 'ขอบคุณทุกคนที่มาเจอกันวันนี้' : `สุ่มจากผู้ที่เช็คอินหน้างาน ${eligible} คน`}</p></div>}
    </section>

    <ol className="draw-history">{Array.from({ length: rounds }, (_, i) => { const d = state?.draws?.find(x => x.round === i + 1); return <li key={i} className={d ? 'done' : ''}><span className="eyebrow">รอบ {i + 1}</span>{d ? <><strong>#{String(d.number).padStart(3, '0')}</strong><span>{d.nickname || d.name}</span></> : <span className="muted">—</span>}</li>; })}</ol>

    {isAdmin ? <div className="draw-controls"><button className="button dark" onClick={draw} disabled={!!rolling || done >= rounds}>สุ่มรอบที่ {Math.min(done + 1, rounds)} 🎲</button><button className="link-button" onClick={reset}>ล้างผล</button>{error && <span className="notice error">{error}</span>}</div>
      : <p className="small-note">ทีมงานกดสุ่มได้จากหน้านี้หลังเข้าสู่ระบบที่ <Link to="/admin">/admin</Link> — หน้าจอนี้เปิดโชว์บนจอใหญ่ได้เลย</p>}
  </main>;
}
