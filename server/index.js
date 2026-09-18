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
import passportRoutes from './routes/passport.js';
import albumRoutes from './routes/album.js';
import { kick as kickAlbumScan } from './album.js';
import { usingS3 } from './storage.js';
import { faceProvider as faceProviderName } from './faces.js';
import { backfillIfEmpty } from './passport.js';
import shopAdminRoutes from './routes/shopAdmin.js';
import albumAdminRoutes from './routes/albumAdmin.js';
import { verifySignature, handleWebhookEvent, lineEnabled } from './line.js';
import { slipEnabled } from './slip.js';
import authRoutes, { me as meRoutes, attachUser, authProviders, devLogin, devLoginEnabled } from './auth.js';

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
app.use('/api', attachUser);   // req.user จาก cookie session (null ถ้าไม่ได้ล็อกอิน)
// ชื่อไฟล์อัปโหลดมี timestamp+รหัสสุ่ม ไม่ซ้ำ ไม่ถูกเขียนทับ → ให้ browser/Cloudflare เก็บได้ยาว ไม่ต้องกลับมาถาม EC2
app.use('/uploads', express.static(path.join(process.cwd(), 'server', 'uploads'), { maxAge: '365d', immutable: true }));
app.get('/api/health', async (_req, res) => {
  try { await one('SELECT 1'); res.json({ ok: true, db: true }); } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});
app.use('/api/auth', authRoutes);
if (devLoginEnabled) { app.get('/api/dev/login', devLogin); console.log('⚠️  DEV_LOGIN เปิดอยู่ — /api/dev/login?u=<id> ใช้ได้บนเครื่องนี้'); }
app.use('/api/me', meRoutes);
app.use('/api', publicRoutes);
app.use('/api', shopRoutes);
app.use('/api', passportRoutes);
app.use('/api', albumRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/shop', shopAdminRoutes);
app.use('/api/admin', albumAdminRoutes);

// พอร์ตนี้เป็น API อย่างเดียว — หน้าเว็บอยู่ที่ Next (:3100) · เปิด / ตรงนี้จะบอกทางไปแทนการเสิร์ฟ build เก่า
app.get('/', (_req, res) => res.type('text/plain').send(`BIGCAT API · หน้าเว็บอยู่ที่ ${process.env.SITE_URL || 'http://localhost:' + (process.env.WEB_PORT || 3100)}`));

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
await (await import('./adminAuth.js')).ensureFirstAdmin();
backfillIfEmpty().catch(e => console.error('passport backfill:', e.message));
kickAlbumScan();   // สแกนรูปที่ค้างจากรอบก่อน (ถ้ามี)
server.listen(PORT, () => console.log(`✓ BIGCAT API + Socket.IO on http://localhost:${PORT} · slip: ${slipEnabled ? process.env.SLIP_PROVIDER : 'off'} · LINE: ${lineEnabled ? 'on' : 'off'} · ภาพ: ${usingS3 ? process.env.MEDIA_BUCKET : 'disk'} · ใบหน้า: ${faceProviderName} · login: ${Object.entries(authProviders).filter(([, v]) => v).map(([k]) => k).join('+') || 'off'}`));
