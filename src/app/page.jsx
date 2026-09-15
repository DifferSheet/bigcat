import React from 'react';
import Home from '@/views/Home.jsx';
import { fetchJSON, meta, jsonLd, eventSchema } from '@/lib/seo.js';

// render ทุก request (ไม่ prerender ตอน build บน runner ที่ยิง API ไม่ถึง — ไม่งั้นหลัง deploy จะได้หน้าว่างจน ISR รอบถัดไป)
export const dynamic = 'force-dynamic';
export const metadata = meta({
  title: 'BIGCAT — Big cats. Lighter days.', absoluteTitle: true,
  description: 'แก๊งแมวตัวโต โนบิ บูตะ ชิบะ — ร้องสด ทำบุญ และเจอกันได้จริงทุกเสาร์ ดูตารางงาน ลงทะเบียนงานฟรี และช้อปของสะสม BIGCAT',
  // og:image = โปสเตอร์ 26 ก.ย. จนกว่างานจะผ่าน แล้วสลับกลับ /images/bigcat-hero.jpg
  path: '/', image: '/images/og-26sep.jpg',
});

export default async function Page() {
  // ดึงฝั่ง server → HTML มีเนื้อหาครบตั้งแต่ไบต์แรก (ดีทั้ง Google และพรีวิวลิงก์)
  const [events, products] = await Promise.all([fetchJSON('/events'), fetchJSON('/shop/products')]);
  const upcoming = (events || []).filter(e => e.status !== 'ended').slice(0, 2);
  const featured = (products || []).filter(p => p.featured).concat((products || []).filter(p => !p.featured)).slice(0, 4);
  return <>
    <Home initialEvents={upcoming} initialProducts={featured} />
    {upcoming.map(ev => <script key={ev.slug} type="application/ld+json" dangerouslySetInnerHTML={jsonLd(eventSchema(ev))} />)}
  </>;
}
