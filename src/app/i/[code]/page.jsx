import React from 'react';
import InvitePage from '@/views/InvitePage.jsx';
export const metadata = { title: 'เพื่อนชวนมาเจอ BIGCAT', description: 'มาเจอแก๊ง BIGCAT ด้วยกัน — ลงทะเบียนฟรี แล้วรับแสตมป์คู่ใน Passport', robots: { index: false, follow: false } };
export default async function Page({ params }) { const { code } = await params; return <InvitePage code={code} />; }
