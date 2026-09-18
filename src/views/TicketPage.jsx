'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from '../lib/nav.jsx';
import { drawQr } from '../lib/qr.js';
import { SiteHeader, SiteFooter, LineNotify } from '../components/EventShell.jsx';
import { Icon, Paw, PageLoader, Tag } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { eventDate, baht } from '../lib/format.js';
import { drawMeritCertificate } from '../lib/merit-certificate.js';

const bookingStatus = { pending: ['รอตรวจสอบสลิป', 'muted'], paid: ['ชำระแล้ว · ใช้เข้างานได้', 'open'], rejected: ['ไม่ผ่านการตรวจสอบ', 'full'], checked_in: ['เช็คอินแล้ว', 'live'] };
const donationStatus = { pending: ['รอตรวจสอบ', 'muted'], approved: ['ยืนยันแล้ว', 'open'], rejected: ['ไม่ผ่านการตรวจสอบ', 'full'] };

// QR บนบัตรชี้ไปหน้าบัตรเอง /ticket/รหัส — แฟนสแกนเห็นบัตรตัวเอง · มือถือของพี่ ๆ ที่ล็อกอินแอดมินอยู่จะเห็นแถบ «ยืนยันเช็คอิน» ด้านบนบัตร (ไม่เปิดเผยพาธหน้าจัดการใน QR)
function QR({ value }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) drawQr(ref.current, `${location.origin}/ticket/${value}`, { size: 180 }); }, [value]);
  return <canvas ref={ref} className="qr" aria-label={`QR code ${value}`} />;
}

// แถบทีมงาน — โผล่เฉพาะเครื่องที่มี session แอดมิน (สแกน QR ด้วยแอปกล้อง → เปิดหน้านี้ → กดยืนยันได้เลย)
function StaffCheckin({ item, onDone }) {
  const [t, setT] = useState(null);      // ข้อมูลบัตรจาก /admin/checkin/:code (ยังไม่เช็คอิน)
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);  // { ok, text }
  useEffect(() => { setT(null); setMsg(null); api('/admin/me').then(() => api(`/admin/checkin/${item.code}`, { admin: true })).then(setT).catch(() => {}); }, [item.code]);
  if (!t) return null;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  const eventDay = t.starts_at ? new Date(t.starts_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }) : today;
  const unpaid = t.kind === 'booking' && !t.already && t.status !== 'paid';
  const go = async () => {
    setBusy(true);
    try { const r = await api(`/admin/checkin/${item.code}`, { method: 'POST', admin: true }); setMsg({ ok: true, text: r.already ? 'บัตรนี้เช็คอินไปแล้ว' : 'เช็คอินสำเร็จ ✓' }); setT({ ...t, already: true }); onDone(); }
    catch (e) { setMsg({ ok: false, text: e.message }); } finally { setBusy(false); }
  };
  return <div className="staff-checkin">
    <div className="grow"><span className="eyebrow">โหมดทีมงาน · {t.title}</span><strong>{t.nickname || t.name}{t.kind === 'booking' ? ` · ที่นั่ง ${(t.seats || []).join(', ')}` : ` · #${String(t.number).padStart(3, '0')}`}</strong>
      {msg ? <small>{msg.text}</small>
        : t.already ? <small>เช็คอินไปแล้ว{t.checked_in_at ? ` เมื่อ ${new Date(t.checked_in_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'short', timeStyle: 'short' })}` : ''}</small>
          : unpaid ? <small>ยังไม่ได้ยืนยันการชำระเงิน ({t.status}) — เช็คอินไม่ได้</small>
            : eventDay !== today ? <small>⚠ วันนี้ยังไม่ใช่วันงาน ({new Date(t.starts_at).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium' })})</small>
              : <small>ตรวจชื่อแล้วกดยืนยัน</small>}
    </div>
    {!t.already && !unpaid && !msg?.ok && <button className="button light" onClick={go} disabled={busy}>ยืนยันเช็คอิน <Icon name="check" /></button>}
    <Link className="staff-link" to="/admin">หน้าจัดการ</Link>
  </div>;
}

// เช็คอินด้วยตัวเองบนบัตร (งานที่ตั้ง checkinMode = self) — เปิดเมื่องานกำลังจัด
function SelfCheckin({ item, onDone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (item.checked_in_at) return null;
  if ((item.checkin_mode || 'self') === 'staff') return <p className="notice muted">ถึงหน้างานแล้วแสดง QR ด้านข้างให้พี่ ๆ ที่ดูแลสแกนเพื่อเช็คอิน</p>;
  if (item.checkin_mode === 'gate') return <p className="notice muted">ถึงหน้างานแล้วสแกน QR ที่จุดเช็คอินด้วยกล้องมือถือ แล้วกด <Tag>เช็คอิน</Tag> — หรือแสดง QR ด้านข้างให้พี่ ๆ สแกนก็ได้</p>;
  // หน้าต่างเวลาเช็คอิน (ถ้าตั้ง) ตัดสินแทนสถานะ live
  const win = typeof item.checkin_window === 'string' ? JSON.parse(item.checkin_window || 'null') : item.checkin_window;
  const fmt = (ms) => new Date(ms).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });
  if (win && item.starts_at) {
    const st = new Date(String(item.starts_at).replace(' ', 'T') + '+07:00').getTime(), opens = st - (win.before ?? 0) * 60e3, closes = st + (win.after ?? 0) * 60e3, now = Date.now();
    if (now < opens) return <p className="notice muted">เช็คอินเปิดเวลา {fmt(opens)} น. (ถึง {fmt(closes)} น.) — หรือแสดง QR ให้พี่ ๆ หน้างานสแกนก็ได้</p>;
    if (now > closes) return <p className="notice muted">ปิดเช็คอินแล้วเมื่อ {fmt(closes)} น. — ถ้ามีเหตุจำเป็น แสดง QR ให้พี่ ๆ หน้างานพิจารณา</p>;
  } else if (item.event_status !== 'live') return <p className="notice muted">ปุ่มเช็คอินจะเปิดเมื่อถึงเวลางาน — หรือแสดง QR ให้พี่ ๆ หน้างานสแกนก็ได้</p>;
  const go = async () => {
    setBusy(true); setError('');
    try { await api(`/registrations/${item.code}/checkin`, { method: 'POST' }); onDone(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return <div className="self-checkin"><p>มาถึงหน้างานแล้วใช่ไหม กดเช็คอินได้เลย หรือแสดง QR ให้พี่ ๆ สแกน</p><button className="button dark" onClick={go} disabled={busy}>ฉันมาถึงแล้ว <Icon name="check" /></button>{error && <p className="notice error">{error}</p>}</div>;
}

// ชื่อบนใบ: ทำบุญโดยไม่ใส่ชื่อ แต่เจ้าของรายการล็อกอินมาเปิดเอง → เซิร์ฟเวอร์ส่ง certificate_name (ชื่อบัญชี) มาให้
const certificateName = (item) => item.certificate_name || item.donor_name || 'ผู้ไม่ประสงค์ออกนาม';

// ใบอนุโมทนาเป็นภาพขนาด IG Story (1080×1920) วาดด้วย canvas ฝั่ง client
async function drawCertificate(item) {
  if (item.slug === 'merit-vassa-2026') return drawMeritCertificate(item);
  const W = 1080, H = 1920;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  // ชื่อ family จริงมาจาก next/font (hashed) — อ่านจาก CSS variable แล้วโหลดก่อนวาด
  const cs = getComputedStyle(document.documentElement);
  const F = { head: cs.getPropertyValue('--font-head').trim() || 'sans-serif', body: cs.getPropertyValue('--font-body').trim() || 'sans-serif', display: cs.getPropertyValue('--font-display').trim() || 'sans-serif' };
  await Promise.all([`600 64px ${F.head}`, `500 72px ${F.head}`, `700 110px ${F.display}`, `400 36px ${F.body}`].map(f => document.fonts.load(f).catch(() => {})));
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#fff8e6'); g.addColorStop(1, '#fcf8f1');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // ภาพปกด้านบน (ครอปเป็นสี่เหลี่ยม)
  if (item.cover) {
    const img = new Image(); img.src = item.cover;
    await new Promise(r => { img.onload = r; img.onerror = r; });
    if (img.naturalWidth) {
      const size = 760, sx = (img.naturalWidth - Math.min(img.naturalWidth, img.naturalHeight)) / 2, sy = (img.naturalHeight - Math.min(img.naturalWidth, img.naturalHeight)) / 2, side = Math.min(img.naturalWidth, img.naturalHeight);
      x.save(); x.beginPath(); x.roundRect((W - size) / 2, 140, size, size, 48); x.clip(); x.drawImage(img, sx, sy, side, side, (W - size) / 2, 140, size, size); x.restore();
    }
  }
  const center = (text, y, font, color = '#33332f') => { x.font = font; x.fillStyle = color; x.textAlign = 'center'; x.fillText(text, W / 2, y); };
  center('ใบอนุโมทนาบัตร', 1000, `600 64px ${F.head}`);
  center(item.title, 1070, `400 36px ${F.body}`, '#8c7460');
  center(certificateName(item), 1200, `500 72px ${F.head}`, '#df8190');
  if (item.dedication) center(item.dedication, 1265, `400 40px ${F.body}`, '#8c7460');
  // หลายหมวดในครั้งเดียว → «ข้าวสาร + น้ำดื่ม 2 ชุด · อาสนะ» · หมวดเดียวเหมือนเดิม
  const detail = item.items?.length ? item.items.map(i => `${i.category}${i.units ? ` ${i.units} ${i.unit_name}` : ''}`).join(' · ') : `${item.units ? `${item.units} ${item.unit_name} · ` : ''}${item.category}`;
  center(detail, 1380, `400 40px ${F.body}`);
  center(`฿${Number(item.amount).toLocaleString('th-TH')}`, 1500, `700 110px ${F.display}`, '#33332f');
  center('ขอให้ความสุขเล็ก ๆ ที่คุณส่งให้ ย้อนกลับมาเป็นความสุขก้อนใหญ่ ♡', 1600, `400 34px ${F.body}`, '#8c7460');
  center(`${eventDate(item).long}`, 1660, `400 32px ${F.body}`, '#8c7460');
  center('BIGCAT', 1800, `700 64px ${F.display}`);
  center(item.code, 1850, `400 28px ${F.body}`, '#8c7460');
  return c.toDataURL('image/png');
}

function CertificateButton({ item }) {
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState(null);
  const [error, setError] = useState('');
  const make = async () => { setBusy(true); setError(''); try { setUrl(await drawCertificate(item)); } catch (e) { setError(e.message || 'สร้างภาพไม่สำเร็จ กรุณาลองอีกครั้ง'); } finally { setBusy(false); } };
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const inLine = /\bLine\//i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const fileName = `anumodana-${item.code}.png`;
  const download = () => { const a = document.createElement('a'); a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove(); };
  const share = async () => {
    try { const blob = await (await fetch(url)).blob(); const file = new File([blob], fileName, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'ใบอนุโมทนาบัตร BIGCAT' }); return true; } } catch (e) { if (e.name === 'AbortError') return true; }
    return false;
  };
  // บันทึก: Android/เดสก์ท็อป → ดาวน์โหลดตรง (เข้าแกลเลอรี/Downloads) · iOS → แผ่นแชร์ (มี «บันทึกรูปภาพ») · ใน LINE ที่ทำไม่ได้ → เปิดเบราว์เซอร์นอก
  const save = async () => {
    if (isIOS) { if (await share()) return; }
    if (inLine && isIOS) { location.href = `${location.pathname}?openExternalBrowser=1`; return; }
    download();
  };
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;
  if (url) return <div className="cert-preview">
    <img src={url} alt="ใบอนุโมทนาบัตร" />
    <div className="cert-actions">
      <button type="button" className="button dark" onClick={save}>บันทึกภาพ <Icon name="arrow" /></button>
      {canShare && !isIOS && <button type="button" className="button ghost small" onClick={share}>แชร์</button>}
      {inLine && <a className="button ghost small" href={`${location.pathname}?openExternalBrowser=1`}>เปิดใน Safari / Chrome</a>}
    </div>
    <p className="cert-hint">{inLine ? <>ถ้าบันทึกใน LINE ไม่ได้ กดค้างที่รูปแล้วเลือก <Tag>บันทึกรูปภาพ</Tag> หรือกด <Tag>เปิดใน Safari / Chrome</Tag> แล้วบันทึกจากที่นั่น</> : <>ถ้าปุ่มไม่ทำงาน กดค้างที่รูปแล้วเลือก <Tag>บันทึกรูปภาพ</Tag> ได้เลย</>}</p>
  </div>;
  return <><button className="button dark" onClick={make} disabled={busy}>{busy ? 'กำลังสร้างภาพ…' : 'สร้างใบอนุโมทนาเป็นภาพ (IG Story)'} <Icon name="heart" /></button>{error && <p className="notice error" role="alert">{error}</p>}</>;
}

// ค้นหาบัตรจากรหัส: ลองการจอง → ลงทะเบียน → ทำบุญ
async function lookup(code) {
  for (const [kind, path] of [['booking', '/bookings/'], ['registration', '/registrations/'], ['donation', '/donations/']]) {
    try { return { kind, item: await api(path + code) }; } catch (e) { if (e.status !== 404) throw e; }
  }
  throw new Error('ไม่พบรหัสนี้ ตรวจสอบตัวสะกดอีกครั้ง');
}

export default function TicketPage({ code }) {
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: code !== 'lookup' });
  const [input, setInput] = useState('');
  useEffect(() => {
    if (code === 'lookup') return setState({});
    setState({ loading: true });
    lookup(code.toUpperCase()).then(r => setState(r)).catch(e => setState({ error: e.message }));
  }, [code]);

  const body = () => {
    if (code === 'lookup' || state.error) return <div className="ticket-lookup">
      <span className="eyebrow">MY TICKET</span><h1>ค้นหาบัตรของฉัน</h1>
      <p>ใส่รหัส 8 หลักที่ได้รับตอนจอง ลงทะเบียน หรือแจ้งยอดทำบุญ</p>
      <form onSubmit={e => { e.preventDefault(); if (input.trim()) navigate(`/ticket/${input.trim().toUpperCase()}`); }}><input id="tk-code" value={input} onChange={e => setInput(e.target.value)} placeholder="เช่น A7K2P9XD" maxLength={16} autoFocus /><button className="button dark">ค้นหา <Icon name="arrow" /></button></form>
      {state.error && <p className="notice error">{state.error}</p>}
    </div>;
    if (state.loading) return <PageLoader label="กำลังค้นหาบัตร…" />;
    const { kind, item } = state;
    const d = item.starts_at ? eventDate(item) : null;
    const [label, tone] = kind === 'booking' ? bookingStatus[item.status] : kind === 'donation' ? donationStatus[item.status] : item.checked_in_at ? ['เช็คอินแล้ว', 'live'] : ['ลงทะเบียนแล้ว', 'open'];
    const reload = () => lookup(item.code).then(r => setState(r)).catch(() => {});
    return <>{kind !== 'donation' && <StaffCheckin item={item} onDone={reload} />}<article className={`ticket tone-${item.tone || 'pink'}`}>
      <div className="ticket-main">
        <span className="eyebrow">{kind === 'booking' ? 'E-TICKET' : kind === 'donation' ? 'ใบอนุโมทนาบัตร' : 'REGISTRATION'}</span>
        <h1>{item.title}</h1>
        {d && <p className="muted">{d.long} · {d.time}{item.place ? ` · ${item.place}` : ''}</p>}
        <span className={`status-pill ${tone}`}>{label}</span>
        <dl className="ticket-facts">
          {kind === 'booking' && <><div><dt>ชื่อ</dt><dd>{item.name}</dd></div><div><dt>ที่นั่ง</dt><dd>{item.seats.join(', ')}</dd></div><div><dt>ยอด</dt><dd>{baht(item.amount)}</dd></div></>}
          {kind === 'registration' && <><div><dt>ชื่อ</dt><dd>{item.nickname || item.name}</dd></div><div><dt>หมายเลข</dt><dd>#{String(item.number).padStart(3, '0')}</dd></div>{item.luckyRound && <div><dt>Lucky Fan</dt><dd>รอบที่ {item.luckyRound} 🎉</dd></div>}</>}
          {kind === 'donation' && <><div><dt>ผู้ร่วมบุญ</dt><dd>{certificateName(item)}{item.anonymous ? <small className="muted"> · ไม่แสดงชื่อบนกำแพง</small> : null}</dd></div>{item.dedication && <div><dt>ในนาม / อุทิศให้</dt><dd>{item.dedication}</dd></div>}<div><dt>หมวด</dt><dd>{item.units ? `${item.units} ${item.unit_name} · ` : ''}{item.category}</dd></div><div><dt>จำนวน</dt><dd>{baht(item.amount)}</dd></div></>}
        </dl>
        {kind === 'donation' && item.status === 'approved' && <><p className="blessing">ขออนุโมทนาบุญ ขอให้ความสุขเล็กๆ ที่คุณส่งให้ ย้อนกลับมาหาคุณเป็นความสุขก้อนใหญ่ ♡</p><CertificateButton item={item} /></>}
        {kind === 'donation' && item.status === 'pending' && <p className="muted">เมื่อยอดได้รับการยืนยัน จะสร้างใบอนุโมทนาเป็นภาพได้จากหน้านี้</p>}
        {kind === 'registration' && <SelfCheckin item={item} onDone={reload} />}
        <LineNotify code={item.code} linked={!!item.lineLinked} />
        {kind === 'booking' && item.status === 'pending' && <p className="muted">กำลังตรวจสอบสลิป เมื่อยืนยันแล้วสถานะจะเปลี่ยนเป็น "ชำระแล้ว" และ QR ใช้เข้างานได้</p>}
        <div className="form-actions"><Link className="button ghost" to={`/events/${item.slug}`}>ไปหน้ากิจกรรม</Link><button className="button ghost" onClick={() => window.print()}>พิมพ์ / บันทึก</button></div>
      </div>
      <div className="ticket-stub">
        <QR value={item.code} />
        <strong className="code">{item.code}</strong>
        <Paw />
      </div>
    </article></>;
  };

  return <><SiteHeader /><main className="ev-page narrow">{body()}</main><SiteFooter /></>;
}
