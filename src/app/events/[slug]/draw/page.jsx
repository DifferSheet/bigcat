import React from 'react';
import DrawScreen from '@/views/DrawScreen.jsx';
export const metadata = { title: 'Lucky Fan', robots: { index: false, follow: false } };
export default async function Page({ params }) { const { slug } = await params; return <DrawScreen slug={slug} />; }
