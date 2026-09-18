'use client';
// เลือกภาพของงานในสมุด passport — 2 แท็บ: «รูปคู่» (รูปที่ระบบเจอว่ามีเรา หรืออัปโหลดเอง) · «รูปหมู่» (เลือกจากอัลบั้มของงาน)
import React, { useEffect, useState } from 'react';
import { Link } from '../lib/nav.jsx';
import { Modal, Icon, PageLoader } from './ui.jsx';
import { Notice } from './EventShell.jsx';
import { FileDrop } from './forms.jsx';
import { api } from '../lib/api.js';

export default function PortraitPicker({ ev, tab: initial = 'portrait', onClose, onChanged }) {
  const [d, setD] = useState(null);
  const [tab, setTab] = useState(initial);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { api(`/passport/${ev.slug}/photos`).then(setD).catch(e => setErr(e.message)); }, [ev.slug]);
  const save = async (path, body) => {
    setBusy(true); setErr('');
    try { await api(path, { method: 'PUT', body }); onChanged(); onClose(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const portrait = (body) => save(`/passport/${ev.slug}/portrait`, body);
  const group = (body) => save(`/passport/${ev.slug}/group`, body);
  const upload = () => { const fd = new FormData(); fd.append('portrait', file); return portrait(fd); };
  const cur = d?.current || {};

  return <Modal title="รูปของงานนี้ในสมุดของฉัน" onClose={onClose} wide>
    <div className="filter-tabs pp-tabs">
      <button className={tab === 'portrait' ? 'active' : ''} onClick={() => setTab('portrait')}>รูปคู่</button>
      <button className={tab === 'group' ? 'active' : ''} onClick={() => setTab('group')}>รูปหมู่</button>
    </div>
    {err && <Notice tone="error">{err}</Notice>}
    {!d ? <PageLoader /> : tab === 'portrait' ? <div className="pp-body">
      <section>
        <span className="eyebrow">รูปที่ระบบเจอว่ามีคุณ ({d.photos.length})</span>
        {d.photos.length === 0
          ? <p className="muted small">ยังไม่พบรูปที่มีคุณในอัลบั้มงานนี้ — เปิดการค้นหาด้วยใบหน้าได้ที่ <Link to="/account?tab=photos">รูปของฉัน</Link> หรืออัปโหลดรูปของคุณเองด้านล่าง</p>
          : <div className="pp-grid">{d.photos.map(p => <button key={p.id} type="button" className={`pp-tile ${cur.portraitPhoto?.id === p.id ? 'active' : ''}`} disabled={busy} onClick={() => portrait({ photoId: p.id })}><img src={p.thumb} alt="" /><small>{p.status === 'confirmed' ? 'ยืนยันแล้ว ✓' : 'น่าจะคุณ'}{p.faces > 1 ? ` · ${p.faces} คน` : ''}</small></button>)}</div>}
      </section>
      <section>
        <span className="eyebrow">หรืออัปโหลดรูปของคุณเอง</span>
        <FileDrop id="pp-file" accept="image/*" file={file} onChange={setFile} label="รูปคู่ที่คุณถ่ายเอง" hint="เห็นเฉพาะคุณคนเดียว · JPG / PNG / WebP" />
        <div className="form-actions"><button type="button" className="button dark small" disabled={!file || busy} onClick={upload}>ใช้รูปนี้ <Icon name="check" size={14} /></button>
          {(cur.portraitPhoto || cur.passportPortrait) && <button type="button" className="link-button" disabled={busy} onClick={() => portrait({})}>กลับไปให้ระบบเลือกอัตโนมัติ</button>}</div>
      </section>
    </div> : <div className="pp-body">
      <section>
        <span className="eyebrow">เลือกรูปหมู่จากอัลบั้มของงาน ({d.album.length})</span>
        {d.album.length === 0
          ? <p className="muted small">งานนี้ยังไม่มีอัลบั้มรูป — เมื่อทีมงานลงรูปแล้วจะเลือกได้ที่นี่</p>
          : <div className="pp-grid">{d.album.map(p => <button key={p.id} type="button" className={`pp-tile ${cur.groupPhoto?.id === p.id ? 'active' : ''}`} disabled={busy} onClick={() => group({ photoId: p.id })}><img src={p.thumb} alt="" /><small>{p.faces >= 3 ? `${p.faces} คน` : p.faces ? `${p.faces} คน` : 'บรรยากาศงาน'}</small></button>)}</div>}
        {cur.groupPhoto && <div className="form-actions"><button type="button" className="link-button" disabled={busy} onClick={() => group({})}>กลับไปใช้รูปหมู่ที่ทีมงานเลือกไว้</button></div>}
      </section>
    </div>}
  </Modal>;
}
