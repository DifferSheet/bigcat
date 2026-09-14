'use client';
import React, { useEffect, useState } from 'react';
import { Link } from '../lib/nav.jsx';
import { SiteHeader, SiteFooter, Notice } from '../components/EventShell.jsx';
import { Icon, PageLoader } from '../components/ui.jsx';
import { useUser, loginUrl } from '../lib/auth.js';

export default function LoginPage() {
  const { user, providers, loaded } = useUser();
  const [next, setNext] = useState('/account');
  const [error, setError] = useState('');
  useEffect(() => { const p = new URLSearchParams(location.search); if (p.get('next')) setNext(p.get('next')); setError(p.get('error') || ''); }, []);
  useEffect(() => { if (user) location.replace(next); }, [user, next]);
  const none = loaded && !providers.line && !providers.google;
  return <>
    <SiteHeader />
    <main className="ev-page">
      <div className="login-card">
        <span className="eyebrow">MEMBER</span>
        <h1>เข้าสู่ระบบ BIGCAT</h1>
        <p className="ev-subtitle">ไม่ต้องสมัคร ไม่ต้องจำรหัสผ่าน — ใช้บัญชีที่มีอยู่แล้วได้เลย</p>
        {error && <Notice tone="warn">{error}</Notice>}
        {!loaded ? <PageLoader /> : user ? <PageLoader label="กำลังพาไปต่อ…" /> : none ? <Notice tone="muted">ยังไม่เปิดให้เข้าสู่ระบบในตอนนี้ — ยังจอง/สั่งซื้อได้ตามปกติโดยไม่ต้องล็อกอิน</Notice> : <div className="login-buttons">
          {providers.line && <a className="button login-line" href={loginUrl('line', next)}><span className="line-mark">LINE</span>เข้าสู่ระบบด้วย LINE</a>}
          {providers.google && <a className="button login-google" href={loginUrl('google', next)}><GoogleMark />เข้าสู่ระบบด้วย Google</a>}
        </div>}
        <ul className="login-perks">
          <li><Icon name="check" size={14} /> กรอกชื่อ เบอร์ ที่อยู่ให้อัตโนมัติทุกครั้งที่จอง/สั่งซื้อ</li>
          <li><Icon name="check" size={14} /> ดูบัตร ยอดทำบุญ และคำสั่งซื้อทั้งหมดในที่เดียว ไม่ต้องจำรหัส</li>
          <li><Icon name="check" size={14} /> ล็อกอินด้วย LINE = พร้อมรับแจ้งเตือนสถานะทาง LINE</li>
        </ul>
        <p className="muted small">เราเก็บเฉพาะชื่อ รูป และอีเมลจากบัญชีที่คุณเลือก · <Link to="/">กลับหน้าแรก</Link></p>
      </div>
    </main>
    <SiteFooter />
  </>;
}

function GoogleMark() {
  return <svg className="google-mark" viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.5l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.9 6.1C12.4 13.5 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z"/><path fill="#FBBC05" d="M10.5 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.1.8-4.6l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.1 1.4-4.9 2.3-8.2 2.3-6.3 0-11.6-4-13.5-9.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>;
}
