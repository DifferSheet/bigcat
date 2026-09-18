#!/usr/bin/env bash
# แก้ชื่อผู้ร่วมบุญบน prod (ชื่อบนใบอนุโมทนา/บัตร/กำแพง) — ไม่ต้อง deploy: ส่งสคริปต์ node ผ่าน ssh ไปรันบน EC2
# ใช้: bash tools/prod-rename-donor.sh "ชื่อเดิม" "ชื่อใหม่"          ← แก้ทุกรายการที่ donor_name ตรงเป๊ะ (รวมทั้งกลุ่มหลายหมวด)
#      bash tools/prod-rename-donor.sh --code A7K2P9XD "ชื่อใหม่"   ← ระบุรหัสรายการ/กลุ่ม
# ใส่ --dry ท้ายสุด = แค่แสดงว่าจะแก้อะไร ไม่แก้จริง
set -euo pipefail
HOST=${EC2_HOST:-ubuntu@ec2-18-141-63-220.ap-southeast-1.compute.amazonaws.com}
KEY=${EC2_KEY:-$HOME/Documents/AWS/app-server-key.pem}
MODE=name; [ "${1:-}" = "--code" ] && { MODE=code; shift; }
FROM=${1:?ใส่ชื่อเดิม หรือ --code รหัส}; TO=${2:?ใส่ชื่อใหม่}; DRY=${3:-}
ssh -i "$KEY" "$HOST" "cd /var/www/bigcat && sudo -n -u deploy -H env MODE='$MODE' FROM='$FROM' TO='$TO' DRY='$DRY' node --input-type=module -" <<'NODE'
import { q, pool } from './server/db.js';
const { MODE, FROM, TO, DRY } = process.env;
const rows = MODE === 'code'
  ? await q('SELECT id, code, group_code, donor_name, amount, status FROM donations WHERE code=? OR group_code=?', [FROM.toUpperCase(), FROM.toUpperCase()])
  : await q('SELECT id, code, group_code, donor_name, amount, status FROM donations WHERE donor_name=?', [FROM]);
if (!rows.length) { console.log('ไม่พบรายการ'); await pool.end(); process.exit(1); }
for (const r of rows) console.log(`${DRY ? '(dry) ' : ''}${r.code}${r.group_code ? ` [กลุ่ม ${r.group_code}]` : ''} · ฿${r.amount} · ${r.status} · "${r.donor_name}" → "${TO}"`);
if (!DRY) { await q('UPDATE donations SET donor_name=? WHERE id IN (?)', [TO, rows.map(r => r.id)]); console.log(`✓ แก้แล้ว ${rows.length} รายการ`); }
await pool.end();
NODE
