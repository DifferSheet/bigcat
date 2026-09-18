// ที่เก็บไฟล์อัลบั้ม — ดิสก์ของเครื่อง (ค่าเริ่มต้น) หรือ S3 เมื่อตั้ง MEDIA_BUCKET
// พาธที่เก็บใน DB: '/uploads/albums/…' (ดิสก์) หรือ 's3:albums/…' (S3) — ฝั่งเว็บเรียก mediaUrl() เสมอ
//   put(key, filePath|Buffer, contentType) → พาธที่เก็บลง DB
//   url(stored)      → URL ที่เบราว์เซอร์ใช้ได้ (S3 = presigned อายุ URL_TTL · ดิสก์ = พาธเดิม)
//   localCopy(stored) → ไฟล์บนดิสก์สำหรับสแกนใบหน้า (S3 = โหลดมาไว้ที่ temp, คืนฟังก์ชัน cleanup)
//   remove(stored)   → ลบไฟล์
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const bucket = process.env.MEDIA_BUCKET || '';
export const usingS3 = !!bucket;
const URL_TTL = Number(process.env.MEDIA_URL_TTL || 6 * 3600);   // 6 ชม. (ลิงก์ในหน้าที่เปิดค้างไว้ต้องไม่หมดอายุระหว่างดู)
const UPLOADS = path.join(process.cwd(), 'server', 'uploads');
const diskPath = (stored) => path.join(UPLOADS, stored.replace(/^\/uploads\//, ''));

let s3 = null;
async function client() {
  if (!s3) { const { S3Client } = await import('@aws-sdk/client-s3'); s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-southeast-1' }); }
  return s3;
}

export async function put(key, source, contentType) {
  if (!usingS3) {
    const dest = path.join(UPLOADS, key);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (Buffer.isBuffer(source)) fs.writeFileSync(dest, source); else if (source !== dest) fs.copyFileSync(source, dest);
    return `/uploads/${key}`;
  }
  const { PutObjectCommand } = await import('@aws-sdk/client-s3');
  await (await client()).send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: Buffer.isBuffer(source) ? source : fs.readFileSync(source), ContentType: contentType, CacheControl: 'private, max-age=31536000' }));
  return `s3:${key}`;
}

// URL สำหรับเบราว์เซอร์ — presigned ของ S3 มีอายุจำกัด (อัลบั้มเป็นของส่วนตัว ไม่เปิดสาธารณะ)
export async function url(stored) {
  if (!stored) return stored;
  if (!stored.startsWith('s3:')) return stored;
  const { GetObjectCommand } = await import('@aws-sdk/client-s3');
  const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
  return getSignedUrl(await client(), new GetObjectCommand({ Bucket: bucket, Key: stored.slice(3) }), { expiresIn: URL_TTL });
}
// แปลงหลายฟิลด์ในแถวเดียว (orig/view/thumb) พร้อมกัน
export async function withUrls(rows, fields = ['thumb', 'view', 'orig']) {
  const list = Array.isArray(rows) ? rows : [rows];
  await Promise.all(list.flatMap(r => fields.filter(f => r?.[f]).map(async f => { r[f] = await url(r[f]); })));
  return rows;
}

export async function localCopy(stored) {
  if (!stored.startsWith('s3:')) return { file: diskPath(stored), done: () => {} };
  const { GetObjectCommand } = await import('@aws-sdk/client-s3');
  const out = await (await client()).send(new GetObjectCommand({ Bucket: bucket, Key: stored.slice(3) }));
  const file = path.join(os.tmpdir(), `bigcat-${crypto.randomUUID()}${path.extname(stored)}`);
  fs.writeFileSync(file, Buffer.from(await out.Body.transformToByteArray()));
  return { file, done: () => fs.rm(file, { force: true }, () => {}) };
}

export async function remove(stored) {
  if (!stored) return;
  if (!stored.startsWith('s3:')) return fs.rm(diskPath(stored), { force: true }, () => {});
  const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
  await (await client()).send(new DeleteObjectCommand({ Bucket: bucket, Key: stored.slice(3) })).catch(() => {});
}
