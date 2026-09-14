import { SITE } from '@/lib/seo.js';
export default function robots() {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/cart', '/checkout', '/order/', '/ticket/', '/api/'] }],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
