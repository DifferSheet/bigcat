import React from 'react';
import AdminPage from '@/views/AdminPage.jsx';
export const metadata = { title: 'อัลบั้ม · แอดมิน', robots: { index: false, follow: false } };
// /admin/albums · /admin/albums/<slug>
export default async function Page({ params }) {
  const { slug = [] } = await params;
  return <AdminPage area="albums" slug={slug[0] || null} />;
}
