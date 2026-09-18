import React from 'react';
import AdminPage from '@/views/AdminPage.jsx';
export const metadata = { title: 'กิจกรรม · แอดมิน', robots: { index: false, follow: false } };
export default function Page() { return <AdminPage area="events" />; }
