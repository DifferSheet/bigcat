// pm2 บน EC2 — รันสองโปรเซสจากโฟลเดอร์ release ที่ GitHub Actions ส่งขึ้นมา
// server.js = Next.js standalone (สร้างตอน build) · server/index.js = Express + Socket.IO
module.exports = {
  apps: [
    {
      name: 'bigcat-web',
      cwd: '/var/www/bigcat',
      script: 'server.js',
      env: { NODE_ENV: 'production', PORT: 3100, HOSTNAME: '127.0.0.1' },
      max_memory_restart: '600M',
    },
    {
      name: 'bigcat-api',
      cwd: '/var/www/bigcat',
      script: 'server/index.js',
      env: { NODE_ENV: 'production', PORT: 3001 },
      max_memory_restart: '400M',
    },
  ],
};
