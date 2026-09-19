'use client';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from '../lib/nav.jsx';
import { StatusPill, Notice } from '../components/EventShell.jsx';
import AdminShell, { AREAS } from './admin/AdminShell.jsx';
import { Icon, PageLoader, Modal, Tag } from '../components/ui.jsx';

const PAGE = 20;
// แบ่งหน้า (ฝั่ง client) — ใช้กับทุกตารางในหน้าจัดการ
function Pager({ total, page, setPage }) {
  const pages = Math.max(1, Math.ceil(total / PAGE));
  if (pages <= 1) return null;
  return <div className="pager"><button type="button" className="button ghost small" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ ก่อนหน้า</button><span>หน้า {page} / {pages} · {total} รายการ</span><button type="button" className="button ghost small" disabled={page >= pages} onClick={() => setPage(page + 1)}>ถัดไป ›</button></div>;
}
// รวมแถวทำบุญที่โอนครั้งเดียวหลายหมวด (group_code เดียวกัน) ให้เป็นรายการเดียว
const groupDonations = (list) => { const m = new Map(); for (const d of list) { const k = d.group_code || d.code; if (!m.has(k)) m.set(k, { ...d, key: k, ids: [], items: [], amount: 0 }); const g = m.get(k); g.ids.push(d.id); g.items.push(d); g.amount += Number(d.amount); if (d.status === 'pending') g.status = 'pending'; } return [...m.values()]; };
import { api, getAdminKey, setAdminKey } from '../lib/api.js';
import { useMounted } from '../lib/useMounted.js';
import { eventDate, typeLabel, baht, parseDate } from '../lib/format.js';

const fmt = (d) => { const x = parseDate(d); return x ? x.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'; };
import dynamic from 'next/dynamic';
const QrScanner = dynamic(() => import('../components/QrScanner.jsx'), { ssr: false });

const ShopAdmin = dynamic(() => import('./ShopAdmin.jsx'), { ssr: false, loading: () => <PageLoader /> });
const AlbumsOverview = dynamic(() => import('./admin/AlbumsAdmin.jsx').then(m => m.AlbumsOverview), { ssr: false, loading: () => <PageLoader /> });
const AlbumDetail = dynamic(() => import('./admin/AlbumsAdmin.jsx').then(m => m.AlbumDetail), { ssr: false, loading: () => <PageLoader /> });
const EventAdminForm = dynamic(() => import('./EventAdminForm.jsx'), { ssr: false, loading: () => <PageLoader /> });

const STATUSES = ['upcoming', 'open', 'soldout', 'live', 'ended', 'hidden'];

function Login({ onDone }) {
  const [f, setF] = useState({ username: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try { const r = await api('/admin/login', { method: 'POST', body: f }); onDone(r.admin); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <div className="admin-login">
    <div className="admin-login-card">
      <span className="eyebrow">STAFF ONLY</span>
      <h1>เข้าสู่ระบบแอดมิน</h1>
      <form className="booking-form" onSubmit={submit}>
        <label>ชื่อผู้ใช้<input id="ad-user" autoComplete="username" required value={f.username} onChange={e => setF({ ...f, username: e.target.value })} autoFocus /></label>
        <label>รหัสผ่าน<input id="ad-pass" type="password" autoComplete="current-password" required value={f.password} onChange={e => setF({ ...f, password: e.target.value })} /></label>
        {error && <Notice tone="error">{error}</Notice>}
        <button className="button dark" disabled={busy}>{busy ? 'กำลังตรวจสอบ…' : 'เข้าสู่ระบบ'} <Icon name="arrow" /></button>
      </form>
    </div>
  </div>;
}

// แท็บสมาชิก: รายชื่อผู้ที่เข้าสู่ระบบด้วย LINE/Google พร้อมสถิติ
function Members() {
  const [data, setData] = useState(null);
  const [qs, setQs] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { const t = setTimeout(() => api(`/admin/members?q=${encodeURIComponent(qs)}`, { admin: true }).then(setData).catch(e => setError(e.message)), 250); return () => clearTimeout(t); }, [qs]);
  const st = data?.stats;
  return <div className="admin-event">
    {st && <div className="stat-tiles">
      <div><span className="eyebrow">สมาชิกทั้งหมด</span><strong>{st.total}</strong><small>ใหม่ 7 วัน {st.week}</small></div>
      <div><span className="eyebrow">LINE</span><strong>{st.line}</strong><small>ผูกแจ้งเตือน {st.linked}</small></div>
      <div><span className="eyebrow">Google</span><strong>{st.google}</strong></div>
    </div>}
    <Seasons />
    <div className="tabs-row"><input className="admin-search" value={qs} onChange={e => setQs(e.target.value)} placeholder="ค้นหาชื่อ / อีเมล / เบอร์" /><span className="muted">{data ? `${data.members.length} คน` : ''}</span></div>
    {error && <Notice tone="error">{error}</Notice>}
    {!data ? <PageLoader /> : data.members.length === 0 ? <p className="muted">ไม่พบสมาชิก</p> : <div className="table-wrap"><table className="admin-table members">
      <thead><tr><th></th><th>สมาชิก</th><th>ติดต่อ</th><th>สมัคร / ล่าสุด</th><th>ซื้อ</th><th>บุญ</th><th>บัตร/ลงทะเบียน</th><th>Passport</th></tr></thead>
      <tbody>{data.members.map(m => <tr key={m.id}>
        <td>{m.avatar ? <img className="thumb round" src={m.avatar} alt="" referrerPolicy="no-referrer" /> : <span className="thumb round placeholder">{m.display_name.slice(0, 1)}</span>}</td>
        <td><strong>{m.display_name}</strong><br /><small className="muted">สมาชิก #{m.id} · {m.provider === 'line' ? 'LINE' : 'Google'}{m.lineLinked ? ' · แจ้งเตือน LINE ✓' : ''}</small></td>
        <td><small>{m.email || '—'}<br />{m.phone || '—'}</small></td>
        <td><small>{fmt(m.created_at)}<br /><span className="muted">{m.last_login_at ? fmt(m.last_login_at) : '—'}</span></small></td>
        <td>{m.orders} <small className="muted">· {baht(m.spent)}</small></td>
        <td>{m.donations} <small className="muted">· {baht(m.donated)}</small></td>
        <td>{Number(m.bookings) + Number(m.registrations)}</td>
        <td><small>{m.stamps} ดวง{m.friends > 0 ? ` · พามา ${m.friends}` : ''}{m.invited_by_name ? <><br /><span className="muted">ชวนโดย {m.invited_by_name}</span></> : null}</small>{Number(m.stamps) >= 3 && <><br /><button type="button" className={`mini-tag as-btn ${m.sticker_given_at ? 'ok' : 'warn'}`} title={m.sticker_given_at ? `มอบสติกเกอร์แล้ว ${fmt(m.sticker_given_at)} — กดเพื่อยกเลิก` : 'ครบ 3 ดวง — กดเมื่อมอบสติกเกอร์แล้ว'} onClick={() => api(`/admin/members/${m.id}/sticker`, { method: 'POST', admin: true }).then(() => setData(d => ({ ...d, members: d.members.map(x => x.id === m.id ? { ...x, sticker_given_at: x.sticker_given_at ? null : new Date().toISOString() } : x) })))}>{m.sticker_given_at ? 'สติกเกอร์ ✓' : 'รอรับสติกเกอร์'}</button></>}</td>
      </tr>)}</tbody>
    </table></div>}
  </div>;
}

// Passport: เล่ม (season) — งานที่วันจัดอยู่ในช่วง จะถูกจัดเข้าเล่มนั้นในหน้า /passport · ไม่ตั้ง = แยกเล่มตามปี พ.ศ.
function Seasons() {
  const [list, setList] = useState(null);
  const [f, setF] = useState({ name: '', starts_on: '', ends_on: '' });
  const [msg, setMsg] = useState('');
  useEffect(() => { api('/admin/seasons', { admin: true }).then(setList).catch(() => setList([])); }, []);
  const save = async (e) => { e.preventDefault(); setMsg(''); try { setList(await api('/admin/seasons', { method: 'POST', body: f, admin: true })); setF({ name: '', starts_on: '', ends_on: '' }); } catch (err) { setMsg(err.message); } };
  return <details className="adv seasons"><summary>Passport · เล่มสะสม <small>({list ? list.length : '…'} เล่ม — ไม่ตั้ง = แยกตามปี)</small></summary>
    {list?.map(s => <div key={s.id} className="season-row"><strong>{s.name}</strong><span className="muted">{String(s.starts_on).slice(0, 10)} → {String(s.ends_on).slice(0, 10)}</span><button type="button" className="link-button" onClick={() => setF({ id: s.id, name: s.name, starts_on: String(s.starts_on).slice(0, 10), ends_on: String(s.ends_on).slice(0, 10) })}>แก้</button><button type="button" className="link-button" onClick={() => api(`/admin/seasons/${s.id}`, { method: 'DELETE', admin: true }).then(setList)}>ลบ</button></div>)}
    <form className="season-form" onSubmit={save}><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="ชื่อเล่ม เช่น เข้าพรรษา 2569" /><input type="date" value={f.starts_on} onChange={e => setF({ ...f, starts_on: e.target.value })} /><input type="date" value={f.ends_on} onChange={e => setF({ ...f, ends_on: e.target.value })} /><button className="button dark small">{f.id ? 'บันทึก' : '+ เพิ่มเล่ม'}</button>{f.id && <button type="button" className="link-button" onClick={() => setF({ name: '', starts_on: '', ends_on: '' })}>ยกเลิก</button>}{msg && <span className="notice error">{msg}</span>}</form>
  </details>;
}

// เลือกสมาชิกเพื่อผูกรายการ (ค้นชื่อ/อีเมล/เบอร์)
function MemberPicker({ title, onPick, onClose }) {
  const [qs, setQs] = useState('');
  const [list, setList] = useState(null);
  useEffect(() => { const t = setTimeout(() => api(`/admin/members?q=${encodeURIComponent(qs)}`, { admin: true }).then(d => setList(d.members)).catch(() => setList([])), 200); return () => clearTimeout(t); }, [qs]);
  return <Modal title={title} onClose={onClose}>
    <input className="admin-search" autoFocus value={qs} onChange={e => setQs(e.target.value)} placeholder="พิมพ์ชื่อ / อีเมล / เบอร์ของสมาชิก" />
    {!list ? <PageLoader /> : list.length === 0 ? <p className="muted small">ไม่พบสมาชิก</p> : <ul className="member-pick">{list.slice(0, 30).map(m => <li key={m.id}><button type="button" onClick={() => onPick(m)}>{m.avatar ? <img src={m.avatar} alt="" referrerPolicy="no-referrer" /> : <span className="thumb round placeholder">{m.display_name.slice(0, 1)}</span>}<span><strong>{m.display_name}</strong><small className="muted">{m.provider === 'line' ? 'LINE' : 'Google'}{m.email ? ` · ${m.email}` : ''}{m.phone ? ` · ${m.phone}` : ''}</small></span></button></li>)}</ul>}
  </Modal>;
}

// เปลี่ยนรหัสผ่านแอดมิน + ออกจากระบบ
// เครื่องมือเฉพาะงานทำบุญ: ยอดแยกหมวด, CSV, ขอบคุณทาง LINE, รายงานความโปร่งใส
function MeritTools({ ev, onMsg, onAdded }) {
  const [stats, setStats] = useState(null);
  const [report, setReport] = useState([]);
  const [thanks, setThanks] = useState('🙏 ขอบคุณที่ร่วมบุญกับแก๊ง BIGCAT ยอดทั้งหมดถวายวัดเรียบร้อยแล้ว ดูรายงานได้ที่หน้ากิจกรรมนะครับ');
  const [item, setItem] = useState({ kind: 'receipt', title: '', amount: '', body: '' });
  const [file, setFile] = useState(null);
  const load = () => Promise.all([api(`/admin/events/${ev.slug}/donation-stats`, { admin: true }), api(`/events/${ev.slug}`)]).then(([st, d]) => { setStats(st); setReport(d.report || []); }).catch(e => onMsg(e.message));
  useEffect(() => { load(); }, [ev.slug]);
  const exportCsv = async () => {
    const res = await fetch(`/api/admin/events/${ev.slug}/donations.csv`, { headers: { 'x-admin-key': getAdminKey() } });
    const url = URL.createObjectURL(await res.blob()); const a = document.createElement('a'); a.href = url; a.download = `${ev.slug}-donations.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const sendThanks = async () => { onMsg(''); try { const r = await api(`/admin/events/${ev.slug}/thanks`, { method: 'POST', body: { text: thanks }, admin: true }); onMsg(`ส่งขอบคุณแล้ว ${r.sent}/${r.recipients} คน`, 'ok'); load(); } catch (e) { onMsg(e.message); } };
  const addReport = async (e) => {
    e.preventDefault(); onMsg('');
    try { const fd = new FormData(); Object.entries(item).forEach(([k, v]) => fd.append(k, v)); if (file) fd.append('image', file); setReport(await api(`/admin/events/${ev.slug}/report`, { method: 'POST', body: fd, admin: true })); setItem({ kind: 'receipt', title: '', amount: '', body: '' }); setFile(null); } catch (err) { onMsg(err.message); }
  };
  // ยอดที่โอนมานอกระบบ (รู้ทีหลัง) — แอดมินบันทึกเองได้ อนุมัติทันที
  const [offline, setOffline] = useState({ categoryId: '', amount: '', units: '', name: '', dedication: '', createdAt: '', note: '', userId: '', anonymous: false });
  const [offBusy, setOffBusy] = useState(false);
  const offCat = stats?.categories.find(c => String(c.id) === String(offline.categoryId));
  const addOffline = async (e) => {
    e.preventDefault(); onMsg(''); setOffBusy(true);
    try {
      const r2 = await api(`/admin/events/${ev.slug}/donations`, { method: 'POST', body: { ...offline, userId: offline.userId || undefined }, admin: true });
      onMsg(`บันทึกยอด ${baht(r2.amount)} หมวด${r2.category} แล้ว (รหัส ${r2.code})`, 'ok');
      setOffline({ categoryId: '', amount: '', units: '', name: '', dedication: '', createdAt: '', note: '', userId: '', anonymous: false });
      load(); onAdded?.();
    } catch (err) { onMsg(err.message); } finally { setOffBusy(false); }
  };
  const delReport = async (id) => { try { await api(`/admin/report/${id}`, { method: 'DELETE', admin: true }); setReport(r => r.filter(x => x.id !== id)); } catch (e) { onMsg(e.message); } };
  if (!stats) return null;
  return <div className="merit-tools">
    <div className="stat-tiles">
      <div><span className="eyebrow">ยอดยืนยันแล้ว</span><strong>{baht(stats.total)}</strong><small>{stats.percent}% ของ {baht(stats.goal)}</small></div>
      <div><span className="eyebrow">รอตรวจ</span><strong>{stats.pending}</strong><small>ตรวจอัตโนมัติผ่าน {stats.autoVerified}</small></div>
      <div><span className="eyebrow">ผูก LINE</span><strong>{stats.lineLinked}</strong><small>ขอบคุณแล้ว {stats.thanked}</small></div>
    </div>
    <div className="table-wrap"><table className="admin-table compact"><thead><tr><th>หมวด</th><th>ยอด</th><th>เป้า</th><th>หน่วย</th><th>คน</th></tr></thead><tbody>{stats.categories.map(c => <tr key={c.id}><td>{c.name}</td><td>{baht(c.raised)}</td><td>{baht(c.goal)}</td><td>{c.unit_price ? `${c.unitsDone}/${c.unitsGoal} ${c.unit_name}` : '—'}</td><td>{c.donors}</td></tr>)}</tbody></table></div>
    <div className="tool-row">
      <button className="button ghost small" onClick={exportCsv}>ดาวน์โหลด CSV ↓</button>
      <input id="ad-thanks" value={thanks} onChange={e => setThanks(e.target.value)} placeholder="ข้อความขอบคุณ" />
      <button className="button dark small" onClick={sendThanks}>ส่งขอบคุณทาง LINE ({stats.lineLinked - stats.thanked})</button>
    </div>
    <details className="report-admin">
      <summary>เพิ่มยอดที่โอนมานอกระบบ</summary>
      <p className="muted small">ใช้กับยอดที่โอนตรงหรือรู้ทีหลัง ไม่ได้กรอกผ่านหน้าเว็บ — บันทึกแล้วขึ้นยอดรวมและกำแพงชื่อทันที ติดหมายเหตุไว้ว่าแอดมินบันทึกเอง</p>
      <form className="booking-form inline" onSubmit={addOffline}>
        <div className="two">
          <label>หมวด<select id="of-cat" required value={offline.categoryId} onChange={e => setOffline({ ...offline, categoryId: e.target.value, amount: '', units: '' })}><option value="">— เลือกหมวด —</option>{stats.categories.map(c => <option key={c.id} value={c.id}>{c.name}{c.unit_price ? ` · ${baht(c.unit_price)}/${c.unit_name}` : ''}</option>)}</select></label>
          {offCat?.unit_price
            ? <label>จำนวน {offCat.unit_name}<input id="of-units" type="number" min="1" required value={offline.units} onChange={e => setOffline({ ...offline, units: e.target.value })} /></label>
            : <label>ยอด (บาท)<input id="of-amount" type="number" min="1" required value={offline.amount} onChange={e => setOffline({ ...offline, amount: e.target.value })} /></label>}
        </div>
        <div className="two">
          <label>ชื่อผู้ร่วมบุญ<input id="of-name" value={offline.name} onChange={e => setOffline({ ...offline, name: e.target.value })} placeholder="เว้นว่าง = ผู้ไม่ประสงค์ออกนาม" /></label>
          <label>วันที่โอน<input id="of-when" type="date" value={offline.createdAt} onChange={e => setOffline({ ...offline, createdAt: e.target.value })} /></label>
        </div>
        <div className="two">
          <label>ในนาม / อุทิศให้<input id="of-ded" value={offline.dedication} onChange={e => setOffline({ ...offline, dedication: e.target.value })} /></label>
          <label>รหัสสมาชิก (ถ้ารู้)<input id="of-user" type="number" min="1" value={offline.userId} onChange={e => setOffline({ ...offline, userId: e.target.value })} placeholder="ผูกให้ขึ้นใน history ของเขา" /></label>
        </div>
        <label>หมายเหตุ <small>— ที่มาของยอด เช่น โอนตรงเข้าบัญชี 19 ก.ย. เวลา 10:20</small><input id="of-note" value={offline.note} onChange={e => setOffline({ ...offline, note: e.target.value })} /></label>
        <label className="check"><input type="checkbox" checked={offline.anonymous} onChange={e => setOffline({ ...offline, anonymous: e.target.checked })} /> <span>ไม่แสดงชื่อบนกำแพง</span></label>
        <div className="form-actions"><button className="button dark small" disabled={offBusy}>{offBusy ? 'กำลังบันทึก…' : 'บันทึกยอดนี้'}</button>{offCat?.unit_price && offline.units ? <span className="muted">= {baht(Number(offline.units) * offCat.unit_price)}</span> : null}</div>
      </form>
    </details>

    <details className="report-admin">
      <summary>รายงานความโปร่งใส ({report.length} รายการ)</summary>
      <form className="booking-form inline" onSubmit={addReport}>
        <div className="two"><label>ประเภท<select id="rp-kind" value={item.kind} onChange={e => setItem({ ...item, kind: e.target.value })}><option value="receipt">ใบเสร็จ / ใบอนุโมทนา</option><option value="photo">ภาพส่งมอบ</option><option value="note">บันทึก</option></select></label><label>ยอด (ถ้ามี)<input id="rp-amount" type="number" value={item.amount} onChange={e => setItem({ ...item, amount: e.target.value })} /></label></div>
        <label>หัวข้อ<input id="rp-title" required value={item.title} onChange={e => setItem({ ...item, title: e.target.value })} placeholder="เช่น ใบอนุโมทนาจากวัด · ถวายสังฆทาน 100 ชุด" /></label>
        <label>รายละเอียด<input id="rp-body" value={item.body} onChange={e => setItem({ ...item, body: e.target.value })} /></label>
        <label>รูปภาพ<input id="rp-image" type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} /></label>
        <div className="form-actions"><button className="button dark small">เพิ่มรายการ</button></div>
      </form>
      <ul className="report-list admin">{report.map(r => <li key={r.id} className="report-item">{r.image_path && <img src={r.image_path} alt="" />}<div><strong>{r.title}</strong>{r.amount != null && <span className="report-amount">{baht(r.amount)}</span>}</div><button className="link-button" onClick={() => delReport(r.id)}>ลบ</button></li>)}</ul>
    </details>
  </div>;
}

function EventAdmin({ ev, refresh, onEdit, onDeleted }) {
  const [tab, setTab] = useState('pending');
  const [view, setView] = useState('donations');   // งานทำบุญ: donations | registrations (ไปวัดด้วย)
  const [confirmDel, setConfirmDel] = useState(false);
  const remove = async () => { setMsg(''); try { await api(`/admin/events/${ev.slug}`, { method: 'DELETE', admin: true }); onDeleted(); } catch (e) { setMsg(e.message); setConfirmDel(false); } };
  const [rows, setRows] = useState(null);
  const [msg, setMsgRaw] = useState('');
  const [msgTone, setMsgTone] = useState('error');
  const setMsg = (m, tone = 'error') => { setMsgRaw(m); setMsgTone(tone); };
  const [sel, setSel] = useState([]);
  const [page, setPage] = useState(1);
  const [slipView, setSlipView] = useState(null);
  const [assignFor, setAssignFor] = useState(null);   // { kind: 'donations'|'registrations', id, key, label } ที่กำลังผูกสมาชิก
  const [search, setSearch] = useState('');
  const assign = async (t, userId) => { setMsg(''); try { const r = await api(`/admin/${t.kind}/${t.id}/assign`, { method: 'POST', body: { userId }, admin: true }); setMsg(userId ? `ผูก ${t.key} กับ ${r.member.display_name} แล้ว — ขึ้นใน history ของสมาชิกทันที` : `ปลด ${t.key} ออกจากสมาชิกแล้ว`, 'ok'); setAssignFor(null); await load(); } catch (e) { setMsg(e.message); } };
  const donTarget = (g) => ({ kind: 'donations', id: g.ids[0], key: g.key, label: g.donor_name });
  const regTarget = (r) => ({ kind: 'registrations', id: r.id, key: r.code, label: r.nickname || r.name });
  useEffect(() => { setPage(1); }, [tab, view, ev.slug]);
  useEffect(() => { if (tab === 'done' && rows && !(rows.registrations || (rows.attend && view === 'registrations'))) setTab('pending'); }, [tab, view, rows]);
  const load = async () => {
    setRows(null);
    if (ev.type === 'fanmeet') setRows({ bookings: await api(`/admin/events/${ev.slug}/bookings`, { admin: true }) });
    else if (ev.type === 'merit') { const [donations, registrations] = await Promise.all([api(`/admin/events/${ev.slug}/donations`, { admin: true }), api(`/admin/events/${ev.slug}/registrations`, { admin: true })]); setRows({ donations, attend: registrations }); }
    else setRows({ registrations: await api(`/admin/events/${ev.slug}/registrations`, { admin: true }) });
  };
  useEffect(() => { load().catch(e => setMsg(e.message)); }, [ev.slug]);
  const [delReg, setDelReg] = useState(null);   // id ของการลงทะเบียนที่กดลบครั้งแรก (กดซ้ำเพื่อยืนยัน)
  const del = async (id) => { if (delReg !== id) return setDelReg(id); setDelReg(null); setMsg(''); try { await api(`/admin/registrations/${id}`, { method: 'DELETE', admin: true }); await load(); refresh(); } catch (e) { setMsg(e.message); } };
  const act = async (path, body) => { setMsg(''); try { await api(path, { method: 'POST', body, admin: true }); await load(); refresh(); } catch (e) { setMsg(e.message); } };
  const bulk = async (action) => { setMsg(''); try { const r = await api('/admin/donations/bulk', { method: 'POST', body: { ids: sel, action }, admin: true }); setMsg(`${action === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ'}แล้ว ${r.count} รายการ`, 'ok'); setSel([]); await load(); refresh(); } catch (e) { setMsg(e.message); } };
  const toggleSel = (id) => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const setStatus = async (status) => { setMsg(''); try { await api(`/admin/events/${ev.slug}`, { method: 'PATCH', body: { status }, admin: true }); refresh(); } catch (e) { setMsg(e.message); } };
  // pending = ที่ยังต้องทำ · done = ตรงข้าม (สำหรับรายชื่อลงทะเบียน = เช็คอินแล้ว) · all = ทั้งหมด
  const show = (list, key) => (tab === 'all' ? list : tab === 'done' ? list.filter(x => !key(x)) : list.filter(x => key(x)));
  const paged = (list) => list.slice((page - 1) * PAGE, page * PAGE);
  // ตารางที่เห็นอยู่เป็นรายชื่อลงทะเบียนไหม — ใช้ตัดสินป้ายแท็บและแท็บ «เช็คอินแล้ว»
  const regList = rows?.registrations || (rows?.attend && view === 'registrations' ? rows.attend : null);
  const checkedIn = regList ? regList.filter(r => r.checked_in_at).length : 0;

  return <div className="admin-event">
    <div className="admin-event-head">
      <div><span className="eyebrow">{typeLabel[ev.type]}</span><h2>{ev.title}</h2></div>
      <label className="status-select">สถานะ <select value={ev.status} onChange={e => setStatus(e.target.value)}>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
      <button className="button ghost small" onClick={onEdit}>แก้ไขงาน</button>
      {confirmDel ? <span className="confirm-del"><span>ลบ <span className="tag-label">{ev.title}</span> ถาวร?</span><button className="button dark small danger" onClick={remove}>ลบเลย</button><button className="link-button" onClick={() => setConfirmDel(false)}>ไม่ลบ</button></span> : <button className="link-button" onClick={() => setConfirmDel(true)}>ลบงาน</button>}
      <Link className="button ghost small" to={`/events/${ev.slug}`}>ดูหน้าเว็บ ↗</Link>
      <Link className="button ghost small" to={`/admin/albums/${ev.slug}`}><Icon name="camera" size={15} /> อัลบั้มรูป</Link>
      {ev.type !== 'fanmeet' && <Link className="button ghost small" to={`/events/${ev.slug}/gate`} title="เปิดบนมือถือ/iPad แล้ววางที่จุดเช็คอิน — ใช้เมื่อตั้ง เช็คอินหน้างาน = สแกน QR หน้างาน">จอ QR เช็คอิน</Link>}
      {ev.type === 'busking' && <Link className="button dark small" to={`/events/${ev.slug}/draw`}>จอสุ่ม Lucky Fan 🎲</Link>}
    </div>
    {msg && <Notice tone={msgTone === 'ok' ? 'info' : 'error'}>{msg}</Notice>}
    {ev.type === 'merit' && <MeritTools ev={ev} onMsg={setMsg} onAdded={() => { load(); refresh(); }} />}
    {rows?.attend && <div className="view-switch"><button className={view === 'donations' ? 'active' : ''} onClick={() => setView('donations')}>ยอดร่วมบุญ ({rows.donations.length})</button><button className={view === 'registrations' ? 'active' : ''} onClick={() => setView('registrations')}>ไปวัดด้วย ({rows.attend.length})</button></div>}
    {rows?.donations && view === 'donations' && <input className="admin-search" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="ค้นหารหัส / ชื่อผู้ร่วมบุญ / สมาชิก" style={{ marginBottom: 10 }} />}
    <div className="tabs-row"><div className="filter-tabs"><button className={tab === 'pending' ? 'active' : ''} onClick={() => setTab('pending')}>{regList ? `ยังไม่เช็คอิน (${regList.length - checkedIn})` : 'รอตรวจ'}</button>{regList && <button className={tab === 'done' ? 'active' : ''} onClick={() => setTab('done')}>เช็คอินแล้ว ({checkedIn})</button>}<button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>ทั้งหมด</button></div>
      {rows?.donations && sel.length > 0 && <div className="bulk-bar"><span>เลือก {sel.length} รายการ</span><button className="button dark small" onClick={() => bulk('approve')}>อนุมัติทั้งหมด</button><button className="link-button" onClick={() => bulk('reject')}>ปฏิเสธ</button></div>}</div>
    {!rows ? <PageLoader /> : <div className="table-wrap"><table className="admin-table">
      {rows.bookings && <><thead><tr><th>รหัส</th><th>ชื่อ</th><th>ที่นั่ง</th><th>ยอด</th><th>สลิป</th><th>สถานะ</th><th></th></tr></thead><tbody>{paged(show(rows.bookings, b => b.status === 'pending')).map(b => <tr key={b.id}><td className="code">{b.code}</td><td>{b.name}<br /><small>{b.phone}</small></td><td>{b.seats.join(', ')}</td><td>{baht(b.amount)}</td><td>{b.slip_path ? <a href={b.slip_path} target="_blank" rel="noreferrer">ดูสลิป</a> : '—'}{b.verify_note && <><br /><small className={b.verified_at ? 'ok-text' : ''}>{b.verify_note}</small></>}</td><td>{b.status}{b.verified_at && <span className="mini-tag ok">auto</span>}</td><td className="actions">{b.status === 'pending' && <><button className="button dark small" onClick={() => act(`/admin/bookings/${b.id}/approve`)}>อนุมัติ</button><button className="link-button" onClick={() => act(`/admin/bookings/${b.id}/reject`)}>ปฏิเสธ</button></>}{b.status === 'paid' && <button className="button ghost small" onClick={() => act(`/admin/bookings/${b.id}/checkin`)}>เช็คอิน</button>}</td></tr>)}</tbody><tfoot><tr><td colSpan={7}><Pager total={show(rows.bookings, b => b.status === 'pending').length} page={page} setPage={setPage} /></td></tr></tfoot></>}
      {rows.donations && view === 'donations' && (() => { const groups = show(groupDonations(rows.donations), g => g.status === 'pending').filter(g => !search || [g.key, g.donor_name, g.member_name, g.dedication, g.message].join(' ').toLowerCase().includes(search.toLowerCase())); const pendingIds = groups.filter(g => g.status === 'pending').map(g => g.ids[0]); return <><thead><tr><th><input type="checkbox" aria-label="เลือกทั้งหมด" checked={pendingIds.length > 0 && pendingIds.every(id => sel.includes(id))} onChange={e => setSel(e.target.checked ? pendingIds : [])} /></th><th>รหัส</th><th>ผู้ร่วมบุญ</th><th>รายการ</th><th>ยอดรวม</th><th>สลิป / ผลตรวจ</th><th>สถานะ</th><th></th></tr></thead><tbody>{paged(groups).map(g => <tr key={g.key}><td>{g.status === 'pending' && <input type="checkbox" checked={sel.includes(g.ids[0])} onChange={() => toggleSel(g.ids[0])} aria-label={`เลือก ${g.key}`} />}</td><td className="code">{g.key}{g.line_user_id && <span className="mini-tag">LINE</span>}<br /><small className="muted">{fmt(g.created_at)}</small></td><td>{g.donor_name}{g.anonymous ? <button type="button" className="mini-tag warn as-btn" title="ผู้ใช้ติ๊ก 'ไม่แสดงชื่อบนกำแพง' — กดเพื่อยกเลิก" onClick={() => act(`/admin/donations/${g.ids[0]}/anonymous`, { anonymous: false })}>ไม่แสดงชื่อ ✕</button> : null}{g.dedication && <><br /><small>{g.dedication}</small></>}{g.message && <><br /><small>“{g.message}”</small></>}<br />{g.member_name ? <small className="member-link">👤 {g.member_name} <button type="button" className="link-button" onClick={() => assign(donTarget(g), null)}>ปลด</button></small> : <button type="button" className="link-button small" onClick={() => setAssignFor(donTarget(g))}>+ ผูกสมาชิก</button>}</td><td><ul className="don-items">{g.items.map(d => <li key={d.id}><span>{d.category}{d.units ? <small> · {d.units} {d.unit_name || 'หน่วย'}</small> : null}</span><b>{baht(d.amount)}</b></li>)}</ul>{g.items.length > 1 && <small className="muted">รวม {g.items.length} หมวด · โอนครั้งเดียว</small>}</td><td><strong>{baht(g.amount)}</strong></td><td>{g.slip_path ? <button type="button" className="slip-thumb" onClick={() => setSlipView(g)} aria-label={`ดูสลิป ${g.key}`}><img src={g.slip_path} alt="" loading="lazy" /><span>ดูสลิป</span></button> : '—'}{g.verify_note && <><br /><small className={g.verified_at ? 'ok-text' : ''}>{g.verify_note}</small></>}</td><td>{g.status}{g.verified_at && <span className="mini-tag ok">auto</span>}{String(g.verify_note || '').startsWith('บันทึกโดยแอดมิน') && <span className="mini-tag via" title={g.verify_note}>บันทึกเอง</span>}</td><td className="actions">{g.status === 'pending' && <><button className="button dark small" onClick={() => act(`/admin/donations/${g.ids[0]}/approve`)}>อนุมัติ</button><button className="link-button" onClick={() => act(`/admin/donations/${g.ids[0]}/reject`)}>ปฏิเสธ</button></>}</td></tr>)}</tbody><tfoot><tr><td colSpan={8}><Pager total={groups.length} page={page} setPage={setPage} /></td></tr></tfoot></>; })()}
      {(rows.registrations || (rows.attend && view === 'registrations')) && (() => { const regs = rows.registrations || rows.attend; const dups = regs.filter(r => r.duplicate_of).length; const via = { gate: 0, self: 0, staff: 0, geo: 0 }; regs.forEach(r => { if (r.checked_in_at) { via[r.checkin_via || 'self'] = (via[r.checkin_via || 'self'] || 0) + 1; if (r.checkin_lat != null) via.geo++; } }); const checked = regs.filter(r => r.checked_in_at).length; return <>{(dups > 0 || checked > 0) && <caption className="table-note">
        {checked > 0 && <span className="checkin-stats" title="ข้อมูลไว้ตัดสินใจวิธีเช็คอินครั้งหน้า"><span>เช็คอินแล้ว <strong>{checked}</strong>/{regs.length}</span><span>ผ่าน QR หน้างาน <strong>{via.gate}</strong></span><span>กดเอง <strong>{via.self}</strong></span><span>ทีมงานสแกน <strong>{via.staff}</strong></span><span>มีพิกัด <strong>{via.geo}</strong></span></span>}
        {dups > 0 && <span className="dup-note">พบรายการที่น่าจะซ้ำ {dups} รายการ (ติดป้าย <Tag>ซ้ำ</Tag>) — ตรวจแล้วกด <Tag>ลบ</Tag> ที่รายการที่มาทีหลัง หมายเลขเดิมของคนอื่นไม่เปลี่ยน</span>}</caption>}<thead><tr><th>#</th><th>ชื่อ</th><th>โซเชียล</th><th>รหัส</th><th>เช็คอิน</th><th></th></tr></thead><tbody>{paged(show(regs, r => !r.checked_in_at)).map(r => <tr key={r.id}><td>{String(r.number).padStart(3, '0')}</td><td>{r.nickname || r.name}<br /><small>{r.name}{r.phone ? ` · ${r.phone}` : ''}</small><br />{r.member_name ? <small className="member-link">👤 {r.member_name} <button type="button" className="link-button" onClick={() => assign(regTarget(r), null)}>ปลด</button></small> : <button type="button" className="link-button small" onClick={() => setAssignFor(regTarget(r))}>+ ผูกสมาชิก</button>}</td><td>{r.social || '—'}{r.kind && r.kind !== 'attend' && <small> · {r.kind}</small>}</td><td className="code">{r.code}{r.lineLinked ? <span className="mini-tag">LINE</span> : null}{r.first_time && r.checked_in_at ? <span className="mini-tag ok" title="เช็คอินงานครั้งแรกในชีวิต">ใหม่</span> : null}{r.invited_by_name && <span className="mini-tag via" title="มาจากลิงก์ชวนเพื่อน">ชวนโดย {r.invited_by_name}</span>}{r.duplicate_of && <span className="mini-tag dup" title={`คนเดียวกับหมายเลข #${String(r.duplicate_of).padStart(3, '0')} (บัญชี/LINE/เบอร์/ชื่อตรงกัน)`}>ซ้ำ #{String(r.duplicate_of).padStart(3, '0')}</span>}</td><td>{r.checked_in_at ? <>✓ <span className="mini-tag via" title={`เช็คอินเมื่อ ${fmt(r.checked_in_at)}`}>{{ gate: 'QR หน้างาน', self: 'กดเอง', staff: 'ทีมงาน' }[r.checkin_via] || 'กดเอง'}</span>{r.checkin_lat != null && <a className="mini-tag via" href={`https://www.google.com/maps?q=${r.checkin_lat},${r.checkin_lng}`} target="_blank" rel="noreferrer" title={`พิกัดตอนเช็คอิน (คลาดเคลื่อน ±${r.checkin_acc ?? '?'} ม.)`}>📍 ±{r.checkin_acc ?? '?'}m</a>}</> : '—'}</td><td className="actions">{!r.checked_in_at ? <button className="button ghost small" onClick={() => act(`/admin/checkin/${r.code}`)}>เช็คอินให้</button> : <button className="link-button" title="คืนเป็นยังไม่เช็คอิน (กรณีกดพลาด)" onClick={() => act(`/admin/registrations/${r.id}/uncheckin`)}>ยกเลิกเช็คอิน</button>}<button type="button" className={`link-button ${delReg === r.id ? 'danger' : ''}`} title="ลบการลงทะเบียนนี้ (ซ้ำ/ลงเล่น)" onClick={() => del(r.id)} onBlur={() => setDelReg(null)}>{delReg === r.id ? 'ยืนยันลบ?' : 'ลบ'}</button></td></tr>)}</tbody><tfoot><tr><td colSpan={6}><Pager total={show(regs, r => !r.checked_in_at).length} page={page} setPage={setPage} /></td></tr></tfoot></>; })()}
    </table></div>}
    {assignFor && <MemberPicker title={`ผูกรายการ ${assignFor.key} (${assignFor.label}) กับสมาชิก`} onPick={m => assign(assignFor, m.id)} onClose={() => setAssignFor(null)} />}
    {slipView && <Modal title={`สลิป ${slipView.key} · ${baht(slipView.amount)}`} wide onClose={() => setSlipView(null)}>
      <img className="slip-full" src={slipView.slip_path} alt={`สลิปของ ${slipView.donor_name}`} />
      <div className="detail-strip">{slipView.verify_note || 'ยังไม่ได้ตรวจอัตโนมัติ'}</div>
      <div className="form-actions">
        {slipView.status === 'pending' && <><button className="button dark small" onClick={() => { act(`/admin/donations/${slipView.ids[0]}/approve`); setSlipView(null); }}>อนุมัติ</button><button className="link-button" onClick={() => { act(`/admin/donations/${slipView.ids[0]}/reject`); setSlipView(null); }}>ปฏิเสธ</button></>}
        <a className="link-button" href={slipView.slip_path} target="_blank" rel="noreferrer">เปิดไฟล์เต็ม ↗</a>
      </div>
    </Modal>}
  </div>;
}

// การ์ดยืนยันเช็คอินหลังสแกน — โชว์ชื่อ/หมายเลข/งาน และเตือนถ้าไม่ใช่วันงาน หรือเช็คอินไปแล้ว
function CheckinCard({ t, onConfirm, onClose, onNext }) {
  const d = t.starts_at ? eventDate({ starts_at: t.starts_at }) : null;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  const eventDay = t.starts_at ? new Date(t.starts_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }) : today;
  const unpaid = t.kind === 'booking' && !t.already && t.status !== 'paid';
  return <Modal title={t.already ? 'เช็คอินไปแล้ว' : 'ยืนยันเช็คอิน'} onClose={onClose}>
    <div className="checkin-card">
      <span className="eyebrow">{t.title}</span>
      <strong className="checkin-name">{t.nickname || t.name}</strong>
      <span className="checkin-meta">{t.kind === 'booking' ? `ที่นั่ง ${(t.seats || []).join(', ')}` : `หมายเลข #${String(t.number).padStart(3, '0')}`} · รหัส {t.code}{t.regKind === 'attend' ? ' · ไปวัดด้วย' : ''}</span>
      {t.already && <Notice>บัตรนี้เช็คอินไปแล้ว{t.checked_in_at ? ` เมื่อ ${new Date(t.checked_in_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'short', timeStyle: 'short' })}` : ''}</Notice>}
      {unpaid && <Notice tone="error">บัตรนี้ยังไม่ได้ยืนยันการชำระเงิน ({t.status}) — เช็คอินไม่ได้</Notice>}
      {!t.already && eventDay !== today && <Notice tone="muted">งานนี้จัดวันที่ {d?.long} — วันนี้ยังไม่ใช่วันงาน ถ้าไม่ได้ตั้งใจให้กดปิด</Notice>}
      <div className="form-actions">
        {!t.already && !unpaid && <button className="button dark" onClick={onConfirm}>ยืนยันเช็คอิน <Icon name="check" /></button>}
        <button className="button ghost" onClick={onNext}>สแกนใบต่อไป</button>
        <button className="link-button" onClick={onClose}>ปิด</button>
      </div>
    </div>
  </Modal>;
}

// พื้นที่สแกน/เช็คอิน (เมนู «สแกน QR») — ช่องพิมพ์รหัส · กล้องในเว็บ · การ์ดยืนยันหลังสแกน
function ScanArea({ onCheckedIn }) {
  const [scan, setScan] = useState('');
  const [result, setResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [pending, setPending] = useState(null);
  const preview = async (raw) => {
    const code = codeOf(raw);
    setScanning(false); setResult(null);
    if (!code) return setResult({ ok: false, error: `QR นี้ไม่ใช่บัตรของเว็บเรา (${String(raw).slice(0, 40)})` });
    try { setPending(await api(`/admin/checkin/${code}`, { admin: true })); }
    catch (err) { setResult({ ok: false, error: err.message }); }
  };
  const submit = async (e) => {
    e.preventDefault(); setResult(null);
    const code = codeOf(scan) || scan.trim();
    if (!code) return;
    try { setResult({ ok: true, ...(await api(`/admin/checkin/${code}`, { method: 'POST', admin: true })) }); setScan(''); onCheckedIn?.(); }
    catch (err) { setResult({ ok: false, error: err.message }); }
  };
  const confirm = async () => {
    try { setResult({ ok: true, ...(await api(`/admin/checkin/${pending.code}`, { method: 'POST', admin: true })) }); onCheckedIn?.(); }
    catch (err) { setResult({ ok: false, error: err.message }); }
    setPending(null);
  };
  // เปิดจากกล้องมือถือ: /admin/scan?checkin=รหัส (หรือ /admin?checkin=…) → ดึงข้อมูลบัตรแล้วลบ query กันรีเฟรชซ้ำ
  useEffect(() => {
    const code = new URLSearchParams(location.search).get('checkin');
    if (!code) return;
    history.replaceState(null, '', location.pathname);
    preview(code);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="ad-scan">
    <div className="ad-card ad-scan-card">
      <span className="eyebrow">CHECK-IN</span>
      <h2>เช็คอินหน้างาน</h2>
      <p className="muted">สแกน QR บนบัตรด้วยกล้อง หรือพิมพ์รหัสบัตร 8 ตัว — ระบบจะโชว์ชื่อให้ตรวจก่อนยืนยันทุกครั้ง</p>
      <form className="scan-box" onSubmit={submit}>
        <Icon name="check" />
        <input id="ad-scan" value={scan} onChange={e => setScan(e.target.value)} placeholder="พิมพ์/สแกนรหัสบัตร" autoCapitalize="characters" />
        <button className="button dark small">เช็คอิน</button>
        <button type="button" className="button ghost small" onClick={() => { setResult(null); setScanning(true); }}><Icon name="camera" size={16} /> เปิดกล้อง</button>
      </form>
      {result && <Notice tone={result.ok ? 'info' : 'error'}>{result.ok ? `${result.already ? 'เช็คอินไปแล้ว' : 'เช็คอินสำเร็จ'}: ${result.name}${result.seats ? ` (${result.seats.join(', ')})` : result.number ? ` #${result.number}` : ''}` : result.error}</Notice>}
      <p className="small-note">จอ QR สำหรับให้แฟน ๆ สแกนเอง อยู่ในหน้ากิจกรรมของงานนั้น (ปุ่ม <Tag>จอ QR เช็คอิน</Tag>)</p>
    </div>
    {scanning && <Modal title="สแกน QR บนบัตร" onClose={() => setScanning(false)}><QrScanner onScan={preview} onError={(msg) => { setScanning(false); setResult({ ok: false, error: msg }); }} /><p>หรือใช้แอปกล้องของมือถือสแกน — QR บนบัตรจะเปิดหน้านี้พร้อมการ์ดยืนยันให้เอง</p></Modal>}
    {pending && <CheckinCard t={pending} onConfirm={confirm} onClose={() => setPending(null)} onNext={() => { setPending(null); setScanning(true); }} />}
  </div>;
}

// รหัสบัตรจากช่องพิมพ์หรือ QR (QR บนบัตรเป็น URL /ticket/รหัส · ของเดิมเป็น /admin?checkin=รหัส)
const codeOf = (raw) => { const m = String(raw || '').match(/(?:checkin=|\/ticket\/)([A-Za-z0-9]{6,12})/) || String(raw || '').trim().match(/^([A-Za-z0-9]{6,12})$/); return m ? m[1].toUpperCase() : ''; };

const AREA_TITLE = { events: 'กิจกรรม', albums: 'อัลบั้มรูป', shop: 'ร้านค้า', members: 'สมาชิก', scan: 'สแกน QR เช็คอิน' };

// area มาจาก URL (/admin/events · /admin/events/:slug · /admin/shop · /admin/members · /admin/scan)
export default function AdminPage({ area = 'events', slug = null }) {
  const mounted = useMounted();
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(null);   // null = กำลังเช็ค session
  const [admin, setAdmin] = useState(null);
  useEffect(() => { api('/admin/me').then(r => { setAdmin(r.admin); setAuthed(true); }).catch(() => setAuthed(!!getAdminKey())); }, []);
  const logout = async () => { await api('/admin/logout', { method: 'POST' }).catch(() => {}); setAdminKey(''); setAuthed(false); setAdmin(null); };
  const [events, setEvents] = useState(null);
  const refresh = () => api('/admin/overview', { admin: true }).then(setEvents).catch(e => { if (e.status === 401) { setAdminKey(''); setAuthed(false); } });
  useEffect(() => { if (authed && area === 'events') refresh(); }, [authed, area]); // eslint-disable-line react-hooks/exhaustive-deps

  const editing = slug === 'new' || (slug && slug.endsWith('/edit'));
  const activeSlug = slug === 'new' ? null : slug?.replace(/\/edit$/, '') || null;
  const active = events?.find(e => e.slug === activeSlug) || null;
  const [form, setForm] = useState(null);       // ข้อมูลเต็มของงานที่กำลังแก้ (null = ยังโหลดไม่เสร็จ)
  useEffect(() => {
    if (!editing) return setForm(null);
    if (slug === 'new') return setForm('new');
    setForm(null);
    api(`/admin/events/${activeSlug}/full`, { admin: true }).then(setForm).catch(() => navigate(`/admin/events/${activeSlug}`));
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const title = area === 'events' && active ? active.title : AREA_TITLE[area] || 'หน้าจัดการ';
  const actions = area === 'events' && !editing
    ? <Link className="button dark small" to="/admin/events/new">+ เพิ่มกิจกรรม</Link>
    : null;

  if (!mounted || authed === null) return <div className="ad-boot"><PageLoader /></div>;
  if (!authed) return <div className="ad-boot"><Login onDone={(a) => { setAdmin(a); setAuthed(true); }} /></div>;

  return <AdminShell area={area} title={title} admin={admin} onLogout={logout} actions={actions}>
    {area === 'albums' ? (slug ? <AlbumDetail slug={slug} /> : <AlbumsOverview />)
      : area === 'shop' ? <ShopAdmin />
      : area === 'members' ? <Members />
        : area === 'scan' ? <ScanArea onCheckedIn={() => { if (events) refresh(); }} />
          : editing ? <div className="ad-card ad-form">
            <Link className="link-button" to={activeSlug ? `/admin/events/${activeSlug}` : '/admin/events'}>← กลับไปที่{activeSlug ? 'งานนี้' : 'รายการกิจกรรม'}</Link>
            {form ? <EventAdminForm initial={form === 'new' ? null : form} onCancel={() => navigate(activeSlug ? `/admin/events/${activeSlug}` : '/admin/events')} onSaved={async (saved) => { await refresh(); navigate(`/admin/events/${saved}`); }} /> : <PageLoader />}
          </div>
            : !events ? <PageLoader />
              : <div className="ad-events">
                <aside className="admin-list">
                  {events.map(ev => { const p = Number(ev.pendingBookings) + Number(ev.pendingDonations); return <Link key={ev.slug} to={`/admin/events/${ev.slug}`} className={`admin-item ${active?.slug === ev.slug ? 'active' : ''}`}>
                    <span className="eyebrow">{typeLabel[ev.type]} · {eventDate(ev).long}</span>
                    <strong>{ev.title}</strong>
                    <span className="admin-item-meta"><StatusPill status={ev.status} />{p > 0 && <span className="mini-tag warn">{p} รอตรวจ</span>}{Number(ev.registrations) > 0 && <span className="mini-tag">{ev.registrations} ลงทะเบียน</span>}</span>
                  </Link>; })}
                </aside>
                <section className="ad-event-panel">
                  {active
                    ? <EventAdmin key={active.slug + active.status} ev={active} refresh={refresh} onEdit={() => navigate(`/admin/events/${active.slug}/edit`)} onDeleted={async () => { await refresh(); navigate('/admin/events'); }} />
                    : <div className="ad-empty"><Icon name="calendar" size={32} /><p>เลือกกิจกรรมจากรายการด้านซ้ายเพื่อจัดการ</p></div>}
                </section>
              </div>}
  </AdminShell>;
}
