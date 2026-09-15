'use client';
// แถบ thumbnail เรียงลำดับ — ลากสลับตำแหน่ง (เมาส์) / ปุ่ม ‹ › (มือถือ) · รายการเป็น path (string) หรือ File ใหม่
import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from './ui.jsx';

export default function ImageStrip({ images, onChange, max = 10 }) {
  const [drag, setDrag] = useState(null);   // index ที่กำลังลาก
  const [over, setOver] = useState(null);   // index ที่เมาส์อยู่เหนือ
  // object URL ของไฟล์ใหม่ — สร้างครั้งเดียวต่อไฟล์ และ revoke เมื่อหายไป
  const urls = useMemo(() => new Map(images.filter(x => x instanceof File).map(f => [f, URL.createObjectURL(f)])), [images]);
  useEffect(() => () => urls.forEach(u => URL.revokeObjectURL(u)), [urls]);
  const src = (x) => (x instanceof File ? urls.get(x) : x);
  const move = (from, to) => { if (from === to || to < 0 || to >= images.length) return; const next = [...images]; const [it] = next.splice(from, 1); next.splice(to, 0, it); onChange(next); };
  const remove = (i) => onChange(images.filter((_, j) => j !== i));
  const add = (list) => onChange([...images, ...Array.from(list || [])].slice(0, max));

  return <div className="img-strip" onDragOver={e => e.preventDefault()}>
    {images.map((x, i) => <figure key={x instanceof File ? `${x.name}-${x.size}` : x} draggable
      className={`${i === 0 ? 'is-cover' : ''} ${drag === i ? 'dragging' : ''} ${over === i && drag !== i ? 'drop-here' : ''}`}
      onDragStart={e => { setDrag(i); e.dataTransfer.effectAllowed = 'move'; }} onDragEnter={() => setOver(i)} onDragEnd={() => { setDrag(null); setOver(null); }}
      onDrop={e => { e.preventDefault(); if (drag != null) move(drag, i); setDrag(null); setOver(null); }}>
      <img src={src(x)} alt="" draggable={false} />
      {i === 0 && <span className="img-strip-tag">ปก</span>}
      {x instanceof File && <span className="img-strip-tag new">ใหม่</span>}
      <div className="img-strip-actions">
        <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="เลื่อนไปก่อนหน้า">‹</button>
        <button type="button" onClick={() => remove(i)} aria-label="เอาภาพออก"><Icon name="close" size={12} /></button>
        <button type="button" onClick={() => move(i, i + 1)} disabled={i === images.length - 1} aria-label="เลื่อนไปถัดไป">›</button>
      </div>
    </figure>)}
    {images.length < max && <label className="img-strip-add"><input type="file" accept="image/*" multiple onChange={e => { add(e.target.files); e.target.value = ''; }} /><Icon name="plus" /><span>เพิ่มภาพ</span></label>}
  </div>;
}
