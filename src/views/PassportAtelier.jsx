'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '../lib/nav.jsx';
import { SiteHeader, SiteFooter, Notice } from '../components/EventShell.jsx';
import { Modal, PageLoader } from '../components/ui.jsx';
import { EventStamp, SpecialStamp, STAMP_LABEL } from '../components/Stamp.jsx';
import SaveImage from '../components/SaveImage.jsx';
import { api } from '../lib/api.js';
import { useUser } from '../lib/auth.js';
import { eventDate, parseDate } from '../lib/format.js';
import { drawPassportImage } from '../lib/passport-image.js';
import './passport-atelier.css';

const time = value => parseDate(value).getTime() || 0;
const monthKey = ev => String(ev.starts_at || '').slice(0, 7);
const monthLabel = key => /^\d{4}-\d{2}$/.test(key) ? new Date(`${key}-01T12:00:00`).toLocaleDateString('th-TH', { month: 'short', year: 'numeric' }) : 'ไม่ระบุเดือน';
const earnedDate = ev => parseDate(ev.earned.earned_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
// Bound both characters and explicit lines; preserve all text across pages.
function notePages(text = '') {
  const pages = []; let page = '', lines = 0;
  for (const char of text) {
    if (page.length >= 160 || (char === '\n' && lines >= 4)) { pages.push(page); page = ''; lines = 0; }
    page += char; if (char === '\n') lines++;
  }
  if (page) pages.push(page);
  return pages;
}

function EventKeepsake({ ev, onPhoto, part }) {
  const unlocked = ev.earned ? ev.unlock : null;
  const image = unlocked?.type === 'image' && unlocked.src;
  const textPages = notePages(unlocked?.text);
  if (part.startsWith('text-')) return <div className="pa-paged-content"><span className="pa-kicker">A NOTE FROM THIS DAY</span><blockquote className="pa-letter">{textPages[Number(part.slice(5))]}</blockquote><p className="pa-note">ข้อความ {Number(part.slice(5)) + 1} / {textPages.length}</p></div>;
  if (part.startsWith('extras-')) return <div className="pa-extras"><span className="pa-kicker">LITTLE TREASURES FROM THIS DAY</span><div>{(ev.earned ? ev.extras || [] : []).slice(Number(part.slice(7)) * 2, Number(part.slice(7)) * 2 + 2).map((s, i) => <figure key={`${s.kind}-${i}`}><SpecialStamp kind={s.kind} meta={s.meta} size={110} /><figcaption>{STAMP_LABEL[s.kind] || s.kind}</figcaption></figure>)}</div></div>;
  if (part === 'audio') return <div className="pa-letter"><span className="pa-kicker">A SOUND TO REMEMBER</span><audio controls preload="none" src={unlocked.src} /><p>เสียงจากความทรงจำครั้งนี้</p></div>;
  if (part.startsWith('caption-')) return <blockquote className="pa-letter">{notePages(unlocked?.caption)[Number(part.slice(8))]}</blockquote>;
  return <>
    {image ? <button type="button" className="pa-photo" onClick={() => onPhoto({ src: unlocked.src, caption: unlocked.caption || 'ภาพความทรงจำจากงาน' })} aria-label="เปิดภาพความทรงจำ">
      <img src={unlocked.src} alt={unlocked.caption || 'ภาพความทรงจำจากงาน'} />
      <span>OUR PHOTO MEMORY ↗</span>
    </button> : <div className="pa-envelope"><span className="pa-envelope-seal" aria-hidden="true">♡</span><span className="pa-kicker">A LITTLE SOMETHING TO KEEP</span><h3>{ev.earned ? 'อีกหนึ่งวันดี ๆ\nที่เราได้เจอกัน' : 'เผื่อวันดี ๆ\nที่เราจะได้เจอกัน'}</h3><p>{ev.earned ? 'ความทรงจำครั้งนี้ อยู่ในสมุดของคุณแล้ว' : ev.phase === 'upcoming' ? 'มาเจอกัน แล้วเก็บแสตมป์ดวงใหม่ไว้ด้วยกัน' : 'งานนี้ผ่านไปแล้ว ไว้สร้างความทรงจำด้วยกันครั้งหน้า'}</p>{ev.earned && !unlocked && <small>เมื่อมีภาพหรือของพิเศษจากงาน จะเปิดดูได้ตรงนี้</small>}</div>}
    {!ev.earned && ev.hasUnlock && <p className="pa-note">มีของพิเศษสำหรับผู้ที่ได้รับแสตมป์งานนี้</p>}
    <p className="pa-handwriting">Together is a wonderful place to be. ♡</p>
  </>;
}

export default function PassportAtelier() {
  const { user, loaded } = useUser();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [filter, setFilter] = useState('earned');
  const [month, setMonth] = useState('all');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [share, setShare] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const swipe = useRef(null);
  const player = useRef(null);
  const pageRoot = useRef(null);
  const fullButton = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [single, setSingle] = useState(false);
  const [leaf, setLeaf] = useState(0);
  const [playerHeight, setPlayerHeight] = useState(500);
  useEffect(() => {
    const resize = () => {
      setSingle(window.innerWidth <= 720 || window.innerHeight < 560);
      const top = expanded ? 12 : (player.current?.getBoundingClientRect().top || 180) + window.scrollY;
      setPlayerHeight(Math.max(260, window.innerHeight - top - 16));
    };
    resize(); const observer = new ResizeObserver(resize);
    if (pageRoot.current) observer.observe(pageRoot.current);
    window.addEventListener('resize', resize);
    return () => { observer.disconnect(); window.removeEventListener('resize', resize); };
  }, [expanded, data]);
  useEffect(() => {
    const change = () => { if (!document.fullscreenElement) setExpanded(false); };
    document.addEventListener('fullscreenchange', change);
    return () => document.removeEventListener('fullscreenchange', change);
  }, []);
  useEffect(() => {
    if (!expanded) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const key = e => {
      if (document.querySelector('dialog[open]')) return;
      if (e.key === 'Escape') { e.preventDefault(); setExpanded(false); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); }
      if (e.key === 'Tab') {
        const items = [...player.current.querySelectorAll('button:not(:disabled),select:not(:disabled),a[href]')].filter(el => el.getClientRects().length);
        const first = items[0], last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    fullButton.current?.focus();
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', key); fullButton.current?.focus({ preventScroll: true }); };
  }, [expanded]);
  const toggleFull = async () => {
    if (expanded) { setExpanded(false); if (document.fullscreenElement) await document.exitFullscreen().catch(() => {}); }
    else { setExpanded(true); try { await pageRoot.current.requestFullscreen?.(); } catch { /* Browser fallback stays in viewport-filling reading mode. */ } }
  };
  useEffect(() => { if (loaded && !user) location.replace('/login?next=/passport-c'); }, [loaded, user]);
  useEffect(() => {
    if (!user) return;
    let active = true; setError('');
    api('/passport').then(result => {
      if (!active) return;
      setData(result);
      const events = result.books.flatMap(b => b.events);
      const earned = events.filter(e => e.earned).sort((a, b) => time(b.earned.earned_at) - time(a.earned.earned_at));
      setFilter(earned.length ? 'earned' : 'all'); setSelected(earned[0]?.slug || null);
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [user, retry]);
  const events = useMemo(() => (data?.books || []).flatMap(b => b.events).sort((a, b) => time(b.starts_at) - time(a.starts_at)), [data]);
  const months = [...new Set(events.map(monthKey))];
  const filtered = events.filter(ev => (month === 'all' || monthKey(ev) === month) && (filter === 'all' || (filter === 'earned' ? !!ev.earned : !ev.earned && ev.phase === 'upcoming')));
  const index = Math.max(0, filtered.findIndex(ev => ev.slug === selected));
  const ev = filtered[index];
  const unlock = ev?.earned ? ev.unlock : null;
  const parts = ['memory', ...Array.from({ length: unlock?.type === 'text' ? notePages(unlock.text).length : 0 }, (_, i) => `text-${i}`), ...(unlock?.type === 'audio' && unlock.src ? ['audio'] : []), ...Array.from({ length: notePages(unlock?.caption).length }, (_, i) => `caption-${i}`), ...Array.from({ length: ev?.earned ? Math.ceil((ev.extras?.length || 0) / 2) : 0 }, (_, i) => `extras-${i}`)];
  const leafCount = parts.length + (single ? 1 : 0);
  const activeLeaf = Math.min(leaf, leafCount - 1);
  const part = parts[Math.max(0, activeLeaf - (single ? 1 : 0))];
  useEffect(() => { setLeaf(0); }, [ev?.slug, filter, month]);
  const state = ev?.earned ? 'earned' : ev?.phase === 'upcoming' ? 'locked' : 'missed';
  const move = delta => { const next = filtered[index + delta]; if (next) setSelected(next.slug); };
  const counts = { all: events.length, earned: events.filter(e => e.earned).length, locked: events.filter(e => !e.earned && e.phase === 'upcoming').length };
  const shareEvent = async () => {
    if (!ev?.earned || busy) return;
    const target = ev; setBusy(true); setError('');
    try {
      // Reuse the existing export with one authorized event, not the entire collection.
      const canvas = await drawPassportImage({ ...data, total: 1, friend: null, books: [{ key: 'memory', events: [target] }] });
      setShare({ url: canvas.toDataURL('image/png'), title: target.title, slug: target.slug });
    } catch (e) { setError(e.message || 'สร้างภาพไม่สำเร็จ กรุณาลองอีกครั้ง'); }
    finally { setBusy(false); }
  };
  const invite = async () => {
    try { await navigator.clipboard.writeText(`${location.origin}/i/${data.user.invite_code}`); setCopied(true); }
    catch { setError('คัดลอกไม่ได้ กรุณาคัดลอกลิงก์ที่แสดงด้านล่าง'); }
  };
  if (!loaded || (!user && !error) || (!data && !error)) return <><SiteHeader /><PageLoader label="กำลังเปิดสมุดความทรงจำ…" /></>;
  return <><SiteHeader /><main ref={pageRoot} className={`pa-page pa-fit${expanded ? ' pa-expanded' : ''}`}>
    <div className="pa-comparison"><span>DESIGN PREVIEW · C / MEMORY ATELIER</span><Link to="/passport">เทียบกับ Passport แบบเดิม ↗</Link></div>
    {error && <Notice tone="error">{error} {!data && <button type="button" onClick={() => setRetry(n => n + 1)}>ลองอีกครั้ง</button>}</Notice>}
    {data && <>
      <header className="pa-heading"><div><span className="pa-kicker">MY BIGCAT PASSPORT</span><h1>Good days,<br /><em>kept forever.</em></h1><p>เก็บวันดี ๆ ของเราไว้ในสมุดเล่มเดียว</p></div><div className="pa-member"><span className="pa-member-mark">♡</span><div><span className="pa-kicker">THIS LITTLE BOOK BELONGS TO</span><strong>{user.display_name}</strong><p><b>{String(data.total).padStart(2, '0')}</b> แสตมป์ที่สะสม <span>·</span> เรื่องราวที่เป็นของคุณ</p></div></div></header>
      <section ref={player} className={`pa-atelier${single ? ' pa-single' : ''}`} style={{ '--pa-player-height': `${playerHeight}px` }} aria-label="สมุดความทรงจำ" onKeyDown={e => { if (/SELECT|INPUT|TEXTAREA|AUDIO/.test(e.target.tagName)) return; if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); setLeaf(n => Math.max(0, Math.min(leafCount - 1, n + (e.key === 'ArrowRight' ? 1 : -1)))); } }}>
        <div className="pa-screen-tools"><label>เดือน <select aria-label="เลือกเดือน" value={month} onChange={e => { setMonth(e.target.value); setSelected(null); }}><option value="all">ทุกเดือน</option>{months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}</select></label><button ref={fullButton} type="button" onClick={toggleFull} aria-pressed={expanded}>{expanded ? '↙ ออกจากเต็มจอ' : '⛶ เต็มจอ'}</button></div>
        <div className="pa-toolbar"><div className="pa-filters" role="group" aria-label="กรองความทรงจำ">{[['earned', 'สะสมแล้ว'], ['all', 'ทั้งหมด'], ['locked', 'รอเก็บ']].map(([value, label]) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => { setFilter(value); setSelected(null); }}>{label} <span>{counts[value]}</span></button>)}</div><label className="pa-jump">เลือกงาน <select aria-label="เลือกความทรงจำ" value={ev?.slug || ''} disabled={!filtered.length} onChange={e => setSelected(e.target.value)}>{!filtered.length && <option value="">ยังไม่มีงานในหมวดนี้</option>}{filtered.map(e => <option key={e.slug} value={e.slug}>{e.title}</option>)}</select></label></div>
        <div className="pa-book-area"><nav className="pa-months" aria-label="เลือกเดือน"><button type="button" aria-pressed={month === 'all'} onClick={() => { setMonth('all'); setSelected(null); }}>ทุกเดือน</button>{months.map(m => <button type="button" key={m} aria-pressed={month === m} onClick={() => { setMonth(m); setSelected(null); }}>{monthLabel(m)}</button>)}</nav>
          {ev ? <div className="pa-book" key={ev.slug} onTouchStart={e => { if (e.target.closest('audio,select')) return; const t = e.touches[0]; swipe.current = [t.clientX, t.clientY]; }} onTouchCancel={() => { swipe.current = null; }} onTouchEnd={e => { const origin = swipe.current; swipe.current = null; if (!origin) return; const t = e.changedTouches[0], dx = t.clientX - origin[0], dy = t.clientY - origin[1]; if (Math.abs(dx) > 75 && Math.abs(dx) > Math.abs(dy) * 1.8) move(dx < 0 ? 1 : -1); }}>
            <article className="pa-paper pa-story" hidden={single && activeLeaf !== 0}><div className="pa-paper-top"><span>BIGCAT · MEMORY JOURNAL</span><span>✦</span></div><div className="pa-date"><b>{eventDate(ev).day}</b><span>{eventDate(ev).month}<br />{eventDate(ev).year}</span></div>
              <button type="button" className={`pa-main-stamp ${state}`} onClick={() => setDetail(ev)} aria-label={`ดูแสตมป์ ${ev.title}`}><EventStamp ev={ev} state={state} size={320} /><span>แตะดูแสตมป์ ↗</span></button>
              <span className="pa-kicker">{ev.earned ? 'A DAY TO REMEMBER' : state === 'locked' ? 'OUR NEXT MEMORY' : 'ANOTHER CHAPTER'}</span><h2>{ev.title}</h2><p className="pa-story-caption">{ev.earned ? 'ดีใจที่วันนั้น เราได้มาเจอกัน' : state === 'locked' ? 'ความทรงจำดวงใหม่ กำลังรอเราอยู่' : 'ครั้งหน้า มาเก็บวันดี ๆ ด้วยกันนะ'}</p>
              <span className={`pa-postmark ${state}`}>{ev.earned ? `เก็บไว้เมื่อ ${earnedDate(ev)}` : state === 'locked' ? 'ยังไม่ได้รับ · รอวันเจอกัน' : 'งานนี้ผ่านไปแล้ว · ยังไม่ได้สะสม'}</span><Link className="pa-event-link" to={`/events/${ev.slug}`}>{state === 'locked' ? 'ดูงานและลงทะเบียน' : 'ดูรายละเอียดงาน'} ↗</Link><footer>Small moments. Big happiness.<span>{String(index * 2 + 1).padStart(2, '0')}</span></footer>
            </article>
            <article className="pa-paper pa-memories" hidden={single && activeLeaf === 0}><div className="pa-paper-top"><span>LITTLE THINGS, BIG LOVE</span><span>♡</span></div><EventKeepsake key={`${ev.slug}-${part}`} ev={ev} onPhoto={setPhoto} part={part} /><footer>Made of moments. Kept with love.<span>{String(index * 2 + 2).padStart(2, '0')}</span></footer></article>
          </div> : <div className="pa-empty"><span>♡</span><h2>{events.length ? 'หน้านี้ยังรอความทรงจำ' : 'เรื่องราวหน้าแรก กำลังจะเริ่มต้น'}</h2><p>{events.length ? 'ลองเลือกเดือนอื่น หรือดูงานทั้งหมดในสมุด' : 'มาเจอแก๊ง BigCat แล้วเช็คอินรับแสตมป์ดวงแรกของคุณ'}</p>{events.length ? <button type="button" onClick={() => { setFilter('all'); setMonth('all'); setSelected(null); }}>ดูงานทั้งหมด</button> : <Link to="/events">ดูตารางงาน ↗</Link>}</div>}
        </div>
        <div className="pa-leaf-nav"><button type="button" aria-label="หน้าก่อนหน้าในงานนี้" disabled={!ev || activeLeaf === 0} onClick={() => setLeaf(activeLeaf - 1)}>←</button><span aria-live="polite">{ev ? `${single && activeLeaf === 0 ? 'แสตมป์' : part.startsWith('extras') ? 'ของสะสม' : part.startsWith('text') || part.startsWith('caption') ? 'ข้อความ' : part === 'audio' ? 'เสียงความทรงจำ' : 'ความทรงจำ'} · หน้า ${activeLeaf + 1} / ${leafCount}` : 'ยังไม่มีงานในหมวดนี้'}</span><button type="button" aria-label="หน้าถัดไปในงานนี้" disabled={!ev || activeLeaf >= leafCount - 1} onClick={() => setLeaf(activeLeaf + 1)}>→</button></div>
        <div className="pa-navigation"><button type="button" aria-label="ความทรงจำก่อนหน้า" disabled={!ev || index === 0} onClick={() => move(-1)}>← <span>งานก่อนหน้า</span></button><div><span aria-live="polite">{filtered.length ? `${index + 1} / ${filtered.length} งาน` : 'ยังไม่มีความทรงจำในหมวดนี้'}</span><button type="button" className="pa-share" onClick={shareEvent} disabled={!ev?.earned || busy}>{busy ? 'กำลังเตรียมภาพ…' : '♡ แชร์แสตมป์งานนี้'}</button></div><button type="button" aria-label="ความทรงจำถัดไป" disabled={!ev || index >= filtered.length - 1} onClick={() => move(1)}><span>งานถัดไป</span> →</button></div>
      </section>
      <section className="pa-invite"><div><span className="pa-kicker">MORE GOOD DAYS, TOGETHER</span><h2>พาเพื่อนมา เติมความทรงจำด้วยกัน</h2><p>ใช้ลิงก์ชวนเพื่อนของคุณ ให้วันแรกของเขาเป็นอีกวันดี ๆ ของเรา</p><code>/i/{data.user.invite_code}</code><button type="button" onClick={invite}>{copied ? 'คัดลอกแล้ว ✓' : 'คัดลอกลิงก์ชวนเพื่อน ↗'}</button></div>{data.friend && <figure><SpecialStamp kind="friend" meta={data.friend.meta} size={110} /><figcaption>พามาแล้ว {data.friend.meta?.count || 0} คน</figcaption></figure>}</section>
      <p className="pa-preview-note">แบบทดลอง C · ใช้ข้อมูล Passport จริงชุดเดียวกับหน้าเดิม · ภาพแชร์รอบนี้เป็นแสตมป์ของงาน ยังไม่รวมอัลบั้มภาพส่วนตัว</p>
    </>}
    {detail && <Modal title={detail.title} onClose={() => setDetail(null)}><div className="pa-detail"><EventStamp ev={detail} state={detail.earned ? 'earned' : detail.phase === 'upcoming' ? 'locked' : 'missed'} size={300} /><p>{eventDate(detail).long}</p><p>{detail.earned ? `${STAMP_LABEL[detail.earned.kind] || 'ได้รับแสตมป์'} · ${earnedDate(detail)}` : 'ยังไม่ได้สะสมแสตมป์งานนี้'}</p><Link to={`/events/${detail.slug}`}>ดูรายละเอียดงาน ↗</Link></div></Modal>}
    {photo && <Modal title={photo.caption} onClose={() => setPhoto(null)} wide><img className="pa-full-photo" src={photo.src} alt={photo.caption} /><a href={photo.src} target="_blank" rel="noreferrer">เปิดภาพเต็ม ↗</a></Modal>}
    {share && <Modal title={`แสตมป์จาก ${share.title}`} onClose={() => setShare(null)}><SaveImage url={share.url} fileName={`bigcat-memory-${share.slug}.png`} title={share.title} alt={`แสตมป์จาก ${share.title}`} /></Modal>}
  </main><SiteFooter /></>;
}
