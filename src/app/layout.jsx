import React from 'react';
import { Anuphan, Fredoka, Mitr, Caveat } from 'next/font/google';
import { SITE, jsonLd, orgSchema } from '@/lib/seo.js';
import '@/tokens.css';    // design tokens — ต้องมาก่อนทุกไฟล์
import '@/styles.css';    // base · header/footer · ปุ่ม
import '@/event.css';     // ระบบกิจกรรม · บัตร · แอดมิน
import '@/forms.css';     // ฟอร์ม · ที่อยู่ · แนบไฟล์
import '@/shop.css';      // ร้านค้า · ตะกร้า · คำสั่งซื้อ
import '@/account.css';   // สมาชิก / login
import ScrollManager from '@/components/ScrollManager.jsx';
import CookieConsent from '@/components/CookieConsent.jsx';

// ฟอนต์โหลดผ่าน next/font — self-host อัตโนมัติ ไม่มี layout shift และไม่ยิง Google ตอน runtime
const anuphan = Anuphan({ subsets: ['thai', 'latin'], weight: ['400', '500', '600', '700'], variable: '--font-body', display: 'swap' });
const mitr = Mitr({ subsets: ['thai', 'latin'], weight: ['400', '500', '600'], variable: '--font-head', display: 'swap' });
const fredoka = Fredoka({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-display', display: 'swap' });
const caveat = Caveat({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-hand', display: 'swap' });

export const metadata = {
  metadataBase: new URL(SITE),
  title: { default: 'BIGCAT — Big cats. Lighter days.', template: '%s · BIGCAT' },
  description: 'แก๊งแมวตัวโต โนบิ บูตะ ชิบะ — ร้องสด ทำบุญ และเจอกันได้จริงทุกเสาร์ ดูตารางงาน ลงทะเบียนงานฟรี และช้อปของสะสม BIGCAT',
  keywords: ['BIGCAT', 'บิ๊กแคท', 'โนบิ', 'น้องโนบิ', 'nobisingasong', 'บูตะ', 'ชิบะ', 'แมวตัวโต', 'ด้อมบิ๊กแคท', 'ร้องสด', 'busking', 'ตลาดเลียบด่วนแดนเนรมิต', 'ของสะสม', 'art toy', 'กิจกรรมแฟนคลับ'],
  applicationName: 'BIGCAT',
  openGraph: { type: 'website', siteName: 'BIGCAT', locale: 'th_TH', url: SITE, images: [{ url: '/images/bigcat-hero.png', width: 1536, height: 1024 }] },
  twitter: { card: 'summary_large_image' },
  icons: { icon: '/favicon.png', apple: '/favicon.png' },
};

export const viewport = { themeColor: '#fcf8f1', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="th" className={`${anuphan.variable} ${mitr.variable} ${fredoka.variable} ${caveat.variable}`}>
      <body>
        <ScrollManager />
        {children}
        <CookieConsent />
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(orgSchema())} />
      </body>
    </html>
  );
}
