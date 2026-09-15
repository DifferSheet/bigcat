'use client';
import React, { useEffect, useState } from 'react';
import { Link } from '../lib/nav.jsx';
import { SiteHeader, SiteFooter, StatusPill } from '../components/EventShell.jsx';
import { Icon, PageLoader, Paw } from '../components/ui.jsx';
import { SOCIALS } from '../components/Social.jsx';
import { api } from '../lib/api.js';
import { eventDate, typeLabel, baht } from '../lib/format.js';

const FILTERS = [['all', 'ทั้งหมด'], ['fanmeet', 'Fan Meet'], ['merit', 'ทำบุญ'], ['busking', 'Busking'], ['workshop', 'Workshop'], ['popup', 'Pop-up']];

function Summary({ ev }) {
  const s = ev.summary || {};
  if (s.seats) return <span className="ev-summary">{s.seats.free > 0 ? <>เหลือ <strong>{s.seats.free}</strong> / {s.seats.total} ที่นั่ง</> : 'ที่นั่งเต็มแล้ว'}</span>;
  if (s.donation) return <span className="ev-summary"><span className="mini-bar"><i style={{ width: `${Math.min(100, s.donation.percent)}%` }} /></span>{baht(s.donation.total)} · {s.donation.percent}%</span>;
  // เลขน้อย ๆ ดูเงียบ — ต่ำกว่า 10 บอกแค่ว่าเปิดแล้ว · เลขเช็คอินโชว์เฉพาะระหว่างงาน
  if (s.registrations) return <span className="ev-summary">{s.registrations.total >= 10 ? <>ลงทะเบียนแล้ว <strong>{s.registrations.total}</strong> คน</> : 'เปิดลงทะเบียนแล้ว'}{ev.status === 'live' && s.registrations.checkedIn > 0 ? ` · เช็คอิน ${s.registrations.checkedIn}` : ''}</span>;
  return null;
}

export default function EventsPage({ notFound = false, initialEvents = null }) {
  const [events, setEvents] = useState(initialEvents);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  // รีเฟรชฝั่ง client เสมอ — กัน HTML ที่ server ส่งมาว่าง (API ล่ม/สร้างตอน build) แล้วค้างว่าง
  useEffect(() => { api('/events').then(setEvents).catch(e => { if (!initialEvents?.length) setError(e.message); }); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const list = (events || []).filter(ev => filter === 'all' || ev.type === filter);
  const upcoming = list.filter(ev => ev.status !== 'ended');
  const past = list.filter(ev => ev.status === 'ended');

  const Card = ({ ev }) => {
    const d = eventDate(ev);
    return <Link to={`/events/${ev.slug}`} className={`ev-card tone-${ev.tone}`}>
      <div className="ev-card-cover"><img src={ev.cover || '/images/bigcat-hero.jpg'} alt={`ภาพปกงาน ${ev.title}`} loading="lazy" /><span className={`date-badge ${ev.tone}`}><strong>{d.day}</strong><span>{d.month}</span></span></div>
      <div className="ev-card-body">
        <div className="ev-card-meta"><span className="eyebrow">{typeLabel[ev.type]}</span><StatusPill status={ev.status} /></div>
        <h3>{ev.title}</h3>
        <p>{ev.subtitle}</p>
        <span className="ev-card-place"><Icon name="pin" size={14} />{ev.place || 'สถานที่จะแจ้งให้ทราบ'} · {d.time}</span>
        <Summary ev={ev} />
      </div>
    </Link>;
  };

  return <>
    <SiteHeader />
    <main className="ev-page">
      <div className="ev-hero-simple">
        <span className="eyebrow">{notFound ? 'PAGE NOT FOUND' : 'LET’S MAKE A DATE'}</span>
        <h1>{notFound ? 'ไม่พบหน้าที่คุณต้องการ' : 'ตารางงานของแก๊ง BIGCAT'}</h1>
        <p>{notFound ? 'แต่ยังมีนัดสนุก ๆ รอคุณอยู่ตรงนี้' : 'จองที่นั่ง ร่วมทำบุญ หรือมาเจอกันริมถนน เลือกงานที่ใช่แล้วกดเข้าไปได้เลย'}</p>
        <div className="filter-tabs">{FILTERS.map(([id, label]) => <button key={id} className={filter === id ? 'active' : ''} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div>
      </div>
      {error && <p className="notice error">โหลดรายการกิจกรรมไม่สำเร็จ: {error} — ตรวจสอบว่า API รันอยู่ (npm run dev)</p>}
      {!events && !error && <PageLoader />}
      {events && <>
        <div className="ev-grid">{upcoming.map(ev => <Card key={ev.slug} ev={ev} />)}</div>
        {upcoming.length === 0 && <div className="ev-empty"><Paw /><strong>ยังไม่มีนัดในหมวดนี้</strong><p>พวกเรากำลังเตรียมอยู่ — ลองดูหมวดอื่น หรือกดติดตามที่ <a href={SOCIALS.nobi[0][2]} target="_blank" rel="noopener">TikTok น้องโนบิ</a> จะได้ไม่พลาดนัดใหม่นะคะ</p>{filter !== 'all' && <button type="button" className="link-button" onClick={() => setFilter('all')}>ดูทุกหมวด →</button>}</div>}
        {past.length > 0 && <><h2 className="ev-subhead">ที่ผ่านมา</h2><div className="ev-grid">{past.map(ev => <Card key={ev.slug} ev={ev} />)}</div></>}
      </>}
    </main>
    <SiteFooter />
  </>;
}
