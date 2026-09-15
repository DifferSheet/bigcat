'use client';
import React, { useEffect, useState } from 'react';
import { Link } from '../lib/nav.jsx';
import { SiteHeader, SiteFooter, StatusPill, Notice } from '../components/EventShell.jsx';
import { Icon, PageLoader } from '../components/ui.jsx';
import { api, getAdminKey, setAdminKey } from '../lib/api.js';
import { useMounted } from '../lib/useMounted.js';
import { eventDate, typeLabel, baht } from '../lib/format.js';
import dynamic from 'next/dynamic';

const ShopAdmin = dynamic(() => import('./ShopAdmin.jsx'), { ssr: false, loading: () => <PageLoader /> });
const EventAdminForm = dynamic(() => import('./EventAdminForm.jsx'), { ssr: false, loading: () => <PageLoader /> });

const STATUSES = ['upcoming', 'open', 'soldout', 'live', 'ended'];

function Login({ onDone }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setAdminKey(key);
    try { await api('/admin/ping', { admin: true }); onDone(); } catch (err) { setAdminKey(''); setError(err.message); }
  };
  return <div className="ticket-lookup"><span className="eyebrow">STAFF ONLY</span><h1>เข้าสู่ระบบแอดมิน</h1><p>ใส่รหัสผู้ดูแล (ADMIN_KEY ในไฟล์ .env)</p>
    <form onSubmit={submit}><input id="ad-key" type="password" value={key} onChange={e => setKey(e.target.value)} placeholder="รหัสผู้ดูแล" autoFocus /><button className="button dark">เข้าสู่ระบบ <Icon name="arrow" /></button></form>
    {error && <p className="notice error">{error}</p>}</div>;
}

// เครื่องมือเฉพาะงานทำบุญ: ยอดแยกหมวด, CSV, ขอบคุณทาง LINE, รายงานความโปร่งใส
function MeritTools({ ev, onMsg }) {
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
  const [confirmDel, setConfirmDel] = useState(false);
  const remove = async () => { setMsg(''); try { await api(`/admin/events/${ev.slug}`, { method: 'DELETE', admin: true }); onDeleted(); } catch (e) { setMsg(e.message); setConfirmDel(false); } };
  const [rows, setRows] = useState(null);
  const [msg, setMsgRaw] = useState('');
  const [msgTone, setMsgTone] = useState('error');
  const setMsg = (m, tone = 'error') => { setMsgRaw(m); setMsgTone(tone); };
  const [sel, setSel] = useState([]);
  const load = async () => {
    setRows(null);
    if (ev.type === 'fanmeet') setRows({ bookings: await api(`/admin/events/${ev.slug}/bookings`, { admin: true }) });
    else if (ev.type === 'merit') setRows({ donations: await api(`/admin/events/${ev.slug}/donations`, { admin: true }) });
    else setRows({ registrations: await api(`/admin/events/${ev.slug}/registrations`, { admin: true }) });
  };
  useEffect(() => { load().catch(e => setMsg(e.message)); }, [ev.slug]);
  const act = async (path) => { setMsg(''); try { await api(path, { method: 'POST', admin: true }); await load(); refresh(); } catch (e) { setMsg(e.message); } };
  const bulk = async (action) => { setMsg(''); try { const r = await api('/admin/donations/bulk', { method: 'POST', body: { ids: sel, action }, admin: true }); setMsg(`${action === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ'}แล้ว ${r.count} รายการ`, 'ok'); setSel([]); await load(); refresh(); } catch (e) { setMsg(e.message); } };
  const toggleSel = (id) => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const setStatus = async (status) => { setMsg(''); try { await api(`/admin/events/${ev.slug}`, { method: 'PATCH', body: { status }, admin: true }); refresh(); } catch (e) { setMsg(e.message); } };
  const show = (list, key) => tab === 'all' ? list : list.filter(x => key(x));

  return <div className="admin-event">
    <div className="admin-event-head">
      <div><span className="eyebrow">{typeLabel[ev.type]}</span><h2>{ev.title}</h2></div>
      <label className="status-select">สถานะ <select value={ev.status} onChange={e => setStatus(e.target.value)}>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
      <button className="button ghost small" onClick={onEdit}>แก้ไขงาน</button>
      {confirmDel ? <span className="confirm-del"><span>ลบ <span className="tag-label">{ev.title}</span> ถาวร?</span><button className="button dark small danger" onClick={remove}>ลบเลย</button><button className="link-button" onClick={() => setConfirmDel(false)}>ไม่ลบ</button></span> : <button className="link-button" onClick={() => setConfirmDel(true)}>ลบงาน</button>}
      <Link className="button ghost small" to={`/events/${ev.slug}`}>ดูหน้าเว็บ ↗</Link>
      {ev.type === 'busking' && <Link className="button dark small" to={`/events/${ev.slug}/draw`}>จอสุ่ม Lucky Fan 🎲</Link>}
    </div>
    {msg && <Notice tone={msgTone === 'ok' ? 'info' : 'error'}>{msg}</Notice>}
    {ev.type === 'merit' && <MeritTools ev={ev} onMsg={setMsg} />}
    <div className="tabs-row"><div className="filter-tabs"><button className={tab === 'pending' ? 'active' : ''} onClick={() => setTab('pending')}>รอตรวจ</button><button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>ทั้งหมด</button></div>
      {rows?.donations && sel.length > 0 && <div className="bulk-bar"><span>เลือก {sel.length} รายการ</span><button className="button dark small" onClick={() => bulk('approve')}>อนุมัติทั้งหมด</button><button className="link-button" onClick={() => bulk('reject')}>ปฏิเสธ</button></div>}</div>
    {!rows ? <PageLoader /> : <div className="table-wrap"><table className="admin-table">
      {rows.bookings && <><thead><tr><th>รหัส</th><th>ชื่อ</th><th>ที่นั่ง</th><th>ยอด</th><th>สลิป</th><th>สถานะ</th><th></th></tr></thead><tbody>{show(rows.bookings, b => b.status === 'pending').map(b => <tr key={b.id}><td className="code">{b.code}</td><td>{b.name}<br /><small>{b.phone}</small></td><td>{b.seats.join(', ')}</td><td>{baht(b.amount)}</td><td>{b.slip_path ? <a href={b.slip_path} target="_blank" rel="noreferrer">ดูสลิป</a> : '—'}{b.verify_note && <><br /><small className={b.verified_at ? 'ok-text' : ''}>{b.verify_note}</small></>}</td><td>{b.status}{b.verified_at && <span className="mini-tag ok">auto</span>}</td><td className="actions">{b.status === 'pending' && <><button className="button dark small" onClick={() => act(`/admin/bookings/${b.id}/approve`)}>อนุมัติ</button><button className="link-button" onClick={() => act(`/admin/bookings/${b.id}/reject`)}>ปฏิเสธ</button></>}{b.status === 'paid' && <button className="button ghost small" onClick={() => act(`/admin/bookings/${b.id}/checkin`)}>เช็คอิน</button>}</td></tr>)}</tbody></>}
      {rows.donations && (() => { const list = show(rows.donations, d => d.status === 'pending'); const pendingIds = list.filter(d => d.status === 'pending').map(d => d.id); return <><thead><tr><th><input type="checkbox" aria-label="เลือกทั้งหมด" checked={pendingIds.length > 0 && pendingIds.every(id => sel.includes(id))} onChange={e => setSel(e.target.checked ? pendingIds : [])} /></th><th>รหัส</th><th>ผู้ร่วมบุญ</th><th>หมวด</th><th>ยอด</th><th>สลิป / ผลตรวจ</th><th>สถานะ</th><th></th></tr></thead><tbody>{list.map(d => <tr key={d.id}><td>{d.status === 'pending' && <input type="checkbox" checked={sel.includes(d.id)} onChange={() => toggleSel(d.id)} aria-label={`เลือก ${d.code}`} />}</td><td className="code">{d.code}{d.line_user_id && <span className="mini-tag">LINE</span>}</td><td>{d.donor_name}{d.dedication && <><br /><small>{d.dedication}</small></>}{d.message && <><br /><small>“{d.message}”</small></>}</td><td>{d.units ? `${d.units} × ` : ''}{d.category}</td><td>{baht(d.amount)}</td><td>{d.slip_path ? <a href={d.slip_path} target="_blank" rel="noreferrer">ดูสลิป</a> : '—'}{d.verify_note && <><br /><small className={d.verified_at ? 'ok-text' : ''}>{d.verify_note}</small></>}</td><td>{d.status}{d.verified_at && <span className="mini-tag ok">auto</span>}</td><td className="actions">{d.status === 'pending' && <><button className="button dark small" onClick={() => act(`/admin/donations/${d.id}/approve`)}>อนุมัติ</button><button className="link-button" onClick={() => act(`/admin/donations/${d.id}/reject`)}>ปฏิเสธ</button></>}</td></tr>)}</tbody></>; })()}
      {rows.registrations && <><thead><tr><th>#</th><th>ชื่อ</th><th>โซเชียล</th><th>รหัส</th><th>เช็คอิน</th><th></th></tr></thead><tbody>{show(rows.registrations, r => !r.checked_in_at).map(r => <tr key={r.id}><td>{String(r.number).padStart(3, '0')}</td><td>{r.nickname || r.name}<br /><small>{r.name}{r.phone ? ` · ${r.phone}` : ''}</small></td><td>{r.social || '—'}{r.kind && r.kind !== 'attend' && <small> · {r.kind}</small>}</td><td className="code">{r.code}{r.lineLinked ? <span className="mini-tag">LINE</span> : null}</td><td>{r.checked_in_at ? '✓' : '—'}</td><td className="actions">{!r.checked_in_at && <button className="button ghost small" onClick={() => act(`/admin/checkin/${r.code}`)}>เช็คอินให้</button>}</td></tr>)}</tbody></>}
    </table></div>}
  </div>;
}

export default function AdminPage() {
  const mounted = useMounted();
  const [authed, setAuthed] = useState(false);
  const [area, setArea] = useState('events');
  // อ่านคีย์/พาธหลัง hydrate เพื่อให้ HTML ฝั่ง server ตรงกับ client
  useEffect(() => { setAuthed(!!getAdminKey()); setArea(location.pathname.includes('/admin/shop') ? 'shop' : 'events'); }, []);
  const [events, setEvents] = useState(null);
  const [active, setActive] = useState(null);
  const [scan, setScan] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [form, setForm] = useState(null);   // null | 'new' | {…ข้อมูลเต็มของงานที่แก้}
  const openEdit = async (slug) => { try { setForm(await api(`/admin/events/${slug}/full`, { admin: true })); } catch { /* แสดงใน EventAdmin */ } };
  const refresh = () => api('/admin/overview', { admin: true }).then(list => { setEvents(list); setActive(a => a ? list.find(e => e.slug === a.slug) : list[0]); }).catch(e => { if (e.status === 401) { setAdminKey(''); setAuthed(false); } });
  useEffect(() => { if (authed) refresh(); }, [authed]);

  const checkin = async (e) => {
    e.preventDefault(); setScanResult(null);
    try { setScanResult({ ok: true, ...(await api(`/admin/checkin/${scan.trim()}`, { method: 'POST', admin: true })) }); setScan(''); refresh(); }
    catch (err) { setScanResult({ ok: false, error: err.message }); }
  };

  return <><SiteHeader /><main className="ev-page">
    {!mounted ? <PageLoader /> : !authed ? <Login onDone={() => setAuthed(true)} /> : <>
      <div className="admin-head"><div><span className="eyebrow">STAFF DASHBOARD</span><h1>{area === 'shop' ? 'จัดการร้านค้า' : 'จัดการกิจกรรม'}</h1></div>{area === 'events' && <button className="button dark small" onClick={() => setForm('new')}>+ เพิ่มกิจกรรม</button>}<div className="area-tabs"><button className={area === 'events' ? 'active' : ''} onClick={() => { setArea('events'); history.replaceState(null, '', '/admin'); }}>กิจกรรม</button><button className={area === 'shop' ? 'active' : ''} onClick={() => { setArea('shop'); history.replaceState(null, '', '/admin/shop'); }}>ร้านค้า</button><button className="link-button" onClick={() => { setAdminKey(''); setAuthed(false); }}>ออกจากระบบ</button></div></div>
      {area === 'shop' ? <ShopAdmin /> : form ? <div className="admin-panel"><EventAdminForm initial={form === 'new' ? null : form} onCancel={() => setForm(null)} onSaved={async (slug) => { setForm(null); const list = await api('/admin/overview', { admin: true }); setEvents(list); setActive(list.find(e => e.slug === slug) || list[0]); }} /></div> : <>
      <form className="scan-box" onSubmit={checkin}><Icon name="check" /><input id="ad-scan" value={scan} onChange={e => setScan(e.target.value)} placeholder="เช็คอินหน้างาน: พิมพ์/สแกนรหัสบัตร" /><button className="button dark small">เช็คอิน</button>{scanResult && <span className={`notice ${scanResult.ok ? '' : 'error'}`}>{scanResult.ok ? `${scanResult.already ? 'เช็คอินไปแล้ว' : 'เช็คอินสำเร็จ'}: ${scanResult.name}${scanResult.seats ? ` (${scanResult.seats.join(', ')})` : scanResult.number ? ` #${scanResult.number}` : ''}` : scanResult.error}</span>}</form>
      {!events ? <PageLoader /> : <div className="admin-layout">
        <aside className="admin-list">{events.map(ev => { const pending = Number(ev.pendingBookings) + Number(ev.pendingDonations); return <button key={ev.slug} className={`admin-item ${active?.slug === ev.slug ? 'active' : ''}`} onClick={() => setActive(ev)}><span className="eyebrow">{typeLabel[ev.type]} · {eventDate(ev).long}</span><strong>{ev.title}</strong><span className="admin-item-meta"><StatusPill status={ev.status} />{pending > 0 && <span className="badge-count">{pending} รอตรวจ</span>}</span></button>; })}</aside>
        {active && <EventAdmin key={active.slug + active.status} ev={active} refresh={refresh} onEdit={() => openEdit(active.slug)} onDeleted={async () => { const list = await api('/admin/overview', { admin: true }); setEvents(list); setActive(list[0] || null); }} />}
      </div>}
      </>}
    </>}
  </main><SiteFooter /></>;
}
