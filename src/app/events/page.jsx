import React from 'react';
import EventsPage from '@/views/EventsPage.jsx';
import { fetchJSON, meta, jsonLd, eventSchema, breadcrumbSchema } from '@/lib/seo.js';

// render ทุก request (ไม่ prerender ตอน build บน runner ที่ยิง API ไม่ถึง — ไม่งั้นหลัง deploy จะได้หน้าว่างจน ISR รอบถัดไป)
export const dynamic = 'force-dynamic';
export const metadata = meta({
  title: 'ตารางงานของแก๊ง BIGCAT',
  description: 'จองที่นั่ง Fan Meet ร่วมทำบุญ หรือมาเจอกันริมถนน ดูตารางงานทั้งหมดของโนบิ บูตะ ชิบะ พร้อมวันเวลาและสถานที่',
  path: '/events',
});

export default async function Page() {
  const events = await fetchJSON('/events');
  return <>
    <EventsPage initialEvents={events || []} />
    <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(breadcrumbSchema([['หน้าแรก', '/'], ['ตารางงาน', '/events']]))} />
    {(events || []).map(ev => <script key={ev.slug} type="application/ld+json" dangerouslySetInnerHTML={jsonLd(eventSchema(ev))} />)}
  </>;
}
