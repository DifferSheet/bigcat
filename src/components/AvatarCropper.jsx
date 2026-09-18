'use client';
// ครอปรูปประจำตัวเป็นวงกลม — ลากเลื่อน · เลื่อนแถบ/ล้อเมาส์/สองนิ้วเพื่อซูม · ส่งออกเป็น JPG สี่เหลี่ยมจัตุรัส (แสดงผลเป็นวงกลมด้วย .avatar)
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Icon } from './ui.jsx';
import { Notice } from './EventShell.jsx';

const OUT = 512;        // ขนาดไฟล์ผลลัพธ์ (px)
const MAX_ZOOM = 4;

export default function AvatarCropper({ file, onDone, onCancel }) {
  const boxRef = useRef(null);
  const [src, setSrc] = useState('');
  const [img, setImg] = useState(null);          // { w, h } ขนาดจริงหลังหมุนตาม EXIF
  const [size, setSize] = useState(0);           // ด้านของกรอบครอป (px บนจอ)
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 }); // ระยะเลื่อนจุดกลางรูปจากจุดกลางกรอบ
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pointers = useRef(new Map());
  const pinch = useRef(null);

  useEffect(() => {
    const url = URL.createObjectURL(file); setSrc(url);
    const im = new Image();
    im.onload = () => setImg({ w: im.naturalWidth, h: im.naturalHeight });
    im.onerror = () => setErr('เปิดรูปนี้ไม่ได้ ลองเลือกไฟล์ JPG / PNG / WebP');
    im.src = url;
    return () => { im.onload = im.onerror = null; URL.revokeObjectURL(url); };   // StrictMode รัน effect ซ้ำ: กัน onerror จาก URL ที่ revoke ไปแล้ว
  }, [file]);
  useEffect(() => {
    const el = boxRef.current; if (!el) return;
    const measure = () => setSize(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure); ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const base = img && size ? size / Math.min(img.w, img.h) : 1;   // สเกลที่รูปพอดีกรอบ (cover)
  const scale = base * zoom;
  const clamp = (o, z = zoom) => {
    if (!img) return o;
    const s = base * z, mx = Math.max(0, (img.w * s - size) / 2), my = Math.max(0, (img.h * s - size) / 2);
    return { x: Math.min(mx, Math.max(-mx, o.x)), y: Math.min(my, Math.max(-my, o.y)) };
  };
  // ซูมรอบจุดกลางกรอบ: ระยะเลื่อนขยายตามสัดส่วนซูมเพื่อให้จุดกลางเดิมอยู่ที่เดิม
  const setZoomAt = (z) => { z = Math.min(MAX_ZOOM, Math.max(1, z)); setOff(o => clamp({ x: o.x * z / zoom, y: o.y * z / zoom }, z)); setZoom(z); };

  const onPointerDown = (e) => { e.currentTarget.setPointerCapture(e.pointerId); pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pointers.current.size === 2) pinch.current = { d: dist(pointers.current), z: zoom }; };
  const onPointerMove = (e) => {
    const prev = pointers.current.get(e.pointerId); if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size >= 2 && pinch.current) { setZoomAt(pinch.current.z * dist(pointers.current) / pinch.current.d); return; }
    setOff(o => clamp({ x: o.x + e.clientX - prev.x, y: o.y + e.clientY - prev.y }));
  };
  const onPointerUp = (e) => { pointers.current.delete(e.pointerId); if (pointers.current.size < 2) pinch.current = null; };
  // wheel ต้องผูกเองแบบ non-passive (React ผูกเป็น passive → preventDefault ไม่ทำงาน หน้าจะเลื่อนแทน)
  const wheelRef = useRef(null);
  wheelRef.current = (e) => setZoomAt(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08));
  useEffect(() => {
    const el = boxRef.current; if (!el) return;
    const onWheel = (e) => { e.preventDefault(); wheelRef.current(e); };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const save = async () => {
    if (!img) return;
    setBusy(true); setErr('');
    try {
      const im = new Image(); im.src = src; await im.decode();
      const c = document.createElement('canvas'); c.width = OUT; c.height = OUT;
      const x = c.getContext('2d');
      // มุมซ้ายบนของรูปในพิกัดกรอบ → แปลงกรอบ (0..size) กลับเป็นพิกัดรูปต้นฉบับ
      const ix = size / 2 - img.w * scale / 2 + off.x, iy = size / 2 - img.h * scale / 2 + off.y;
      x.fillStyle = '#fff'; x.fillRect(0, 0, OUT, OUT);   // PNG โปร่งใส → พื้นขาว
      x.drawImage(im, -ix / scale, -iy / scale, size / scale, size / scale, 0, 0, OUT, OUT);
      const blob = await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('สร้างรูปไม่สำเร็จ')), 'image/jpeg', 0.9));
      await onDone(blob);
    } catch (e) { setErr(e.message); setBusy(false); }
  };

  const imgStyle = img && size ? { width: img.w * scale, height: img.h * scale, left: size / 2 - img.w * scale / 2 + off.x, top: size / 2 - img.h * scale / 2 + off.y } : { visibility: 'hidden' };
  return <Modal title="จัดรูปประจำตัว" onClose={onCancel}>
    {err && <Notice tone="error">{err}</Notice>}
    <div className="crop-body">
      <div ref={boxRef} className="crop-box" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        {src && <img src={src} alt="" draggable={false} style={imgStyle} />}
        <div className="crop-mask" aria-hidden="true" />
      </div>
      <label className="crop-zoom">
        <Icon name="minus" size={14} />
        <input type="range" min="1" max={MAX_ZOOM} step="0.01" value={zoom} onChange={e => setZoomAt(+e.target.value)} aria-label="ซูม" />
        <Icon name="plus" size={14} />
      </label>
      <p className="muted crop-hint">ลากเพื่อเลื่อนรูป · เลื่อนแถบเพื่อซูม ส่วนในวงกลมคือรูปที่จะแสดง</p>
      <div className="form-actions">
        <button type="button" className="button dark small" disabled={!img || busy} onClick={save}>{busy ? 'กำลังบันทึก…' : <>ใช้รูปนี้ <Icon name="check" size={14} /></>}</button>
        <button type="button" className="link-button" disabled={busy} onClick={onCancel}>ยกเลิก</button>
      </div>
    </div>
  </Modal>;
}

const dist = (m) => { const [a, b] = [...m.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
