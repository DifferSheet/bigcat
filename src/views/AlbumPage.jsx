'use client';
// อัลบั้มเต็มของงาน — กริดรูป · กรอง «รูปที่มีฉัน» · lightbox (ดาวน์โหลด · ใช้เป็นรูปคู่ใน passport · ไม่ใช่ฉัน · ขอเอารูปออก)
import React, { useEffect, useState } from 'react';
import { Link } from '../lib/nav.jsx';
import { SiteHeader, SiteFooter, Notice } from '../components/EventShell.jsx';
import { Icon, PageLoader, Tag } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useUser } from '../lib/auth.js';
import { eventDate } from '../lib/format.js';

export default function AlbumPage({ slug }) {
  const { user, loaded } = useUser();
  const [ev, setEv] = useState(null);
  const [a, setA] = useState(null);
  const [filter, setFilter] = useState('all');   // all | me
  const [open, setOpen] = useState(null);        // index ใน list
  const [msg, setMsg] = useState('');
  const load = () => api(`/events/${slug}/album`).then(setA).catch(e => setMsg(e.message));
  useEffect(() => { api(`/events/${slug}`).then(d => setEv(d.event)).catch(() => {}); }, [slug]);
  useEffect(() => { if (loaded) load(); }, [slug, loaded, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!a || a.access !== 'full') return; const m = location.hash.match(/^#p(\d+)/); if (m) { const i = a.photos.findIndex(p => p.id === Number(m[1])); if (i >= 0) setOpen(i); } }, [a]);

  const list = a?.access === 'full' ? a.photos.filter(p => filter === 'all' || p.mine) : [];
  const act = async (path, body) => { setMsg(''); try { const r = await api(path, { method: 'POST', body }); await load(); return r; } catch (e) { setMsg(e.message); } };
  const cur = open != null ? list[open] : null;
  useEffect(() => {
    if (cur == null) return;
    const key = (e) => { if (e.key === 'Escape') setOpen(null); if (e.key === 'ArrowRight') setOpen(i => Math.min(list.length - 1, i + 1)); if (e.key === 'ArrowLeft') setOpen(i => Math.max(0, i - 1)); };
    addEventListener('keydown', key); return () => removeEventListener('keydown', key);
  }, [cur, list.length]);

  const d = ev ? eventDate(ev) : null;
  return <><SiteHeader /><main className="ev-page album-page">
    <nav className="crumbs"><Link to="/events">ตารางงาน</Link><span>/</span><Link to={`/events/${slug}`}>{ev?.title || '…'}</Link><span>/</span><span>อัลบั้ม</span></nav>
    <div className="album-head">
      <div><span className="eyebrow">PHOTO ALBUM{d ? ` · ${d.long}` : ''}</span><h1>{ev?.title || 'อัลบั้มงาน'}</h1>{a?.access === 'full' && <p className="muted">{a.total} รูป{a.me?.matches > 0 ? ` · มีคุณ ${a.me.matches} รูป` : ''}</p>}</div>
      {a?.access === 'full' && <div className="filter-tabs"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>ทั้งหมด</button><button className={filter === 'me' ? 'active' : ''} onClick={() => setFilter('me')} disabled={!a.me?.matches}>รูปที่มีฉัน {a.me?.matches ? `(${a.me.matches})` : ''}</button></div>}
    </div>
    {msg && <Notice tone="error">{msg}</Notice>}
    {!a ? <PageLoader label="กำลังเปิดอัลบั้ม…" />
      : a.access !== 'full' ? <div className="album-locked">
        <div className="album-preview locked">{a.photos.map(p => <span key={p.id} className="album-preview-tile"><img src={p.thumb} alt="" /></span>)}</div>
        <Notice tone="muted">อัลบั้ม {a.total} รูปนี้เปิดให้เฉพาะคนที่<strong>เช็คอินหน้างาน</strong> {!user ? <><Link to={`/login?next=/events/${slug}/album`}>เข้าสู่ระบบ</Link>ด้วยบัญชีที่ใช้ลงทะเบียนงานนี้</> : 'บัญชีนี้ยังไม่มีการเช็คอินงานนี้ — ถ้าลงทะเบียนโดยไม่ได้ล็อกอิน ให้พี่ ๆ ผูกบัตรกับบัญชีในหน้าจัดการได้'}</Notice>
      </div>
        : <>
          {a.facesEnabled && a.me && !a.me.registered && <Notice tone="muted">อยากให้ระบบหารูปที่มีคุณให้อัตโนมัติ? <Link to="/account#face">ลงทะเบียนใบหน้าในหน้าบัญชี</Link> (เลือกทำหรือไม่ก็ได้ ลบได้ทุกเมื่อ)</Notice>}
          {filter === 'me' && list.length === 0 && <Notice tone="muted">ยังไม่พบรูปที่มีคุณในอัลบั้มนี้</Notice>}
          <div className="album-grid">{list.map((p, i) => <button key={p.id} type="button" className={`album-tile ${p.mine ? 'mine' : ''}`} style={{ aspectRatio: `${p.width} / ${p.height}` }} onClick={() => setOpen(i)}><img src={p.thumb} alt="" loading="lazy" />{p.mine && <span className="album-me">{p.mine.status === 'confirmed' ? 'คุณ ✓' : 'น่าจะคุณ'}</span>}</button>)}</div>
        </>}
    {cur && <div className="lightbox" role="dialog" aria-modal="true" onClick={e => { if (e.target === e.currentTarget) setOpen(null); }}>
      <button className="lb-close icon-button" aria-label="ปิด" onClick={() => setOpen(null)}><Icon name="close" /></button>
      {open > 0 && <button className="lb-nav prev" aria-label="รูปก่อนหน้า" onClick={() => setOpen(open - 1)}>‹</button>}
      {open < list.length - 1 && <button className="lb-nav next" aria-label="รูปถัดไป" onClick={() => setOpen(open + 1)}>›</button>}
      <figure><img src={cur.view} alt="" /><figcaption>
        <span className="muted">{open + 1} / {list.length}{cur.mine ? ` · ${cur.mine.status === 'confirmed' ? 'ยืนยันแล้วว่าเป็นคุณ' : `ระบบคิดว่าเป็นคุณ (${Math.round(cur.mine.similarity * 100)}%)`}` : ''}</span>
        <div className="lb-actions">
          <a className="button dark small" href={cur.orig} download target="_blank" rel="noreferrer">ดาวน์โหลด <Icon name="arrow" size={14} /></a>
          {cur.mine && <>
            {cur.mine.status !== 'confirmed' && <button className="button ghost small" onClick={() => act(`/events/${slug}/album/${cur.id}/me`)}>ใช่ นี่ฉัน</button>}
            <Link className="button ghost small" to={`/passport?portrait=${slug}:${cur.id}`}>ใช้เป็นรูปคู่ใน Passport</Link>
            <button className="link-button" onClick={async () => { await act(`/events/${slug}/album/${cur.id}/not-me`); if (filter === 'me') setOpen(null); }}>ไม่ใช่ฉัน</button>
          </>}
          <button className="link-button" onClick={async () => { const reason = prompt('เหตุผลที่อยากให้เอารูปนี้ออก (ไม่บังคับ)') ?? null; if (reason === null) return; await act(`/events/${slug}/album/${cur.id}/remove`, { reason }); alert('ส่งคำขอแล้ว พี่ ๆ จะดูให้เร็วที่สุด'); }}>ขอเอารูปนี้ออก</button>
        </div>
      </figcaption></figure>
    </div>}
  </main><SiteFooter /></>;
}
