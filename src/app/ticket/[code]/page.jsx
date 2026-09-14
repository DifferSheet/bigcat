import React from 'react';
import TicketPage from '@/views/TicketPage.jsx';
export const metadata = { title: 'บัตรของฉัน', robots: { index: false, follow: false } };
export default async function Page({ params }) { const { code } = await params; return <TicketPage code={code} />; }
