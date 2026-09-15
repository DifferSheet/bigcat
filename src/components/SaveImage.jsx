'use client';
// ปุ่มบันทึก/แชร์ภาพจาก canvas (data URL) — ตรรกะเดียวกับใบอนุโมทนาบัตร: iOS → แผ่นแชร์ · Android/เดสก์ท็อป → ดาวน์โหลด · ใน LINE → เปิดเบราว์เซอร์นอก
import React from 'react';
import { Icon, Tag } from './ui.jsx';

export default function SaveImage({ url, fileName, title, alt }) {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const inLine = /\bLine\//i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const download = () => { const a = document.createElement('a'); a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove(); };
  const share = async () => {
    try { const blob = await (await fetch(url)).blob(); const file = new File([blob], fileName, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title }); return true; } } catch (e) { if (e.name === 'AbortError') return true; }
    return false;
  };
  const save = async () => {
    if (isIOS) { if (await share()) return; }
    if (inLine && isIOS) { location.href = `${location.pathname}?openExternalBrowser=1`; return; }
    download();
  };
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;
  return <div className="cert-preview">
    <img src={url} alt={alt} />
    <div className="cert-actions">
      <button type="button" className="button dark" onClick={save}>บันทึกภาพ <Icon name="arrow" /></button>
      {canShare && !isIOS && <button type="button" className="button ghost small" onClick={share}>แชร์</button>}
      {inLine && <a className="button ghost small" href={`${location.pathname}?openExternalBrowser=1`}>เปิดใน Safari / Chrome</a>}
    </div>
    <p className="cert-hint">{inLine ? <>ถ้าบันทึกใน LINE ไม่ได้ กดค้างที่รูปแล้วเลือก <Tag>บันทึกรูปภาพ</Tag> หรือกด <Tag>เปิดใน Safari / Chrome</Tag></> : <>ถ้าปุ่มไม่ทำงาน กดค้างที่รูปแล้วเลือก <Tag>บันทึกรูปภาพ</Tag> ได้เลย</>}</p>
  </div>;
}
