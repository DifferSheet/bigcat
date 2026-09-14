import mysql from 'mysql2/promise';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const here = path.dirname(fileURLToPath(import.meta.url));

export const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'bigcat',
};

export const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: 'Z',
  dateStrings: true,
});

// สร้าง database + ตารางถ้ายังไม่มี (รันตอน server start และตอน seed)
export async function migrate() {
  const admin = await mysql.createConnection({ ...dbConfig, database: undefined, multipleStatements: true });
  await admin.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await admin.query(`USE \`${dbConfig.database}\``);
  await admin.query(fs.readFileSync(path.join(here, 'schema.sql'), 'utf8'));
  // คอลัมน์ที่เพิ่มทีหลัง — MySQL ไม่มี ADD COLUMN IF NOT EXISTS จึงข้าม error 1060/1061 (ซ้ำ)
  const alters = [
    "ALTER TABLE donation_categories ADD COLUMN unit_name VARCHAR(40) NULL, ADD COLUMN unit_price INT NULL",
    "ALTER TABLE donations ADD COLUMN dedication VARCHAR(160) NULL, ADD COLUMN units INT NULL, ADD COLUMN trans_ref VARCHAR(64) NULL, ADD COLUMN verified_at DATETIME NULL, ADD COLUMN verify_note VARCHAR(300) NULL, ADD COLUMN line_user_id VARCHAR(64) NULL, ADD COLUMN thanked_at DATETIME NULL",
    "ALTER TABLE donations ADD UNIQUE KEY uq_don_ref (trans_ref)",
    "ALTER TABLE bookings ADD COLUMN trans_ref VARCHAR(64) NULL, ADD COLUMN verified_at DATETIME NULL, ADD COLUMN verify_note VARCHAR(300) NULL, ADD COLUMN line_user_id VARCHAR(64) NULL",
    "ALTER TABLE bookings ADD UNIQUE KEY uq_bk_ref (trans_ref)",
    "ALTER TABLE product_variants ADD COLUMN image VARCHAR(300) NULL",
    // สมาชิก: ผูกรายการกับ users.id (NULL = ทำตอนไม่ได้ล็อกอิน)
    "ALTER TABLE orders ADD COLUMN user_id INT NULL, ADD INDEX ix_ord_user (user_id)",
    "ALTER TABLE bookings ADD COLUMN user_id INT NULL, ADD INDEX ix_bk_user (user_id)",
    "ALTER TABLE donations ADD COLUMN user_id INT NULL, ADD INDEX ix_don_user (user_id)",
    "ALTER TABLE registrations ADD COLUMN user_id INT NULL, ADD INDEX ix_reg_user (user_id)",
    "ALTER TABLE registrations ADD COLUMN kind VARCHAR(20) NOT NULL DEFAULT 'attend', ADD COLUMN line_user_id VARCHAR(64) NULL",
  ];
  for (const sql of alters) {
    for (let attempt = 0; ; attempt++) {
      try { await admin.query(sql); break; }
      catch (e) {
        if ([1060, 1061].includes(e.errno)) break;                    // คอลัมน์/คีย์มีอยู่แล้ว
        if (e.errno === 1213 && attempt < 3) { await new Promise(r => setTimeout(r, 300)); continue; }   // deadlock ตอน dev restart ถี่ ๆ → ลองใหม่
        throw e;
      }
    }
  }
  await admin.end();
}

export const q = async (sql, params = []) => (await pool.query(sql, params))[0];
export const one = async (sql, params = []) => (await q(sql, params))[0] || null;

// รันหลายคำสั่งใน transaction เดียว
export async function tx(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn({
      q: async (sql, params = []) => (await conn.query(sql, params))[0],
      one: async (sql, params = []) => ((await conn.query(sql, params))[0])[0] || null,
    });
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export const parseJSON = (value, fallback) => {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
};
