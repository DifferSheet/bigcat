import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { Server } from 'socket.io';
import { migrate, one } from './db.js';
import { setIO, room, releaseExpiredHolds, eventDetail, HttpError } from './lib.js';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';
import shopRoutes from './routes/shop.js';
import shopAdminRoutes from './routes/shopAdmin.js';
import { verifySignature, handleWebhookEvent, lineEnabled } from './line.js';
import { slipEnabled } from './slip.js';

const PORT = Number(process.env.PORT || 3001);
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true } });
setIO(io);

fs.mkdirSync(path.join(process.cwd(), 'server', 'uploads'), { recursive: true });

app.use(cors());
// LINE webhook ต้องใช้ raw body เพื่อตรวจลายเซ็น — ต้องมาก่อน express.json()
app.post('/api/line/webhook', express.raw({ type: '*/*' }), async (req, res) => {
  if (!verifySignature(req.body, req.get('x-line-signature'))) return res.status(401).end();
  res.status(200).end(); // ตอบ LINE ก่อน แล้วค่อยประมวลผล
  try { for (const ev of JSON.parse(req.body.toString()).events || []) await handleWebhookEvent(ev); }
  catch (e) { console.error('[line webhook]', e); }
});
app.use(express.json());
app.use('/uploads', express.static(path.join(process.cwd(), 'server', 'uploads')));
app.get('/api/health', async (_req, res) => {
  try { await one('SELECT 1'); res.json({ ok: true, db: true }); } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});
app.use('/api', publicRoutes);
app.use('/api', shopRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/shop', shopAdminRoutes);

// production: เสิร์ฟไฟล์ที่ build แล้วจาก dist/
const dist = path.join(process.cwd(), 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api|\/uploads|\/socket\.io).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, _req, res, _next) => {
  // trans_ref ซ้ำ (UNIQUE KEY) = สลิปใบเดิมถูกใช้ไปแล้ว — ตอบให้คนอ่านรู้เรื่อง ไม่ใช่ 500
  if (err.errno === 1062 && /_ref/.test(err.message)) err = new HttpError(409, 'สลิปใบนี้ถูกใช้ยืนยันไปแล้ว กรุณาใช้สลิปของรายการนี้เท่านั้น');
  const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? 'เกิดข้อผิดพลาดในระบบ' : err.message });
});

// realtime: client เข้าห้องของกิจกรรมที่กำลังดู แล้วรับข้อมูลล่าสุดทันที
io.on('connection', socket => {
  socket.on('join', async (slug) => {
    for (const r of socket.rooms) if (r.startsWith('event:')) socket.leave(r);
    socket.join(room(slug));
    try { socket.emit('snapshot', await eventDetail(slug)); } catch { /* slug ไม่ถูกต้อง */ }
  });
});

setInterval(() => releaseExpiredHolds().catch(console.error), 15000);

await migrate();
server.listen(PORT, () => console.log(`✓ BIGCAT API + Socket.IO on http://localhost:${PORT} · slip: ${slipEnabled ? process.env.SLIP_PROVIDER : 'off'} · LINE: ${lineEnabled ? 'on' : 'off'}`));
