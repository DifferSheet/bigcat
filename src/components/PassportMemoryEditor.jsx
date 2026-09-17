'use client';
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
  return <fieldset className="mode-pick"><legend>สมุดความทรงจำ · 1 งาน / 1 หน้าคู่</legend>
    <p className="muted small">ส่วนนี้แสดงหลังจบงานสำหรับผู้ได้รับแสตมป์ ภาพลายมือและรูปหมู่เป็นภาพส่วนกลาง ไม่ใช้สำหรับภาพส่วนตัว</p>
    <div className="two"><label>แม่แบบอัลบั้ม<select value={memory.layout || 'auto'} onChange={e => set('layout', e.target.value)}>{[['auto', 'อัตโนมัติตามภาพ'], ['warm', 'วันอบอุ่น'], ['playful', 'วันสนุก'], ['special', 'วันพิเศษ · รูปคู่เด่น'], ['merit', 'วันร่วมบุญ']].map(([v, t]) => <option value={v} key={v}>{t}</option>)}</select></label>
    <label>ข้อความจาก<select value={memory.author || 'boota'} onChange={e => set('author', e.target.value)}><option value="boota">บูตะ</option><option value="nobi">โนบิ</option></select></label></div>
    {[['memoryNote', 'noteImage', 'ภาพข้อความลายมือ'], ['memoryGroup', 'groupImage', 'รูปหมู่']].map(([field, key, title]) => <label key={field}>{title}{memory[key] && !files[field] && <a href={memory[key]} target="_blank" rel="noreferrer">ดูภาพเดิม ↗</a>}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => onFiles({ ...files, [field]: e.target.files?.[0] || null })} /><button type="button" className="link-button" onClick={() => { set(key, ''); onFiles({ ...files, [field]: null }); }}>นำภาพนี้ออก</button></label>)}
    <label>ข้อความถอดจากลายมือ (ให้อ่านบนมือถือได้)<textarea rows={4} value={memory.noteText || ''} onChange={e => set('noteText', e.target.value)} maxLength={5000} /></label>
    <label>คำบรรยายอัลบั้ม<input value={memory.caption || ''} onChange={e => set('caption', e.target.value)} maxLength={500} /></label>
    {slug ? <div className="unlock-box"><strong>รูปคู่เฉพาะสมาชิก · บันทึกแยกจากฟอร์มงาน</strong><p className="small">กรอกรหัสสมาชิกจากหน้าจัดการสมาชิก แล้วตรวจชื่อก่อนส่ง รูปจะเปิดดูได้เฉพาะเจ้าของ Passport</p>
      <label>รหัสสมาชิก<input type="number" min="1" value={memberId} disabled={busy} onChange={e => { setMemberId(e.target.value); setOwner(null); setMessage(''); }} /></label>
      <button type="button" className="button small ghost" disabled={busy || !memberId} onClick={() => action(async () => { const result = await api(`/admin/events/${slug}/passport-portrait/${memberId}`, { admin: true }); setOwner({ ...result, id: memberId }); })}>ตรวจชื่อเจ้าของภาพ</button>
      {owner && <><p>ส่งให้: <strong>{owner.name}</strong> · สมาชิก #{owner.id}</p><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => setPortrait(e.target.files?.[0] || null)} /><button type="button" className="button small dark" disabled={busy || !portrait} onClick={() => action(async () => { const fd = new FormData(); fd.append('portrait', portrait); await api(`/admin/events/${slug}/passport-portrait/${owner.id}`, { method: 'PUT', body: fd, admin: true }); setMessage(`บันทึกรูปให้ ${owner.name} แล้ว`); })}>ยืนยันบันทึกรูปคู่ให้ {owner.name}</button><button type="button" className="link-button" disabled={busy} onClick={() => { if (window.confirm(`นำรูปคู่ออกจาก Passport ของ ${owner.name}?`)) action(async () => { await api(`/admin/events/${slug}/passport-portrait/${owner.id}`, { method: 'DELETE', admin: true }); setMessage('นำรูปคู่ออกจากสมุดแล้ว'); }); }}>นำรูปคู่ออกจากสมุด</button></>}
      {message && <p role="status">{message}</p>}
    </div> : <p className="small">สร้างกิจกรรมก่อน แล้วจึงเพิ่มรูปคู่ให้สมาชิกที่มีแสตมป์ได้</p>}
  </fieldset>;
}
