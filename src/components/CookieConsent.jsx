'use client';
// แบนเนอร์คุกกี้ตาม PDPA: แจ้งก่อนใช้ · เลือกได้ (ยอมรับทั้งหมด / เฉพาะที่จำเป็น / ตั้งค่ารายหมวด) · ลิงก์นโยบาย · เปิดแก้ทีหลังได้จากท้ายเว็บ
import React, { useEffect, useState } from 'react';
import { Link } from '../lib/nav.jsx';
import { Icon } from './ui.jsx';
import { useConsent, saveConsent, openConsentSettings } from '../lib/consent.js';

const CATS = [
  { key: 'necessary', locked: true, name: 'จำเป็นต่อการใช้งาน', desc: 'สถานะเข้าสู่ระบบ ความปลอดภัยตอนล็อกอินด้วย LINE/Google และตะกร้าสินค้า — ปิดไม่ได้เพราะเว็บจะทำงานไม่ได้' },
  { key: 'functional', name: 'ความสะดวก', desc: 'จำชื่อ เบอร์ และที่อยู่ที่เคยกรอกตอนสั่งซื้อ และจำว่าคุณโหวต/ลงทะเบียนกิจกรรมไหนไปแล้ว' },
];

export default function CookieConsent() {
  const consent = useConsent();
  const [settings, setSettings] = useState(false);
  const [functional, setFunctional] = useState(true);
  useEffect(() => { const open = () => { setFunctional(!!consent?.functional); setSettings(true); }; addEventListener('bigcat:consent-open', open); return () => removeEventListener('bigcat:consent-open', open); }, [consent]);
  if (consent === undefined) return null;          // ยังไม่ hydrate
  if (consent && !settings) return null;           // ตอบไปแล้ว
  const done = (fn) => { saveConsent({ functional: fn }); setSettings(false); };
  return <div className="cookie-wrap" role="dialog" aria-live="polite" aria-label="การใช้คุกกี้">
    <div className="cookie-box">
      <div className="cookie-head"><span className="cookie-icon">🍪</span><div><strong>เว็บนี้ใช้คุกกี้และหน่วยความจำในเบราว์เซอร์</strong><p>เพื่อให้เข้าสู่ระบบ เก็บตะกร้า และจำข้อมูลที่คุณกรอกไว้ให้ครั้งถัดไป เราไม่ใช้คุกกี้โฆษณาหรือติดตามข้ามเว็บ อ่านรายละเอียดที่ <Link to="/privacy">นโยบายความเป็นส่วนตัว</Link></p></div></div>
      {settings && <ul className="cookie-cats">{CATS.map(c => <li key={c.key}>
        <label className="cookie-cat"><input type="checkbox" checked={c.locked || functional} disabled={c.locked} onChange={e => setFunctional(e.target.checked)} /><span><strong>{c.name}{c.locked && <small> · เปิดเสมอ</small>}</strong><small>{c.desc}</small></span></label>
      </li>)}</ul>}
      <div className="cookie-actions">
        {settings
          ? <><button className="button dark small" onClick={() => done(functional)}>บันทึกการตั้งค่า <Icon name="check" size={14} /></button><button className="button ghost small" onClick={() => done(false)}>เฉพาะที่จำเป็น</button></>
          : <><button className="button dark small" onClick={() => done(true)}>ยอมรับทั้งหมด <Icon name="check" size={14} /></button><button className="button ghost small" onClick={() => done(false)}>เฉพาะที่จำเป็น</button><button className="link-button" onClick={() => { setFunctional(true); setSettings(true); }}>ตั้งค่า</button></>}
      </div>
    </div>
  </div>;
}

// ลิงก์เปิดตั้งค่าคุกกี้ (ใช้ท้ายเว็บ)
export function CookieSettingsLink({ className = 'link-button' }) {
  return <button type="button" className={className} onClick={openConsentSettings}>ตั้งค่าคุกกี้</button>;
}
