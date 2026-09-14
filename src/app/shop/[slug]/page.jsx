import React from 'react';
import { notFound } from 'next/navigation';
import ProductPage from '@/views/ProductPage.jsx';
import { fetchJSON, meta, jsonLd, productSchema, breadcrumbSchema } from '@/lib/seo.js';
import { stripHtml } from '@/lib/html.js';

export const revalidate = 60;

export async function generateStaticParams() {
  const products = await fetchJSON('/shop/products', { revalidate: 300 });
  return (products || []).map(p => ({ slug: p.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const p = await fetchJSON(`/shop/products/${slug}`);
  if (!p) return meta({ title: 'ไม่พบสินค้า', path: `/shop/${slug}`, noindex: true });
  return meta({
    title: `${p.name} — ${p.name_th || 'ของสะสม BIGCAT'}`,
    description: `฿${p.price.toLocaleString('th-TH')} · ${stripHtml(p.description) || p.name_th || p.name} ${p.available ? 'พร้อมส่ง' : 'สินค้าหมด'}`.slice(0, 300),
    path: `/shop/${p.slug}`, image: p.image, type: 'article',
  });
}

export default async function Page({ params }) {
  const { slug } = await params;
  const p = await fetchJSON(`/shop/products/${slug}`);
  if (!p) notFound();
  return <>
    <ProductPage slug={slug} initialProduct={p} />
    <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(productSchema(p))} />
    <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(breadcrumbSchema([['หน้าแรก', '/'], ['ร้านค้า', '/shop'], [p.name, `/shop/${slug}`]]))} />
  </>;
}
