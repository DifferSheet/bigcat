'use client';
// «ข้อความลายมือ» ของงาน — ภาพที่ไปโผล่ในกรอบ A LITTLE NOTE ของสมุด passport + ข้อความถอดและคนเขียน
// ตัดช่องที่ซ้ำกับที่อื่นออกแล้ว (แด๊ดสั่ง 19 ก.ย. 2026): เทมเพลตเลือกจากการ์ดด้านบน ·
// รูปหมู่ตั้งจากรูปในอัลบั้ม/ระบบเลือกให้เอง · คำบรรยายสมาชิกเขียนเองในสมุด
import React, { useState } from 'react';
import { api } from '../lib/api.js';

export default function PassportMemoryEditor({ memory, onChange, files, onFiles, slug }) {
  const [memberId, setMemberId] = useState('');
  const [owner, setOwner] = useState(null);
  const [portrait, setPortrait] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const set = (k, v) => onChange({ ...memory, [k]: v });
  const action = async task => { setBusy(true); setMessage(''); try { await task(); } catch (e) { setMessage(e.message); } finally { setBusy(false); } };
  const picked = files.memoryNote || null;
  const preview = picked ? URL.createObjectURL(picked) : memory.noteImage || null;

  return <div className="pme">
    <div className="pme-note">
      <figure className="pme-shot">
        {preview ? <img src={preview} alt="ภาพข้อความลายมือของงานนี้" /> : <span className="pme-empty">ยังไม่มีภาพลายมือ</span>}
        <figcaption>กรอบ A LITTLE NOTE ในสมุด</figcaption>
      </figure>
      <div className="pme-fields">
        <label>ภาพข้อความลายมือ <small>— รูปกระดาษที่น้องเขียนถึงแฟน ๆ ของงานนี้ (ภาพเดียว ใช้กับทุกคนที่มีแสตมป์)</small>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => onFiles({ ...files, memoryNote: e.target.files?.[0] || null })} />
        </label>
        {(memory.noteImage || picked) && <button type="button" className="link-button" onClick={() => { set('noteImage', ''); onFiles({ ...files, memoryNote: null }); }}>นำภาพนี้ออก</button>}
        <label>ข้อความถอดจากลายมือ <small>— ให้คนอ่านลายมือไม่ออกกดอ่านได้ · ไม่มีภาพก็ใช้ข้อความนี้แทน</small>
          <textarea rows={4} value={memory.noteText || ''} onChange={e => set('noteText', e.target.value)} maxLength={5000} />
        </label>
        <label>ลายเซ็นท้ายโน้ต<select value={memory.author || 'boota'} onChange={e => set('author', e.target.value)}><option value="boota">จาก บูตะ ♡</option><option value="nobi">จาก โนบิ ♡</option></select></label>
      </div>
    </div>

    {slug ? <details className="pme-portrait">
      <summary>ส่งรูปคู่ให้สมาชิกรายคน <small>— ปกติไม่ต้องใช้ ระบบจับคู่ใบหน้าให้เอง และสมาชิกเลือกรูปเองได้ในสมุด</small></summary>
      <p className="small">กรอกรหัสสมาชิกจากหน้าจัดการสมาชิก แล้วตรวจชื่อก่อนส่ง รูปจะเปิดดูได้เฉพาะเจ้าของ Passport</p>
      <label>รหัสสมาชิก<input type="number" min="1" value={memberId} disabled={busy} onChange={e => { setMemberId(e.target.value); setOwner(null); setMessage(''); }} /></label>
      <button type="button" className="button small ghost" disabled={busy || !memberId} onClick={() => action(async () => { const result = await api(`/admin/events/${slug}/passport-portrait/${memberId}`, { admin: true }); setOwner({ ...result, id: memberId }); })}>ตรวจชื่อเจ้าของภาพ</button>
      {owner && <><p>ส่งให้: <strong>{owner.name}</strong> · สมาชิก #{owner.id}</p>
        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => setPortrait(e.target.files?.[0] || null)} />
        <button type="button" className="button small dark" disabled={busy || !portrait} onClick={() => action(async () => { const fd = new FormData(); fd.append('portrait', portrait); await api(`/admin/events/${slug}/passport-portrait/${owner.id}`, { method: 'PUT', body: fd, admin: true }); setMessage(`บันทึกรูปให้ ${owner.name} แล้ว`); })}>ยืนยันบันทึกรูปคู่ให้ {owner.name}</button>
        <button type="button" className="link-button" disabled={busy} onClick={() => { if (window.confirm(`นำรูปคู่ออกจาก Passport ของ ${owner.name}?`)) action(async () => { await api(`/admin/events/${slug}/passport-portrait/${owner.id}`, { method: 'DELETE', admin: true }); setMessage('นำรูปคู่ออกจากสมุดแล้ว'); }); }}>นำรูปคู่ออกจากสมุด</button></>}
      {message && <p role="status">{message}</p>}
    </details> : <p className="small">สร้างกิจกรรมก่อน แล้วจึงเพิ่มรูปคู่ให้สมาชิกที่มีแสตมป์ได้</p>}
  </div>;
}
