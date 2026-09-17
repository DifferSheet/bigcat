'use client';
// Passport — สมุดแสตมป์ของสมาชิก: แสตมป์ต่องานที่มา/ร่วมบุญ · ช่องว่างของงานที่พลาด · แสตมป์พิเศษ · เนื้อหาปลดล็อก · ลิงก์ชวนเพื่อน · แชร์เป็นรูป
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from '../lib/nav.jsx';
import { SiteHeader, SiteFooter, Notice, Section } from '../components/EventShell.jsx';
import { Icon, Paw, PageLoader, Modal, Tag } from '../components/ui.jsx';
import { EventStamp, SpecialStamp, STAMP_LABEL } from '../components/Stamp.jsx';
import SaveImage from '../components/SaveImage.jsx';
import PassportMemory, { MemoryPhoto } from '../components/PassportMemory.jsx';
import { eventMemory } from '../lib/passport-memory.js';
import { api } from '../lib/api.js';
import { useUser } from '../lib/auth.js';
import { eventDate, parseDate } from '../lib/format.js';
import { drawPassportImage } from '../lib/passport-image.js';
import './passport.css';

const fmt = (d) => { const x = parseDate(d); return x ? x.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : ''; };

function CollectorBook({ name, events, onOpen }) {
  const earned = events.filter(ev => ev.earned).slice(-3);
  return <div className="pc-stage">
    <div className="pc-open-page" aria-hidden="true">
      <span>MY MEMORIES</span>
      <div>{earned.map(ev => <EventStamp key={ev.slug} ev={ev} size={76} />)}{Array.from({ length: 3 - earned.length }, (_, i) => <span className="pc-empty-stamp" key={i}>♡</span>)}</div>
      <p>More good days<br />are on their way.</p>
    </div>
    <button type="button" onClick={onOpen} className="pc-cover" aria-label="เปิดสมุด ดูแสตมป์ของฉัน" aria-haspopup="dialog">
      <img className="pc-cover-logo" src="/images/bigcat-mark-pink.webp" width="90" height="67" alt="BIGCAT" />
      <span className="pc-book-title">PASSPORT</span>
      <span className="pc-book-subtitle">SMALL MOMENTS<br />BIG HAPPINESS</span>
      <div className="pc-portraits">{[['nobi', 'Nobi'], ['boota', 'Boota'], ['shiba', 'Shiba']].map(([key, label]) => <div key={key} className={`pc-medallion ${key}`}><img src={`/images/cozy/${key}-personality-v2.webp`} alt={label} width="130" height="170" /><span>{label}</span></div>)}</div>
      <span className="pc-nameplate">{name}</span>
      <span className="pc-book-footer">A KINDER WORLD<br />WITH BIGCAT</span>
      <span className="pc-ribbon" aria-hidden="true">♡</span>
    </button>
    <span className="pc-stage-note">แตะปก เปิดความทรงจำของคุณ ↗</span>
  </div>;
}

function MemoryChapter({ book, filter, onOpen, page = 0, mobile = false }) {
  const events = book.events.filter(ev => filter === 'all' || (filter === 'earned' ? !!ev.earned : !ev.earned && ev.phase === 'upcoming'));
  const eventIndex = Math.floor(page / 2);
  const ev = events[eventIndex];
  return <section className="passport-book pc-chapter" aria-label={book.name}>
    <div className="pc-spread pm-spread" key={`${filter}-${eventIndex}-${mobile}`}>
      {(mobile ? [page % 2] : [0, 1]).map(side => <div className="pc-paper" key={side}>
        <div className="pc-paper-heading"><span>{side === 0 ? 'BIGCAT · MEMORY JOURNAL' : 'LITTLE MOMENTS, BIG LOVE'}</span><span aria-hidden="true">✦</span></div>
        <PassportMemory key={`${ev?.slug}-${side}`} ev={ev} side={side} onOpen={onOpen} />
        <footer className="pc-paper-footer"><span>{mobile ? `งานที่ ${eventIndex + 1} · หน้า ${side + 1}/2` : side === 0 ? 'เก็บทุกครั้งที่ได้เจอกัน' : 'Made of moments. Kept with love.'}</span><span>{String(eventIndex * 2 + side + 1).padStart(2, '0')}</span></footer>
      </div>)}
    </div>
  </section>;
}

// รายละเอียดแสตมป์ 1 ดวง (กดจากสมุด) — ใหญ่ขึ้น + วันที่ได้ + แสตมป์พิเศษของงานนั้น + เนื้อหาปลดล็อก
function StampDetail({ ev, onClose, inline = false }) {
  const d = eventDate(ev);
  const state = ev.earned ? 'earned' : ev.phase === 'upcoming' ? 'locked' : 'missed';
  const Wrapper = inline ? React.Fragment : Modal;
  return <Wrapper {...(inline ? {} : { title: ev.title, onClose })}>
    <div className="stamp-detail pc-detail-card">
      <div className="pc-detail-showcase"><span className="eyebrow">BIGCAT · COLLECTIBLE MEMORY</span><EventStamp ev={ev} state={state} size={280} /><span className={`pc-detail-status ${state}`}>{state === 'earned' ? '✦ อยู่ในสมุดของคุณแล้ว' : state === 'locked' ? '♡ รอวันสร้างความทรงจำ' : 'ความทรงจำที่ผ่านไป'}</span></div>
      <div className="pc-detail-info">
      {inline && <h2>{ev.title}</h2>}
      <p className="muted">{d.long} · {d.time}</p>
      {state === 'earned' && <p className="stamp-earned-at">{STAMP_LABEL[ev.earned.kind]} · ได้เมื่อ {fmt(ev.earned.earned_at)}</p>}
      {state === 'missed' && <p className="muted">งานนี้ผ่านไปแล้ว — แสตมป์ดวงนี้ไม่ออกอีก ครั้งหน้ามาเจอกันนะ</p>}
      {state === 'locked' && <p className="muted">ยังไม่ถึงวันงาน — มาเช็คอินแล้วรับแสตมป์ดวงนี้</p>}
      {ev.extras?.length > 0 && <div className="stamp-extras">{ev.extras.map(s => <SpecialStamp key={s.kind} kind={s.kind} meta={s.meta} size={84} />)}</div>}
      {ev.unlock && <div className="unlock-box">
        <span className="eyebrow">เฉพาะคนที่มา ♡</span>
        {ev.unlock.type === 'text' && <p className="unlock-text">{ev.unlock.text}</p>}
        {ev.unlock.type === 'image' && ev.unlock.src && <img src={ev.unlock.src} alt={ev.unlock.caption || 'ภาพหลังเวที'} />}
        {ev.unlock.type === 'audio' && ev.unlock.src && <audio controls preload="none" src={ev.unlock.src} />}
        {ev.unlock.caption && <small className="muted">{ev.unlock.caption}</small>}
      </div>}
      {!ev.unlock && ev.hasUnlock && state !== 'earned' && <p className="muted small">งานนี้มีของพิเศษให้เฉพาะคนที่มาเช็คอิน</p>}
      <Link className="button ghost small" to={`/events/${ev.slug}`}>ไปหน้างาน</Link>
      </div>
    </div>
  </Wrapper>;
}

// One native dialog, one visible spread. Details replace pages rather than stacking dialogs.
function PassportReader({ books, name, onClose }) {
  const dialog = useRef(null);
  const flight = useRef(null);
  const closeBook = useRef(() => {});
  const [phase, setPhase] = useState('lifting');
  const body = useRef(null);
  const touch = useRef(null);
  const stampTrigger = useRef(null);
  const back = useRef(null);
  const [filter, setFilter] = useState('all');
  const [chapter, setChapter] = useState(0);
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState(null);
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches);
  useLayoutEffect(() => {
    const media = matchMedia('(max-width: 720px)');
    const update = () => setMobile(media.matches);
    update(); media.addEventListener('change', update);
    const previous = document.activeElement;
    const source = document.querySelector('.pc-stage > .pc-cover');
    const sourceRect = source?.getBoundingClientRect();
    const sourceWidth = source?.offsetWidth;
    const sourceHeight = source?.offsetHeight;
    const sourceTransform = source ? getComputedStyle(source).transform : 'none';
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current.showModal();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const animations = new Set();
    let disposed = false, closing = false, settled = false;
    const clone = source?.cloneNode(true);
    const leaf = document.createElement('div');
    leaf.className = 'pc-flight-leaf';
    const changePhase = value => { dialog.current.dataset.phase = value; setPhase(value); };
    const spread = () => dialog.current.querySelector('.pc-reader-body .pc-spread');
    const leftPaper = () => media.matches ? null : spread()?.querySelector('.pc-paper');
    if (clone) {
      clone.removeAttribute('aria-haspopup'); clone.setAttribute('tabindex', '-1');
      clone.classList.add('pc-flight-cover');
      clone.style.padding = getComputedStyle(source).padding;
      leaf.append(clone);
      flight.current.append(leaf);
      clone.style.boxShadow = getComputedStyle(source).boxShadow;
      clone.style.overflow = 'visible';
      source.style.visibility = 'hidden';
      source.parentElement.classList.add('pc-stage-lifted');
    }
    const animate = async (el, frames, duration) => {
      if (!el || disposed) return;
      const a = el.animate(frames, { duration: reduced.matches ? 0 : duration, easing: 'cubic-bezier(.22,.75,.22,1)', fill: 'forwards' });
      animations.add(a); await a.finished.catch(() => {}); animations.delete(a);
    };
    const destination = () => {
      const papers = dialog.current.querySelectorAll('.pc-reader-body .pc-paper');
      return (papers[papers.length - 1] || dialog.current.querySelector('.pc-reader-shell')).getBoundingClientRect();
    };
    const place = rect => {
      Object.assign(flight.current.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
      // Keep the hero artwork layout intact: magnify it, never reflow it at the destination.
      if (clone) Object.assign(clone.style, { width: `${sourceWidth}px`, height: `${sourceHeight}px`, transform: `scale(${rect.width / sourceWidth})`, transformOrigin: 'top left' });
    };
    const inverse = (from, to) => {
      const scale = sourceWidth / to.width;
      return `translate(${from.left + from.width / 2 - to.left - to.width / 2}px, ${from.top + from.height / 2 - to.top - to.height / 2}px) scale(${scale}) ${sourceTransform === 'none' ? '' : sourceTransform}`;
    };
    const reveal = () => { if (!disposed && !closing) {
      // The animated papers ARE the interactive papers. No surface replacement at rest.
      changePhase('ready');
      spread()?.getAnimations().forEach(a => a.cancel());
      leftPaper()?.getAnimations().forEach(a => a.cancel());
      flight.current.style.visibility = 'hidden';
    } };
    const open = async () => {
      if (!clone || !sourceRect || reduced.matches) { reveal(); return; }
      const target = destination(); place(target);
      await Promise.all([
        animate(flight.current, [{ transform: inverse(sourceRect, target) }, { transform: 'none' }], 520),
        animate(spread(), [{ transform: inverse(sourceRect, target) }, { transform: 'none' }], 520),
      ]);
      if (disposed || closing || settled) return;
      changePhase('unfolding');
      await Promise.all([
        animate(leaf, [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-180deg)' }], 850),
        animate(leftPaper(), [{ transform: 'rotateY(180deg)' }, { transform: 'rotateY(0deg)' }], 850),
      ]);
      reveal();
    };
    closeBook.current = async () => {
      if (closing || disposed) return;
      closing = true;
      for (const a of animations) a.cancel();
      setDetail(null);
      // Wait for the paper spread to remount when closing from stamp details.
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (disposed) return;
      if (!clone || reduced.matches) { onClose(); return; }
      const target = destination(); place(target);
      changePhase('folding');
      flight.current.style.visibility = 'visible';
      flight.current.getAnimations().forEach(a => a.cancel());
      await Promise.all([
        animate(leaf, [{ transform: 'rotateY(-180deg)' }, { transform: 'rotateY(0deg)' }], 650),
        animate(leftPaper(), [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(180deg)' }], 650),
      ]);
      if (disposed) return;
      changePhase('returning');
      const origin = source.getBoundingClientRect();
      await Promise.all([
        animate(flight.current, [{ transform: 'none' }, { transform: inverse(origin, target) }], 480),
        animate(spread(), [{ transform: 'none' }, { transform: inverse(origin, target) }], 480),
      ]);
      if (!disposed) onClose();
    };
    open();
    // A rotation/resize during opening should settle into a readable book, not stale geometry.
    const settle = () => { if (!closing) { settled = true; for (const a of animations) a.finish(); reveal(); } };
    window.addEventListener('resize', settle);
    return () => {
      disposed = true; animations.forEach(a => a.cancel()); leaf.remove();
      if (source) { source.style.visibility = ''; source.parentElement.classList.remove('pc-stage-lifted'); }
      window.removeEventListener('resize', settle); media.removeEventListener('change', update);
      document.body.style.overflow = overflow; requestAnimationFrame(() => previous?.focus({ preventScroll: true }));
    };
  }, []);
  useEffect(() => { if (detail) back.current?.focus(); }, [detail]);
  const book = books[chapter] || { name: 'Our first chapter', events: [] };
  const events = book.events.filter(ev => filter === 'all' || (filter === 'earned' ? !!ev.earned : !ev.earned && ev.phase === 'upcoming'));
  const pages = Math.max(1, events.length) * 2;
  const current = Math.min(page, pages - 1);
  const start = mobile ? current : Math.floor(current / 2) * 2;
  const step = mobile ? 1 : 2;
  const turn = delta => { setPage(Math.max(0, Math.min(pages - 1, start + delta * step))); body.current?.scrollTo({ top: 0 }); };
  const closeDetail = () => { setDetail(null); requestAnimationFrame(() => dialog.current?.querySelector(`[data-event-slug="${CSS.escape(stampTrigger.current || '')}"]`)?.focus()); };
  return <dialog ref={dialog} className="pc-reader" data-phase={phase} aria-labelledby="pc-reader-title" onCancel={e => { e.preventDefault(); detail ? closeDetail() : closeBook.current(); }} onClick={e => { if (e.target === dialog.current) closeBook.current(); }} onKeyDown={e => {
    if (phase !== 'ready') return;
    if (detail || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); turn(e.key === 'ArrowRight' ? 1 : -1); }
  }}>
    <div ref={flight} className="pc-book-flight" aria-hidden="true" inert />
    <div className="pc-reader-shell">
    <header className="pc-reader-header">
      <div className="pc-reader-identity"><span className="eyebrow">MY BIGCAT PASSPORT</span><h2 id="pc-reader-title" title={`สมุดของ ${name}`}>สมุดของ {name}</h2></div>
      {!detail && <div className="pc-reader-controls" inert={phase !== 'ready'}>
        <label className="pc-reader-chapter"><span>เก็บแล้ว {book.events.filter(ev => ev.earned).length}/{book.events.length} ดวง</span><select aria-label="เลือกบทในสมุด" value={chapter} onChange={e => { setChapter(Number(e.target.value)); setPage(0); }}>{(books.length ? books : [book]).map((b, i) => <option key={b.key || i} value={i}>{String(i + 1).padStart(2, '0')} · {b.name}</option>)}</select></label>
        <div className="pc-filters" role="group" aria-label="กรองแสตมป์">{[['all', 'ทั้งหมด'], ['earned', 'สะสมแล้ว'], ['locked', 'รอเก็บ']].map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} aria-controls="pc-reader-pages" onClick={() => { setFilter(value); setPage(0); }}>{label}</button>)}</div>
      </div>}
      <button type="button" className="button ghost small pc-reader-close" onClick={() => closeBook.current()}>ปิดสมุด ×</button>
    </header>
    <div className="pc-reader-interior" inert={phase !== 'ready'}>
    {detail ? <div className="pc-reader-detail" ref={body}><button ref={back} type="button" className="button ghost small" onClick={closeDetail}>← กลับหน้าสมุด</button><StampDetail ev={detail} inline /></div> : <>
      <div className="pc-reader-body" id="pc-reader-pages" ref={body} onTouchStart={e => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY }; }} onTouchCancel={() => { touch.current = null; }} onTouchEnd={e => { const t = e.changedTouches[0], origin = touch.current; touch.current = null; if (!origin) return; const dx = t.clientX - origin.x, dy = t.clientY - origin.y; if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.5) turn(dx < 0 ? 1 : -1); }}>
        <MemoryChapter book={book} filter={filter} page={current} mobile={mobile} onOpen={ev => { stampTrigger.current = ev.slug; setDetail(ev); }} />
      </div>
      <footer className="pc-reader-nav"><button type="button" className="button ghost small" disabled={start === 0} onClick={() => turn(-1)} aria-label="หน้าก่อนหน้า">← <span>ก่อนหน้า</span></button><label><span className="pc-page-status" aria-live="polite">งาน {events.length ? Math.floor(start / 2) + 1 : 0}/{events.length}{mobile ? ` · หน้า ${start % 2 + 1}/2` : ` · หน้า ${start + 1}–${start + 2}`}</span><select aria-label="ไปหน้าที่" value={start} onChange={e => setPage(Number(e.target.value))}>{Array.from({ length: Math.ceil(pages / step) }, (_, i) => <option key={i} value={i * step}>{events[Math.floor(i * step / 2)]?.title || 'หน้าว่าง'}{mobile ? ` · ${i % 2 === 0 ? 'แสตมป์และโน้ต' : 'รูปถ่าย'}` : ''}</option>)}</select></label><button type="button" className="button dark small" disabled={start + step >= pages} onClick={() => turn(1)} aria-label="หน้าถัดไป"><span>ถัดไป</span> →</button></footer>
    </>}
    </div>
    </div>
  </dialog>;
}

// ลิงก์ชวนเพื่อน — ก๊อป / แชร์ (native share บนมือถือ)
function InviteBox({ code, friend }) {
  const [copied, setCopied] = useState(false);
  const url = `${typeof location !== 'undefined' ? location.origin : ''}/i/${code}`;
  const text = `มาเจอแก๊ง BIGCAT ด้วยกันไหม ลงทะเบียนฟรี แล้วเราจะได้แสตมป์คู่ใน Passport ♡ ${url}`;
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard ไม่ให้ */ } };
  const share = async () => { try { await navigator.share({ title: 'มาเจอ BIGCAT ด้วยกัน', text, url }); } catch { /* ยกเลิก */ } };
  return <div className="invite-box">
    <div className="invite-copy">
      <span className="eyebrow">พาเพื่อนมา</span>
      <h3>ชวนเพื่อนที่ยังไม่เคยมา — ได้แสตมป์คู่ทั้งสองคน</h3>
      <p className="muted">ส่งลิงก์นี้ให้เพื่อน เพื่อนลงทะเบียนแล้วมาเช็คอินครั้งแรกเมื่อไหร่ คุณได้แสตมป์ <Tag>พามาเจอ</Tag> เพื่อนได้ <Tag>มาครั้งแรก</Tag> — สองลายต่อกันเป็นภาพเดียวเมื่อวางมือถือชิดกัน</p>
      <div className="invite-link"><code>{url.replace(/^https?:\/\//, '')}</code><button type="button" className="button dark small" onClick={copy}>{copied ? 'ก๊อปแล้ว ✓' : 'ก๊อปลิงก์'}</button>{typeof navigator !== 'undefined' && !!navigator.share && <button type="button" className="button ghost small" onClick={share}>ส่งให้เพื่อน</button>}</div>
      {friend?.meta?.count > 0 && <p className="small-note">พามาแล้ว {friend.meta.count} คน{friend.meta.friends?.length ? ` — ${friend.meta.friends.join(', ')}` : ''}</p>}
    </div>
    <SpecialStamp kind="friend" meta={friend?.meta} size={110} />
  </div>;
}

export default function PassportPage() {
  const { user, loaded } = useUser();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [readerOpen, setReaderOpen] = useState(false);
  const [img, setImg] = useState(null);        // data URL รูปแชร์
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (loaded && !user) location.replace('/login?next=/passport'); }, [loaded, user]);
  useEffect(() => { if (user) api('/passport').then(setData).catch(e => setError(e.message)); }, [user]);
  const makeImage = async () => { setBusy(true); try { setImg((await drawPassportImage(data)).toDataURL('image/png')); } catch (e) { setError(e.message); } finally { setBusy(false); } };

  if (!user || (!data && !error)) return <><SiteHeader /><PageLoader label="กำลังเปิดสมุด…" /></>;
  const specials = data ? [...data.books.flatMap(b => b.events.flatMap(ev => (ev.extras || []).map(s => ({ ...s, ev })))), ...(data.friend ? [{ ...data.friend, ev: null }] : [])] : [];
  const upcoming = data ? data.books.flatMap(b => b.events).filter(ev => ev.phase === 'upcoming') : [];
  const latest = data ? data.books.flatMap(b => b.events).filter(ev => ev.earned).reduce((best, ev) => !best || (parseDate(ev.earned.earned_at).getTime() || 0) > (parseDate(best.earned.earned_at).getTime() || 0) ? ev : best, null) : null;
  const latestMemory = latest ? eventMemory(latest) : null;

  return <><SiteHeader /><main className="ev-page passport-page">
    {error && <Notice tone="error">{error}</Notice>}
    {data && <>
      <section className="pc-hero" aria-labelledby="passport-title">
        <div className="pc-intro">
          <span className="eyebrow">MY BIGCAT PASSPORT</span>
          <h1 id="passport-title">Every moment,<br />a little <em>treasure.</em></h1>
          <p className="pc-lead">สมุดเล่มเล็ก ที่เก็บความทรงจำของเรา</p>
          <div className="pc-owner">{user.avatar ? <img className="avatar" src={user.avatar} alt="" referrerPolicy="no-referrer" /> : <span className="avatar placeholder">{user.display_name.slice(0, 1)}</span>}<span>สมุดของ <strong>{user.display_name}</strong></span></div>
          <div className="pc-actions"><button type="button" className="button dark" onClick={makeImage} disabled={busy || data.total === 0} title={data.total === 0 ? 'ยังไม่มีแสตมป์ให้อวด — มางานก่อนนะ' : ''}><Icon name="heart" size={16} />{busy ? 'กำลังวาด…' : 'แชร์ความทรงจำ'}</button><button type="button" className="button ghost" aria-haspopup="dialog" onClick={() => setReaderOpen(true)}>เปิดสมุดของฉัน ↗</button></div>
          <div className="pc-stats"><div><strong>{String(data.total).padStart(2, '0')}</strong><span>STAMPS COLLECTED</span></div><div><span>OUR FIRST MEMORY</span><strong className="pc-first-date">{data.user.first_checkin_at ? fmt(data.user.first_checkin_at) : 'รอวันแรกที่ได้เจอกัน ♡'}</strong></div></div>
          {data.user.inviter && <p className="small-note">มาเจอเพราะ {data.user.inviter.display_name} ชวน ♡</p>}
        </div>
        <CollectorBook name={user.display_name} events={data.books.flatMap(b => b.events)} onOpen={() => setReaderOpen(true)} />
      </section>
      <div className="pc-content">
      {img && <SaveImage url={img} fileName={`bigcat-passport-${user.display_name}.png`} title="BIGCAT Passport" alt="Passport ของฉัน" />}

      {data.sticker.eligible && !data.sticker.given_at && <Notice>ครบ {data.sticker.at} ดวงแล้ว 🎉 รับ<strong>สติกเกอร์ Passport</strong>ได้ที่โต๊ะพี่ ๆ ในงานถัดไป — โชว์หน้านี้ให้ดูได้เลย</Notice>}
      {data.sticker.given_at && <p className="small-note">รับสติกเกอร์ Passport แล้วเมื่อ {fmt(data.sticker.given_at)} ♡</p>}

      {latest && <section className="pc-photo-album" aria-label="ภาพความทรงจำหลังงาน"><div><span className="eyebrow">OUR PHOTO MEMORIES</span><h3>อีกหนึ่งวันดี ๆ<br />ที่เราได้เจอกัน</h3><p>{latest.title}</p><small>พื้นที่เก็บภาพความทรงจำหลังจบงาน</small></div><div className="pm-photo-layout">{latestMemory.group || latestMemory.portrait ? <>{latestMemory.group && <MemoryPhoto src={latestMemory.group} caption="วันของพวกเรา ♡" kind="group" />}{latestMemory.portrait && <MemoryPhoto src={latestMemory.portrait} caption="เธอกับเรา" kind="portrait" />}</> : <div className="pc-photo-pending"><Icon name="heart" size={32} /><strong>รอเก็บภาพวันดี ๆ ของเรา</strong><p>เมื่อรูปหลังงานพร้อม จะนำมาเก็บไว้ตรงนี้</p><small>รูปหมู่ และรูปคู่สำหรับผู้ที่มีภาพ</small></div>}</div></section>}
      {data.total === 0 && <div className="pc-empty"><span>♡</span><h3>ความทรงจำดวงแรก กำลังรอคุณอยู่</h3><p>มาเจอกันที่งาน แล้วเช็คอินเพื่อเริ่มต้นสมุดเล่มนี้</p><Link className="button ghost small" to="/events">ดูตารางงาน ↗</Link></div>}

      {specials.length > 0 && <Section eyebrow="THE LITTLE TREASURES" title="แสตมป์พิเศษ" className="pc-treasures" aside={<span className="pc-book-count">{specials.length} ดวงพิเศษ ♡</span>}>
        <p className="pc-tray-caption">เรื่องราวที่พิเศษขึ้นอีกนิด เก็บไว้ใกล้หัวใจ</p>
        <div className="pc-velvet-tray">{specials.map((s, i) => <div key={i} className="pc-treasure"><div className="pc-pin-well"><SpecialStamp kind={s.kind} meta={s.meta} size={140} /></div><strong>{STAMP_LABEL[s.kind]}</strong><small>{s.ev ? s.ev.title : `พาเพื่อนมาแล้ว ${s.meta?.count || 0} คน`}</small></div>)}</div>
      </Section>}

      <Section eyebrow="INVITE" title="พาเพื่อนมา"><InviteBox code={data.user.invite_code} friend={data.friend} /></Section>

      {upcoming.length > 0 && <p className="small-note">งานถัดไป: {upcoming.slice(0, 3).map(ev => <Link key={ev.slug} to={`/events/${ev.slug}`}>{ev.title}</Link>).reduce((a, b) => [a, ' · ', b])} — ลงทะเบียนแล้วมาเช็คอินรับแสตมป์</p>}
      </div>
    </>}
    {readerOpen && data && <PassportReader books={data.books} name={user.display_name} onClose={() => setReaderOpen(false)} />}
    <Paw />
  </main><SiteFooter /></>;
}
