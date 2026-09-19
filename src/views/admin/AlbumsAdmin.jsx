'use client';
// เมนู «อัลบั้ม» — ภาพรวมทุกงาน + จัดการอัลบั้มของงานเดียว (อัปโหลด · คัดรูป · เผยแพร่ · ทบทวนใบหน้า · คำขอเอารูปออก)
import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from '../../lib/nav.jsx';
import { Notice } from '../../components/EventShell.jsx';
import { Icon, PageLoader, Modal, Tag } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { eventDate, typeLabel, parseDate } from '../../lib/format.js';

const mb = (b) => (!b ? '—' : b > 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.round(b / 1e6)} MB`);
const fmt = (d) => { const x = parseDate(d); return x ? x.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : ''; };
const CHUNK = 4;
const LAYOUTS = [
  { key: 'auto', name: 'อัตโนมัติ', note: 'เลือกให้ตามประเภทงานและรูปที่มี' },
  { key: 'warm', name: 'อบอุ่น', note: 'รูปหมู่ใหญ่ รูปคู่รอง' },
  { key: 'playful', name: 'สนุก', note: 'สองรูปเอียงเล็กน้อย' },
  { key: 'special', name: 'พิเศษ', note: 'รูปคู่เด่นกว่ารูปหมู่' },
  { key: 'merit', name: 'ทำบุญ', note: 'จัดตรง เรียบ ขอบทอง' },
];   // อัปทีละ 4 ไฟล์ — ล้มก็ลองใหม่เฉพาะชุดที่ล้ม

/* ---------- ภาพรวม ---------- */
export function AlbumsOverview() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api('/admin/albums', { admin: true }).then(setD).catch(e => setErr(e.message)); }, []);
  if (err) return <Notice tone="error">{err}</Notice>;
  if (!d) return <PageLoader />;
  const t = d.totals;
  return <div className="ab-overview">
    <div className="stat-tiles">
      <div><span className="eyebrow">รูปทั้งหมด</span><strong>{t.photos}</strong><small>{mb(t.bytes)} · เก็บที่ {d.storage === 's3' ? 'S3' : 'ดิสก์เซิร์ฟเวอร์'}</small></div>
      <div><span className="eyebrow">กำลังสแกนใบหน้า</span><strong>{t.pending}</strong><small>{d.facesEnabled ? `${d.provider} · เกณฑ์ ${Math.round(d.threshold * 100)}%` : 'ปิดการจับคู่'}</small></div>
      <div className={t.removals ? 'warn' : ''}><span className="eyebrow">คำขอเอารูปออก</span><strong>{t.removals}</strong><small>{t.removals ? 'รอทีมพิจารณา' : 'ไม่มีค้าง'}</small></div>
    </div>
    <div className="ab-grid">
      {d.albums.map(a => <Link key={a.slug} to={`/admin/albums/${a.slug}`} className={`ab-card ${a.photos ? '' : 'empty'}`}>
        <span className="ab-cover">{a.preview ? <img src={a.preview} alt="" loading="lazy" /> : <Icon name="camera" size={26} />}</span>
        <span className="ab-card-body">
          <span className="eyebrow">{typeLabel[a.type]} · {eventDate(a).long}</span>
          <strong>{a.title}</strong>
          <span className="ab-tags">
            {a.photos > 0 ? <><b className="mini-tag">{a.photos} รูป</b><b className={`mini-tag ${a.published ? 'ok' : 'warn'}`}>{a.published ? 'เผยแพร่แล้ว' : 'ยังไม่เผยแพร่'}</b></> : <b className="mini-tag via">ยังไม่มีรูป</b>}
            {Number(a.pending) > 0 && <b className="mini-tag">สแกน {a.pending}</b>}
            {Number(a.failed) > 0 && <b className="mini-tag dup">ล้มเหลว {a.failed}</b>}
            {Number(a.members) > 0 && <b className="mini-tag ok">👤 {a.members} คน</b>}
            {Number(a.removals) > 0 && <b className="mini-tag dup">คำขอลบ {a.removals}</b>}
          </span>
        </span>
      </Link>)}
    </div>
  </div>;
}

/* ---------- ทบทวนใบหน้า ---------- */
function FaceReview({ slug, onClose, onChanged }) {
  const [d, setD] = useState(null);
  const [state, setState] = useState('unknown');
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState('');
  const load = () => api(`/admin/albums/${slug}/faces?state=${state === 'all' ? 'all' : 'unknown'}`, { admin: true }).then(setD).catch(e => setErr(e.message));
  useEffect(() => { setD(null); load(); }, [slug, state]); // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (id, body) => {
    setBusy(id); setErr('');
    try { await api(`/admin/album/faces/${id}/assign`, { method: 'POST', body, admin: true }); setD(x => ({ ...x, faces: x.faces.filter(f => state === 'all' || f.id !== id) })); onChanged?.(); }
    catch (e) { setErr(e.message); } finally { setBusy(null); }
  };
  return <Modal title="ทบทวนใบหน้าในอัลบั้ม" wide onClose={onClose}>
    <div className="filter-tabs"><button className={state === 'unknown' ? 'active' : ''} onClick={() => setState('unknown')}>ยังไม่รู้ว่าใคร</button><button className={state === 'all' ? 'active' : ''} onClick={() => setState('all')}>ทั้งหมด</button></div>
    {err && <Notice tone="error">{err}</Notice>}
    {!d ? <PageLoader /> : !d.faces.length ? <p className="muted">ไม่มีใบหน้าที่ต้องทบทวนในตัวกรองนี้</p> : <>
      <p className="small-note">ผูกได้เฉพาะสมาชิกที่เช็คอินงานนี้ ({d.members.length} คน) · เจ้าตัวกด <Tag>ไม่ใช่ฉัน</Tag> ถอนได้เสมอ · ใบหน้าของมาสคอต/โปสเตอร์ให้กด «ไม่ใช่คน»</p>
      <div className="face-grid">{d.faces.map(f => <div key={f.id} className={`face-cell ${busy === f.id ? 'busy' : ''}`}>
        <img src={`/api/admin/album/faces/${f.id}/crop`} alt="" loading="lazy" />
        {f.display_name ? <small className="ok-text">{f.display_name}{f.status === 'confirmed' ? ' ✓' : ''}</small> : <small className="muted">ยังไม่รู้ว่าใคร</small>}
        <select disabled={busy === f.id} value={f.user_id || ''} onChange={e => act(f.id, { userId: e.target.value || null })}>
          <option value="">— เลือกสมาชิก —</option>
          {d.members.map(m => <option key={m.id} value={m.id}>{m.display_name}</option>)}
        </select>
        <button type="button" className="link-button" disabled={busy === f.id} onClick={() => act(f.id, { notPerson: true })}>ไม่ใช่คน</button>
      </div>)}</div>
    </>}
  </Modal>;
}

/* ---------- อัลบั้มของงานเดียว ---------- */
export function AlbumDetail({ slug }) {
  const navigate = useNavigate();
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [sel, setSel] = useState([]);
  const [filter, setFilter] = useState('all');
  const [prog, setProg] = useState(null);      // { done, total, failed }
  const [faces, setFaces] = useState(false);
  const [over, setOver] = useState(false);
  const failedFiles = useRef([]);
  const load = () => api(`/admin/albums/${slug}`, { admin: true }).then(setD).catch(e => setErr(e.message));
  useEffect(() => { load(); }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!d?.photos.some(p => p.scan === 'pending')) return; const t = setTimeout(load, 3000); return () => clearTimeout(t); }, [d]); // eslint-disable-line react-hooks/exhaustive-deps

  const upload = async (files) => {
    const list = Array.from(files || []).filter(f => f.type.startsWith('image/'));
    if (!list.length) return;
    setMsg(''); setErr(''); failedFiles.current = [];
    let added = 0, dup = 0, failed = 0;
    setProg({ done: 0, total: list.length, failed: 0 });
    for (let i = 0; i < list.length; i += CHUNK) {
      const part = list.slice(i, i + CHUNK);
      try {
        const fd = new FormData(); part.forEach(f => fd.append('photos', f));
        const r = await api(`/admin/albums/${slug}/photos`, { method: 'POST', body: fd, admin: true });
        added += r.added; dup += r.duplicate;
      } catch { failed += part.length; failedFiles.current.push(...part); }
      setProg({ done: Math.min(list.length, i + CHUNK), total: list.length, failed });
    }
    setProg(null);
    setMsg(`อัปโหลดแล้ว ${added} รูป${dup ? ` · ข้ามไฟล์ซ้ำ ${dup}` : ''}${failed ? ` · ล้มเหลว ${failed} รูป — กดปุ่มข้างนี้ หรือลากโฟลเดอร์เดิมมาวางใหม่ก็ได้ (รูปที่ขึ้นแล้วจะถูกข้าม)` : ''}`);
    load();
  };
  const bulk = async (action) => {
    if (!sel.length) return;
    if (action === 'delete' && !confirm(`ลบ ${sel.length} รูปถาวร?`)) return;
    setMsg('');
    try { const r = await api(`/admin/albums/${slug}/bulk`, { method: 'POST', body: { ids: sel, action }, admin: true }); setSel([]); setMsg(`ทำกับ ${r.count} รูปแล้ว`); load(); }
    catch (e) { setErr(e.message); }
  };
  const mark = async (id, on) => { setMsg(''); try { await api(`/admin/albums/${slug}/bulk`, { method: 'POST', body: { ids: [id], action: on ? 'group' : 'ungroup' }, admin: true }); load(); } catch (e) { setErr(e.message); } };
  const setGroup = async (id) => { setMsg(''); try { await api(`/admin/albums/${slug}/group-photo`, { method: 'POST', body: { id }, admin: true }); setMsg(id ? 'ตั้งเป็นรูปหมู่ของงานแล้ว — จะไปโชว์ในสมุด Passport ของทุกคนที่ได้แสตมป์งานนี้' : 'เอารูปหมู่ออกแล้ว'); load(); } catch (e) { setErr(e.message); } };
  const setLayout = async (layout) => { setMsg(''); try { await api(`/admin/albums/${slug}/layout`, { method: 'POST', body: { layout }, admin: true }); setMsg('เปลี่ยนเทมเพลตหน้าในสมุด Passport แล้ว'); load(); } catch (e) { setErr(e.message); } };
  const publish = async (next) => { try { await api(`/admin/albums/${slug}/publish`, { method: 'POST', body: { published: next }, admin: true }); load(); } catch (e) { setErr(e.message); } };
  const removal = async (id, action) => { try { await api(`/admin/album/removals/${id}/${action}`, { method: 'POST', admin: true }); load(); } catch (e) { setErr(e.message); } };

  if (err && !d) return <Notice tone="error">{err}</Notice>;
  if (!d) return <PageLoader />;
  const FILTERS = [['all', 'ทั้งหมด'], ['matched', 'มีสมาชิก'], ['single', 'เดี่ยว/คู่'], ['nomatch', 'ไม่ได้จับคู่'], ['group', 'รูปหมู่ที่เลือกไว้'], ['featured', 'พรีวิว'], ['unknown', 'หน้าที่ยังไม่รู้จัก']];
  const keep = (p) => filter === 'all' || (filter === 'matched' ? p.matched > 0 : filter === 'single' ? p.scan === 'done' : filter === 'nomatch' ? p.scan === 'skipped' : filter === 'group' ? !!p.group_ok : filter === 'featured' ? !!p.featured : p.unknown > 0);
  const list = d.photos.filter(keep);
  const stat = { done: d.photos.filter(p => p.scan === 'done').length, skipped: d.photos.filter(p => p.scan === 'skipped').length, pending: d.photos.filter(p => p.scan === 'pending').length, failed: d.photos.filter(p => p.scan === 'failed').length, matched: d.photos.filter(p => p.matched > 0).length, bytes: d.photos.reduce((n, p) => n + Number(p.bytes || 0), 0) };

  return <div className="ab-detail">
    <div className="ab-head">
      <div><Link className="link-button" to="/admin/albums">← อัลบั้มทั้งหมด</Link>
        <h2>{d.event.title}</h2>
        <p className="muted">{eventDate(d.event).long} · {d.photos.length} รูป · {mb(stat.bytes)}</p></div>
      <div className="ab-head-actions">

        <button type="button" className={`button ${d.event.published ? 'ghost' : 'dark'} small`} onClick={() => publish(!d.event.published)}>{d.event.published ? 'ซ่อนอัลบั้ม' : 'เผยแพร่อัลบั้ม'}</button>
        <Link className="button ghost small" to={`/events/${slug}/album`} target="_blank">ดูแบบที่แฟนเห็น ↗</Link>
        {d.facesEnabled && <button type="button" className="button ghost small" onClick={() => setFaces(true)}>ทบทวนใบหน้า</button>}
      </div>
    </div>
    <section className="ab-layouts">
      <span className="eyebrow">เทมเพลตหน้าในสมุด Passport</span>
      <div className="ab-layout-row">{LAYOUTS.map(l => <button key={l.key} type="button" className={`ab-layout-card ${d.event.layout === l.key ? 'active' : ''}`} onClick={() => setLayout(l.key)}>
        <span className={`ab-layout-preview ly-${l.key}`} aria-hidden="true"><i /><i /></span>
        <strong>{l.name}</strong><small>{l.note}</small>
      </button>)}</div>
    </section>

    <Notice tone={d.event.published ? 'info' : 'muted'}>{d.event.published
      ? <>อัลบั้มนี้เปิดให้คนที่<strong>เช็คอินงานนี้</strong>ดูได้แล้ว · คนอื่นเห็นพรีวิว {d.photos.filter(p => p.featured).length || 3} รูป</>
      : <>ยังไม่เผยแพร่ — คัดรูปให้เรียบร้อยแล้วกด <Tag>เผยแพร่อัลบั้ม</Tag> แฟน ๆ ถึงจะเห็น</>}</Notice>

    <label className={`ab-drop ${prog ? 'busy' : ''} ${over ? 'over' : ''}`}
      onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files); }}>
      <input type="file" accept="image/*" multiple disabled={!!prog} onChange={e => { upload(e.target.files); e.target.value = ''; }} />
      <Icon name="upload" size={22} />
      {prog ? <span><strong>{prog.done}/{prog.total}</strong> กำลังอัปโหลด…{prog.failed ? ` · ล้มเหลว ${prog.failed}` : ''}</span>
        : <span>ลากรูปทั้งโฟลเดอร์มาวาง หรือกดเพื่อเลือก — ระบบย่อรูป คัดรูปเดี่ยว/คู่ และจับคู่ใบหน้าให้เอง (ไฟล์ซ้ำจะถูกข้าม)</span>}
    </label>
    {msg && <Notice>{msg}{failedFiles.current.length > 0 && !prog && <> <button type="button" className="button dark small" onClick={() => upload(failedFiles.current)}>ลองอัปโหลดอีกครั้ง ({failedFiles.current.length})</button></>}</Notice>}
    {err && <Notice tone="error">{err}</Notice>}

    <p className="checkin-stats">
      <span>เดี่ยว/คู่ (จับคู่ได้) <strong>{stat.done}</strong></span>
      <span>รูปหมู่/ไม่มีหน้า <strong>{stat.skipped}</strong></span>
      {stat.pending > 0 && <span>กำลังสแกน <strong>{stat.pending}</strong></span>}
      {stat.failed > 0 && <span className="danger">ล้มเหลว <strong>{stat.failed}</strong> <button type="button" className="link-button" onClick={() => { setSel(d.photos.filter(p => p.scan === 'failed').map(p => p.id)); }}>เลือกทั้งหมด</button></span>}
      <span>มีสมาชิกในรูป <strong>{stat.matched}</strong></span>
      <span className="muted">{d.facesEnabled ? `จับคู่ด้วย ${d.provider}` : 'ปิดการจับคู่ใบหน้า'}</span>
    </p>

    {d.removals.length > 0 && <div className="removal-list"><strong>คำขอเอารูปออก ({d.removals.length})</strong>
      {d.removals.map(r => { const p = d.photos.find(x => x.id === r.photo_id); return <div key={r.id} className="removal-row">{p && <img src={p.thumb} alt="" />}<span>{r.display_name}{r.reason ? ` — ${r.reason}` : ''} <small className="muted">{fmt(r.created_at)}</small></span><button className="button dark small" onClick={() => removal(r.id, 'done')}>ลบรูป</button><button className="link-button" onClick={() => removal(r.id, 'declined')}>ไม่ลบ</button></div>; })}
    </div>}

    <div className="tabs-row">
      <div className="filter-tabs">{FILTERS.map(([k, label]) => <button key={k} className={filter === k ? 'active' : ''} onClick={() => setFilter(k)}>{label}</button>)}</div>
      <span className="ab-tools">
        <button type="button" className="link-button" onClick={async () => { setMsg(''); try { const r = await api(`/admin/albums/${slug}/bulk`, { method: 'POST', body: { action: 'group-auto' }, admin: true }); setMsg(`ทำเครื่องหมายรูปหมู่อัตโนมัติ ${r.count} รูป (คนตั้งแต่ ${r.threshold} คนขึ้นไป)`); load(); } catch (e) { setErr(e.message); } }}>ทำเครื่องหมายรูปหมู่อัตโนมัติ (คน ≥ {d.groupMinFaces || 20})</button>
      <label className="check-all"><input type="checkbox" checked={list.length > 0 && list.every(p => sel.includes(p.id))} onChange={e => setSel(e.target.checked ? list.map(p => p.id) : [])} /> เลือกทั้งหมดในมุมมองนี้</label>
      </span>
    </div>
    {sel.length > 0 && <div className="bulk-bar"><span>เลือก {sel.length} รูป</span>
      <button className="button dark small" onClick={() => bulk('feature')}>ตั้งเป็นพรีวิว</button>
      <button className="button ghost small" onClick={() => bulk('unfeature')}>เอาออกจากพรีวิว</button>
      <button className="button ghost small" onClick={() => bulk('group')}>ทำเครื่องหมายรูปหมู่</button>
      <button className="button ghost small" onClick={() => bulk('ungroup')}>เอาออกจากรูปหมู่</button>
      <button className="button ghost small" onClick={() => bulk('rescan')}>สแกนใหม่</button>
      <button className="link-button danger" onClick={() => bulk('delete')}>ลบ</button>
      <button className="link-button" onClick={() => setSel([])}>ยกเลิกการเลือก</button>
    </div>}

    {!list.length ? <p className="muted">ไม่มีรูปในมุมมองนี้</p> : <div className="ab-photos">{list.map(p => {
      const on = sel.includes(p.id);
      const isGroup = d.event.groupPhotoId === p.id;
      return <figure key={p.id} className={`ab-tile ${p.scan} ${on ? 'on' : ''} ${isGroup ? 'is-group' : ''}`} title={p.matched_names || ''} onClick={e => { if (e.shiftKey) e.preventDefault(); setSel(s => on ? s.filter(x => x !== p.id) : [...s, p.id]); }}>
        <img src={p.thumb} alt="" loading="lazy" />
        <span className="ab-check">{on ? '✓' : ''}</span>
        <span className="aa-badges">
          {p.scan === 'pending' ? <b className="mini-tag">สแกน…</b> : p.scan === 'done' ? <b className="mini-tag ok">{p.faces === 1 ? 'เดี่ยว' : p.faces === 2 ? 'คู่' : `${p.faces} คน`}</b> : p.scan === 'failed' ? <b className="mini-tag dup">ล้มเหลว</b> : <b className="mini-tag via">{p.faces ? `หมู่ ${p.faces}` : 'ไม่มีหน้า'}</b>}
          {p.matched > 0 && <b className="mini-tag warn">👤 {p.matched}</b>}
          {!!p.featured && <b className="mini-tag ok">พรีวิว</b>}{isGroup && <b className="mini-tag warn">รูปหมู่หลัก</b>}{!!p.group_ok && !isGroup && <b className="mini-tag via">รูปหมู่</b>}
        </span>
        <a className="ab-open" href={p.view} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} aria-label="เปิดรูปเต็ม">↗</a>
        <span className="ab-tile-actions">
          <button type="button" className="link-button" onClick={e => { e.stopPropagation(); mark(p.id, !p.group_ok); }}>{p.group_ok ? 'เอาออกจากรูปหมู่' : 'ทำเครื่องหมายรูปหมู่'}</button>
          <button type="button" className="link-button" onClick={e => { e.stopPropagation(); setGroup(isGroup ? 0 : p.id); }}>{isGroup ? 'เลิกเป็นรูปหลัก' : 'ตั้งเป็นรูปหลัก'}</button>
        </span>
      </figure>;
    })}</div>}
    {faces && <FaceReview slug={slug} onClose={() => setFaces(false)} onChanged={load} />}
  </div>;
}
