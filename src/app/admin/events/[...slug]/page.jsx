import React from 'react';
import AdminPage from '@/views/AdminPage.jsx';
export const metadata = { title: 'กิจกรรม · แอดมิน', robots: { index: false, follow: false } };
// /admin/events · /admin/events/<slug> · /admin/events/<slug>/edit · /admin/events/new
export default async function Page({ params }) {
  const { slug = [] } = await params;
  return <AdminPage area="events" slug={slug.join('/') || null} />;
}
