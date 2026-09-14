'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useUser, prefillFrom } from '../lib/auth.js';
import { Link } from '../lib/nav.jsx';
import { Section, Notice, PayBox } from '../components/EventShell.jsx';
import { PhoneInput, FileDrop } from '../components/forms.jsx';
import { Icon } from '../components/ui.jsx';
import { api, holdTokenFor } from '../lib/api.js';
import { baht } from '../lib/format.js';

export default function SeatBooking({ data }) {
  const { event: ev, seats = [] } = data;
  const cfg = ev.config.seatMap || {};
  const max = cfg.maxPerBooking || 4;
  const token = useMemo(() => holdTokenFor(ev.slug), [ev.slug]);
  const mine = token.slice(0, 6);

  const [selected, setSelected] = useState([]);   // seat ids ที่กำลังเลือก (ยังไม่ hold)
  const [hold, setHold] = useState(null);          // { expiresAt, seats }
  const [remaining, setRemaining] = useState(0);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const { user } = useUser();
  useEffect(() => { setForm(f => prefillFrom(user, f, { name: 'display_name', phone: 'phone', email: 'email' })); }, [user]);
  const [slip, setSlip] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  const rows = useMemo(() => {
    const map = new Map();
    for (const s of seats) { if (!map.has(s.row_label)) map.set(s.row_label, []); map.get(s.row_label).push(s); }
    return [...map.entries()];
  }, [seats]);
  const zones = useMemo(() => { const z = new Map(); for (const s of seats) if (!z.has(s.zone)) z.set(s.zone, s.price); return [...z.entries()]; }, [seats]);

  const heldSeats = seats.filter(s => s.status === 'held' && s.heldBy === mine);
  const chosen = hold ? heldSeats : seats.filter(s => selected.includes(s.id));
  const total = chosen.reduce((sum, s) => sum + s.price, 0);
  const stats = { free: seats.filter(s => s.status === 'available').length, total: seats.length };

  // นับถอยหลังเวลาถือที่นั่ง
  useEffect(() => {
    if (!hold) return;
    const tick = () => { const r = Math.max(0, Math.floor((new Date(hold.expiresAt) - Date.now()) / 1000)); setRemaining(r); if (r === 0) { setHold(null); setError('หมดเวลาถือที่นั่ง กรุณาเลือกใหม่'); } };
    tick(); const t = setInterval(tick, 1000); return () => clearInterval(t);
  }, [hold]);
  // ถ้า server ปล่อยที่นั่งเราไปแล้ว (หมดเวลา) ให้ออกจากโหมดกรอกฟอร์ม
  useEffect(() => { if (hold && heldSeats.length === 0 && !busy) setHold(null); }, [seats]);

  const toggle = (s) => {
    if (hold || s.status !== 'available') return;
    setError('');
    setSelected(sel => sel.includes(s.id) ? sel.filter(x => x !== s.id) : sel.length >= max ? (setError(`เลือกได้สูงสุด ${max} ที่`), sel) : [...sel, s.id]);
  };

  const startHold = async () => {
    setBusy(true); setError('');
    try { const r = await api(`/events/${ev.slug}/seats/hold`, { method: 'POST', body: { seatIds: selected, holdToken: token } }); setHold(r); setSelected([]); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const cancelHold = async () => { setBusy(true); try { await api(`/events/${ev.slug}/seats/release`, { method: 'POST', body: { holdToken: token } }); } catch { /* ignore */ } setHold(null); setBusy(false); };
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const fd = new FormData();
      Object.entries({ ...form, holdToken: token }).forEach(([k, v]) => fd.append(k, v));
      if (slip) fd.append('slip', slip);
      setDone(await api(`/events/${ev.slug}/bookings`, { method: 'POST', body: fd }));
      setHold(null);
    } catch (err) { setError(err.message); if (err.status === 410) setHold(null); }
    finally { setBusy(false); }
  };

  if (done) return <Section eyebrow="BOOKED" title="จองสำเร็จ รอตรวจสอบการชำระเงิน">
    <Notice>ที่นั่ง {done.seats.join(', ')} ถูกจองในชื่อคุณแล้ว ยอดรวม {baht(done.amount)}</Notice>
    <p>รหัสการจองของคุณคือ <strong className="code">{done.code}</strong> สลิปจะได้รับการตรวจสอบภายใน 24 ชั่วโมง แล้วบัตรจะเปลี่ยนสถานะเป็น "ชำระแล้ว" เปิดดูบัตรได้ทุกเมื่อจากลิงก์ด้านล่าง</p>
    <Link className="button dark" to={`/ticket/${done.code}`}>เปิดบัตรของฉัน <Icon name="arrow" /></Link>
  </Section>;

  if (ev.status !== 'open') return <Section eyebrow="SEATS" title="ที่นั่ง"><Notice tone="muted">{ev.status === 'soldout' ? 'ที่นั่งเต็มแล้ว ติดตาม waitlist ได้ที่ช่องทางของ BIGCAT' : ev.status === 'upcoming' ? 'ยังไม่เปิดจอง รอประกาศวันเปิดจองเร็วๆ นี้' : 'ปิดรับจองแล้ว'}</Notice></Section>;

  return <Section eyebrow="SEAT BOOKING" title="เลือกที่นั่ง" aside={<span className="ev-summary">เหลือ <strong>{stats.free}</strong> / {stats.total} ที่นั่ง · อัปเดตสด</span>}>
    <div className="seat-legend">
      {zones.map(([zone, price]) => <span key={zone}><i className={`seat-swatch zone-${zone === (cfg.zones?.A?.name) ? 'vip' : 'std'}`} />{zone} · {baht(price)}</span>)}
      <span><i className="seat-swatch booked" />จองแล้ว</span><span><i className="seat-swatch held" />มีคนกำลังจอง</span><span><i className="seat-swatch selected" />ที่คุณเลือก</span>
    </div>
    <div className="seat-map" role="group" aria-label="ผังที่นั่ง">
      <div className="stage">STAGE · โนบิ บูตะ ชิบะ</div>
      {rows.map(([row, list]) => <div className="seat-row" key={row}>
        <span className="row-label">{row}</span>
        {list.map(s => {
          const isMine = s.status === 'held' && s.heldBy === mine;
          const cls = ['seat', s.zone === cfg.zones?.A?.name ? 'vip' : '', s.status === 'booked' ? 'booked' : '', s.status === 'held' && !isMine ? 'held' : '', selected.includes(s.id) || isMine ? 'selected' : ''].join(' ');
          return <button key={s.id} className={cls} disabled={!!hold || s.status !== 'available'} onClick={() => toggle(s)} aria-pressed={selected.includes(s.id)} aria-label={`ที่นั่ง ${s.label} ${s.zone} ${baht(s.price)} ${s.status === 'available' ? 'ว่าง' : 'ไม่ว่าง'}`}>{s.col_num}</button>;
        })}
      </div>)}
    </div>

    <div className="booking-panel">
      <div className="booking-summary">
        <span className="eyebrow">ที่นั่งที่เลือก ({chosen.length}/{max})</span>
        <div className="chips">{chosen.length ? chosen.map(s => <span className="chip" key={s.id}>{s.label} <small>{s.zone}</small></span>) : <span className="muted">แตะที่นั่งว่างบนผังเพื่อเลือก</span>}</div>
        <div className="booking-total"><span>ยอดรวม</span><strong>{baht(total)}</strong></div>
        {hold && <div className="hold-timer"><Icon name="clock" size={16} />ถือที่นั่งให้อีก <strong>{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</strong> นาที</div>}
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {!hold
        ? <button className="button dark" disabled={!selected.length || busy} onClick={startHold}>ยืนยันที่นั่งและกรอกข้อมูล <Icon name="arrow" /></button>
        : <form className="booking-form" onSubmit={submit}>
          <label>ชื่อ-นามสกุล<input id="bk-name" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="ชื่อที่ใช้รับบัตรหน้างาน" /></label>
          <label>เบอร์โทร<PhoneInput id="bk-phone" required value={form.phone} onChange={phone => setForm({ ...form, phone })} /></label>
          <label>อีเมล (ถ้ามี)<input id="bk-email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="สำหรับส่งบัตร" /></label>
          <PayBox payment={ev.config.payment} note={`โอน ${baht(total)} แล้วแนบสลิปด้านล่าง (แนบทีหลังได้ที่หน้าบัตร)`} />
          <FileDrop id="bk-slip" file={slip} onChange={setSlip} hint="โอนแล้วแนบได้เลย หรือแนบทีหลังที่หน้าบัตร · JPG / PNG" />
          <div className="form-actions"><button type="button" className="button ghost" onClick={cancelHold} disabled={busy}>เลือกใหม่</button><button className="button dark" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'ยืนยันการจอง'} <Icon name="check" /></button></div>
        </form>}
    </div>
  </Section>;
}
