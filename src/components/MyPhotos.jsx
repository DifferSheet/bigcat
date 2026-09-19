'use client';
// แท็บ «รูปของฉัน» — ลงทะเบียนใบหน้า (opt-in) แล้วดูรูปที่ระบบเจอว่ามีเราในอัลบั้มแต่ละงาน
// ออกแบบเป็นขั้นตอน 1-2-3 ให้เห็นชัดว่าต้องทำอะไร และปุ่มไม่เคย «ตายเฉย ๆ» — กดแล้วบอกเสมอว่าติดตรงไหน
import React, { useEffect, useRef, useState } from 'react';
import { Link } from '../lib/nav.jsx';
import { Notice } from './EventShell.jsx';
import { Icon, Modal, PageLoader, Tag } from './ui.jsx';
import { api } from '../lib/api.js';
import { eventDate } from '../lib/format.js';
import PhotoModal from './PhotoModal.jsx';

const fmt = (d) => { const x = d ? new Date(String(d).replace(' ', 'T') + (/Z|[+-]\d\d:\d\d$/.test(String(d)) ? '' : 'Z')) : null; return x ? x.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : ''; };

export function PdpaTerms({ provider, onClose }) {
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

/* ---------- ขั้นตอนลงทะเบียนใบหน้า ---------- */
function Register({ st, onDone, onPdpa }) {
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const input = useRef(null);
  useEffect(() => { if (!file) return setUrl(''); const u = URL.createObjectURL(file); setUrl(u); return () => URL.revokeObjectURL(u); }, [file]);

  const sending = useRef(false);
  const submit = async (e) => {
    e?.preventDefault();
    if (sending.current) return;   // กันกดซ้ำ/ดับเบิลแท็บ
    if (!file) return setMsg({ ok: false, text: 'ขั้นที่ 1 ยังไม่เสร็จ — เลือกรูปหน้าของคุณก่อน' });
    if (!consent) return setMsg({ ok: false, text: 'ขั้นที่ 2 ยังไม่เสร็จ — ติ๊กยอมรับข้อกำหนดก่อน' });
    sending.current = true; setBusy(true); setMsg(null);
    try {
      const fd = new FormData(); fd.append('selfie', file); fd.append('consent', 'true');
      const r = await api('/me/face', { method: 'POST', body: fd });
      setFile(null); setConsent(false);
      onDone(r.matches);
    } catch (err) { setMsg({ ok: false, text: err.message }); } finally { sending.current = false; setBusy(false); }
  };

  return <form className="mp-steps" onSubmit={submit}>
    <section className={`mp-step ${file ? 'done' : 'now'}`}>
      <span className="mp-num">{file ? '✓' : '1'}</span>
      <div className="mp-step-body">
        <h3>เลือกรูปหน้าของคุณ 1 รูป</h3>
        <p className="muted small">หน้าตรง เห็นหน้าชัด แสงพอ ไม่ใส่แมสก์/แว่นดำ · เป็นรูปไหนก็ได้ ไม่ต้องเป็นรูปในงาน · ระบบใช้แค่ครั้งเดียวแล้วลบรูปทิ้ง</p>
        <div className="mp-pick">
          {url ? <img className="mp-preview" src={url} alt="รูปที่เลือก" /> : <span className="mp-preview empty"><Icon name="user" size={26} /></span>}
          <div className="mp-pick-actions">
            <input ref={input} type="file" accept="image/*" hidden onChange={e => { setFile(e.target.files?.[0] || null); setMsg(null); e.target.value = ''; }} />
            <button type="button" className="button dark small" onClick={() => input.current?.click()}><Icon name="upload" size={15} /> {file ? 'เลือกรูปอื่น' : 'เลือกรูปจากเครื่อง'}</button>
            {file && <><span className="muted small">{file.name}</span><button type="button" className="link-button" onClick={() => setFile(null)}>เอาออก</button></>}
          </div>
        </div>
      </div>
    </section>

    <section className={`mp-step ${consent ? 'done' : file ? 'now' : ''}`}>
      <span className="mp-num">{consent ? '✓' : '2'}</span>
      <div className="mp-step-body">
        <h3>ยอมรับข้อกำหนดการใช้ข้อมูลใบหน้า</h3>
        <button type="button" className="mp-consent" aria-pressed={consent} onClick={() => { setConsent(!consent); setMsg(null); }}>
          <span className={`mp-tick ${consent ? 'on' : ''}`} aria-hidden="true">{consent ? '✓' : ''}</span>
          <span>ฉันยินยอมให้ BIGCAT ใช้ข้อมูลใบหน้าของฉัน เพื่อหารูปของฉันในอัลบั้มงานที่ฉันเช็คอิน และถอนความยินยอมได้ทุกเมื่อ</span>
        </button>
        <button type="button" className="link-button" onClick={onPdpa}>อ่านข้อกำหนดฉบับเต็ม (เก็บอะไร · ใช้ทำอะไร · ลบอย่างไร)</button>
      </div>
    </section>

    <section className={`mp-step ${file && consent ? 'now' : ''}`}>
      <span className="mp-num">3</span>
      <div className="mp-step-body">
        <h3>ให้ระบบค้นหารูปของคุณ</h3>
        <p className="muted small">ใช้เวลาไม่กี่วินาที · ผลลัพธ์เห็นเฉพาะคุณ · รูปคู่จะถูกเสนอไปแปะใน <Tag>Passport</Tag> ให้อัตโนมัติ (เปลี่ยนเองได้)</p>
        <button className="button dark" disabled={busy}>{busy ? 'กำลังค้นหา…' : 'ลงทะเบียนใบหน้าและค้นหารูป'} <Icon name="check" /></button>
      </div>
    </section>
    {msg && <Notice tone={msg.ok ? 'info' : 'error'}>{msg.text}</Notice>}
    {st.provider === 'rekognition' && <p className="small-note">ประมวลผลด้วย Amazon Rekognition (สิงคโปร์) ภายใต้บัญชีของ BIGCAT</p>}
  </form>;
}

/* ---------- รูปที่ระบบเจอว่ามีเรา ---------- */
function MyPhotoGrid({ data, onChange }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [sel, setSel] = useState([]);          // id ที่เลือกไว้ (ข้ามงานได้)
  const [picking, setPicking] = useState(false);   // โหมดเลือกหลายรูป
  const [open, setOpen] = useState(null);      // index ใน flat
  const flat = data.events.flatMap(ev => ev.photos.map(p => ({ ...p, event: ev })));
  const toggle = (id) => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const act = async (p, verdict) => {
    setBusy(true); setErr('');
    try { await api(`/events/${p.event.slug}/album/${p.id}/${verdict}`, { method: 'POST' }); setOpen(null); await onChange(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const bulkNotMe = async () => {
    if (!sel.length || !confirm(`เอา ${sel.length} รูปออกจาก «รูปของฉัน»?`)) return;
    setBusy(true); setErr(''); setMsg('');
    try { const r = await api('/me/photos/not-me', { method: 'POST', body: { ids: sel } }); setSel([]); setMsg(`เอาออกแล้ว ${r.count} รูป`); await onChange(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  // ดาวน์โหลดหลายรูป = ขอ zip จาก server แล้วบันทึกทีเดียว (เบราว์เซอร์บล็อกการดาวน์โหลดหลายไฟล์พร้อมกัน)
  const bulkDownload = async () => {
    if (!sel.length) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      const res = await fetch('/api/me/photos/zip', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids: sel }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'ดาวน์โหลดไม่สำเร็จ');
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a'); a.href = url; a.download = `bigcat-photos-${sel.length}.zip`; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setMsg(`ดาวน์โหลด ${sel.length} รูปแล้ว`);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  if (!data.total) return <Notice tone="muted">{data.waiting > 0
    ? <>ระบบเจอรูปที่น่าจะเป็นคุณแล้ว <strong>{data.waiting} รูป</strong>{data.waitingEvents?.length ? ` จาก${data.waitingEvents.join(' · ')}` : ''} — แต่อัลบั้มยังไม่เผยแพร่ พอทีมงานเปิดอัลบั้ม รูปจะขึ้นที่นี่ทันที</>
    : <>ยังไม่พบรูปที่มีคุณ — ระบบจะค้นให้อัตโนมัติทุกครั้งที่ทีมงานลงอัลบั้มของงานที่คุณเช็คอิน</>}</Notice>;
  return <div className="mp-events">
    {err && <Notice tone="error">{err}</Notice>}
    {msg && <Notice>{msg}</Notice>}
    {data.waiting > 0 && <Notice tone="muted">อีก {data.waiting} รูปรออัลบั้มเผยแพร่ก่อนถึงจะขึ้นที่นี่</Notice>}
    <div className="mp-toolbar">
      <button type="button" className={`button ${picking ? 'dark' : 'ghost'} small`} onClick={() => { setPicking(!picking); setSel([]); }}>{picking ? 'เสร็จแล้ว' : 'เลือกหลายรูป'}</button>
      {picking && <>
        <button type="button" className="link-button" onClick={() => setSel(sel.length === flat.length ? [] : flat.map(p => p.id))}>{sel.length === flat.length ? 'ล้างที่เลือก' : `เลือกทั้งหมด (${flat.length})`}</button>
        <span className="muted small">{sel.length ? `เลือกไว้ ${sel.length} รูป` : 'แตะรูปเพื่อเลือก'}</span>
      </>}
    </div>
    {picking && sel.length > 0 && <div className="mp-bulk">
      <span>เลือก {sel.length} รูป</span>
      <button className="button dark small" disabled={busy} onClick={bulkDownload}>{busy ? 'กำลังเตรียมไฟล์…' : 'ดาวน์โหลด (.zip)'}</button>
      <button className="link-button danger" disabled={busy} onClick={bulkNotMe}>ไม่ใช่ฉัน</button>
      <button className="link-button" onClick={() => setSel([])}>ยกเลิกการเลือก</button>
    </div>}

    {data.events.map(ev => <section key={ev.slug} className="mp-event">
      <div className="mp-event-head">
        <div><span className="eyebrow">{eventDate(ev).long}</span><h3>{ev.title}</h3></div>
        <span className="muted small">{ev.photos.length} รูป · <Link to={`/events/${ev.slug}/album`}>ดูอัลบั้มทั้งงาน ↗</Link></span>
      </div>
      <div className="mp-grid">{ev.photos.map(p => {
        const on = sel.includes(p.id);
        const i = flat.findIndex(x => x.id === p.id);
        return <figure key={p.id} className={`mp-photo ${busy ? 'busy' : ''} ${picking ? 'picking' : ''} ${on ? 'on' : ''}`}>
          <button type="button" className="mp-photo-open" onClick={() => picking ? toggle(p.id) : setOpen(i)} aria-label={picking ? 'เลือกรูปนี้' : 'ดูรูปเต็ม'}>
            <img src={p.thumb} alt="" loading="lazy" />
            {picking && <span className="mp-check">{on ? '✓' : ''}</span>}
          </button>
          <figcaption>
            <span className={`mini-tag ${p.status === 'confirmed' ? 'ok' : ''}`}>{p.status === 'confirmed' ? 'ยืนยันแล้ว' : `น่าจะคุณ ${p.similarity ? `${Math.round(p.similarity * 100)}%` : ''}`}</span>
            {!picking && <span className="mp-photo-actions">
              {p.status !== 'confirmed' && <button type="button" className="link-button" disabled={busy} onClick={() => act({ ...p, event: ev }, 'me')}>ใช่ฉัน</button>}
              <a className="link-button" href={p.orig} download target="_blank" rel="noreferrer">ดาวน์โหลด</a>
              <button type="button" className="link-button danger" disabled={busy} onClick={() => act({ ...p, event: ev }, 'not-me')}>ไม่ใช่ฉัน</button>
            </span>}
          </figcaption>
        </figure>;
      })}</div>
    </section>)}
    {open != null && <PhotoModal list={flat} index={open} setIndex={setOpen} onClose={() => setOpen(null)}
      caption={(p, i) => `${i + 1} / ${flat.length} · ${p.event.title} · ${p.status === 'confirmed' ? 'ยืนยันแล้วว่าเป็นคุณ' : `ระบบคิดว่าเป็นคุณ${p.similarity ? ` ${Math.round(p.similarity * 100)}%` : ''}`}`}
      actions={(p) => <>
        <a className="button dark small" href={p.orig} download target="_blank" rel="noreferrer">ดาวน์โหลด <Icon name="arrow" size={14} /></a>
        {p.status !== 'confirmed' && <button type="button" className="button ghost small" disabled={busy} onClick={() => act(p, 'me')}>ใช่ นี่ฉัน</button>}
        <button type="button" className="link-button" disabled={busy} onClick={() => act(p, 'not-me')}>ไม่ใช่ฉัน</button>
      </>} />}
  </div>;
}

export default function MyPhotos() {
  const [st, setSt] = useState(null);
  const [photos, setPhotos] = useState(null);
  const [pdpa, setPdpa] = useState(false);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [again, setAgain] = useState(false);   // กดเปลี่ยนรูปหน้าใหม่
  const load = async () => {
    const s = await api('/me/face').catch(() => ({ enabled: false }));
    setSt(s);
    const p = s.registered_at ? await api('/me/photos').catch(() => ({ total: 0, events: [] })) : { total: 0, events: [] };
    setPhotos(p);
    return p;
  };
  useEffect(() => { load(); }, []);
  const forget = async () => {
    if (!confirm('ลบข้อมูลใบหน้าและยกเลิกการจับคู่รูปทั้งหมด?')) return;
    setBusy(true); setMsg(null);
    try { await api('/me/face', { method: 'DELETE' }); setMsg({ ok: true, text: 'ลบข้อมูลใบหน้าและยกเลิกการจับคู่ทั้งหมดแล้ว' }); setAgain(false); await load(); }
    catch (e) { setMsg({ ok: false, text: e.message }); } finally { setBusy(false); }
  };
  if (!st) return <PageLoader />;
  if (!st.enabled) return <Notice tone="muted">ระบบค้นหารูปด้วยใบหน้ายังไม่เปิดใช้งาน</Notice>;
  const registered = !!st.registered_at;

  return <div className="mp-wrap">
    <div className="mp-intro">
      <div>
        <span className="eyebrow">MY PHOTOS</span>
        <h2>หารูปที่มีคุณในอัลบั้มงาน</h2>
        <p>อัปโหลดรูปหน้าของคุณครั้งเดียว ระบบจะหา<strong>รูปที่มีคุณ</strong>ในอัลบั้มของทุกงานที่คุณเช็คอินให้อัตโนมัติ ไม่ต้องไล่ดูทีละรูป และรูปคู่จะถูกเสนอไปแปะใน <Tag>Passport</Tag> ทันทีที่อัลบั้มออก</p>
        <p className="muted small">ไม่บังคับ · เก็บแค่ค่าคุณลักษณะของใบหน้า ไม่เก็บรูปเซลฟี่ · เห็นเฉพาะคุณ · ลบได้ทุกเมื่อ</p>
      </div>
      <div className="mp-status">
        <span className={`mp-badge ${registered ? 'on' : ''}`}>{registered ? 'เปิดใช้อยู่' : 'ยังไม่เปิดใช้'}</span>
        {registered && <>
          <span className="muted small">ลงทะเบียนเมื่อ {fmt(st.registered_at)}</span>
          <strong>{photos?.total || 0} รูปที่มีคุณ</strong>
          {photos?.waiting > 0 && <span className="muted small">อีก {photos.waiting} รูปรออัลบั้มเผยแพร่</span>}
          <div className="mp-manage">
            <button type="button" className="link-button" onClick={() => setAgain(x => !x)}>{again ? 'ยกเลิก' : 'เปลี่ยนรูปหน้า'}</button>
            <button type="button" className="link-button danger" disabled={busy} onClick={forget}>ลบข้อมูลใบหน้า</button>
          </div>
        </>}
      </div>
    </div>
    {msg && <Notice tone={msg.ok ? 'info' : 'error'}>{msg.text}</Notice>}

    {(!registered || again) && <Register st={st} onPdpa={() => setPdpa(true)} onDone={async () => {
      setAgain(false);
      const p = await load();   // บอกตามที่เห็นจริง — รูปที่อัลบั้มยังไม่เผยแพร่ เลื่อนลงไปก็ไม่เจอ
      setMsg({ ok: true, text: p.total > 0 ? `เจอรูปที่น่าจะเป็นคุณ ${p.total} รูป — เลื่อนลงไปดูได้เลย`
        : p.waiting > 0 ? `เจอรูปที่น่าจะเป็นคุณ ${p.waiting} รูป${p.waitingEvents?.length ? ` จาก${p.waitingEvents.join(' · ')}` : ''} — อัลบั้มยังไม่เผยแพร่ พอทีมงานเปิดอัลบั้ม รูปจะขึ้นที่นี่ทันที`
          : 'ลงทะเบียนแล้ว — เมื่อมีอัลบั้มของงานที่คุณเช็คอิน ระบบจะหารูปให้อัตโนมัติ' });
    }} />}

    {registered && (photos ? <MyPhotoGrid data={photos} onChange={load} /> : <PageLoader />)}
    {pdpa && <PdpaTerms provider={st.provider} onClose={() => setPdpa(false)} />}
  </div>;
}
