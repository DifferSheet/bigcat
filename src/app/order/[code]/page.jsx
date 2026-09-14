import React from 'react';
import OrderPage from '@/views/OrderPage.jsx';
export const metadata = { title: 'ติดตามคำสั่งซื้อ', robots: { index: false, follow: false } };
export default async function Page({ params }) { const { code } = await params; return <OrderPage code={code} />; }
