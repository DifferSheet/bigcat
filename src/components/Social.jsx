'use client';
// ลิงก์โซเชียลของแก๊ง — ใช้ท้ายหน้าแรก ท้ายหน้าอื่น และโมดัลตัวละคร (ลิงก์จริง แด๊ดให้ 15 ก.ย. 2026)
import React from 'react';
import { Icon } from './ui.jsx';

// โซเชียล (ลิงก์จริง แด๊ดให้ 15 ก.ย.) — ใช้ทั้ง footer และโมดัลตัวละคร
export const SOCIALS = {
  nobi: [['music', 'TikTok น้องโนบิ', 'https://www.tiktok.com/@nobisingasong'], ['instagram', 'Instagram น้องโนบิ', 'https://www.instagram.com/nobibigcat/'], ['x', 'X น้องโนบิ', 'https://x.com/nobibigcat'], ['facebook', 'Facebook น้องโนบิ', 'https://www.facebook.com/NobiBigcat']],
  boota: [['music', 'TikTok น้องบูตะ', 'https://www.tiktok.com/@bootabigcat'], ['instagram', 'Instagram น้องบูตะ', 'https://www.instagram.com/bootabigcat'], ['facebook', 'Facebook น้องบูตะ', 'https://www.facebook.com/BootaStar/']],
  gang: [['youtube', 'YouTube BIGCAT', 'https://www.youtube.com/@NobiBootaBigcat']],
};
export const OPENCHAT = 'https://line.me/ti/g2/m0j1nxwqVMKQDnUz0WNM304jSueC69cRPsSY5g?utm_source=invitation&utm_medium=link_copy&utm_campaign=default';

// แถวไอคอนโซเชียล — ลิงก์จริงทุกปุ่ม เปิดแท็บใหม่
export function SocialRow({ items }) {
  return <div className="hm-social-row">{items.map(([icon, label, href]) => <a key={href} href={href} target="_blank" rel="noopener" aria-label={label} title={label}><Icon name={icon} size={18} /></a>)}</div>;
}

// บล็อกโซเชียลท้ายเว็บ: NOBI 4 · BOOTA 3 · BIGCAT (YouTube + OpenChat) — ใช้ทั้งหน้าแรกและ footer หน้าอื่น
export function SocialLinks() {
  return <div className="hm-social">
    <span className="hm-social-head">Follow the gang <small>ตามพวกเราได้ที่</small></span>
    <div className="hm-social-group"><b>NOBI</b><SocialRow items={SOCIALS.nobi} /></div>
    <div className="hm-social-group"><b>BOOTA</b><SocialRow items={SOCIALS.boota} /></div>
    <div className="hm-social-group"><b>BIGCAT</b><SocialRow items={SOCIALS.gang} /><a className="hm-openchat" href={OPENCHAT} target="_blank" rel="noopener" aria-label="ด้อมบิ๊กแคท OpenChat">Join the fam →</a></div>
  </div>;
}
