'use client';
import React, { useState } from 'react';
import { EventStamp } from './Stamp.jsx';
import { eventDate } from '../lib/format.js';
import { eventMemory } from '../lib/passport-memory.js';
import { drawEventMemoryImage } from '../lib/passport-image.js';
import PortraitPicker from './PortraitPicker.jsx';

export function MemoryPhoto({ src, caption, kind }) {
  const [failed, setFailed] = useState(false);
  return <figure className={`pm-polaroid pm-${kind}`}><span className="pm-tape" aria-hidden="true" />
    {failed ? <p className="pm-image-error">โหลดภาพไม่สำเร็จ ลองเปิดสมุดอีกครั้งนะ</p> : <a href={src} target="_blank" rel="noreferrer" aria-label={`เปิดภาพเต็ม: ${caption}`}><img src={src} alt={caption} onError={() => setFailed(true)} /></a>}
    <figcaption>{caption}</figcaption></figure>;
}

export default function PassportMemory({ ev, side, onOpen }) {
  const [includePortrait, setIncludePortrait] = useState(false);
  const [share, setShare] = useState(false);
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pick, setPick] = useState(false);
  if (!ev) return <div className="pc-page-note"><span>♡</span><p>ยังไม่มีความทรงจำในตัวกรองนี้</p></div>;
  const m = eventMemory(ev);
  const state = ev.earned ? 'earned' : ev.phase === 'upcoming' ? 'locked' : 'missed';
  const makeImage = async () => {
    setBusy(true); setError(''); setImage(null);
    try { setImage((await drawEventMemoryImage(ev, { includePortrait })).toDataURL('image/png')); }
    catch { setError('สร้างภาพไม่สำเร็จ กรุณาลองอีกครั้ง'); }
    finally { setBusy(false); }
  };
  if (side === 0) return <div className={`pm-story pm-${m.layout}`}>
    <div className="pm-event-heading"><span className="eyebrow">A DAY TO REMEMBER</span><h3>{ev.title}</h3><small>{eventDate(ev).long}{ev.place ? ` · ${ev.place}` : ''}</small></div>
    <div className="pm-letter-row"><button type="button" className={`pm-stamp ${state}`} data-event-slug={ev.slug} onClick={() => onOpen(ev)} aria-label={`ดูแสตมป์ ${ev.title}`}><EventStamp ev={ev} state={state} size={164} /><small>{ev.earned ? 'เก็บวันนี้ไว้แล้ว ♡' : state === 'locked' ? 'รอวันได้เจอกัน' : 'งานนี้ผ่านไปแล้ว'}</small></button>
      <div className="pm-letter"><span className="pm-tape" aria-hidden="true" /><span className="eyebrow">A LITTLE NOTE</span>
        {m.noteImage ? <a href={m.noteImage} target="_blank" rel="noreferrer" aria-label="เปิดภาพลายมือเต็ม"><img src={m.noteImage} alt={`ข้อความลายมือจาก${m.author}`} /></a> : m.noteText ? <p className="pm-note-text">{m.noteText}</p> : <p className="pm-pending">{ev.earned ? 'กำลังรวบรวมความทรงจำวันของเราอยู่นะ' : 'มาเจอกัน แล้วเก็บเรื่องราวของวันนั้นไว้ด้วยกันนะ'}</p>}
        {m.noteImage && m.noteText && <details><summary>อ่านข้อความ</summary><p>{m.noteText}</p></details>}
        {(m.noteImage || m.noteText) && <span className="pm-signature">จาก {m.author} ♡</span>}
      </div></div>
    {ev.earned && <button className="pm-detail-link" onClick={() => onOpen(ev)}>ดูแสตมป์พิเศษและของที่ระลึกจากงาน ↗</button>}
  </div>;
  return <div className={`pm-album pm-${m.layout} ${m.group && m.portrait ? 'pm-two-photos' : 'pm-one-photo'}`}>
    <div className="pm-album-heading"><span className="eyebrow">OUR PHOTO MEMORIES</span><h3>เราอยู่ในความทรงจำเดียวกัน</h3></div>
    <div className="pm-photo-layout">
      {m.group && <MemoryPhoto src={m.group} caption="วันของพวกเรา ♡" kind="group" />}
      {m.portrait && <MemoryPhoto src={m.portrait} caption="เธอกับเรา" kind="portrait" />}
      {!m.group && !m.portrait && <div className="pm-photo-pending"><span aria-hidden="true">♡</span><strong>{ev.earned ? 'รูปวันดี ๆ กำลังเดินทางมา' : 'หน้าต่อไปของความทรงจำ'}</strong><p>{ev.earned ? 'เมื่อทีมงานเตรียมภาพหลังงานเรียบร้อย เราจะเก็บไว้ให้ตรงนี้' : 'ภาพหลังงานสำหรับสมาชิกที่ได้รับแสตมป์นี้'}</p></div>}
    </div>
    {pick && <PortraitPicker ev={ev} onClose={() => setPick(false)} onChanged={() => dispatchEvent(new CustomEvent('bigcat:passport-refresh'))} />}
    {(m.group || m.portrait) && <p className="pm-caption">{m.caption}</p>}
    {ev.earned && ev.phase === 'past' && <div className="pm-portrait-tools">
      <button type="button" className="pm-detail-link" onClick={() => setPick(true)}>{m.portrait ? 'เปลี่ยนรูปคู่' : 'เลือกรูปคู่ของฉัน'} ↗</button>
      {(m.group || m.portrait) && <button type="button" className="pm-detail-link" onClick={() => setShare(!share)} aria-expanded={share}>เตรียมภาพสำหรับแชร์ ↗</button>}
      {m.portrait && ev.memory?.portraitSource === 'auto' && <small className="muted">รูปคู่นี้ระบบเลือกจากอัลบั้มให้{ev.memory.myPhotos > 1 ? ` · มีรูปคุณอีก ${ev.memory.myPhotos - 1} รูป` : ''}</small>}
    </div>}
    {share && <div className="pm-share-panel"><strong>เลือกสิ่งที่อยากแบ่งปัน</strong>{m.portrait && <label><input type="checkbox" disabled={busy} checked={includePortrait} onChange={e => { setIncludePortrait(e.target.checked); setImage(null); }} /> รวมรูปคู่ของฉันในภาพแชร์</label>}<small>รูปคู่จะไม่ถูกใส่ลงภาพแชร์จนกว่าคุณจะเลือก</small><button className="button small ghost" type="button" disabled={busy} onClick={makeImage}>{busy ? 'กำลังเตรียมภาพ…' : 'สร้างภาพแชร์'}</button>{image && <a href={image} download={`bigcat-memory-${ev.slug}.png`}>ดาวน์โหลดภาพ PNG ↓</a>}{error && <p role="alert">{error}</p>}</div>}
  </div>;
}
