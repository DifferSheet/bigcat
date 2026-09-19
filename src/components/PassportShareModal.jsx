'use client';
import React, { useEffect, useState } from 'react';
import { Modal } from './ui.jsx';
import { drawEventMemoryImage } from '../lib/passport-image.js';

const targets = [
  ['IG Stories', 'https://www.instagram.com/'],
  ['FB Stories', 'https://www.facebook.com/'],
  ['Facebook', 'https://www.facebook.com/'],
  ['TikTok', 'https://www.tiktok.com/'],
  ['X', 'https://x.com/compose/post'],
];

export default function PassportShareModal({ ev, onClose }) {
  const [format, setFormat] = useState('story');
  const [asset, setAsset] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState(null);
  useEffect(() => {
    let cancelled = false, url;
    setAsset(null); setError(''); setNotice(null);
    (async () => {
      try {
        const canvas = await drawEventMemoryImage(ev, { format });
        const blob = await new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('สร้างไฟล์ไม่สำเร็จ')), 'image/png'));
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        const file = new File([blob], `bigcat-memory-${ev.slug}-${format === 'story' ? '9x16' : '4x3'}.png`, { type: 'image/png' });
        setAsset({ url, file, format });
      } catch (e) { if (!cancelled) setError(e.message || 'สร้างภาพไม่สำเร็จ กรุณาลองอีกครั้ง'); }
    })();
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [ev, format, retry]);
  const ready = asset?.format === format;
  const download = () => {
    if (!ready) return;
    const a = document.createElement('a'); a.href = asset.url; a.download = asset.file.name;
    document.body.appendChild(a); a.click(); a.remove();
  };
  const share = async ([name, href]) => {
    if (!ready || sharing) return;
    setNotice({ text: `เลือก ${name} ในเมนูแชร์ของเครื่อง หากไม่พบ ให้บันทึกรูปแล้วเลือกภาพจากแอป`, href, name });
    if (navigator.canShare?.({ files: [asset.file] })) {
      setSharing(true);
      try { await navigator.share({ files: [asset.file] }); }
      catch (e) {
        if (e.name !== 'AbortError') setNotice({ text: `แชร์ไฟล์ไม่ได้ในเครื่องนี้ กดบันทึกภาพ แล้วเปิด ${name} เพื่อเลือกรูป`, href, name });
      } finally { setSharing(false); }
    } else {
      download();
      setNotice({ text: `บันทึกรูปแล้ว เปิด ${name} แล้วเลือกรูปที่ดาวน์โหลด${name.includes('Stories') ? 'เพื่อสร้าง Story' : 'เพื่อสร้างโพสต์'}`, href, name });
    }
  };
  return <Modal wide title="บันทึกความทรงจำไว้แชร์" onClose={onClose}
    toolbar={<div className="ps-formats" role="group" aria-label="รูปแบบภาพ"><button type="button" aria-pressed={format === 'story'} disabled={sharing} onClick={() => setFormat('story')}>9:16 · เปิดขึ้น <small>2160 × 3840</small></button><button type="button" aria-pressed={format === 'landscape'} disabled={sharing} onClick={() => setFormat('landscape')}>4:3 · เปิดข้าง <small>2400 × 1800</small></button></div>}
    footer={<div className="ps-actions"><button type="button" className="button dark" disabled={!ready || sharing} onClick={download}>บันทึกภาพ PNG ↓</button><div className="ps-platforms" aria-label="แชร์ไปยัง">{targets.map(target => <button type="button" key={target[0]} disabled={!ready || sharing} onClick={() => share(target)}>{target[0]}</button>)}</div><p className="ps-hint" role="status">{notice ? <>{notice.text} · <a href={notice.href} target="_blank" rel="noreferrer">เปิด {notice.name} ↗</a></> : 'มือถือ: เลือกแอปในเมนูแชร์ · หากไม่รองรับ ให้บันทึกรูปแล้วอัปโหลดในแอป'}</p></div>}>
    <div className="ps-preview" aria-busy={!ready && !error}>{ready ? <img src={asset.url} alt={`ภาพ Passport ${format === 'story' ? '9:16 กางขึ้น' : '4:3 กางข้าง'}`} /> : error ? <div role="alert"><p>{error}</p><button type="button" className="button ghost" onClick={() => setRetry(n => n + 1)}>ลองอีกครั้ง</button></div> : <p role="status">กำลังจัดหน้าความทรงจำ…</p>}</div>
  </Modal>;
}
