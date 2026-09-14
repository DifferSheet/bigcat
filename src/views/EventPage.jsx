'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Link } from '../lib/nav.jsx';
import dynamic from 'next/dynamic';
import { SiteHeader, SiteFooter, StatusPill, Countdown, Section, CalendarButton } from '../components/EventShell.jsx';
import { Icon, PageLoader } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useEventSocket } from '../lib/socket.js';
import { eventDate, typeLabel } from '../lib/format.js';

// โมดูลเฉพาะประเภทงาน — โหลดเมื่อเปิดงานประเภทนั้นเท่านั้น
const modules = {
  fanmeet: dynamic(() => import('../modules/SeatBooking.jsx'), { ssr: false, loading: () => <PageLoader label="กำลังโหลดผังที่นั่ง…" /> }),
  merit: dynamic(() => import('../modules/MeritGoals.jsx'), { ssr: false, loading: () => <PageLoader label="กำลังโหลดยอดทำบุญ…" /> }),
  busking: dynamic(() => import('../modules/BuskingRegister.jsx'), { ssr: false, loading: () => <PageLoader label="กำลังโหลด…" /> }),
  workshop: dynamic(() => import('../modules/SimpleRegister.jsx'), { ssr: false, loading: () => <PageLoader /> }),
  popup: dynamic(() => import('../modules/SimpleRegister.jsx'), { ssr: false, loading: () => <PageLoader /> }),
};

const ctaLabel = { fanmeet: 'จองที่นั่ง', merit: 'ร่วมทำบุญ', busking: 'ลงทะเบียนมาเจอ', workshop: 'ลงทะเบียน', popup: 'รายละเอียด' };

export default function EventPage({ slug, initialData = null }) {
  const [data, setData] = useState(initialData);
  const [error, setError] = useState('');
  const [live, setLive] = useState(false);

  useEffect(() => { if (!initialData) api(`/events/${slug}`).then(setData).catch(e => setError(e.message)); }, [slug, initialData]);

  // realtime: อัปเดตเฉพาะส่วนที่เปลี่ยน
  useEventSocket(slug, {
    snapshot: d => setData(d),
    seats: seats => setData(d => d && { ...d, seats }),
    donations: donations => setData(d => d && { ...d, donations }),
    registrations: registrations => setData(d => d && { ...d, registrations }),
    draw: ({ draws }) => setData(d => d && { ...d, draws }),
    songs: songs => setData(d => d && { ...d, songs }),
    polls: polls => setData(d => d && { ...d, polls }),
    report: report => setData(d => d && { ...d, report }),
    event: patch => setData(d => d && { ...d, event: { ...d.event, ...patch } }),
  }, setLive);

  if (error) return <><SiteHeader /><main className="ev-page"><div className="ev-hero-simple"><h1>{error}</h1><Link className="button dark" to="/events">ดูกิจกรรมทั้งหมด</Link></div></main><SiteFooter /></>;
  if (!data) return <><SiteHeader /><PageLoader /></>;

  const { event: ev } = data;
  const d = eventDate(ev);
  const cfg = ev.config || {};
  const Module = modules[ev.type];
  const ended = ev.status === 'ended';

  return <>
    <SiteHeader live={live} />
    <main className="ev-page">
      <nav className="crumbs" aria-label="breadcrumb"><Link to="/">หน้าแรก</Link><span>/</span><Link to="/events">ตารางงาน</Link><span>/</span><span>{ev.title}</span></nav>

      <section className={`ev-hero tone-${ev.tone}`}>
        <div className="ev-hero-copy">
          <div className="ev-card-meta"><span className="eyebrow">{typeLabel[ev.type]} · {ev.category}</span><StatusPill status={ev.status} /></div>
          <h1>{ev.title}</h1>
          <p className="ev-subtitle">{ev.subtitle}</p>
          <dl className="ev-facts">
            <div><dt>วันที่</dt><dd>{d.long}</dd></div>
            <div><dt>เวลา</dt><dd>{d.time}</dd></div>
            <div><dt>สถานที่</dt><dd>{ev.map_url ? <a href={ev.map_url} target="_blank" rel="noreferrer">{ev.place} ↗</a> : ev.place}</dd></div>
          </dl>
          {!ended && <Countdown to={ev.starts_at} endedLabel={ev.status === 'live' ? 'กำลังจัดอยู่ตอนนี้' : 'ถึงเวลางานแล้ว'} />}
          <div className="ev-actions">
            {!ended && <a className="button dark" href="#module">{ctaLabel[ev.type]} <Icon name="arrow" /></a>}
            <CalendarButton event={ev} />
          </div>
        </div>
        <HeroSlides ev={ev} d={d} />
      </section>

      <div className="ev-columns">
        <div className="ev-main">
          <Section title="เกี่ยวกับงานนี้"><p className="ev-desc">{ev.description}</p></Section>
          <div id="module">{Module && <Module data={data} setData={setData} />}</div>
          {ended && <Section eyebrow="RECAP" title="ขอบคุณที่มาเจอกัน"><p>งานนี้จบลงแล้ว ภาพบรรยากาศและสรุปยอดจะอัปเดตที่นี่ ติดตามงานถัดไปได้ที่หน้าตารางงาน</p></Section>}
        </div>
        <aside className="ev-side">
          {cfg.schedule?.length > 0 && <Section eyebrow="SCHEDULE" title="กำหนดการ"><ol className="schedule">{cfg.schedule.map(([time, title]) => <li key={time}><time>{time}</time><span>{title}</span></li>)}</ol></Section>}
          {cfg.faq?.length > 0 && <Section eyebrow="FAQ" title="คำถามที่พบบ่อย"><div className="faq">{cfg.faq.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div></Section>}
          <Section eyebrow="SHARE" title="ชวนเพื่อน"><button className="button ghost" onClick={async () => { try { await navigator.share?.({ title: ev.title, url: location.href }) ?? navigator.clipboard.writeText(location.href); } catch { /* ยกเลิก */ } }}>แชร์ลิงก์งานนี้ ↗</button></Section>
        </aside>
      </div>
    </main>
    <SiteFooter />
  </>;
}

// ภาพฮีโร่: ปก + แกลเลอรี (config.gallery) เลื่อนดูได้ — scroll-snap ปัดบนมือถือ / ปุ่มซ้ายขวา + จุดบนเดสก์ท็อป
function HeroSlides({ ev, d }) {
  const slides = [ev.cover, ...(ev.config?.gallery || [])].filter(Boolean);
  if (!slides.length) slides.push('/images/bigcat-hero.png');
  const ref = useRef(null);
  const [i, setI] = useState(0);
  const go = (n) => { const el = ref.current; if (!el) return; const k = (n + slides.length) % slides.length; el.scrollTo({ left: k * el.clientWidth, behavior: 'smooth' }); setI(k); };
  const onScroll = () => { const el = ref.current; if (el) setI(Math.round(el.scrollLeft / el.clientWidth)); };
  return <div className={`ev-hero-art ${slides.length > 1 ? 'has-slides' : ''}`}>
    <div className="ev-slides" ref={ref} onScroll={onScroll} aria-roledescription="carousel">
      {slides.map((src, k) => <div className="ev-slide" key={src} aria-hidden={k !== i}><img src={src} alt={k === 0 ? `ภาพปกงาน ${ev.title}` : `ภาพประกอบงาน ${ev.title} (${k + 1}/${slides.length})`} loading={k === 0 ? 'eager' : 'lazy'} /></div>)}
    </div>
    <span className={`date-badge ${ev.tone} big`}><strong>{d.day}</strong><span>{d.month}</span></span>
    {slides.length > 1 && <>
      <button type="button" className="ev-slide-btn prev" aria-label="ภาพก่อนหน้า" onClick={() => go(i - 1)}>‹</button>
      <button type="button" className="ev-slide-btn next" aria-label="ภาพถัดไป" onClick={() => go(i + 1)}>›</button>
      <div className="ev-dots" role="tablist">{slides.map((_, k) => <button key={k} type="button" role="tab" aria-selected={k === i} aria-label={`ภาพที่ ${k + 1}`} className={k === i ? 'on' : ''} onClick={() => go(k)} />)}</div>
    </>}
  </div>;
}
