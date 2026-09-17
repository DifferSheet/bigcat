// multer สำหรับไฟล์ภาพที่ผู้ใช้/แอดมินอัปโหลด (สลิป · ปกงาน · รูปสินค้า · รูปโปรไฟล์) → server/uploads/ เสิร์ฟที่ /uploads/*
import multer from 'multer';
import path from 'node:path';
import { mkdir } from 'node:fs';
import { code } from './lib.js';

// Portraits are intentionally outside /uploads, which is publicly served.
export const passportPrivateRoot = path.join(process.cwd(), 'server', 'private-passport');
export const uploadPassportPortrait = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => mkdir(passportPrivateRoot, { recursive: true }, err => cb(err, passportPrivateRoot)),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${code(16)}.${{ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.mimetype]}`),
  }),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => /^(image\/jpeg|image\/png|image\/webp)$/.test(file.mimetype) ? cb(null, true) : cb(new Error('ใช้ภาพ JPG, PNG หรือ WebP เท่านั้น')),
});

export const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(process.cwd(), 'server', 'uploads'),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${code(6)}${path.extname(file.originalname || '').toLowerCase() || '.jpg'}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
});

// ฟอร์มงาน: ภาพ + เสียง (เนื้อหาปลดล็อกใน passport อาจเป็นเสียงจากน้อง ๆ) — จำกัด 15 MB
export const uploadMedia = multer({
  storage: multer.diskStorage({
    destination: path.join(process.cwd(), 'server', 'uploads'),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${code(6)}${path.extname(file.originalname || '').toLowerCase() || '.bin'}`),
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^(image|audio)\//.test(file.mimetype)),
});
