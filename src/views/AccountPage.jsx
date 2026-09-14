'use client';
import React, { useEffect, useState } from 'react';
import { Link } from '../lib/nav.jsx';
import { SiteHeader, SiteFooter, Notice, Section } from '../components/EventShell.jsx';
import { Icon, PageLoader } from '../components/ui.jsx';
import { PhoneInput, AddressForm } from '../components/forms.jsx';
import { api } from '../lib/api.js';
import { useUser, refreshUser, logout } from '../lib/auth.js';
import { baht, parseDate } from '../lib/format.js';

const ST = { pending: ['รอตรวจสอบ', 'muted'], approved: ['ยืนยันแล้ว', 'open'], paid: ['ชำระแล้ว', 'open'], rejected: ['ไม่ผ่าน', 'full'], packing: ['กำลังแพ็ก', 'open'], shipped: ['จัดส่งแล้ว', 'open'], completed: ['สำเร็จ', 'open'], cancelled: ['ยกเลิก', 'muted'], checked_in: ['เช็คอินแล้ว', 'open'], registered: ['ลงทะเบียนแล้ว', 'open'] };
const Pill = ({ status }) => { const [label, tone] = ST[status] || [status, 'muted']; return <span className={`status-pill ${tone}`}>{label}</span>; };
const fmt = (d) => { const x = parseDate(d); return x ? x.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : ''; };

export default function AccountPage() {
  const { user, loaded } = useUser();
  const [form, setForm] = useState(null);
  const [act, setAct] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (loaded && !user) location.replace('/login?next=/account'); }, [loaded, user]);
  useEffect(() => { if (user && !form) setForm({ display_name: user.display_name || '', phone: user.phone || '', email: user.email || '', address: user.address || '' }); }, [user, form]);
  useEffect(() => { if (user) api('/me/activity').then(setAct).catch(() => setAct({})); }, [user]);
  if (!user || !form) return <><SiteHeader /><PageLoader /></>;

  const save = async (e) => {
    e.preventDefault(); setBusy(true); setMsg('');
    try { await api('/me', { method: 'PUT', body: form }); await refreshUser(); setMsg('บันทึกแล้ว ✓'); }
    catch (err) { setMsg(err.message); } finally { setBusy(false); }
  };
  const out = async () => { await logout(); location.href = '/'; };
  const empty = act && !act.orders?.length && !act.bookings?.length && !act.donations?.length && !act.registrations?.length;

  return <>
    <SiteHeader />
    <main className="ev-page">
      <nav className="crumbs"><Link to="/">หน้าแรก</Link><span>/</span><span>บัญชีของฉัน</span></nav>
      <div className="account-head">
        {user.avatar ? <img className="avatar lg" src={user.avatar} alt="" referrerPolicy="no-referrer" /> : <span className="avatar lg placeholder">{user.display_name.slice(0, 1)}</span>}
        <div><span className="eyebrow">MEMBER · {user.provider === 'line' ? 'LINE' : 'Google'}</span><h1>{user.display_name}</h1><p className="muted">สมาชิกตั้งแต่ {fmt(user.created_at)}{user.line_linked ? ' · รับแจ้งเตือนทาง LINE' : ''}</p></div>
        <button className="link-button" onClick={out}>ออกจากระบบ</button>
      </div>

      <div className="account-layout">
        <Section eyebrow="PROFILE" title="ข้อมูลสำหรับจอง/สั่งซื้อ">
          <p className="muted small">กรอกไว้ครั้งเดียว ระบบจะเติมให้ทุกฟอร์มอัตโนมัติ (แก้ในฟอร์มแต่ละครั้งได้)</p>
          <form className="booking-form" onSubmit={save}>
            <div className="two"><label>ชื่อที่ใช้<input value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} /></label><label>เบอร์โทร<PhoneInput value={form.phone} onChange={phone => setForm({ ...form, phone })} /></label></div>
            <label>อีเมล<input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
            <AddressForm idPrefix="ac" required={false} value={form.address} onChange={address => setForm(f => ({ ...f, address }))} />
            <div className="form-actions"><button className="button dark small" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button>{msg && <span className="muted">{msg}</span>}</div>
          </form>
        </Section>

        <Section eyebrow="HISTORY" title="รายการของฉัน">
          {!act ? <PageLoader /> : empty ? <Notice tone="muted">ยังไม่มีรายการที่ทำตอนล็อกอินอยู่ — รายการก่อนหน้านี้ค้นด้วยรหัสได้ที่ <Link to="/ticket/lookup">บัตรของฉัน</Link></Notice> : <>
            {act.orders?.length > 0 && <Group title="คำสั่งซื้อ">{act.orders.map(o => <Row key={o.code} to={`/order/${o.code}`} main={<>#{o.code} · {baht(o.total)}</>} sub={`${fmt(o.created_at)} · ${o.delivery === 'ship' ? 'จัดส่ง' : 'รับหน้างาน'}`} status={o.status} />)}</Group>}
            {act.bookings?.length > 0 && <Group title="บัตร / ที่นั่ง">{act.bookings.map(b => <Row key={b.code} to={`/ticket/${b.code}`} main={<>{b.title} · ที่นั่ง {b.seats.join(', ')}</>} sub={`${fmt(b.starts_at)} · ${baht(b.amount)}`} status={b.status} />)}</Group>}
            {act.registrations?.length > 0 && <Group title="ลงทะเบียนร่วมงาน">{act.registrations.map(r => <Row key={r.code} to={`/ticket/${r.code}`} main={<>{r.title} · หมายเลข {r.number}</>} sub={`${fmt(r.starts_at)}${r.kind !== 'attend' ? ` · ${r.kind}` : ''}`} status={r.checked_in_at ? 'checked_in' : 'registered'} />)}</Group>}
            {act.donations?.length > 0 && <Group title="ร่วมทำบุญ">{act.donations.map(d => <Row key={d.code} to={`/ticket/${d.code}`} main={<>{d.title} · {d.category}</>} sub={`${fmt(d.created_at)} · ${baht(d.amount)}`} status={d.status} />)}</Group>}
          </>}
        </Section>
      </div>
    </main>
    <SiteFooter />
  </>;
}

const Group = ({ title, children }) => <div className="act-group"><h3>{title}</h3><ul className="act-list">{children}</ul></div>;
const Row = ({ to, main, sub, status }) => <li><Link to={to}><div><strong>{main}</strong><span className="muted small">{sub}</span></div><Pill status={status} /><Icon name="arrow" size={14} /></Link></li>;
