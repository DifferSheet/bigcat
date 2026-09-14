import { SITE, fetchJSON } from '@/lib/seo.js';

export const revalidate = 3600;

export default async function sitemap() {
  const [events, products] = await Promise.all([fetchJSON('/events'), fetchJSON('/shop/products')]);
  const now = new Date();
  return [
    { url: `${SITE}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE}/events`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE}/shop`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    ...(events || []).map(e => ({ url: `${SITE}/events/${e.slug}`, lastModified: new Date(e.created_at || now), changeFrequency: 'daily', priority: e.status === 'ended' ? 0.4 : 0.8 })),
    ...(products || []).map(p => ({ url: `${SITE}/shop/${p.slug}`, lastModified: new Date(p.created_at || now), changeFrequency: 'weekly', priority: 0.7 })),
  ];
}
