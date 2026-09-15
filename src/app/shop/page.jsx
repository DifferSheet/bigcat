import React from 'react';
import ShopPage from '@/views/ShopPage.jsx';
import { fetchJSON, meta, jsonLd, productSchema, breadcrumbSchema } from '@/lib/seo.js';

export const revalidate = 60;
export const metadata = meta({
  title: 'ร้านค้า BIGCAT — Little things. Big love.',
  description: 'ของสะสมจากแก๊ง BIGCAT กระเป๋าผ้า พวงกุญแจ เสื้อยืด และของชิ้นเล็กที่เก็บความสุขไว้ได้เสมอ ส่งถึงบ้านหรือรับหน้างาน',
  path: '/shop', image: '/images/bigcat-merch.jpg',
});

export default async function Page() {
  const products = await fetchJSON('/shop/products');
  return <>
    <ShopPage initialProducts={products || []} />
    <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(breadcrumbSchema([['หน้าแรก', '/'], ['ร้านค้า', '/shop']]))} />
    {(products || []).map(p => <script key={p.slug} type="application/ld+json" dangerouslySetInnerHTML={jsonLd(productSchema(p))} />)}
  </>;
}
