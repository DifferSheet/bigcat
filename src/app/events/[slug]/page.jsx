import React from 'react';
import { notFound } from 'next/navigation';
import EventPage from '@/views/EventPage.jsx';
import { fetchJSON, meta, jsonLd, eventSchema, breadcrumbSchema } from '@/lib/seo.js';
import { eventDate, typeLabel } from '@/lib/format.js';

export const revalidate = 60;

// สร้างล่วงหน้าทุกกิจกรรม → หน้าเสิร์ฟจาก cache เร็วมาก
export async function generateStaticParams() {
  const events = await fetchJSON('/events', { revalidate: 300 });
  return (events || []).map(e => ({ slug: e.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const data = await fetchJSON(`/events/${slug}`);
  if (!data?.event) return meta({ title: 'ไม่พบกิจกรรม', path: `/events/${slug}`, noindex: true });
  const ev = data.event;
  const d = eventDate(ev);
  return meta({
    title: ev.title,
    description: `${typeLabel[ev.type]} · ${d.long} ${d.time} · ${ev.place || 'สถานที่จะแจ้งให้ทราบ'} — ${ev.subtitle || (ev.description || '').slice(0, 110)}`,
    path: `/events/${ev.slug}`, image: ev.cover, type: 'article',
  });
}

export default async function Page({ params }) {
  const { slug } = await params;
  const data = await fetchJSON(`/events/${slug}`);
  if (!data?.event) notFound();
  return <>
    <EventPage slug={slug} initialData={data} />
    <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(eventSchema(data.event))} />
    <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(breadcrumbSchema([['หน้าแรก', '/'], ['ตารางงาน', '/events'], [data.event.title, `/events/${slug}`]]))} />
  </>;
}
