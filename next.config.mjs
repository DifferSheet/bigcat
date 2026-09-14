/** @type {import('next').NextConfig} */
const API = process.env.API_ORIGIN || 'http://localhost:3001';

export default {
  reactStrictMode: true,
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
};
