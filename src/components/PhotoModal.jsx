'use client';
// ดูรูปเต็มแบบ modal — ใช้ร่วมกันทั้งสมุด passport และหน้ารูปของฉัน (ลูกศรซ้าย/ขวา · Esc ปิด · กดพื้นหลังปิด)
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './ui.jsx';

export default function PhotoModal({ list, index, setIndex, onClose, caption, actions }) {
  const p = list[index];
  useEffect(() => {
    const key = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIndex(i => Math.min(list.length - 1, i + 1));
      if (e.key === 'ArrowLeft') setIndex(i => Math.max(0, i - 1));
    };
    addEventListener('keydown', key); return () => removeEventListener('keydown', key);
  }, [list.length, onClose, setIndex]);
  const [host, setHost] = useState(null);
  const box = useRef(null);
  useEffect(() => { setHost(document.body); }, []);
  // ใช้ <dialog> + showModal เพราะสมุด passport เองก็เป็น dialog (top layer) — z-index ธรรมดาสู้ไม่ได้
  useEffect(() => { if (host && box.current && !box.current.open) box.current.showModal(); }, [host]);
  if (!p || !host) return null;
  return createPortal(<dialog ref={box} className="lightbox lb-top" aria-label="ดูภาพเต็ม" onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <button className="lb-close icon-button" aria-label="ปิด" onClick={onClose}><Icon name="close" /></button>
    {index > 0 && <button className="lb-nav prev" aria-label="รูปก่อนหน้า" onClick={() => setIndex(index - 1)}>‹</button>}
    {index < list.length - 1 && <button className="lb-nav next" aria-label="รูปถัดไป" onClick={() => setIndex(index + 1)}>›</button>}
    <figure>
      <img src={p.src || p.view} alt={p.alt || ''} />
      <figcaption>
        <span className="muted">{caption ? caption(p, index) : `${index + 1} / ${list.length}`}</span>
        {actions && <div className="lb-actions">{actions(p, index)}</div>}
      </figcaption>
    </figure>
  </dialog>, host);
}
