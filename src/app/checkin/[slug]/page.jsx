import React from 'react';
import GateCheckin from '@/views/GateCheckin.jsx';
export const metadata = { title: 'เช็คอินหน้างาน', robots: { index: false, follow: false } };
export default async function Page({ params }) { const { slug } = await params; return <GateCheckin slug={slug} />; }
