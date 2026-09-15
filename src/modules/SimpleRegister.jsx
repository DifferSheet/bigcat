'use client';
import React, { useEffect, useState } from 'react';
import { useUser, prefillFrom } from '../lib/auth.js';
import { Link } from '../lib/nav.jsx';
import { Section, Notice, LoginToRegister } from '../components/EventShell.jsx';
import { PhoneInput } from '../components/forms.jsx';
import { Icon } from '../components/ui.jsx';
import { api } from '../lib/api.js';

// งานทั่วไป (Workshop / Pop-up): ลงทะเบียนแบบจำกัดจำนวนถ้ามี capacity ไม่งั้นแสดงข้อมูลอย่างเดียว
export default function SimpleRegister({ data }) {
  const { event: ev, registrations } = data;
  const capacity = ev.config.capacity;
  const [form, setForm] = useState({ name: '', phone: '' });
  const { user } = useUser();
  useEffect(() => { setForm(f => prefillFrom(user, f, { name: 'display_name', phone: 'phone' })); }, [user]);
  const [done, setDone] = useState(data.mine?.[0] || null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!capacity) return <Section eyebrow="INFO" title="รายละเอียดเพิ่มเติม"><Notice tone="muted">งานนี้เดินเข้ามาได้เลย ไม่ต้องลงทะเบียน ติดตามประกาศเพิ่มเติมได้ที่ช่องทางของ BIGCAT</Notice></Section>;
  const taken = registrations?.total || 0;
  const selfOnly = (ev.config?.registerMode || 'anyone') === 'self';
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try { setDone(await api(`/events/${ev.slug}/registrations`, { method: 'POST', body: form })); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <Section eyebrow="REGISTER" title="ลงทะเบียน" aside={<span className="ev-summary">รับ {capacity} ที่{taken >= 10 ? <> · ลงทะเบียนแล้ว <strong>{taken}</strong></> : ' · เปิดลงทะเบียนแล้ว'}</span>}>
    {done ? <><Notice>ลงทะเบียนสำเร็จ หมายเลข #{String(done.number).padStart(3, '0')}</Notice><Link className="button dark" to={`/ticket/${done.code}`}>เปิดบัตร <Icon name="arrow" /></Link></>
      : ev.status === 'upcoming' ? <Notice tone="muted">ยังไม่เปิดลงทะเบียน</Notice>
        : taken >= capacity ? <Notice tone="muted">เต็มแล้ว</Notice>
          : selfOnly && !user ? <LoginToRegister user={user} />
          : <form className="booking-form" onSubmit={submit}>
            <label>ชื่อ<input id="sr-name" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
            <label>เบอร์โทร<PhoneInput id="sr-phone" required value={form.phone} onChange={phone => setForm({ ...form, phone })} /></label>
            {error && <Notice tone="error">{error}</Notice>}
            <div className="form-actions"><button className="button dark" disabled={busy}>ลงทะเบียน <Icon name="arrow" /></button></div>
          </form>}
  </Section>;
}
