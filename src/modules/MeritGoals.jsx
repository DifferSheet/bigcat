'use client';
import React, { useEffect, useState } from 'react';
import { useUser, prefillFrom } from '../lib/auth.js';
import { Link } from '../lib/nav.jsx';
import { Section, Notice, PayBox, Countdown, LineNotify, LoginToRegister } from '../components/EventShell.jsx';
import { PhoneInput, FileDrop } from '../components/forms.jsx';
import { Icon, Paw, Tagged } from '../components/ui.jsx';
import { api, voterToken } from '../lib/api.js';
import { baht, parseDate, eventDate } from '../lib/format.js';
import { useMounted } from '../lib/useMounted.js';

const PRESETS = [100, 300, 500, 1000];
const attendKey = (slug) => `bigcat-attend-${slug}`;

// รองรับทั้งรูปแบบเก่า [percent, title] และแบบใหม่ { percent, title, reward }
const normMilestone = (m) => Array.isArray(m) ? { percent: m[0], title: m[1], reward: null } : m;

/* ---------- Milestone แบบ interactive ---------- */
function Milestone({ m, percent, goal, total, polls, slug }) {
  const hit = percent >= m.percent;
  const [open, setOpen] = useState(false);
  const [voted, setVoted] = useState(null);
  useEffect(() => { try { setVoted(localStorage.getItem(`bigcat-poll-${slug}-${m.reward?.key}`)); } catch { /* optional */ } }, [slug, m.reward?.key]);
  const r = m.reward;
  const vote = async (i) => {
    setVoted(String(i)); try { localStorage.setItem(`bigcat-poll-${slug}-${r.key}`, String(i)); } catch { /* optional */ }
    await api(`/events/${slug}/polls/${r.key}/vote`, { method: 'POST', body: { option: i, voterToken: voterToken() } }).catch(() => {});
  };
  const poll = polls?.[r?.key] || { counts: [], total: 0 };
  return <li className={`ms ${hit ? 'hit' : ''} ${open ? 'open' : ''}`}>
    <button className="ms-head" onClick={() => hit && setOpen(!open)} aria-expanded={open} disabled={!hit}>
      <span className="ms-pct">{m.percent}%</span>
      <span className="ms-text">{m.title}</span>
      <span className="ms-state">{hit ? (r ? (open ? 'ซ่อน' : 'เปิดดู ✓') : 'ปลดล็อกแล้ว ✓') : `อีก ${baht(Math.max(0, Math.ceil(goal * m.percent / 100) - total))}`}</span>
    </button>
    {hit && open && r && <div className="ms-reward">
      {r.type === 'image' && <figure><img src={r.src} alt={r.caption || m.title} loading="lazy" />{r.caption && <figcaption>{r.caption}</figcaption>}</figure>}
      {r.type === 'link' && <a className="button dark small" href={r.url} target="_blank" rel="noreferrer">{r.label || 'เปิดลิงก์'} ↗</a>}
      {r.type === 'text' && <p>{r.body}</p>}
      {r.type === 'poll' && <div className="poll">
        <p className="poll-q">{r.question}</p>
        {r.options.map((opt, i) => {
          const n = poll.counts[i] || 0, pct = poll.total ? Math.round(n / poll.total * 100) : 0;
          return <button key={i} className={`poll-opt ${voted === String(i) ? 'mine' : ''}`} onClick={() => vote(i)}>
            <i style={{ width: `${pct}%` }} /><span>{opt}</span><b>{pct}% · {n}</b>
          </button>;
        })}
        <small className="muted">{poll.total} เสียง · เปลี่ยนใจได้ นับเสียงล่าสุด</small>
      </div>}
    </div>}
  </li>;
}

export default function MeritGoals({ data }) {
  const { event: ev, donations, polls = {}, report = [], registrations } = data;
  const { categories = [], wall = [], total = 0, goal = 0, percent = 0, donors = 0 } = donations || {};
  const cfg = ev.config;
  const milestones = (cfg.milestones || []).map(normMilestone);
  const [form, setForm] = useState({ name: '', dedication: '', message: '', anonymous: false });
  // หมวดที่เลือก: { [categoryId]: { units } | { amount } } — เลือกได้หลายหมวด โอนครั้งเดียว
  const [picked, setPicked] = useState({});
  const [slip, setSlip] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);
  const [attend, setAttend] = useState({ name: '', phone: '' });
  const { user } = useUser();
  useEffect(() => { setAttend(a => prefillFrom(user, a, { name: 'display_name', phone: 'phone' })); setForm(f => prefillFrom(user, f, { name: 'display_name' })); }, [user]);
  const [attendDone, setAttendDone] = useState(null);
  useEffect(() => { try { setAttendDone(JSON.parse(localStorage.getItem(attendKey(ev.slug)) || 'null') || data.mine?.find(m => m.kind === 'attend') || null); } catch { /* optional */ } }, [ev.slug, data.mine]);
  const [attendErr, setAttendErr] = useState('');

  const deadline = cfg.donateUntil ? parseDate(cfg.donateUntil) : null;
  const closed = deadline ? deadline < new Date() : false;
  const open = ['open', 'live'].includes(ev.status) && !closed;
  const lineAmount = (c) => { const p = picked[c.id]; if (!p) return 0; return c.unit_price ? Number(p.units || 0) * c.unit_price : Number(p.amount || 0); };
  const items = categories.filter(c => picked[c.id]);
  const amount = items.reduce((s, c) => s + lineAmount(c), 0);
  const toggle = (c) => setPicked(pk => { const next = { ...pk }; if (next[c.id]) delete next[c.id]; else next[c.id] = c.unit_price ? { units: 1 } : { amount: 300 }; return next; });
  const setPick = (c, patch) => setPicked(pk => ({ ...pk, [c.id]: { ...pk[c.id], ...patch } }));

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      if (!items.length) throw new Error('กรุณาเลือกหมวดที่ต้องการทำบุญอย่างน้อย 1 หมวด');
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      fd.append('items', JSON.stringify(items.map(c => ({ categoryId: c.id, units: picked[c.id].units, amount: picked[c.id].amount }))));
      if (!slip) throw new Error('กรุณาแนบสลิปโอนเงิน');
      fd.append('slip', slip);
      setDone(await api(`/events/${ev.slug}/donations`, { method: 'POST', body: fd }));
      document.getElementById('donate-form')?.scrollIntoView({ behavior: 'smooth' });
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const registerAttend = async (e) => {
    e.preventDefault(); setAttendErr('');
    try {
      const r = await api(`/events/${ev.slug}/registrations`, { method: 'POST', body: { ...attend, kind: 'attend' } });
      setAttendDone(r); try { localStorage.setItem(attendKey(ev.slug), JSON.stringify(r)); } catch { /* optional */ }
    } catch (err) { setAttendErr(err.message); }
  };

  return <>
    {/* ---------- ยอดรวม + milestone ---------- */}
    <Section eyebrow="GOAL" title="ยอดรวมตอนนี้" aside={<span className="ev-summary">ผู้ร่วมบุญ <strong>{donors}</strong> คน · อัปเดตสด</span>}>
      <div className="merit-total">
        <div className="merit-figures"><strong>{baht(total)}</strong><span>จากเป้าหมาย {baht(goal)}</span></div>
        <div className="merit-bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
          <i style={{ width: `${percent}%` }} />
          {milestones.map(m => <b key={m.percent} className={`tick ${percent >= m.percent ? 'hit' : ''}`} style={{ left: `${m.percent}%` }} title={`${m.percent}%`} />)}
        </div>
        <span className="merit-percent">{percent}%</span>
      </div>
      {deadline && <div className="deadline">
        <span className="eyebrow">{closed ? 'ปิดรับยอดออนไลน์แล้ว' : 'ปิดรับยอดออนไลน์ใน'}</span>
        {!closed && <Countdown to={cfg.donateUntil} endedLabel="ปิดรับยอดออนไลน์แล้ว" />}
        <small className="muted">{eventDate({ starts_at: cfg.donateUntil }).long} {eventDate({ starts_at: cfg.donateUntil }).time} · วันไปวัดจริงคือ {eventDate(ev).long}</small>
      </div>}
      <ol className="milestones">{milestones.map(m => <Milestone key={m.percent} m={m} percent={percent} goal={goal} total={total} polls={polls} slug={ev.slug} />)}</ol>
    </Section>

    {/* ---------- หมวด (หน่วยของจริง) ---------- */}
    <Section eyebrow="CATEGORIES" title="ทำบุญตามหมวด">
      <p className="muted small">เลือกได้หลายหมวด แล้วโอนรวมครั้งเดียวในฟอร์มด้านล่าง</p>
      <div className="cat-grid">{categories.map(c => {
        const pct = c.goal ? Math.min(100, Math.round(c.raised / c.goal * 100)) : 0;
        const on = !!picked[c.id];
        return <div key={c.id} className={`cat-card ${on ? 'active' : ''}`}>
          <label className="cat-pick"><input type="checkbox" checked={on} onChange={() => toggle(c)} aria-label={`เลือกหมวด ${c.name}`} /><span className="eyebrow">{c.donors} คนร่วมบุญ</span></label>
          <h3>{c.name}</h3><p>{c.description}</p>
          {c.goal > 0 && <div className="mini-bar"><i style={{ width: `${pct}%` }} /></div>}
          {c.unit_price
            ? <span className="cat-figures"><strong>{c.unitsDone}/{c.unitsGoal} {c.unit_name}</strong> · {c.unit_name}ละ {baht(c.unit_price)} · {pct}%</span>
            : c.goal > 0
              ? <span className="cat-figures"><strong>{baht(c.raised)}</strong> / {baht(c.goal)} · {pct}%</span>
              : <span className="cat-figures"><strong>{baht(c.raised)}</strong> · ตามศรัทธา</span>}
          {on && (c.unit_price
            ? <div className="cat-input"><div className="stepper small"><button type="button" onClick={() => setPick(c, { units: Math.max(1, Number(picked[c.id].units) - 1) })} aria-label="ลด">−</button><input type="number" min="1" value={picked[c.id].units} onChange={e => setPick(c, { units: e.target.value })} aria-label={`จำนวน${c.unit_name}`} /><button type="button" onClick={() => setPick(c, { units: Number(picked[c.id].units) + 1 })} aria-label="เพิ่ม">+</button></div><span>{c.unit_name} = <strong>{baht(lineAmount(c))}</strong></span></div>
            : <div className="cat-input"><div className="amount-row">{PRESETS.map(a => <button type="button" key={a} className={`chip ${Number(picked[c.id].amount) === a ? 'active' : ''}`} onClick={() => setPick(c, { amount: a })}>{baht(a)}</button>)}<input type="number" min="1" value={picked[c.id].amount} onChange={e => setPick(c, { amount: e.target.value })} aria-label="ยอดเงิน" placeholder="ระบุเอง" /></div></div>)}
          {!on && open && <button type="button" className="cat-add" onClick={() => toggle(c)}>+ ร่วมบุญหมวดนี้</button>}
        </div>;
      })}</div>
    </Section>

    {/* ---------- ฟอร์มร่วมบุญ ---------- */}
    <div id="donate-form">
      {done ? <Section eyebrow="THANK YOU" title="อนุโมทนาบุญ">
        {done.autoApproved
          ? <Notice>ตรวจสลิปผ่านแล้ว ยอด {baht(done.amount)} ขึ้นบนหน้านี้ทันที รหัส <strong className="code">{done.code}</strong></Notice>
          : <Notice tone="muted">รับรายการแล้ว รหัส <strong className="code">{done.code}</strong> · {done.note?.startsWith('ตรวจสลิปไม่ผ่าน') || done.note?.includes('ไม่ตรง') || done.note?.includes('ซ้ำ') ? 'ระบบตรวจอัตโนมัติไม่ผ่าน พี่ ๆ ที่ดูแลบูตะจะตรวจให้เอง' : 'พี่ ๆ ที่ดูแลบูตะจะตรวจสอบสลิป'}ภายใน 24 ชั่วโมง</Notice>}
        <LineNotify code={done.code} />
        <div className="form-actions"><Link className="button dark" to={`/ticket/${done.code}`}>ดูใบอนุโมทนา + บันทึกเป็นภาพ <Icon name="arrow" /></Link><button className="link-button" onClick={() => setDone(null)}>ทำบุญเพิ่ม</button></div>
      </Section>
        : <Section eyebrow="DONATE" title="ร่วมทำบุญ">
          {!open ? <Notice tone="muted">{closed ? 'ปิดรับยอดออนไลน์แล้ว ขอบคุณทุกคนที่ร่วมบุญ พบกันที่วัด!' : 'ปิดรับยอดแล้ว ขอบคุณทุกคนที่ร่วมบุญ'}</Notice> : <form className="booking-form" onSubmit={submit}>
            {items.length === 0
              ? <Notice tone="muted">ยังไม่ได้เลือกหมวด — เลือกจากการ์ด <span className="tag-label">ทำบุญตามหมวด</span> ด้านบนได้หลายหมวด</Notice>
              : <div className="donate-summary"><span className="eyebrow">รายการที่เลือก</span>
                <ul>{items.map(c => <li key={c.id}><span>{c.name}{picked[c.id].units ? ` · ${picked[c.id].units} ${c.unit_name}` : ''}</span><strong>{baht(lineAmount(c))}</strong><button type="button" className="link-button" onClick={() => toggle(c)} aria-label={`เอา ${c.name} ออก`}>เอาออก</button></li>)}</ul>
                <div className="donate-total"><span>ยอดโอนรวม</span><strong>{baht(amount)}</strong></div>
              </div>}
            <div className="two">
              <label>ชื่อที่จะแสดง<input id="dn-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="ชื่อ / นามแฝง" /></label>
              <label>ทำบุญในนาม / อุทิศให้ (ถ้ามี)<input id="dn-ded" value={form.dedication} onChange={e => setForm({ ...form, dedication: e.target.value })} placeholder="เช่น ในนามน้องส้ม, อุทิศให้น้องมะลิ" maxLength={160} /></label>
            </div>
            <label>ข้อความบนกำแพงผู้ร่วมบุญ (ถ้ามี) <small className="muted">แสดงใต้ชื่อคุณให้ทุกคนเห็น เช่น คำอนุโมทนา หรือคำอวยพรถึงบูตะ</small><input id="dn-msg" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} maxLength={300} placeholder="เช่น สาธุ ขอให้บูตะและมัมป๊าแข็งแรง" /></label>
            <label className="check"><input id="dn-anon" type="checkbox" checked={form.anonymous} onChange={e => setForm({ ...form, anonymous: e.target.checked })} /> ไม่แสดงชื่อบนกำแพงผู้ร่วมบุญ</label>
            <PayBox payment={cfg.payment} note={`โอน ${baht(amount)} แล้วแนบสลิป — ระบบตรวจสลิปอัตโนมัติ ยอดขึ้นทันทีเมื่อผ่าน`} />
            <FileDrop id="dn-slip" file={slip} onChange={setSlip} required hint="โอนแล้วแนบสลิปเพื่อยืนยันยอด (จำเป็น) · JPG / PNG" />
            {error && <Notice tone="error">{error}</Notice>}
            <div className="form-actions"><button className="button dark" disabled={busy || !(amount >= 1)}>{busy ? 'กำลังส่ง…' : `แจ้งยอด ${baht(amount)}`} <Icon name="heart" /></button></div>
          </form>}
        </Section>}
    </div>

    {/* ---------- ไปวัดด้วย ---------- */}
    {cfg.attend?.enabled && <Section eyebrow="JOIN IN PERSON" title="ไปวัดด้วยกัน" aside={<span className="ev-summary">จะไป <strong>{registrations?.total || 0}</strong> คน · เช็คอินแล้ว {registrations?.checkedIn || 0}</span>}>
      {cfg.attend.note && <p className="muted"><Tagged text={cfg.attend.note} /></p>}
      {attendDone
        ? <><Notice>ลงทะเบียนไปวัดแล้ว หมายเลข #{String(attendDone.number).padStart(3, '0')} — วันงานเปิดหน้าบัตรเพื่อเช็คอินรับของที่ระลึก</Notice><div className="form-actions"><Link className="button ghost small" to={`/ticket/${attendDone.code}`}>เปิดบัตร</Link><button className="link-button" onClick={() => { setAttendDone(null); try { localStorage.removeItem(attendKey(ev.slug)); } catch { /* optional */ } }}>ลงทะเบียนคนอื่น</button></div></>
        : ev.status === 'ended' ? <Notice tone="muted">งานจบแล้ว</Notice>
          : (cfg.registerMode || 'anyone') === 'self' && !user ? <LoginToRegister user={user} what="ลงทะเบียนไปวัด" />
          : <form className="booking-form inline" onSubmit={registerAttend}>
            <label>ชื่อ<input id="at-name" required value={attend.name} onChange={e => setAttend({ ...attend, name: e.target.value })} /></label>
            <label>เบอร์โทร (ถ้ามี)<PhoneInput id="at-phone" value={attend.phone} onChange={phone => setAttend({ ...attend, phone })} /></label>
            {attendErr && <Notice tone="error">{attendErr}</Notice>}
            <div className="form-actions"><button className="button dark small">ฉันจะไปวัดด้วย <Icon name="check" /></button></div>
          </form>}
    </Section>}

    {/* ---------- ความโปร่งใส ---------- */}
    <Section eyebrow="TRANSPARENCY" title="ความโปร่งใส">
      <div className="trust-grid">
        {cfg.report?.accountNote && <div className="trust-item"><span className="eyebrow">บัญชีรับเงิน</span><p>{cfg.report.accountNote}</p></div>}
        {cfg.report?.excessPolicy && <div className="trust-item"><span className="eyebrow">ยอดเกินเป้า</span><p>{cfg.report.excessPolicy}</p></div>}
        {cfg.report?.taxNote && <div className="trust-item"><span className="eyebrow">ลดหย่อนภาษี</span><p>{cfg.report.taxNote}</p></div>}
      </div>
      <div className="report-head"><h3>รายงานการใช้เงิน</h3><span className="muted">ยอดรับ {baht(total)} · ยอดใช้ที่มีหลักฐาน {baht(report.reduce((s, r) => s + Number(r.amount || 0), 0))}</span></div>
      {report.length === 0 ? <p className="muted">ใบเสร็จ ใบอนุโมทนาจากวัด และภาพส่งมอบจะอัปโหลดไว้ที่นี่หลังวันงาน</p>
        : <ul className="report-list">{report.map(r => <li key={r.id} className={`report-item ${r.kind}`}>{r.image_path && <a href={r.image_path} target="_blank" rel="noreferrer"><img src={r.image_path} alt={r.title} loading="lazy" /></a>}<div><span className="eyebrow">{{ receipt: 'ใบเสร็จ / ใบอนุโมทนา', photo: 'ภาพส่งมอบ', note: 'บันทึก' }[r.kind]}</span><strong>{r.title}</strong>{r.amount != null && <span className="report-amount">{baht(r.amount)}</span>}{r.body && <p>{r.body}</p>}</div></li>)}</ul>}
    </Section>

    {/* ---------- กำแพงผู้ร่วมบุญ ---------- */}
    <Section eyebrow="WALL OF HEARTS" title="ผู้ร่วมบุญล่าสุด">
      {wall.length === 0 ? <p className="muted">ยังไม่มีรายการ เป็นคนแรกได้เลย</p> : <ul className="wall">{wall.map(w => <li key={w.id}><Paw /><div><strong>{w.donor_name}</strong>{w.dedication && <em className="dedication"> · {w.dedication}</em>} <span className="muted">· {w.units ? `${w.units} ${w.unit_name} ` : ''}{w.category} · {baht(w.amount)}</span>{w.message && <p>“{w.message}”</p>}</div></li>)}</ul>}
    </Section>
  </>;
}
