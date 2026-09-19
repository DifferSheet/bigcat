'use client';
import React, { useEffect, useRef, useState } from 'react';
import { EventStamp } from './Stamp.jsx';
import { eventDate } from '../lib/format.js';
import { eventMemory, stampState } from '../lib/passport-memory.js';
import { drawEventMemoryImage } from '../lib/passport-image.js';
import PortraitPicker from './PortraitPicker.jsx';
import PhotoModal from './PhotoModal.jsx';
import SaveImage from './SaveImage.jsx';
import { Icon, Modal } from './ui.jsx';
import { Notice } from './EventShell.jsx';
import { api } from '../lib/api.js';

export function MemoryPhoto({ src, caption, kind, onOpen }) {
  const [failed, setFailed] = useState(false);
  return <figure className={`pm-polaroid pm-${kind}`}><span className="pm-tape" aria-hidden="true" />
    {failed ? <p className="pm-image-error">โหลดภาพไม่สำเร็จ ลองเปิดสมุดอีกครั้งนะ</p>
      : <button type="button" className="pm-photo-open" onClick={onOpen} aria-label={`ดูภาพเต็ม: ${caption}`}><img src={src} alt={caption} onError={() => setFailed(true)} /></button>}
    <figcaption>{caption}</figcaption></figure>;
}

// แก้ข้อความในหน้าสมุดของตัวเอง (หัวข้อ · ใต้รูปแต่ละใบ · บรรทัดปิดท้าย)
function TextEditor({ ev, m, onClose }) {
  const [f, setF] = useState({ heading: m.texts?.heading || '', groupCaption: m.texts?.groupCaption || '', portraitCaption: m.texts?.portraitCaption || '', caption: m.texts?.caption || '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await api(`/passport/${ev.slug}/texts`, { method: 'PUT', body: f }); dispatchEvent(new CustomEvent('bigcat:passport-refresh')); onClose(); }
    catch (er) { setErr(er.message); } finally { setBusy(false); }
  };
  const field = (key, label, placeholder) => <label>{label}<input value={f[key]} maxLength={120} placeholder={placeholder} onChange={e => setF({ ...f, [key]: e.target.value })} /></label>;
  return <Modal title="ข้อความในหน้านี้" onClose={onClose}>
    <form className="booking-form pm-text-form" onSubmit={save}>
      <p className="muted small">เว้นว่างไว้ = ใช้ข้อความเริ่มต้น · ข้อความนี้เห็นเฉพาะในสมุดของคุณ</p>
      {field('heading', 'หัวข้อของหน้า', 'เราอยู่ในความทรงจำเดียวกัน')}
      {m.group && field('groupCaption', 'ใต้รูปหมู่', 'วันของพวกเรา ♡')}
      {m.portrait && field('portraitCaption', 'ใต้รูปคู่', 'เธอกับเรา')}
      {field('caption', 'บรรทัดปิดท้าย', 'อีกหนึ่งวันดี ๆ ที่เราได้เจอกัน')}
      {err && <Notice tone="error">{err}</Notice>}
      <div className="form-actions"><button className="button dark small" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button><button type="button" className="link-button" onClick={onClose}>ยกเลิก</button></div>
    </form>
  </Modal>;
}

export default function PassportMemory({ ev, side, onOpen }) {
  const [share, setShare] = useState(false);
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pick, setPick] = useState(null);   // 'portrait' | 'group'
  const [menu, setMenu] = useState(false);
  const gearBox = useRef(null);
  useEffect(() => {
    if (!menu) return;
    const away = (e) => { if (!gearBox.current?.contains(e.target)) setMenu(false); };
    const esc = (e) => { if (e.key === 'Escape') setMenu(false); };
    addEventListener('pointerdown', away); addEventListener('keydown', esc);
    return () => { removeEventListener('pointerdown', away); removeEventListener('keydown', esc); };
  }, [menu]);
  const [open, setOpen] = useState(null);   // index ของรูปที่เปิดดูเต็ม
  const [texts, setTexts] = useState(false);
  if (!ev) return <div className="pc-page-note"><span>♡</span><p>ยังไม่มีความทรงจำในตัวกรองนี้</p></div>;
  const m = eventMemory(ev);
  const state = stampState(ev);
  const makeImage = async () => {
    setShare(true); setBusy(true); setError(''); setImage(null);
    try { setImage((await drawEventMemoryImage(ev)).toDataURL('image/png')); }
    catch { setError('สร้างภาพไม่สำเร็จ กรุณาลองอีกครั้ง'); }
    finally { setBusy(false); }
  };
  if (side === 0) return <div className={`pm-story pm-${m.layout}`}>
    <div className="pm-event-heading"><span className="eyebrow">A DAY TO REMEMBER</span><h3>{ev.title}</h3><small>{eventDate(ev).long}{ev.place ? ` · ${ev.place}` : ''}</small></div>
    <div className="pm-letter-row">{(() => {
      // ไม่ส่ง onOpen มา = แสตมป์กดไม่ได้ (ปิดหน้ารายละเอียดไว้ก่อน แด๊ดสั่ง 19 ก.ย. 2026)
      const caption = <small>{ev.earned ? 'เก็บวันนี้ไว้แล้ว ♡' : state === 'today' ? 'เช็คอินงานเพื่อรับแสตมป์' : state === 'locked' ? 'รอวันได้เจอกัน' : 'งานนี้ผ่านไปแล้ว'}</small>;
      return onOpen
        ? <button type="button" className={`pm-stamp ${state}`} data-event-slug={ev.slug} onClick={() => onOpen(ev)} aria-label={`ดูแสตมป์ ${ev.title}`}><EventStamp ev={ev} state={state} size={164} />{caption}</button>
        : <div className={`pm-stamp ${state}`} data-event-slug={ev.slug}><EventStamp ev={ev} state={state} size={164} />{caption}</div>;
    })()}
      <div className="pm-letter"><span className="pm-tape" aria-hidden="true" /><span className="eyebrow">A LITTLE NOTE</span>
        {m.noteImage ? <button type="button" className="pm-photo-open" onClick={() => setOpen(0)} aria-label="ดูภาพลายมือเต็ม"><img src={m.noteImage} alt={`ข้อความลายมือจาก${m.author}`} /></button> : m.noteText ? <p className="pm-note-text">{m.noteText}</p> : <p className="pm-pending">{ev.earned ? 'กำลังรวบรวมความทรงจำวันของเราอยู่นะ' : 'มาเจอกัน แล้วเก็บเรื่องราวของวันนั้นไว้ด้วยกันนะ'}</p>}
        {m.noteImage && m.noteText && <details><summary>อ่านข้อความ</summary><p>{m.noteText}</p></details>}
        {(m.noteImage || m.noteText) && <span className="pm-signature">จาก {m.author} ♡</span>}
      </div></div>
    {open != null && m.noteImage && <PhotoModal list={[{ src: m.noteImage, alt: `ข้อความลายมือจาก${m.author}` }]} index={0} setIndex={() => {}} onClose={() => setOpen(null)} caption={() => `ข้อความลายมือจาก${m.author} ♡`} />}
  </div>;
  const shots = [m.group && { src: m.group, alt: m.groupCaption, label: m.groupCaption }, m.portrait && { src: m.portrait, alt: m.portraitCaption, label: m.portraitCaption }].filter(Boolean);
  return <div className={`pm-album pm-${m.layout} ${m.group && m.portrait ? 'pm-two-photos' : 'pm-one-photo'}`}>
    <div className="pm-album-heading"><span className="eyebrow">OUR PHOTO MEMORIES</span><h3>{m.heading}</h3></div>
    {ev.earned && ev.phase === 'past' && <div className="pm-gear-wrap" ref={gearBox}>
      <button type="button" className="pm-gear" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)} aria-label="จัดการรูปในหน้านี้"><Icon name="gear" size={17} /></button>
      {menu && <div className="pm-gear-menu" role="menu">
        <button type="button" role="menuitem" onClick={() => { setMenu(false); setPick('portrait'); }}>{m.portrait ? 'เปลี่ยนรูปคู่' : 'เลือกรูปคู่ของฉัน'}</button>
        <button type="button" role="menuitem" onClick={() => { setMenu(false); setPick('group'); }}>{m.group ? 'เปลี่ยนรูปหมู่' : 'เลือกรูปหมู่'}</button>
        <button type="button" role="menuitem" onClick={() => { setMenu(false); setTexts(true); }}>แก้ข้อความในหน้านี้</button>
        {(m.group || m.portrait) && <button type="button" role="menuitem" onClick={() => { setMenu(false); makeImage(); }}>บันทึกภาพหน้านี้ไว้แชร์</button>}
        {m.portrait && ev.memory?.portraitSource === 'auto' && <small>รูปคู่นี้ระบบเลือกให้จากอัลบั้ม{ev.memory.myPhotos > 1 ? ` · มีรูปคุณอีก ${ev.memory.myPhotos - 1} รูป` : ''}</small>}
      </div>}
    </div>}
    <div className="pm-photo-layout">
      {m.group && <MemoryPhoto src={m.group} caption={m.groupCaption} kind="group" onOpen={() => setOpen(0)} />}
      {m.portrait && <MemoryPhoto src={m.portrait} caption={m.portraitCaption} kind="portrait" onOpen={() => setOpen(shots.length - 1)} />}
      {!m.group && !m.portrait && <div className="pm-photo-pending"><span aria-hidden="true">♡</span><strong>{ev.earned ? 'รูปวันดี ๆ กำลังเดินทางมา' : 'หน้าต่อไปของความทรงจำ'}</strong><p>{ev.earned ? 'เมื่อทีมงานเตรียมภาพหลังงานเรียบร้อย เราจะเก็บไว้ให้ตรงนี้' : 'ภาพหลังงานสำหรับสมาชิกที่ได้รับแสตมป์นี้'}</p></div>}
    </div>
    {texts && <TextEditor ev={ev} m={m} onClose={() => setTexts(false)} />}
    {pick && <PortraitPicker ev={ev} tab={pick} onClose={() => setPick(null)} onChanged={() => dispatchEvent(new CustomEvent('bigcat:passport-refresh'))} />}
    {(m.group || m.portrait) && <p className="pm-caption">{m.caption}</p>}
    {open != null && <PhotoModal list={shots} index={open} setIndex={setOpen} onClose={() => setOpen(null)} caption={(p, i) => `${p.label} · ${i + 1}/${shots.length}`} />}
    {share && <Modal title="เก็บหน้านี้ไว้แชร์" onClose={() => setShare(false)}><div className="pm-share-preview">
      {busy && <p role="status">กำลังจัดหน้าความทรงจำของคุณ…</p>}
      {image && <SaveImage url={image} fileName={`bigcat-memory-${ev.slug}.png`} title={ev.title} alt="ภาพความทรงจำแนวตั้ง พร้อมรูปและแสตมป์จากหน้าสมุดนี้" />}
      {error && <><Notice tone="error">{error}</Notice><button type="button" className="button ghost" onClick={makeImage}>ลองอีกครั้ง</button></>}
    </div></Modal>}
  </div>;
}
