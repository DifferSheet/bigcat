import React from 'react';
import Home from '@/views/Home.jsx';
import { fetchJSON, meta, jsonLd, eventSchema } from '@/lib/seo.js';

export const revalidate = 60;
export const metadata = meta({
  title: 'BIGCAT — แก๊งแมวตัวโต ความสุขเต็มหัวใจ',
  description: 'โลกใบเล็กของโนบิ บูตะ และชิบะ ที่อยากทำให้ทุกวันของคุณน่ารักขึ้นอีกนิด ติดตามกิจกรรม ของสะสม และโมเมนต์ของพวกเรา',
  path: '/', image: '/images/bigcat-hero.png',
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
