import React from 'react';
import GateScreen from '@/views/GateScreen.jsx';
export const metadata = { title: 'QR เช็คอินหน้างาน', robots: { index: false, follow: false } };
export default async function Page({ params }) { const { slug } = await params; return <GateScreen slug={slug} />; }
