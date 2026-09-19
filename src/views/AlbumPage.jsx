'use client';
// อัลบั้มเต็มของงาน — แท็บ (ทั้งหมด · รูปที่มีฉัน · รูปหมู่ · รูปตัวเอกของงาน) · โหลดเพิ่มตอนเลื่อน
// · lightbox (ดาวน์โหลด · ไม่ใช่ฉัน · ขอเอารูปออก)
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from '../lib/nav.jsx';
import { SiteHeader, SiteFooter, Notice } from '../components/EventShell.jsx';
import { Icon, PageLoader } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useUser } from '../lib/auth.js';
import { eventDate } from '../lib/format.js';
import PhotoModal from '../components/PhotoModal.jsx';

export default function AlbumPage({ slug }) {
  const { user, loaded } = useUser();
  const [ev, setEv] = useState(null);
  const [a, setA] = useState(null);          // ข้อมูลอัลบั้ม (ไม่รวมรูป) จากหน้าแรกที่โหลด
  const [photos, setPhotos] = useState([]);  // สะสมทีละหน้า
  const [cursor, setCursor] = useState(null);
  const [more, setMore] = useState(false);   // กำลังโหลดหน้าถัดไป
  const [tab, setTab] = useState('all');
  const [open, setOpen] = useState(null);    // index ใน photos
  const [msg, setMsg] = useState('');
  const end = useRef(null);

  // โหลดหนึ่งหน้า · cur = null คือหน้าแรกของแท็บนี้
  const loadPage = useCallback(async (which, cur) => {
    setMore(true);
    try {
      const r = await api(`/events/${slug}/album?tab=${which}${cur ? `&cursor=${cur}` : ''}`);
      setA(r);
      setPhotos(prev => (cur ? [...prev, ...r.photos] : r.photos));
      setCursor(r.nextCursor);
    } catch (e) { setMsg(e.message); } finally { setMore(false); }
  }, [slug]);

  useEffect(() => { api(`/events/${slug}`).then(d => setEv(d.event)).catch(() => {}); }, [slug]);
  useEffect(() => { if (loaded) { setPhotos([]); setCursor(null); setOpen(null); loadPage(tab, null); } }, [slug, loaded, user?.id, tab, loadPage]);
  // เลื่อนถึงท้ายกริด = โหลดต่อเอง (ยังมีปุ่มให้กดเองเผื่อ observer ไม่ทำงาน)
  useEffect(() => {
    if (!cursor || !end.current) return;
    const io = new IntersectionObserver(([x]) => { if (x.isIntersecting && !more) loadPage(tab, cursor); }, { rootMargin: '600px' });
    io.observe(end.current);
    return () => io.disconnect();
  }, [cursor, more, tab, loadPage]);
  // ลิงก์ #p<id> จากหน้างาน — เปิดรูปนั้นถ้าอยู่ในหน้าที่โหลดมาแล้ว
  useEffect(() => {
    if (a?.access !== 'full' || open != null) return;
    const m = location.hash.match(/^#p(\d+)/);
    if (!m) return;
    const i = photos.findIndex(p => p.id === Number(m[1]));
    if (i >= 0) setOpen(i);
  }, [photos, a, open]);

  const act = async (path, body) => { setMsg(''); try { const r = await api(path, { method: 'POST', body }); await loadPage(tab, null); return r; } catch (e) { setMsg(e.message); } };
  const origUrl = (p) => `/api/events/${slug}/album/${p.id}/orig`;
  const cur = open != null ? photos[open] : null;
  const d = ev ? eventDate(ev) : null;
  // แท็บที่ยังไม่มีรูปจะไม่ขึ้น ยกเว้น «รูปที่มีฉัน» ที่ต้องเห็นไว้ให้รู้ว่ามีฟีเจอร์นี้
  const tabs = a?.access === 'full' ? [
    ['all', 'ทั้งหมด', a.counts?.all], ['me', 'รูปที่มีฉัน', a.counts?.me],
    ['group', 'รูปหมู่', a.counts?.group], ['mascot', `รูป${a.mascotName || 'น้อง'}`, a.counts?.mascot],
  ].filter(([k, , n]) => k === 'all' || k === 'me' || n > 0) : [];

  return <><SiteHeader /><main className="ev-page album-page">
    <nav className="crumbs"><Link to="/events">ตารางงาน</Link><span>/</span><Link to={`/events/${slug}`}>{ev?.title || '…'}</Link><span>/</span><span>อัลบั้ม</span></nav>
    <div className="album-head">
      <div><span className="eyebrow">PHOTO ALBUM{d ? ` · ${d.long}` : ''}</span><h1>{ev?.title || 'อัลบั้มงาน'}</h1>{a?.access === 'full' && <p className="muted">{a.total} รูป{a.me?.matches > 0 ? ` · มีคุณ ${a.me.matches} รูป` : ''}</p>}</div>
      {a?.access === 'full' && <div className="filter-tabs">{tabs.map(([k, label, n]) => <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)} disabled={k === 'me' && !n}>{label}{n ? ` (${n})` : ''}</button>)}</div>}
    </div>
    {msg && <Notice tone="error">{msg}</Notice>}
    {!a ? <PageLoader label="กำลังเปิดอัลบั้ม…" />
      : a.access === 'unpublished' ? <Notice tone="muted">ทีมงานกำลังคัดรูปของงานนี้อยู่ — อีกไม่นานจะเปิดให้คนที่เช็คอินเข้ามาดูนะคะ</Notice>
      : a.access !== 'full' ? <div className="album-locked">
        <div className="album-preview locked">{photos.map(p => <span key={p.id} className="album-preview-tile"><img src={p.thumb} alt="" /></span>)}</div>
        <Notice tone="muted">อัลบั้ม {a.total} รูปนี้เปิดให้เฉพาะคนที่<strong>เช็คอินหน้างาน</strong> {!user ? <><Link to={`/login?next=/events/${slug}/album`}>เข้าสู่ระบบ</Link>ด้วยบัญชีที่ใช้ลงทะเบียนงานนี้</> : 'บัญชีนี้ยังไม่มีการเช็คอินงานนี้ — ถ้าลงทะเบียนโดยไม่ได้ล็อกอิน ให้พี่ ๆ ผูกบัตรกับบัญชีในหน้าจัดการได้'}</Notice>
      </div>
        : <>
          {a.facesEnabled && a.me && !a.me.registered && <Notice tone="muted">อยากให้ระบบหารูปที่มีคุณให้อัตโนมัติ? <Link to="/account?tab=photos">ลงทะเบียนใบหน้าในหน้าบัญชี</Link> (เลือกทำหรือไม่ก็ได้ ลบได้ทุกเมื่อ)</Notice>}
          {tab === 'me' && !photos.length && !more && <Notice tone="muted">ยังไม่พบรูปที่มีคุณในอัลบั้มนี้</Notice>}
          {tab === 'mascot' && <p className="muted small">รูปเดี่ยวของ{a.mascotName}ที่พี่ ๆ คัดไว้จากงานนี้</p>}
          <div className="album-grid">{photos.map((p, i) => <button key={p.id} type="button" className={`album-tile ${p.mine ? 'mine' : ''}`} style={{ aspectRatio: `${p.width} / ${p.height}` }} onClick={() => setOpen(i)}><img src={p.thumb} alt="" loading="lazy" />{p.mine && <span className="album-me">{p.mine.status === 'confirmed' ? 'คุณ ✓' : 'น่าจะคุณ'}</span>}</button>)}</div>
          <div className="album-more" ref={end}>
            {more ? <span className="muted">กำลังโหลดรูปเพิ่ม…</span>
              : cursor ? <button type="button" className="button ghost" onClick={() => loadPage(tab, cursor)}>โหลดรูปเพิ่ม</button>
                : photos.length > 0 ? <span className="muted small">ครบทุกรูปแล้ว ({photos.length} รูป)</span> : null}
          </div>
        </>}
    {cur && <PhotoModal list={photos} index={open} setIndex={setOpen} onClose={() => setOpen(null)}
      caption={(p, i) => `${i + 1} / ${photos.length}${p.mine ? ` · ${p.mine.status === 'confirmed' ? 'ยืนยันแล้วว่าเป็นคุณ' : `ระบบคิดว่าเป็นคุณ (${Math.round(p.mine.similarity * 100)}%)`}` : ''}`}
      actions={(p) => <>
        <a className="button dark small" href={origUrl(p)} download target="_blank" rel="noreferrer">ดาวน์โหลด <Icon name="arrow" size={14} /></a>
        {p.mine && <>
          {p.mine.status !== 'confirmed' && <button className="button ghost small" onClick={() => act(`/events/${slug}/album/${p.id}/me`)}>ใช่ นี่ฉัน</button>}
          <button className="link-button" onClick={async () => { await act(`/events/${slug}/album/${p.id}/not-me`); if (tab === 'me') setOpen(null); }}>ไม่ใช่ฉัน</button>
        </>}
        <button className="link-button" onClick={async () => { const reason = prompt('เหตุผลที่อยากให้เอารูปนี้ออก (ไม่บังคับ)') ?? null; if (reason === null) return; await act(`/events/${slug}/album/${p.id}/remove`, { reason }); alert('ส่งคำขอแล้ว พี่ ๆ จะดูให้เร็วที่สุด'); }}>ขอเอารูปนี้ออก</button>
      </>} />}
  </main><SiteFooter /></>;
}
