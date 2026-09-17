'use client';
// ฟอร์มเพิ่ม/แก้ไขกิจกรรม (หน้าแอดมิน) — ข้อมูลหลัก + กำหนดการ + FAQ + ส่วนเฉพาะประเภท · ตั้งค่าขั้นสูงแก้เป็น JSON ได้
import React, { useState } from 'react';
import ImageStrip from '../components/ImageStrip.jsx';
import PassportMemoryEditor from '../components/PassportMemoryEditor.jsx';
import { Notice } from '../components/EventShell.jsx';
import { Icon, Tag } from '../components/ui.jsx';

import { api } from '../lib/api.js';
import { typeLabel } from '../lib/format.js';

const TYPES = ['fanmeet', 'merit', 'busking', 'workshop', 'popup'];
const STATUSES = [['upcoming', 'เร็ว ๆ นี้ (ยังไม่เปิด)'], ['open', 'เปิดรับ'], ['soldout', 'เต็ม'], ['live', 'กำลังจัด'], ['ended', 'จบแล้ว (ย้ายไปหมวดที่ผ่านมา)'], ['hidden', 'ซ่อน — ไม่แสดงบนเว็บเลย']];
const TONES = [['pink', 'ชมพู'], ['yellow', 'เหลือง'], ['sage', 'เขียวอ่อน'], ['blue', 'ฟ้า']];
// key ใน config ที่ฟอร์มมีช่องให้แล้ว — ที่เหลือไปอยู่ในกล่อง JSON ขั้นสูง
const KNOWN = ['schedule', 'faq', 'drawRounds', 'setlist', 'capacity', 'donateUntil', 'attend', 'payment', 'songs', 'gallery', 'milestones', 'report', 'seatMap', 'registerMode', 'checkinMode', 'checkinWindow', 'stamp', 'unlock', 'dayOne', 'memory'];
const REWARD_TYPES = [['text', 'ข้อความ'], ['image', 'ภาพลับ'], ['link', 'ลิงก์ (Live / คลิป)'], ['poll', 'โหวต']];
const newMilestone = (percent = 25) => ({ percent, title: '', reward: { type: 'text', body: '' } });

const toLocal = (v) => (v ? String(v).slice(0, 16).replace(' ', 'T') : '');
const lines = (arr, sep = ' | ') => (arr || []).map(x => Array.isArray(x) ? x.join(sep) : x).join('\n');
const unlines = (txt, sep = '|', cols = 2) => txt.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const parts = l.split(sep).map(x => x.trim()); return cols === 1 ? parts[0] : [parts[0] || '', parts.slice(1).join(sep).trim()]; });

export default function EventAdminForm({ initial, onSaved, onCancel }) {
  const editing = !!initial;
  const cfg = initial?.config || {};
  const [f, setF] = useState({
    title: initial?.title || '', subtitle: initial?.subtitle || '', type: initial?.type || 'busking', status: initial?.status || 'upcoming',
    category: initial?.category || '', tone: initial?.tone || 'pink', place: initial?.place || '', map_url: initial?.map_url || '',
    starts_at: toLocal(initial?.starts_at), ends_at: toLocal(initial?.ends_at), description: initial?.description || '', slug: initial?.slug || '',
    schedule: lines(cfg.schedule), faq: lines(cfg.faq),
    drawRounds: cfg.drawRounds ?? 3, setlist: lines(cfg.setlist), songsEnabled: cfg.songs?.enabled ?? true,
    capacity: cfg.capacity ?? '',
    donateUntil: toLocal(cfg.donateUntil), attendEnabled: cfg.attend?.enabled ?? false, attendNote: cfg.attend?.note || '',
    payAccount: cfg.payment?.accountName || '', payPromptpay: cfg.payment?.promptpay || '',
    registerMode: cfg.registerMode || 'anyone', checkinMode: cfg.checkinMode || 'self',
    winBefore: cfg.checkinWindow?.before ?? '', winAfter: cfg.checkinWindow?.after ?? '',
    dayOne: !!cfg.dayOne, unlockType: cfg.unlock?.type || 'text', unlockText: cfg.unlock?.text || '', unlockCaption: cfg.unlock?.caption || '',
    accountNote: cfg.report?.accountNote || '', excessPolicy: cfg.report?.excessPolicy || '', taxNote: cfg.report?.taxNote || '',
    seatRows: (cfg.seatMap?.rows || []).join(', '), seatCols: cfg.seatMap?.cols ?? 10, seatMax: cfg.seatMap?.maxPerBooking ?? 4, seatHold: cfg.seatMap?.holdMinutes ?? 10,
  });
  // โซนที่นั่ง: [{ key: 'A' | 'default', name, price, perk }]
  const [zones, setZones] = useState(Object.entries(cfg.seatMap?.zones || { default: { name: 'Standard', price: 0, perk: '' } }).map(([key, z]) => ({ key, name: z.name || '', price: z.price ?? 0, perk: z.perk || '' })));
  // ตั้งค่าอื่นที่ฟอร์มยังไม่มีช่อง — แสดงเป็นบล็อกละ key (JSON ของ key นั้น) แก้ได้
  const [other, setOther] = useState(Object.entries(cfg).filter(([k]) => !KNOWN.includes(k)).map(([k, v]) => ({ key: k, json: JSON.stringify(v, null, 2) })));
  const [cats, setCats] = useState(initial?.categories?.length ? initial.categories : [{ name: '', description: '', goal: '', unit_name: '', unit_price: '' }]);
  // ภาพทั้งหมดเรียงลำดับ — ภาพแรก = ปก · รายการเป็น path เดิม (string) หรือ File ใหม่
  const [images, setImages] = useState([initial?.cover, ...(cfg.gallery || [])].filter(Boolean));
  // passport: ลายแสตมป์ + เนื้อหาปลดล็อก — เก็บ path เดิม หรือ File ใหม่ · null = ลบ
  const [stamp, setStamp] = useState(cfg.stamp?.image || null);
  const [unlockFile, setUnlockFile] = useState(null);
  const [memory, setMemory] = useState(cfg.memory || {});
  const [memoryFiles, setMemoryFiles] = useState({});
  const unlockSrc = cfg.unlock?.src || null;
  const [milestones, setMilestones] = useState(cfg.milestones || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const setCat = (i, k, v) => setCats(cs => cs.map((c, j) => j === i ? { ...c, [k]: v } : c));

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const advanced = {};
      for (const { key, json } of other) { if (!key.trim()) continue; try { advanced[key.trim()] = json.trim() ? JSON.parse(json) : null; } catch { throw new Error(`บล็อก ${key} ไม่ใช่ JSON ที่ถูกต้อง`); } }
      const config = { ...advanced, schedule: unlines(f.schedule), faq: unlines(f.faq), registerMode: f.registerMode, checkinMode: f.checkinMode, checkinWindow: f.winBefore !== '' || f.winAfter !== '' ? { before: Number(f.winBefore) || 0, after: Number(f.winAfter) || 0 } : null };
      if (f.type === 'merit') config.report = { accountNote: f.accountNote, excessPolicy: f.excessPolicy, taxNote: f.taxNote };
      if (f.type === 'fanmeet') config.seatMap = { rows: f.seatRows.split(',').map(x => x.trim()).filter(Boolean), cols: Number(f.seatCols) || 0, maxPerBooking: Number(f.seatMax) || 1, holdMinutes: Number(f.seatHold) || 10, zones: Object.fromEntries(zones.filter(z => z.key.trim()).map(z => [z.key.trim(), { name: z.name, price: Number(z.price) || 0, perk: z.perk }])) };
      if (f.type === 'busking') { config.drawRounds = Number(f.drawRounds) || 0; config.setlist = unlines(f.setlist, '|', 1); config.songs = { enabled: !!f.songsEnabled }; }
      if (f.type === 'workshop' || f.type === 'popup') config.capacity = f.capacity === '' ? undefined : Number(f.capacity);
      if (f.type === 'merit') { config.donateUntil = f.donateUntil ? f.donateUntil.replace('T', ' ') + ':00' : undefined; config.attend = { enabled: !!f.attendEnabled, note: f.attendNote }; }
      if (f.type === 'merit' || f.type === 'fanmeet') config.payment = { ...(cfg.payment || {}), accountName: f.payAccount, promptpay: f.payPromptpay };
      config.dayOne = !!f.dayOne || undefined;
      config.memory = memory;
      config.stamp = stamp instanceof File ? (cfg.stamp || {}) : stamp ? { image: stamp } : null;
      config.unlock = f.unlockType === 'text' ? (f.unlockText.trim() ? { type: 'text', text: f.unlockText.trim(), caption: f.unlockCaption } : undefined) : { ...(cfg.unlock?.type !== 'text' ? cfg.unlock : {}), type: f.unlockType, caption: f.unlockCaption, text: undefined };
      if (f.type === 'merit') config.milestones = milestones.filter(m => m.title).map(m => ({ ...m, percent: Number(m.percent) || 0 })).sort((a, b) => a.percent - b.percent);
      // ภาพ: path เดิมส่งเป็น string · ไฟล์ใหม่ส่งเป็น 'file:<i>' + แนบไฟล์ตามลำดับ
      const fd = new FormData(); const files = images.filter(x => x instanceof File);
      const payload = { ...f, config, images: images.map(x => x instanceof File ? `file:${files.indexOf(x)}` : x), categories: f.type === 'merit' ? cats.filter(c => c.name) : undefined };
      fd.append('payload', JSON.stringify(payload)); files.forEach(file => fd.append('gallery', file));
      if (stamp instanceof File) fd.append('stamp', stamp);
      if (unlockFile) fd.append('unlock', unlockFile);
      Object.entries(memoryFiles).forEach(([key, file]) => { if (file) fd.append(key, file); });
      const r = await api(editing ? `/admin/events/${initial.slug}` : '/admin/events', { method: editing ? 'PUT' : 'POST', body: fd, admin: true });
      onSaved(r.slug);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  // วิธีเช็คอินหน้างาน — self: ผู้เข้าร่วมกดเองบนบัตร · gate: สแกน QR ที่จุดเช็คอิน (โทเคนหมุน 45 วิ) · staff: พี่ ๆ สแกนบัตรเท่านั้น
  // + หน้าต่างเวลา (นาทีก่อน/หลังเวลาเริ่ม) ใช้กับ self และ gate — เว้นว่างทั้งคู่ = ไม่จำกัดเวลา (self จะดูจากสถานะ «กำลังจัด» แทน)
  const checkinPick = <>
    <fieldset className="mode-pick"><legend>เช็คอินหน้างาน</legend>
      <label className="check"><input type="radio" name="checkinMode" checked={f.checkinMode === 'gate'} onChange={() => set('checkinMode', 'gate')} /> <span><strong>สแกน QR หน้างาน</strong> <small>วางมือถือโชว์จอ QR ที่จุดเช็คอิน (ปุ่ม <Tag>จอ QR เช็คอิน</Tag> ในหน้าจัดการ) QR เปลี่ยนทุก 45 วิ — ถ่ายรูปส่งต่อใช้ไม่ได้ · ไม่ต้องมีคนยืนสแกน</small></span></label>
      <label className="check"><input type="radio" name="checkinMode" checked={f.checkinMode === 'self'} onChange={() => set('checkinMode', 'self')} /> <span><strong>กดเองได้</strong> <small>ปุ่ม <Tag>ฉันมาถึงแล้ว</Tag> บนบัตร/หน้างาน — กดจากที่ไหนก็ได้ เหมาะกับงานที่ไม่มีสิทธิ์พิเศษ</small></span></label>
      <label className="check"><input type="radio" name="checkinMode" checked={f.checkinMode === 'staff'} onChange={() => set('checkinMode', 'staff')} /> <span><strong>ทีมงานสแกนเท่านั้น</strong> <small>ผู้เข้าร่วมแสดง QR บนบัตร พี่ ๆ สแกนด้วยมือถือที่ล็อกอิน — แน่นที่สุดแต่ต้องมีคนยืนสแกน</small></span></label>
    </fieldset>
    {f.checkinMode !== 'staff' && <div className="two">
      <label>เปิดเช็คอินก่อนเริ่มงาน (นาที) <small>เว้นว่าง = ไม่จำกัดเวลา</small><input type="number" min="0" value={f.winBefore} onChange={e => set('winBefore', e.target.value)} placeholder="30" /></label>
      <label>ปิดเช็คอินหลังเริ่มงาน (นาที) <small>มาช้ากว่านี้เช็คอินเองไม่ได้ (พี่ ๆ สแกนให้ได้)</small><input type="number" min="0" value={f.winAfter} onChange={e => set('winAfter', e.target.value)} placeholder="30" /></label>
    </div>}
  </>;
  return <form className="booking-form event-form" onSubmit={submit}>
    <h2>{editing ? `แก้ไข: ${initial.title}` : 'เพิ่มกิจกรรมใหม่'}</h2>
    <div className="two">
      <label>ชื่องาน<input required value={f.title} onChange={e => set('title', e.target.value)} placeholder="เช่น NobiBigcat ร้องสดทุกเพลง" /></label>
      <label>ประเภท {editing && <small>(เปลี่ยนไม่ได้หลังสร้าง)</small>}<select value={f.type} disabled={editing} onChange={e => set('type', e.target.value)}>{TYPES.map(t => <option key={t} value={t}>{typeLabel[t]}</option>)}</select></label>
    </div>
    <label>คำโปรย (บรรทัดรองใต้ชื่อ)<input value={f.subtitle} onChange={e => set('subtitle', e.target.value)} placeholder="เช่น ครั้งแรกในร่างใหม่ของน้องโนบิ · เข้าฟรี" /></label>
    <div className="three">
      <label>สถานะ<select value={f.status} onChange={e => set('status', e.target.value)}>{STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <label>ป้ายหมวด<input value={f.category} onChange={e => set('category', e.target.value)} placeholder={typeLabel[f.type]} /></label>
      <label>โทนสี<select value={f.tone} onChange={e => set('tone', e.target.value)}>{TONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
    </div>
    <div className="two">
      <label>เริ่ม<input type="datetime-local" required value={f.starts_at} onChange={e => set('starts_at', e.target.value)} /></label>
      <label>จบ (ถ้ามี)<input type="datetime-local" value={f.ends_at} onChange={e => set('ends_at', e.target.value)} /></label>
    </div>
    <div className="two">
      <label>สถานที่<input value={f.place} onChange={e => set('place', e.target.value)} placeholder="เช่น ตลาดเลียบด่วนแดนเนรมิต (BTS ห้าแยกลาดพร้าว ทางออก 4)" /></label>
      <label>ลิงก์แผนที่<input value={f.map_url} onChange={e => set('map_url', e.target.value)} placeholder="https://maps.google.com/?q=…" /></label>
    </div>
    {!editing && <label>slug (ที่อยู่หน้าเว็บ /events/…) <small>เว้นว่าง = สร้างจากชื่องาน</small><input value={f.slug} onChange={e => set('slug', e.target.value)} placeholder="nobi-busking-26sep-2026" /></label>}
    <label>รายละเอียดงาน<textarea rows={6} value={f.description} onChange={e => set('description', e.target.value)} placeholder="เล่าว่างานนี้คืออะไร เจอกันยังไง (ขึ้นบรรทัดใหม่ได้)" /></label>
    <div className="gallery-edit">
      <span className="file-drop-label">ภาพของงาน <small>(ภาพแรก = ปก · ที่เหลือเป็นสไลด์ · ลากสลับตำแหน่งได้ · สูงสุด 11 ภาพ)</small></span>
      <ImageStrip images={images} onChange={setImages} max={11} />
    </div>

    <h2>กำหนดการ &amp; คำถามที่พบบ่อย</h2>
    <label>กำหนดการ <small>บรรทัดละรายการ: เวลา | สิ่งที่ทำ</small><textarea rows={4} value={f.schedule} onChange={e => set('schedule', e.target.value)} placeholder={'19:00 | เริ่มร้อง\n20:45 | สุ่ม Lucky Fan'} /></label>
    <label>FAQ <small>บรรทัดละข้อ: คำถาม | คำตอบ</small><textarea rows={5} value={f.faq} onChange={e => set('faq', e.target.value)} placeholder={'ต้องเสียค่าเข้าไหม | ไม่เสีย เข้าฟรีทุกคน'} /></label>

    {f.type === 'busking' && <><h2>Busking</h2>
      <fieldset className="mode-pick"><legend>ใครลงทะเบียนได้</legend>
        <label className="check"><input type="radio" name="registerMode" checked={f.registerMode === 'anyone'} onChange={() => set('registerMode', 'anyone')} /> <span><strong>ใครก็ได้</strong> <small>ไม่ต้องล็อกอิน ลงให้เพื่อน/ครอบครัวได้หลายคน</small></span></label>
        <label className="check"><input type="radio" name="registerMode" checked={f.registerMode === 'self'} onChange={() => set('registerMode', 'self')} /> <span><strong>ด้วยตนเองเท่านั้น</strong> <small>ต้องเข้าสู่ระบบ LINE/Google · 1 บัญชี = 1 สิทธิ์ (เหมาะกับงานที่มีสุ่มรางวัล/รับของ)</small></span></label>
      </fieldset>
      {checkinPick}
      <div className="two"><label>จำนวน Lucky Fan ที่สุ่ม<input type="number" min="0" value={f.drawRounds} onChange={e => set('drawRounds', e.target.value)} /></label><label className="check"><input type="checkbox" checked={!!f.songsEnabled} onChange={e => set('songsEnabled', e.target.checked)} /> เปิดให้ขอเพลง/โหวตเพลง</label></div>
      <label>เซ็ตลิสต์ <small>บรรทัดละเพลง</small><textarea rows={4} value={f.setlist} onChange={e => set('setlist', e.target.value)} /></label></>}
    {(f.type === 'workshop' || f.type === 'popup') && <><h2>ลงทะเบียน</h2>
      <fieldset className="mode-pick"><legend>ใครลงทะเบียนได้</legend>
        <label className="check"><input type="radio" name="registerMode" checked={f.registerMode === 'anyone'} onChange={() => set('registerMode', 'anyone')} /> <span><strong>ใครก็ได้</strong> <small>ไม่ต้องล็อกอิน ลงให้เพื่อน/ครอบครัวได้หลายคน</small></span></label>
        <label className="check"><input type="radio" name="registerMode" checked={f.registerMode === 'self'} onChange={() => set('registerMode', 'self')} /> <span><strong>ด้วยตนเองเท่านั้น</strong> <small>ต้องเข้าสู่ระบบ LINE/Google · 1 บัญชี = 1 สิทธิ์ (เหมาะกับงานที่มีสุ่มรางวัล/รับของ)</small></span></label>
      </fieldset>
      {checkinPick}
      <label>รับกี่ที่ <small>เว้นว่าง = ไม่ต้องลงทะเบียน</small><input type="number" min="1" value={f.capacity} onChange={e => set('capacity', e.target.value)} /></label></>}
    {f.type === 'merit' && <><h2>ทำบุญ</h2>
      <div className="two"><label>ปิดรับยอดออนไลน์<input type="datetime-local" value={f.donateUntil} onChange={e => set('donateUntil', e.target.value)} /></label><label className="check"><input type="checkbox" checked={!!f.attendEnabled} onChange={e => set('attendEnabled', e.target.checked)} /> เปิดลงทะเบียน <Tag>ไปวัดด้วย</Tag></label></div>
      <fieldset className="mode-pick"><legend>ใครลงทะเบียนไปวัดได้</legend>
        <label className="check"><input type="radio" name="registerMode" checked={f.registerMode === 'anyone'} onChange={() => set('registerMode', 'anyone')} /> <span><strong>ใครก็ได้</strong> <small>ไม่ต้องล็อกอิน ลงให้เพื่อน/ครอบครัวได้หลายคน</small></span></label>
        <label className="check"><input type="radio" name="registerMode" checked={f.registerMode === 'self'} onChange={() => set('registerMode', 'self')} /> <span><strong>ด้วยตนเองเท่านั้น</strong> <small>ต้องเข้าสู่ระบบ LINE/Google · 1 บัญชี = 1 สิทธิ์ (เหมาะกับงานที่มีสุ่มรางวัล/รับของ)</small></span></label>
      </fieldset>
      {checkinPick}
      <label>โน้ตสำหรับคนไปวัด<input value={f.attendNote} onChange={e => set('attendNote', e.target.value)} placeholder="เช่น นัดพบหน้าวัด 09:00 น. แต่งกายสุภาพ" /></label>
      <div className="ms-edit"><div className="ev-section-head"><span className="eyebrow">Milestone ปลดล็อกตามยอด <small>— ถึง % ของเป้ารวมแล้วเปิดของขวัญให้แฟน ๆ</small></span><button type="button" className="link-button" onClick={() => setMilestones([...milestones, newMilestone(milestones.length ? Math.min(100, (Number(milestones[milestones.length - 1].percent) || 0) + 25) : 25)])}>+ เพิ่ม milestone</button></div>
        {milestones.map((m, i) => { const r = m.reward || { type: 'text' }; const setM = (patch) => setMilestones(ms => ms.map((x, j) => j === i ? { ...x, ...patch } : x)); const setR = (patch) => setM({ reward: { ...r, ...patch } }); return <div key={i} className="ms-row">
          <div className="ms-row-head"><input type="number" min="1" max="100" value={m.percent} onChange={e => setM({ percent: e.target.value })} aria-label="เปอร์เซ็นต์" /><span>%</span><input className="grow" placeholder="ชื่อ milestone เช่น ปล่อยภาพลับมหาบูตะ" value={m.title} onChange={e => setM({ title: e.target.value })} /><select value={r.type} onChange={e => setR({ type: e.target.value })}>{REWARD_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select><button type="button" className="link-button" onClick={() => setMilestones(milestones.filter((_, j) => j !== i))}>ลบ</button></div>
          {r.type === 'text' && <textarea rows={2} placeholder="ข้อความที่จะเปิดให้อ่านเมื่อถึงเป้า" value={r.body || ''} onChange={e => setR({ body: e.target.value })} />}
          {r.type === 'image' && <div className="two"><select value={r.src || ''} onChange={e => setR({ src: e.target.value })}><option value="">— เลือกภาพจากภาพของงาน —</option>{images.filter(x => typeof x === 'string').map(src => <option key={src} value={src}>{src.split('/').pop()}</option>)}</select><input placeholder="คำบรรยายภาพ" value={r.caption || ''} onChange={e => setR({ caption: e.target.value })} /></div>}
          {r.type === 'link' && <div className="two"><input placeholder="https://…" value={r.url || ''} onChange={e => setR({ url: e.target.value })} /><input placeholder="ข้อความบนปุ่ม เช่น ดู Live / ย้อนหลัง" value={r.label || ''} onChange={e => setR({ label: e.target.value })} /></div>}
          {r.type === 'poll' && <div className="poll-edit"><input placeholder="คำถาม" value={r.question || ''} onChange={e => setR({ question: e.target.value })} /><textarea rows={3} placeholder={'ตัวเลือก บรรทัดละข้อ'} value={(r.options || []).join('\n')} onChange={e => setR({ options: e.target.value.split('\n').map(x => x.trim()).filter(Boolean), key: r.key || `poll-${i + 1}` })} /></div>}
        </div>; })}
        {milestones.length === 0 && <p className="muted small">ยังไม่มี milestone — กด <Tag>+ เพิ่ม milestone</Tag></p>}
      </div>
      <h2>ความโปร่งใส <small>(แสดงในกล่อง ความโปร่งใส บนหน้างาน)</small></h2>
      <label>บัญชีรับเงิน<textarea rows={2} value={f.accountNote} onChange={e => set('accountNote', e.target.value)} placeholder="บัญชีนี้เป็นของใคร รวบรวมยอดแทนใคร" /></label>
      <label>ยอดเกินเป้า<textarea rows={2} value={f.excessPolicy} onChange={e => set('excessPolicy', e.target.value)} placeholder="ยอดที่เกินจะเอาไปทำอะไร" /></label>
      <label>ลดหย่อนภาษี<textarea rows={2} value={f.taxNote} onChange={e => set('taxNote', e.target.value)} /></label>
      <div className="cat-edit"><div className="ev-section-head"><span className="eyebrow">หมวดร่วมบุญ <small>— ราคาต่อหน่วยเว้นว่าง = ใส่ยอดเอง</small></span><button type="button" className="link-button" onClick={() => setCats([...cats, { name: '', description: '', goal: '', unit_name: '', unit_price: '' }])}>+ เพิ่มหมวด</button></div>
        {cats.map((c, i) => <div key={c.id || i} className="cat-row"><input placeholder="ชื่อหมวด" value={c.name} onChange={e => setCat(i, 'name', e.target.value)} /><input placeholder="คำอธิบาย" value={c.description || ''} onChange={e => setCat(i, 'description', e.target.value)} /><input type="number" min="0" placeholder="เป้า (บาท)" value={c.goal ?? ''} onChange={e => setCat(i, 'goal', e.target.value)} /><input placeholder="หน่วย เช่น ชุด" value={c.unit_name || ''} onChange={e => setCat(i, 'unit_name', e.target.value)} /><input type="number" min="0" placeholder="บาท/หน่วย" value={c.unit_price ?? ''} onChange={e => setCat(i, 'unit_price', e.target.value)} /><button type="button" className="link-button" onClick={() => setCats(cats.filter((_, j) => j !== i))} aria-label="ลบหมวด">ลบ</button></div>)}
      </div></>}
    {(f.type === 'merit' || f.type === 'fanmeet') && <><h2>รับเงิน</h2>
      <div className="two"><label>ชื่อบัญชี<input value={f.payAccount} onChange={e => set('payAccount', e.target.value)} /></label><label>เลข PromptPay (ถ้าไม่ใช้ QR)<input value={f.payPromptpay} onChange={e => set('payPromptpay', e.target.value)} /></label></div>
</>}
    {f.type === 'fanmeet' && <><h2>ผังที่นั่ง <small>(ที่นั่งถูกสร้างครั้งแรกที่บันทึก — หลังมีคนจองแล้วแก้ผังไม่มีผลกับที่นั่งเดิม)</small></h2>
      <div className="three"><label>แถว (คั่นด้วย ,)<input value={f.seatRows} onChange={e => set('seatRows', e.target.value)} placeholder="A, B, C, D" /></label><label>ที่นั่งต่อแถว<input type="number" min="1" value={f.seatCols} onChange={e => set('seatCols', e.target.value)} /></label><label>จองได้สูงสุด/ครั้ง<input type="number" min="1" value={f.seatMax} onChange={e => set('seatMax', e.target.value)} /></label></div>
      <label>ล็อกที่นั่งระหว่างกรอกฟอร์ม (นาที)<input type="number" min="1" value={f.seatHold} onChange={e => set('seatHold', e.target.value)} /></label>
      <div className="cat-edit"><div className="ev-section-head"><span className="eyebrow">โซน / ราคา <small>— key = ตัวอักษรแถว หรือ default สำหรับแถวที่เหลือ</small></span><button type="button" className="link-button" onClick={() => setZones([...zones, { key: '', name: '', price: 0, perk: '' }])}>+ เพิ่มโซน</button></div>
        {zones.map((z, i) => { const setZ = (k, v) => setZones(zs => zs.map((x, j) => j === i ? { ...x, [k]: v } : x)); return <div key={i} className="zone-row"><input placeholder="A / default" value={z.key} onChange={e => setZ('key', e.target.value)} /><input placeholder="ชื่อโซน" value={z.name} onChange={e => setZ('name', e.target.value)} /><input type="number" min="0" placeholder="ราคา" value={z.price} onChange={e => setZ('price', e.target.value)} /><input placeholder="สิทธิพิเศษ" value={z.perk} onChange={e => setZ('perk', e.target.value)} /><button type="button" className="link-button" onClick={() => setZones(zones.filter((_, j) => j !== i))}>ลบ</button></div>; })}
      </div></>}

    <h2>Passport</h2>
    <PassportMemoryEditor memory={memory} onChange={setMemory} files={memoryFiles} onFiles={setMemoryFiles} slug={initial?.slug} />
    <p className="muted small">แสตมป์ที่สมาชิกได้เมื่อมางานนี้ (เช็คอิน/ร่วมบุญ) — 1 งาน 1 ลาย ไม่ออกซ้ำ · ถ้าไม่อัปโหลด ระบบวาดจากภาพปกให้</p>
    <div className="two">
      <label>ลายแสตมป์ <small>PNG โปร่งใส สี่เหลี่ยมจัตุรัส ≥ 600px</small>
        <span className="stamp-pick">{stamp && <img src={stamp instanceof File ? URL.createObjectURL(stamp) : stamp} alt="" />}<input type="file" accept="image/*" onChange={e => { setStamp(e.target.files?.[0] || stamp); e.target.value = ''; }} />{stamp && <button type="button" className="link-button" onClick={() => setStamp(null)}>ใช้ภาพปกแทน</button>}</span></label>
      <label className="check" style={{ alignSelf: 'end' }}><input type="checkbox" checked={!!f.dayOne} onChange={e => set('dayOne', e.target.checked)} /> <span><strong>งานเปิดตัว passport</strong> <small>คนที่มางานนี้ได้แสตมป์ Day One เพิ่ม (ติ๊กงานเดียว)</small></span></label>
    </div>
    <fieldset className="mode-pick"><legend>เนื้อหาปลดล็อก <small>— เห็นได้เฉพาะคนที่มีแสตมป์งานนี้ (ภาพหลังเวที · เสียงจากน้อง ๆ · โน้ตสั้น ๆ)</small></legend>
      {['text', 'image', 'audio'].map(t => <label key={t} className="check"><input type="radio" name="unlockType" checked={f.unlockType === t} onChange={() => set('unlockType', t)} /> <span><strong>{{ text: 'ข้อความ', image: 'ภาพ', audio: 'เสียง' }[t]}</strong></span></label>)}
    </fieldset>
    {f.unlockType === 'text'
      ? <label>ข้อความจากน้อง ๆ<textarea rows={3} value={f.unlockText} onChange={e => set('unlockText', e.target.value)} placeholder="เช่น คืนนี้โนร้องเพลงสุดท้ายทั้งน้ำตา ขอบคุณที่อยู่จนจบนะ" /></label>
      : <label>ไฟล์{f.unlockType === 'audio' ? 'เสียง (mp3/m4a)' : 'ภาพ'} {unlockSrc && !unlockFile && <small>มีไฟล์เดิมอยู่ — เลือกใหม่เพื่อแทนที่</small>}<input type="file" accept={f.unlockType === 'audio' ? 'audio/*' : 'image/*'} onChange={e => { setUnlockFile(e.target.files?.[0] || null); }} /></label>}
    <label>คำบรรยายใต้เนื้อหา<input value={f.unlockCaption} onChange={e => set('unlockCaption', e.target.value)} placeholder="เช่น หลังเวที 26 ก.ย. — ถ่ายโดยบูตะ" /></label>

    <details className="adv" open={other.length > 0}><summary>ตั้งค่าอื่น ๆ <small>({other.length} รายการ — สำหรับค่าที่ฟอร์มยังไม่มีช่องให้)</small></summary>
      <div className="json-blocks">
        {other.map((o, i) => <div key={i} className="json-block"><div className="json-block-head"><Tag>{o.key || 'key ใหม่'}</Tag><input value={o.key} onChange={e => setOther(os => os.map((x, j) => j === i ? { ...x, key: e.target.value } : x))} placeholder="ชื่อ key" /><button type="button" className="link-button" onClick={() => setOther(other.filter((_, j) => j !== i))}>ลบ</button></div><textarea rows={Math.min(12, Math.max(2, o.json.split('\n').length))} value={o.json} onChange={e => setOther(os => os.map((x, j) => j === i ? { ...x, json: e.target.value } : x))} spellCheck={false} /></div>)}
        <button type="button" className="link-button" onClick={() => setOther([...other, { key: '', json: '' }])}>+ เพิ่มค่า</button>
      </div></details>

    {error && <Notice tone="error">{error}</Notice>}
    <div className="form-actions"><button className="button dark small" disabled={busy}>{busy ? 'กำลังบันทึก…' : editing ? 'บันทึกการแก้ไข' : 'สร้างกิจกรรม'} <Icon name="check" size={14} /></button><button type="button" className="link-button" onClick={onCancel}>ยกเลิก</button></div>
  </form>;
}
