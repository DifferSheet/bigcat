'use client';
// ชิ้นส่วนฟอร์มที่ใช้ซ้ำ: เบอร์โทร (ตรวจรูปแบบ) · ที่อยู่ไทย (ค้นหา + dropdown ต่อกัน) · แนบไฟล์ (ลากวาง + พรีวิว)
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Icon } from './ui.jsx';
import { formatPhone, isPhone, PHONE_HINT } from '../lib/phone.js';
import { loadAddressDB, districtsOf, subdistrictsOf, zipsOf, searchAddress, composeAddress, parseAddress, isBangkok } from '../lib/address.js';

/* ---------- เบอร์โทร: จัดรูปแบบขณะพิมพ์ + ตรวจ regex ผ่าน HTML validity (เบราว์เซอร์แสดงข้อความเอง) ---------- */
export function PhoneInput({ value, onChange, required, ...props }) {
  const ref = useRef(null);
  // ค่าที่ prefill มา (โปรไฟล์/ความจำ) จัดรูปแบบให้เหมือนที่พิมพ์เอง
  useEffect(() => { const f = formatPhone(value); if (value && isPhone(value) && f !== value) onChange(f); }, [value]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { ref.current?.setCustomValidity(value && !isPhone(value) ? PHONE_HINT : ''); }, [value]);
  return <input ref={ref} type="tel" inputMode="tel" autoComplete="tel" maxLength={12} required={required} placeholder="081-234-5678"
    value={value} onChange={e => onChange(formatPhone(e.target.value))} {...props} />;
}

/* ---------- ที่อยู่: line1 (บ้านเลขที่/ถนน) + พื้นที่ ----------
   value/onChange เป็นข้อความบรรทัดเดียว (เก็บใน DB ตามเดิม) — ข้างในถือโครงสร้างแล้ว compose/parse ให้
   กรอกพื้นที่ได้ 2 ทาง: พิมพ์ค้นหาทีเดียว (ตำบล/อำเภอ/รหัส) หรือเลือก dropdown จังหวัด → อำเภอ → ตำบล → รหัสเติมเอง */
export function AddressForm({ value, onChange, required = true, idPrefix = 'addr' }) {
  const [db, setDb] = useState(null);
  const [a, setA] = useState(() => parseAddress(null, value));
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const lastComposed = useRef(value);
  const listId = useId();
  useEffect(() => { loadAddressDB().then(setDb).catch(() => {}); }, []);
  // ค่าจากข้างนอกเปลี่ยน (prefill จากโปรไฟล์/ความจำ) → แยกใหม่ · หลัง db มาถึงก็แยกอีกรอบเพื่อให้ตรงฐานข้อมูล
  useEffect(() => {
    if (value === lastComposed.current && a.province) return;   // เป็นค่าที่เราประกอบเองและแยกไว้แล้ว
    setA(parseAddress(db, value)); lastComposed.current = value;
  }, [value, db]);   // eslint-disable-line react-hooks/exhaustive-deps
  const update = (patch) => {
    const next = { ...a, ...patch };
    // เปลี่ยนต้นสาย → ล้างปลายสาย และเติมรหัสอัตโนมัติเมื่อครบ
    // (ล้างเฉพาะช่องที่ patch ไม่ได้ส่งมา — ตอนเลือกจากผลค้นหาจะส่งมาครบทุกช่อง)
    if ('province' in patch && !('district' in patch)) { next.district = ''; next.subdistrict = ''; }
    if ('district' in patch && !('subdistrict' in patch)) next.subdistrict = '';
    if (!('zip' in patch)) { const z = zipsOf(db, next.province, next.district, next.subdistrict); if (!z.includes(next.zip)) next.zip = z[0] || ''; }
    setA(next); const s = composeAddress(next); lastComposed.current = s; onChange(s);
  };
  const pick = (row) => { const typed = q.trim(); update({ province: row.province, district: row.district, subdistrict: row.subdistrict, zip: row.zips.find(z => /^\d+$/.test(typed) && z.startsWith(typed)) || row.zips[0] }); setQ(''); setOpen(false); };
  const hits = useMemo(() => (open ? searchAddress(db, q) : []), [db, q, open]);
  const onKey = (e) => {
    if (!hits.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => (h + 1) % hits.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => (h - 1 + hits.length) % hits.length); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(hits[hi]); }
    else if (e.key === 'Escape') setOpen(false);
  };
  const bkk = isBangkok(a.province);
  const zips = zipsOf(db, a.province, a.district, a.subdistrict);
  const area = a.province ? composeAddress({ ...a, line1: '' }) : '';
  return <div className="addr">
    <label>บ้านเลขที่ / หมู่ / ซอย / ถนน<input id={`${idPrefix}-line1`} required={required} value={a.line1} onChange={e => update({ line1: e.target.value })} placeholder="เช่น 99/1 หมู่ 3 ซอยสุขใจ ถนนสุขุมวิท" autoComplete="street-address" /></label>
    <div className="addr-search">
      <label htmlFor={`${idPrefix}-q`}>ค้นหาพื้นที่จัดส่ง <small className="muted">พิมพ์ ตำบล/แขวง · อำเภอ/เขต · หรือรหัสไปรษณีย์ แล้วเลือกจากรายการ</small></label>
      <div className="addr-search-box">
        <Icon name="search" size={16} />
        <input id={`${idPrefix}-q`} value={q} onChange={e => { setQ(e.target.value); setOpen(true); setHi(0); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} onKeyDown={onKey}
          placeholder={db ? 'เช่น คลองเตย, บางรัก, 10110' : 'กำลังโหลดข้อมูลพื้นที่…'} autoComplete="off" role="combobox" aria-expanded={open && hits.length > 0} aria-controls={listId} aria-autocomplete="list" />
      </div>
      {open && hits.length > 0 && <ul className="addr-hits" id={listId} role="listbox">{hits.map((r, i) => <li key={`${r.province}${r.district}${r.subdistrict}`} role="option" aria-selected={i === hi} className={i === hi ? 'hi' : ''} onMouseDown={() => pick(r)}>
        <strong>{isBangkok(r.province) ? 'แขวง' : 'ต.'}{r.subdistrict}</strong><span>{isBangkok(r.province) ? 'เขต' : 'อ.'}{r.district} · {r.province}</span><b>{r.zips.join('/')}</b>
      </li>)}</ul>}
    </div>
    <div className="addr-grid">
      <label>จังหวัด<select id={`${idPrefix}-province`} required={required} value={a.province} onChange={e => update({ province: e.target.value })} disabled={!db}><option value="">— เลือก —</option>{db?.provinces.map(p => <option key={p}>{p}</option>)}</select></label>
      <label>{bkk ? 'เขต' : 'อำเภอ/เขต'}<select id={`${idPrefix}-district`} required={required} value={a.district} onChange={e => update({ district: e.target.value })} disabled={!a.province}><option value="">— เลือก —</option>{districtsOf(db, a.province).map(d => <option key={d}>{d}</option>)}</select></label>
      <label>{bkk ? 'แขวง' : 'ตำบล/แขวง'}<select id={`${idPrefix}-subdistrict`} required={required} value={a.subdistrict} onChange={e => update({ subdistrict: e.target.value })} disabled={!a.district}><option value="">— เลือก —</option>{subdistrictsOf(db, a.province, a.district).map(s => <option key={s}>{s}</option>)}</select></label>
      <label>รหัสไปรษณีย์{zips.length > 1
        ? <select id={`${idPrefix}-zip`} required={required} value={a.zip} onChange={e => update({ zip: e.target.value })}>{zips.map(z => <option key={z}>{z}</option>)}</select>
        : <input id={`${idPrefix}-zip`} required={required} value={a.zip} readOnly placeholder="เติมให้อัตโนมัติ" tabIndex={-1} />}</label>
    </div>
    {area && <p className="addr-preview muted"><Icon name="pin" size={14} /> {area}</p>}
  </div>;
}

/* ---------- แนบไฟล์รูป: กล่องเส้นประ ลากวาง/กดเลือก + พรีวิว ---------- */
export function FileDrop({ file, onChange, accept = 'image/*', id, label = 'สลิปโอนเงิน', hint = 'ลากรูปมาวาง หรือกดเพื่อเลือกจากเครื่อง · JPG / PNG', required = false }) {
  const [over, setOver] = useState(false);
  const [url, setUrl] = useState('');
  const inputRef = useRef(null);
  const autoId = useId(); const inputId = id || autoId;
  useEffect(() => { if (!file || !file.type?.startsWith('image/')) { setUrl(''); return; } const u = URL.createObjectURL(file); setUrl(u); return () => URL.revokeObjectURL(u); }, [file]);
  const take = (list) => { const f = list?.[0]; if (f) onChange(f); };
  const clear = () => { onChange(null); if (inputRef.current) inputRef.current.value = ''; };
  const size = file ? (file.size > 1e6 ? `${(file.size / 1e6).toFixed(1)} MB` : `${Math.round(file.size / 1e3)} KB`) : '';
  return <div className="file-drop-wrap">
    <span className="file-drop-label">{label}</span>
    <div className={`file-drop ${over ? 'over' : ''} ${file ? 'has-file' : ''}`}
      onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); setOver(false); take(e.dataTransfer.files); }}>
      <input ref={inputRef} id={inputId} type="file" accept={accept} required={required && !file} onChange={e => take(e.target.files)} />
      {file
        ? <div className="file-drop-preview">
          {url ? <img src={url} alt="" /> : <span className="file-drop-icon"><Icon name="check" /></span>}
          <div className="file-drop-meta"><strong>{file.name}</strong><span className="muted">{size} · แนบแล้ว ✓</span></div>
          <div className="file-drop-actions"><label htmlFor={inputId} className="link-button">เปลี่ยน</label><button type="button" className="link-button" onClick={clear}>ลบ</button></div>
        </div>
        : <label htmlFor={inputId} className="file-drop-empty">
          <span className="file-drop-icon"><Icon name="upload" /></span>
          <strong>แนบ{label}</strong><span className="muted">{hint}</span>
        </label>}
    </div>
  </div>;
}
