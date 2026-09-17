'use client';
// หน้าบัญชี → «รูปของฉันในอัลบั้มงาน» (opt-in): อธิบายว่าได้อะไร · ข้อกำหนด PDPA แบบเต็มเมื่อกดอ่าน · ต้องติ๊กยินยอมก่อนอัปโหลด · ลบได้ทุกเมื่อ
import React, { useEffect, useState } from 'react';
import { Link } from '../lib/nav.jsx';
import { Notice, Section } from './EventShell.jsx';
import { Icon, Modal, Tag } from './ui.jsx';
import { FileDrop } from './forms.jsx';
import { api } from '../lib/api.js';

const fmt = (d) => { const x = d ? new Date(String(d).replace(' ', 'T') + (String(d).includes('Z') ? '' : 'Z')) : null; return x ? x.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : ''; };

function Pdpa({ provider, onClose }) {
  return <Modal title="ข้อกำหนดการใช้ข้อมูลใบหน้า" onClose={onClose}>
    <div className="pdpa-text">
      <p><strong>ข้อมูลที่เก็บ</strong> — เมื่อคุณอัปโหลดรูปหน้าของตัวเอง ระบบจะแปลงใบหน้าเป็น "ค่าคุณลักษณะ" (ชุดตัวเลขที่ใช้เทียบความคล้าย ย้อนกลับเป็นรูปไม่ได้) แล้ว<strong>ลบไฟล์รูปที่คุณอัปโหลดทิ้งทันที</strong> ไม่มีรูปเซลฟี่เก็บอยู่ในระบบ</p>
      <p><strong>นำไปใช้ทำอะไร</strong> — เทียบกับใบหน้าในอัลบั้มรูปของงานที่คุณเช็คอิน เพื่อหา <Tag>รูปที่มีคุณ</Tag> และเสนอเป็นรูปคู่ใน Passport ของคุณเท่านั้น ไม่ใช้ระบุตัวตนในที่อื่น ไม่ใช้โฆษณา ไม่ส่งต่อให้ใคร และไม่มีใครค้นหารูปของคุณด้วยใบหน้าได้นอกจากตัวคุณ</p>
      <p><strong>รูปในอัลบั้ม</strong> — ระบบสแกนเฉพาะรูปเดี่ยวและรูปคู่ (1–3 คน) ที่ทีมงานอัปโหลด รูปหมู่ไม่ถูกนำไปจับคู่ · การจับคู่เป็นการคาดเดา คุณกด <Tag>ไม่ใช่ฉัน</Tag> ได้ และผลจะแสดงให้เฉพาะคุณเห็น</p>
      <p><strong>ผู้ประมวลผล</strong> — {provider === 'rekognition' ? <>ค่าคุณลักษณะประมวลผลและเก็บด้วยบริการ Amazon Rekognition (AWS ภูมิภาคสิงคโปร์) ภายใต้บัญชีของ BIGCAT · AWS ไม่ใช้ข้อมูลนี้เพื่อวัตถุประสงค์อื่น</> : <>ประมวลผลบนเซิร์ฟเวอร์ของ BIGCAT เอง ไม่ส่งข้อมูลไปยังผู้ให้บริการภายนอก</>}</p>
      <p><strong>ระยะเวลา</strong> — เก็บจนกว่าคุณจะกด <Tag>ลบข้อมูลใบหน้า</Tag> หรือปิดบัญชี เมื่อลบ ระบบจะลบค่าคุณลักษณะและยกเลิกการจับคู่ทั้งหมดทันที (รูปที่คุณเลือกไว้ใน Passport ด้วยตัวเองยังอยู่)</p>
      <p><strong>สิทธิ์ของคุณ</strong> — ถอนความยินยอม ลบข้อมูล ขอดูข้อมูล หรือขอให้เอารูปของคุณออกจากอัลบั้มได้ทุกเมื่อ ผ่านปุ่มในหน้านี้และในอัลบั้ม หรือติดต่อทีมงานทาง LINE OA · การไม่ยินยอมไม่กระทบสิทธิ์อื่นใดในการใช้เว็บ</p>
      <p className="muted small">อ่านนโยบายความเป็นส่วนตัวฉบับเต็มได้ที่ <Link to="/privacy">ความเป็นส่วนตัว</Link></p>
    </div>
  </Modal>;
}

export default function FaceSection() {
  const [st, setSt] = useState(null);
  const [file, setFile] = useState(null);
  const [consent, setConsent] = useState(false);
  const [pdpa, setPdpa] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);   // { ok, text }
  const load = () => api('/me/face').then(setSt).catch(() => setSt({ enabled: false }));
  useEffect(() => { load(); }, []);
  const submit = async (e) => {
    e.preventDefault(); if (!file) return setMsg({ ok: false, text: 'เลือกรูปหน้าของคุณก่อน' });
    setBusy(true); setMsg(null);
    try { const fd = new FormData(); fd.append('selfie', file); fd.append('consent', String(consent)); const r = await api('/me/face', { method: 'POST', body: fd }); setFile(null); setMsg({ ok: true, text: r.matches > 0 ? `ลงทะเบียนแล้ว — พบรูปที่น่าจะเป็นคุณ ${r.matches} รูป` : 'ลงทะเบียนแล้ว — เมื่อมีอัลบั้มงานที่คุณเช็คอิน ระบบจะหารูปให้อัตโนมัติ' }); load(); }
    catch (err) { setMsg({ ok: false, text: err.message }); } finally { setBusy(false); }
  };
  const remove = async () => { setBusy(true); setMsg(null); try { await api('/me/face', { method: 'DELETE' }); setMsg({ ok: true, text: 'ลบข้อมูลใบหน้าและยกเลิกการจับคู่ทั้งหมดแล้ว' }); load(); } catch (err) { setMsg({ ok: false, text: err.message }); } finally { setBusy(false); } };
  if (!st) return null;
  if (!st.enabled) return null;
  const registered = !!st.registered_at;
  return <Section eyebrow="MY PHOTOS" title="รูปของฉันในอัลบั้มงาน" className="face-section">
    <div id="face" className="face-box">
      <div className="face-copy">
        <p><strong>ทำแล้วได้อะไร</strong> — อัปโหลดรูปหน้าของคุณ 1 รูป ระบบจะหา<strong>รูปที่มีคุณ</strong>ในอัลบั้มของทุกงานที่คุณเช็คอินให้อัตโนมัติ ไม่ต้องไล่ดูทีละรูป และรูปคู่ของคุณจะถูกเสนอไปแปะใน <Tag>Passport</Tag> ทันทีที่อัลบั้มงานออก</p>
        <p className="muted small">ไม่บังคับ · ระบบเก็บแค่ค่าคุณลักษณะของใบหน้า ไม่เก็บรูปเซลฟี่ · ไม่มีใครค้นรูปคุณได้นอกจากคุณ · ลบได้ทุกเมื่อ — <button type="button" className="link-button inline" onClick={() => setPdpa(true)}>อ่านข้อกำหนดการใช้ข้อมูลใบหน้า</button></p>
      </div>
      {registered
        ? <div className="face-status">
          <Notice>ลงทะเบียนใบหน้าแล้วเมื่อ {fmt(st.registered_at)} ✓{st.matches?.length > 0 ? <> — พบรูปของคุณใน {st.matches.map(m => <Link key={m.slug} to={`/events/${m.slug}/album`}>{m.title} ({m.n})</Link>).reduce((a, b) => [a, ' · ', b])}</> : ' — ยังไม่มีอัลบั้มที่พบรูปของคุณ'}</Notice>
          <div className="form-actions"><button type="button" className="link-button" onClick={() => setSt({ ...st, registered_at: null, _re: true })}>เปลี่ยนรูปหน้า</button><button type="button" className="link-button danger" disabled={busy} onClick={remove}>ลบข้อมูลใบหน้า</button></div>
        </div>
        : <form className="booking-form face-form" onSubmit={submit}>
          <FileDrop id="face-file" accept="image/*" file={file} onChange={setFile} label="รูปหน้าตรงของคุณ 1 รูป" hint="หน้าชัด แสงพอ ไม่ใส่แมสก์/แว่นดำ · ไม่ต้องเป็นรูปในงาน" />
          <label className="check"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> <span>ฉันยินยอมให้ BIGCAT ใช้ข้อมูลใบหน้าของฉันเพื่อหารูปของฉันในอัลบั้มงาน ตาม<button type="button" className="link-button inline" onClick={() => setPdpa(true)}>ข้อกำหนดการใช้ข้อมูลใบหน้า</button></span></label>
          <div className="form-actions"><button className="button dark small" disabled={busy || !consent || !file}>{busy ? 'กำลังประมวลผล…' : 'ลงทะเบียนใบหน้า'} <Icon name="check" size={14} /></button>{st._re && <button type="button" className="link-button" onClick={load}>ยกเลิก</button>}</div>
        </form>}
      {msg && <Notice tone={msg.ok ? 'info' : 'error'}>{msg.text}</Notice>}
    </div>
    {pdpa && <Pdpa provider={st.provider} onClose={() => setPdpa(false)} />}
  </Section>;
}
