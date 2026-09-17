import React from 'react';
import AlbumPage from '@/views/AlbumPage.jsx';
export const metadata = { title: 'อัลบั้มงาน', robots: { index: false, follow: false } };
export default async function Page({ params }) { const { slug } = await params; return <AlbumPage slug={slug} />; }
