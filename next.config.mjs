/** @type {import('next').NextConfig} */
const API = process.env.API_ORIGIN || 'http://localhost:3001';

export default {
  reactStrictMode: true,
  // dev: ให้มือถือในวง LAN เปิด http://192.168.x.x:3100 ได้ (Next ปิดกั้น origin ที่ไม่ใช่ localhost ตอน dev — chunk โหลดไม่ได้ หน้าไม่ hydrate)
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*', '*.local'],
  // build เป็นโฟลเดอร์รันเองได้ (.next/standalone) — GitHub Actions ส่งเฉพาะก้อนนี้ขึ้น EC2
  output: 'standalone',
  // เรียก API/Socket ผ่าน origin เดียวกัน → ไม่ต้องตั้ง CORS และ cookie ใช้ร่วมกันได้
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API}/api/:path*` },
      { source: '/uploads/:path*', destination: `${API}/uploads/:path*` },
      { source: '/socket.io/:path*', destination: `${API}/socket.io/:path*` },
    ];
  },
  images: { formats: ['image/avif', 'image/webp'] },
  // รูปใน public/ — Next ส่ง max-age=0 เป็นค่าเริ่มต้น ทำให้ Cloudflare ต้อง revalidate กับ EC2 ทุก request
  // ตั้ง 1 วัน (ชื่อไฟล์คงที่ เปลี่ยนรูปชื่อเดิมจะเห็นภายใน 1 วัน หรือกด Purge Cache ใน Cloudflare)
  async headers() {
    return [
      { source: '/images/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }] },
    ];
  },
};
