import React from 'react';
import EventsPage from '@/views/EventsPage.jsx';
export const metadata = { title: 'ไม่พบหน้านี้', robots: { index: false } };
export default function NotFound() { return <EventsPage notFound />; }
