'use client';
// เลือกรูปคู่ของงานใน passport — จากรูปที่ระบบพบว่ามีฉันในอัลบั้ม · อัปโหลดเอง · หรือกลับไปให้ระบบเลือกอัตโนมัติ
import React, { useEffect, useState } from 'react';
import { Link } from '../lib/nav.jsx';
import { Modal, Icon, PageLoader } from './ui.jsx';
import { Notice } from './EventShell.jsx';
import { FileDrop } from './forms.jsx';
import { api } from '../lib/api.js';

export default function PortraitPicker({ ev, onClose, onChanged }) {
  const [d, setD] = useState(null);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { api(`/passport/${ev.slug}/photos`).then(setD).catch(e => setErr(e.message)); }, [ev.slug]);
  const save = async (body) => {
    setBusy(true); setErr('');
    try { await api(`/passport/${ev.slug}/portrait`, { method: 'PUT', body }); onChanged(); onClose(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const upload = () => { const fd = new FormData(); fd.append('portrait', file); return save(fd); };
  const cur = d?.current || {};
  const chosenId = cur.portraitPhoto?.id;
  return <Modal title="รูปคู่ของงานนี้" onClose={onClose} wide>
    {err && <Notice tone="error">{err}</Notice>}
    {!d ? <PageLoader /> : <div className="pp-body">
      <section>
        <span className="eyebrow">รูปที่มีคุณในอัลบั้ม ({d.photos.length})</span>
        {d.photos.length === 0
          ? <p className="muted small">ยังไม่พบรูปที่มีคุณในอัลบั้มงานนี้ — {ev.memory?.myPhotos === 0 ? <>ถ้ายังไม่ได้ลงทะเบียนใบหน้า ไปที่ <Link to="/account#face">บัญชีของฉัน</Link> หรือ</> : null}เลือกจาก <Link to={`/events/${ev.slug}/album`}>อัลบั้มงาน</Link> ด้วยตัวเอง</p>
          : <div className="pp-grid">{d.photos.map(p => <button key={p.id} type="button" className={`pp-tile ${chosenId === p.id ? 'active' : ''}`} disabled={busy} onClick={() => save({ photoId: p.id })}><img src={p.thumb} alt="" /><small>{p.status === 'confirmed' ? 'ยืนยันแล้ว ✓' : 'น่าจะคุณ'}{p.faces > 1 ? ` · ${p.faces} คน` : ''}</small></button>)}</div>}
      </section>
      <section>
        <span className="eyebrow">หรืออัปโหลดรูปของคุณเอง</span>
        <FileDrop id="pp-file" accept="image/*" file={file} onChange={setFile} label="รูปคู่ที่คุณถ่ายเอง" hint="เห็นเฉพาะคุณคนเดียว · JPG / PNG / WebP" />
        <div className="form-actions"><button type="button" className="button dark small" disabled={!file || busy} onClick={upload}>ใช้รูปนี้ <Icon name="check" size={14} /></button>{(cur.portraitPhoto || cur.passportPortrait) && <button type="button" className="link-button" disabled={busy} onClick={() => save({})}>กลับไปให้ระบบเลือกอัตโนมัติ</button>}</div>
      </section>
    </div>}
  </Modal>;
}
