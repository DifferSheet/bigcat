'use client';
// ส่วน «อัลบั้มงาน» บนหน้างาน — เช็คอินแล้วเห็นทั้งอัลบั้ม (ลิงก์ไปหน้าเต็ม) · ไม่ได้เช็คอินเห็นพรีวิว 3 รูปให้รู้ว่ามีระบบนี้
import React, { useEffect, useState } from 'react';
import { Link } from '../lib/nav.jsx';
import { Section, Notice } from '../components/EventShell.jsx';
import { Icon, Tag } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useUser } from '../lib/auth.js';

export default function EventAlbum({ ev }) {
  const { user } = useUser();
  const [a, setA] = useState(null);
  useEffect(() => { api(`/events/${ev.slug}/album`).then(setA).catch(() => setA({ total: 0 })); }, [ev.slug, user?.id]);
  if (!a || !a.total) return null;
  const full = a.access === 'full';
  return <Section eyebrow="PHOTO ALBUM" title="ภาพบรรยากาศวันงาน" aside={<span className="ev-summary"><strong>{a.total}</strong> รูป{full && a.me?.matches > 0 ? <> · มีคุณ <strong>{a.me.matches}</strong> รูป</> : null}</span>}>
    <div className={`album-preview ${full ? '' : 'locked'}`}>
      {a.photos.slice(0, full ? 5 : 3).map(p => <Link key={p.id} to={`/events/${ev.slug}/album${full ? `#p${p.id}` : ''}`} className="album-preview-tile"><img src={p.thumb} alt="" loading="lazy" />{p.mine && <span className="album-me">คุณ</span>}</Link>)}
      {full && a.total > 5 && <Link to={`/events/${ev.slug}/album`} className="album-preview-tile more"><span>+{a.total - 5}</span></Link>}
    </div>
    {full
      ? <div className="form-actions"><Link className="button dark" to={`/events/${ev.slug}/album`}>เปิดอัลบั้มทั้งหมด <Icon name="arrow" /></Link>{a.facesEnabled && !a.me?.registered && <Link className="link-button" to="/account#face">ให้ระบบหารูปที่มีคุณอัตโนมัติ →</Link>}</div>
      : <Notice tone="muted">อัลบั้มเต็มเปิดให้เฉพาะคนที่<strong>เช็คอินหน้างาน</strong>นี้ {user ? 'บัญชีของคุณยังไม่มีการเช็คอินงานนี้' : <>— <Link to={`/login?next=/events/${ev.slug}`}>เข้าสู่ระบบ</Link>ด้วยบัญชีที่ใช้ลงทะเบียน</>} · ครั้งหน้ามาเช็คอินแล้วรับทั้งแสตมป์ Passport และรูปในอัลบั้ม</Notice>}
  </Section>;
}
