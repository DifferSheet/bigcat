'use client';
// โครงหน้าจัดการ — แดชบอร์ดของแอดมินล้วน ไม่ใช้ header/footer ของเว็บหลัก
// แถบบน: โลโก้ BIGCAT ADMIN · ชื่อหน้า · โปรไฟล์แอดมิน (เมนู: เปลี่ยนรหัสผ่าน · ออกจากระบบ)
// ซ้าย: เมนูหลัก (เดสก์ท็อป) → มือถือกลายเป็นแถบล่าง · กลาง: เนื้อหาเต็มความกว้าง
import React, { useEffect, useRef, useState } from 'react';
import { Link } from '../../lib/nav.jsx';
import { Icon, Logo, Modal } from '../../components/ui.jsx';
import { Notice } from '../../components/EventShell.jsx';
import { api } from '../../lib/api.js';

export const AREAS = [
  { key: 'events', label: 'กิจกรรม', href: '/admin/events', icon: 'calendar' },
  { key: 'albums', label: 'อัลบั้ม', href: '/admin/albums', icon: 'camera' },
  { key: 'shop', label: 'ร้านค้า', href: '/admin/shop', icon: 'bag' },
  { key: 'members', label: 'สมาชิก', href: '/admin/members', icon: 'user' },
  { key: 'scan', label: 'สแกน QR', href: '/admin/scan', icon: 'check' },
];

function PasswordModal({ onClose }) {
  const [f, setF] = useState({ current: '', next: '' });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try { await api('/admin/password', { method: 'PUT', body: f, admin: true }); setMsg({ ok: true, text: 'เปลี่ยนรหัสผ่านแล้ว ✓' }); setF({ current: '', next: '' }); }
    catch (err) { setMsg({ ok: false, text: err.message }); } finally { setBusy(false); }
  };
  return <Modal title="เปลี่ยนรหัสผ่าน" onClose={onClose}>
    <form className="booking-form" onSubmit={save}>
      <label>รหัสผ่านปัจจุบัน<input type="password" autoComplete="current-password" required value={f.current} onChange={e => setF({ ...f, current: e.target.value })} /></label>
      <label>รหัสผ่านใหม่ <small>อย่างน้อย 8 ตัว</small><input type="password" autoComplete="new-password" required minLength={8} value={f.next} onChange={e => setF({ ...f, next: e.target.value })} /></label>
      <div className="form-actions"><button className="button dark small" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button></div>
      {msg && <Notice tone={msg.ok ? 'info' : 'error'}>{msg.text}</Notice>}
    </form>
  </Modal>;
}

function ProfileMenu({ admin, onLogout }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    addEventListener('pointerdown', away); addEventListener('keydown', esc);
    return () => { removeEventListener('pointerdown', away); removeEventListener('keydown', esc); };
  }, [open]);
  const name = admin?.display_name || admin?.username || 'แอดมิน';
  return <div className="ad-profile" ref={box}>
    <button type="button" className="ad-profile-button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
      <span className="ad-avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
      <span className="ad-profile-name">{name}</span>
    </button>
    {open && <div className="ad-menu" role="menu">
      <div className="ad-menu-head"><strong>{name}</strong><small>แอดมิน BIGCAT</small></div>
      <button type="button" role="menuitem" onClick={() => { setOpen(false); setPw(true); }}><Icon name="user" size={15} /> เปลี่ยนรหัสผ่าน</button>
      <a role="menuitem" href="/" target="_blank" rel="noreferrer" onClick={() => setOpen(false)}><Icon name="arrow" size={15} /> เปิดเว็บหน้าบ้าน</a>
      <button type="button" role="menuitem" className="danger" onClick={onLogout}><Icon name="close" size={15} /> ออกจากระบบ</button>
    </div>}
    {pw && <PasswordModal onClose={() => setPw(false)} />}
  </div>;
}

export default function AdminShell({ area, title, admin, onLogout, actions, children }) {
  return <div className="ad-shell">
    <Link to="/admin/events" className="ad-brand" aria-label="หน้าจัดการ BIGCAT"><Logo wordmark={false} tone="white" /><span>BIGCAT <b>ADMIN</b></span></Link>
    <header className="ad-topbar">
      <h1 className="ad-title">{title}</h1>
      <div className="ad-topbar-right">{actions}<ProfileMenu admin={admin} onLogout={onLogout} /></div>
    </header>
    <nav className="ad-side" aria-label="เมนูหน้าจัดการ">
      {AREAS.map(a => <Link key={a.key} to={a.href} className={`ad-nav-item ${area === a.key ? 'active' : ''}`} aria-current={area === a.key ? 'page' : undefined}>
        <Icon name={a.icon} size={20} /><span>{a.label}</span>
      </Link>)}
    </nav>
    <main className="ad-main">{children}</main>
  </div>;
}
