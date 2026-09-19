'use client';
import React, { useEffect, useState } from 'react';
import { Modal } from './ui.jsx';
import { drawEventMemoryImage } from '../lib/passport-image.js';
import { PASSPORT_SHARE_THEMES, defaultPassportQuote } from '../lib/passport-share-themes.js';

const targets = [
  ['IG Stories', 'https://www.instagram.com/'],
  ['FB Stories', 'https://www.facebook.com/'],
  ['Facebook', 'https://www.facebook.com/'],
  ['TikTok', 'https://www.tiktok.com/'],
  ['X', 'https://x.com/compose/post'],
];

export default function PassportShareModal({ ev, onClose }) {
  const [format, setFormat] = useState('story');
  const [background, setBackground] = useState('linen');
  const [heading, setHeading] = useState(() => defaultPassportQuote(ev));
  const settingsKey = JSON.stringify([format, background, heading]);
  const [asset, setAsset] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState(null);
  useEffect(() => {
    let cancelled = false, url;
    setError(''); setNotice(null);
    const timer = setTimeout(async () => {
      try {
        const canvas = await drawEventMemoryImage(ev, { format, background, heading });
        const blob = await new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('สร้างไฟล์ไม่สำเร็จ')), 'image/png'));
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        const file = new File([blob], `bigcat-memory-${ev.slug}-${format === 'story' ? '9x16' : '4x3'}.png`, { type: 'image/png' });
        setAsset({ url, file, format, key: settingsKey });
      } catch (e) { if (!cancelled) setError(e.message || 'สร้างภาพไม่สำเร็จ กรุณาลองอีกครั้ง'); }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); if (url) URL.revokeObjectURL(url); };
  }, [ev, format, background, heading, settingsKey, retry]);
  const ready = asset?.key === settingsKey;
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
  const saveButton = <button type="button" className="button dark" disabled={!ready || sharing} onClick={download}>บันทึกภาพ PNG ↓</button>;
  return <Modal wide title="แต่งภาพความทรงจำ" onClose={onClose} footer={<div className="ps-mobile-save">{saveButton}</div>}>
    <div className="ps-editor">
      <div className="ps-preview" aria-busy={!ready && !error}>{ready ? <img src={asset.url} alt={`ภาพ Passport ${format === 'story' ? '9:16 กางขึ้น' : '4:3 กางข้าง'}`} /> : error ? <div role="alert"><p>{error}</p><button type="button" className="button ghost" onClick={() => setRetry(n => n + 1)}>ลองอีกครั้ง</button></div> : <p role="status">กำลังจัดหน้าความทรงจำ…</p>}</div>
      <aside className="ps-controls" aria-label="ปรับแต่งภาพ">
        <div className="ps-formats" role="group" aria-label="รูปแบบภาพ">{[['story','9:16'],['landscape','4:3']].map(([value,label]) => <button type="button" key={value} aria-pressed={format === value} disabled={sharing} onClick={() => setFormat(value)}><span className={`ps-ratio-icon ps-ratio-${value}`} aria-hidden="true" />{label}</button>)}</div>
        <div><p className="ps-control-label">พื้นหลัง</p><div className="ps-backgrounds" role="group" aria-label="พื้นหลัง">{PASSPORT_SHARE_THEMES.map(theme => <button type="button" key={theme.id} title={theme.name} aria-label={theme.name} aria-pressed={background === theme.id} onClick={() => setBackground(theme.id)} style={{ '--swatch': theme.color, '--swatch-ink': theme.ink }}><span aria-hidden="true">{background === theme.id ? '✓' : ''}</span><small>{theme.name}</small></button>)}</div></div>
        <label className="ps-heading-label">ข้อความด้านบน<textarea rows={3} maxLength={100} value={heading} onChange={e => setHeading(e.target.value.split('\n').slice(0,2).join('\n'))} /><small>ได้ 2 บรรทัด · สีข้อความและโลโก้ปรับตามพื้นหลัง</small></label>
        <div className="ps-desktop-save">{saveButton}</div>
        <details className="ps-share-more"><summary>แชร์ไปยังแอป</summary><div className="ps-platforms">{targets.map(target => <button type="button" key={target[0]} disabled={!ready || sharing} onClick={() => share(target)}>{target[0]}</button>)}</div><p className="ps-hint" role="status">{notice ? <>{notice.text} · <a href={notice.href} target="_blank" rel="noreferrer">เปิด {notice.name} ↗</a></> : 'เลือกแอปในเมนูแชร์ของเครื่อง หรือบันทึกรูปแล้วอัปโหลดในแอป'}</p></details>
      </aside>
    </div>
  </Modal>;
}
