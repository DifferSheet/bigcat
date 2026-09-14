// ดึงข้อมูลฝั่ง server สำหรับ SEO/metadata — เรียก Express ตรงๆ ไม่ผ่าน rewrite
export const API = process.env.API_ORIGIN || 'http://localhost:3001';
export const SITE = (process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

// revalidate: หน้าสาธารณะเป็น ISR — ข้อมูลสด ๆ (ที่นั่ง/ยอดบุญ) hydrate ด้วย socket อยู่แล้ว
export async function fetchJSON(path, { revalidate = 60 } = {}) {
  try {
    const res = await fetch(`${API}/api${path}`, { next: { revalidate } });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export const abs = (url) => (!url ? `${SITE}/images/bigcat-hero.png` : /^https?:/.test(url) ? url : `${SITE}${url}`);

const BRAND = 'BIGCAT';
export function meta({ title, description, path = '/', image, type = 'website', noindex = false, publishedTime }) {
  const url = `${SITE}${path}`;
  const img = abs(image);
  return {
    title, description,
    alternates: { canonical: url },
    robots: noindex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: { title: `${title} · ${BRAND}`, description, url, siteName: BRAND, locale: 'th_TH', type, images: [{ url: img, width: 1200, height: 630, alt: title }], ...(publishedTime ? { publishedTime } : {}) },
    twitter: { card: 'summary_large_image', title: `${title} · ${BRAND}`, description, images: [img] },
  };
}

// JSON-LD helper — ใส่ใน <script type="application/ld+json">
export const jsonLd = (data) => ({ __html: JSON.stringify(data).replace(/</g, '\\u003c') });

const eventStatus = { upcoming: 'EventScheduled', open: 'EventScheduled', soldout: 'EventScheduled', live: 'EventScheduled', ended: 'EventScheduled' };

export function eventSchema(ev) {
  return {
    '@context': 'https://schema.org', '@type': 'Event',
    name: ev.title, description: ev.description || ev.subtitle,
    startDate: String(ev.starts_at).replace(' ', 'T') + '+07:00',
    ...(ev.ends_at ? { endDate: String(ev.ends_at).replace(' ', 'T') + '+07:00' } : {}),
    eventStatus: `https://schema.org/${eventStatus[ev.status] || 'EventScheduled'}`,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: { '@type': 'Place', name: ev.place || 'จะแจ้งให้ทราบ', address: ev.place || 'ประเทศไทย' },
    image: [abs(ev.cover)], url: `${SITE}/events/${ev.slug}`,
    organizer: { '@type': 'Organization', name: BRAND, url: SITE },
  };
}

export function productSchema(p) {
  return {
    '@context': 'https://schema.org', '@type': 'Product',
    name: p.name, description: p.description || p.name_th, image: [abs(p.image)],
    sku: p.slug, brand: { '@type': 'Brand', name: BRAND },
    offers: {
      '@type': 'Offer', priceCurrency: 'THB', price: p.price, url: `${SITE}/shop/${p.slug}`,
      availability: `https://schema.org/${p.available ? 'InStock' : 'OutOfStock'}`,
    },
  };
}

export const orgSchema = () => ({
  '@context': 'https://schema.org', '@type': 'Organization',
  name: BRAND, url: SITE, logo: `${SITE}/images/bigcat-logo-ink.png`,
  description: 'แก๊งแมวตัวโต โนบิ บูตะ ชิบะ — กิจกรรม ของสะสม และเรื่องราวน่ารักในทุกวัน',
});

export const breadcrumbSchema = (items) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: `${SITE}${path}` })),
});
