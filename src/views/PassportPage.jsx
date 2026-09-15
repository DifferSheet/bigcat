'use client';
// Passport — สมุดแสตมป์ของสมาชิก: แสตมป์ต่องานที่มา/ร่วมบุญ · ช่องว่างของงานที่พลาด · แสตมป์พิเศษ · เนื้อหาปลดล็อก · ลิงก์ชวนเพื่อน · แชร์เป็นรูป
import React, { useEffect, useState } from 'react';
import { Link } from '../lib/nav.jsx';
import { SiteHeader, SiteFooter, Notice, Section } from '../components/EventShell.jsx';
import { Icon, Paw, PageLoader, Modal, Tag } from '../components/ui.jsx';
import { EventStamp, SpecialStamp, STAMP_LABEL } from '../components/Stamp.jsx';
import SaveImage from '../components/SaveImage.jsx';
import { api } from '../lib/api.js';
import { useUser } from '../lib/auth.js';
import { eventDate, parseDate } from '../lib/format.js';
import { drawPassportImage } from '../lib/passport-image.js';

const fmt = (d) => { const x = parseDate(d); return x ? x.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : ''; };

// รายละเอียดแสตมป์ 1 ดวง (กดจากสมุด) — ใหญ่ขึ้น + วันที่ได้ + แสตมป์พิเศษของงานนั้น + เนื้อหาปลดล็อก
function StampDetail({ ev, onClose }) {
  const d = eventDate(ev);
  const state = ev.earned ? 'earned' : ev.phase === 'upcoming' ? 'locked' : 'missed';
  return <Modal title={ev.title} onClose={onClose}>
    <div className="stamp-detail">
      <EventStamp ev={ev} state={state} size={200} />
      <p className="muted">{d.long} · {d.time}</p>
      {state === 'earned' && <p className="stamp-earned-at">{STAMP_LABEL[ev.earned.kind]} · ได้เมื่อ {fmt(ev.earned.earned_at)}</p>}
      {state === 'missed' && <p className="muted">งานนี้ผ่านไปแล้ว — แสตมป์ดวงนี้ไม่ออกอีก ครั้งหน้ามาเจอกันนะ</p>}
      {state === 'locked' && <p className="muted">ยังไม่ถึงวันงาน — มาเช็คอินแล้วรับแสตมป์ดวงนี้</p>}
      {ev.extras?.length > 0 && <div className="stamp-extras">{ev.extras.map(s => <SpecialStamp key={s.kind} kind={s.kind} meta={s.meta} size={84} />)}</div>}
      {ev.unlock && <div className="unlock-box">
        <span className="eyebrow">เฉพาะคนที่มา ♡</span>
        {ev.unlock.type === 'text' && <p className="unlock-text">{ev.unlock.text}</p>}
        {ev.unlock.type === 'image' && ev.unlock.src && <img src={ev.unlock.src} alt={ev.unlock.caption || 'ภาพหลังเวที'} />}
        {ev.unlock.type === 'audio' && ev.unlock.src && <audio controls preload="none" src={ev.unlock.src} />}
        {ev.unlock.caption && <small className="muted">{ev.unlock.caption}</small>}
      </div>}
      {!ev.unlock && ev.hasUnlock && state !== 'earned' && <p className="muted small">งานนี้มีของพิเศษให้เฉพาะคนที่มาเช็คอิน</p>}
      <Link className="button ghost small" to={`/events/${ev.slug}`}>ไปหน้างาน</Link>
    </div>
  </Modal>;
}

// ลิงก์ชวนเพื่อน — ก๊อป / แชร์ (native share บนมือถือ)
function InviteBox({ code, friend }) {
  const [copied, setCopied] = useState(false);
  const url = `${typeof location !== 'undefined' ? location.origin : ''}/i/${code}`;
  const text = `มาเจอแก๊ง BIGCAT ด้วยกันไหม ลงทะเบียนฟรี แล้วเราจะได้แสตมป์คู่ใน Passport ♡ ${url}`;
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard ไม่ให้ */ } };
  const share = async () => { try { await navigator.share({ title: 'มาเจอ BIGCAT ด้วยกัน', text, url }); } catch { /* ยกเลิก */ } };
  return <div className="invite-box">
    <div className="invite-copy">
      <span className="eyebrow">พาเพื่อนมา</span>
      <h3>ชวนเพื่อนที่ยังไม่เคยมา — ได้แสตมป์คู่ทั้งสองคน</h3>
      <p className="muted">ส่งลิงก์นี้ให้เพื่อน เพื่อนลงทะเบียนแล้วมาเช็คอินครั้งแรกเมื่อไหร่ คุณได้แสตมป์ <Tag>พามาเจอ</Tag> เพื่อนได้ <Tag>มาครั้งแรก</Tag> — สองลายต่อกันเป็นภาพเดียวเมื่อวางมือถือชิดกัน</p>
      <div className="invite-link"><code>{url.replace(/^https?:\/\//, '')}</code><button type="button" className="button dark small" onClick={copy}>{copied ? 'ก๊อปแล้ว ✓' : 'ก๊อปลิงก์'}</button>{typeof navigator !== 'undefined' && !!navigator.share && <button type="button" className="button ghost small" onClick={share}>ส่งให้เพื่อน</button>}</div>
      {friend?.meta?.count > 0 && <p className="small-note">พามาแล้ว {friend.meta.count} คน{friend.meta.friends?.length ? ` — ${friend.meta.friends.join(', ')}` : ''}</p>}
    </div>
    <SpecialStamp kind="friend" meta={friend?.meta} size={110} />
  </div>;
}

export default function PassportPage() {
  const { user, loaded } = useUser();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);      // งานที่กดดู
  const [img, setImg] = useState(null);        // data URL รูปแชร์
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (loaded && !user) location.replace('/login?next=/passport'); }, [loaded, user]);
  useEffect(() => { if (user) api('/passport').then(setData).catch(e => setError(e.message)); }, [user]);
  const makeImage = async () => { setBusy(true); try { setImg((await drawPassportImage(data)).toDataURL('image/png')); } catch (e) { setError(e.message); } finally { setBusy(false); } };

  if (!user || (!data && !error)) return <><SiteHeader /><PageLoader label="กำลังเปิดสมุด…" /></>;
  const specials = data ? [...data.books.flatMap(b => b.events.flatMap(ev => (ev.extras || []).map(s => ({ ...s, ev })))), ...(data.friend ? [{ ...data.friend, ev: null }] : [])] : [];
  const upcoming = data ? data.books.flatMap(b => b.events).filter(ev => ev.phase === 'upcoming') : [];

  return <><SiteHeader /><main className="ev-page passport-page">
    {error && <Notice tone="error">{error}</Notice>}
    {data && <>
      <div className="passport-head">
        {user.avatar ? <img className="avatar lg" src={user.avatar} alt="" referrerPolicy="no-referrer" /> : <span className="avatar lg placeholder">{user.display_name.slice(0, 1)}</span>}
        <div className="grow">
          <span className="eyebrow">PASSPORT</span>
          <h1>{user.display_name}</h1>
          <p className="muted">สะสมแล้ว <strong>{data.total}</strong> ดวง{data.user.first_checkin_at ? ` · มางานครั้งแรก ${fmt(data.user.first_checkin_at)}` : ''}{data.user.inviter ? ` · มาเจอเพราะ ${data.user.inviter.display_name} ชวน` : ''}</p>
        </div>
        <button type="button" className="button dark small" onClick={makeImage} disabled={busy || data.total === 0} title={data.total === 0 ? 'ยังไม่มีแสตมป์ให้อวด — มางานก่อนนะ' : ''}>{busy ? 'กำลังวาด…' : 'แชร์เป็นรูป'} <Icon name="heart" size={16} /></button>
      </div>
      {img && <SaveImage url={img} fileName={`bigcat-passport-${user.display_name}.png`} title="BIGCAT Passport" alt="Passport ของฉัน" />}

      {data.sticker.eligible && !data.sticker.given_at && <Notice>ครบ {data.sticker.at} ดวงแล้ว 🎉 รับ<strong>สติกเกอร์ Passport</strong>ได้ที่โต๊ะพี่ ๆ ในงานถัดไป — โชว์หน้านี้ให้ดูได้เลย</Notice>}
      {data.sticker.given_at && <p className="small-note">รับสติกเกอร์ Passport แล้วเมื่อ {fmt(data.sticker.given_at)} ♡</p>}

      {data.books.map(book => <Section key={book.key} eyebrow="STAMPS" title={book.name} className="passport-book">
        <div className="stamp-grid">
          {book.events.map(ev => { const state = ev.earned ? 'earned' : ev.phase === 'upcoming' ? 'locked' : 'missed'; const d = eventDate(ev); return <button key={ev.slug} type="button" className={`stamp-slot ${state}`} onClick={() => setOpen(ev)}>
            <EventStamp ev={ev} state={state} size={120} />
            <strong>{ev.title}</strong>
            <small>{state === 'locked' ? `${d.long} · รอเก็บ` : state === 'missed' ? 'พลาดไป' : fmt(ev.earned.earned_at)}</small>
            {ev.extras?.length > 0 && <span className="slot-extra">+{ev.extras.length} พิเศษ</span>}
            {ev.hasUnlock && state === 'earned' && <span className="slot-unlock">♡ มีของปลดล็อก</span>}
          </button>; })}
        </div>
      </Section>)}

      {specials.length > 0 && <Section eyebrow="SPECIAL" title="แสตมป์พิเศษ">
        <div className="stamp-grid special">{specials.map((s, i) => <div key={i} className="stamp-slot earned"><SpecialStamp kind={s.kind} meta={s.meta} size={110} /><strong>{STAMP_LABEL[s.kind]}</strong><small>{s.ev ? s.ev.title : `พาเพื่อนมาแล้ว ${s.meta?.count || 0} คน`}</small></div>)}</div>
      </Section>}

      <Section eyebrow="INVITE" title="พาเพื่อนมา"><InviteBox code={data.user.invite_code} friend={data.friend} /></Section>

      {upcoming.length > 0 && <p className="small-note">งานถัดไป: {upcoming.slice(0, 3).map(ev => <Link key={ev.slug} to={`/events/${ev.slug}`}>{ev.title}</Link>).reduce((a, b) => [a, ' · ', b])} — ลงทะเบียนแล้วมาเช็คอินรับแสตมป์</p>}
    </>}
    {open && <StampDetail ev={open} onClose={() => setOpen(null)} />}
    <Paw />
  </main><SiteFooter /></>;
}
