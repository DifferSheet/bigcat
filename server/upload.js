// multer สำหรับไฟล์ภาพที่ผู้ใช้/แอดมินอัปโหลด (สลิป · ปกงาน · รูปสินค้า · รูปโปรไฟล์) → server/uploads/ เสิร์ฟที่ /uploads/*
import multer from 'multer';
import path from 'node:path';
import { code } from './lib.js';

export const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(process.cwd(), 'server', 'uploads'),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${code(6)}${path.extname(file.originalname || '').toLowerCase() || '.jpg'}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
});
