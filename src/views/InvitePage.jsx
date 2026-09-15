'use client';
// หน้าที่เพื่อนเปิดจากลิงก์ชวน /i/:code — จำคนชวนไว้ (cookie 30 วัน) แล้วพาไปงานถัดไป
import React, { useEffect, useState } from 'react';
import { Link } from '../lib/nav.jsx';
import { SiteHeader, SiteFooter, Notice } from '../components/EventShell.jsx';
import { Icon, Paw, PageLoader, Tag } from '../components/ui.jsx';
import { SpecialStamp } from '../components/Stamp.jsx';
import { api } from '../lib/api.js';
import { eventDate } from '../lib/format.js';

export default function InvitePage({ code }) {
  const [r, setR] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api(`/invite/${code}`, { method: 'POST' }).then(setR).catch(e => setError(e.message)); }, [code]);
  const body = () => {
    if (error) return <Notice tone="error">{error}</Notice>;
    if (!r) return <PageLoader />;
    if (r.self) return <Notice tone="muted">นี่คือลิงก์ชวนของคุณเอง — ส่งให้เพื่อนที่ยังไม่เคยมางานนะ</Notice>;
    const next = r.next ? eventDate(r.next) : null;
    return <div className="invite-landing">
      <div className="invite-pair"><SpecialStamp kind="friend" size={96} /><SpecialStamp kind="first" size={96} /></div>
      <span className="eyebrow">เพื่อนชวนมาเจอ</span>
      <h1>{r.inviter.display_name} ชวนคุณมาเจอแก๊ง BIGCAT</h1>
      <p>ลงทะเบียนฟรี มาเช็คอินหน้างานครั้งแรกเมื่อไหร่ คุณได้แสตมป์ <Tag>มาครั้งแรก</Tag> และ {r.inviter.display_name} ได้ <Tag>พามาเจอ</Tag> — สองลายต่อกันเป็นภาพเดียว</p>
      {r.attached && <Notice>ผูกกับ {r.inviter.display_name} แล้ว ✓ ไปลงทะเบียนงานได้เลย</Notice>}
      {!r.alreadyMember && <p className="muted small">ระบบจำไว้ให้ 30 วัน — เข้าสู่ระบบด้วย LINE/Google ตอนลงทะเบียนงาน แล้วทุกอย่างจะผูกกันเอง</p>}
      {r.next
        ? <Link className="button dark" to={`/events/${r.next.slug}`}>ดูงานถัดไป: {r.next.title} <Icon name="arrow" /></Link>
        : <Link className="button dark" to="/events">ดูตารางงาน <Icon name="arrow" /></Link>}
      {next && <p className="muted">{next.long} · {next.time}</p>}
    </div>;
  };
  return <><SiteHeader /><main className="ev-page narrow gate-page">{body()}<Paw /></main><SiteFooter /></>;
}
