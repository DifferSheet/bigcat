#!/usr/bin/env bash
# ซิงก์ค่า login/LINE จาก .env เครื่องเรา → /var/www/bigcat/.env บน EC2 แล้วสร้างโปรเซส pm2 ใหม่
# (pm2 restart เฉย ๆ ไม่เห็นค่าใหม่ — ดู README หัวข้อ deploy) และล้าง line_user_id ของ OA เดิม
# ใช้: bash tools/sync-env-to-ec2.sh        ค่าอื่นบน EC2 (DB/SLIP/PORT) ไม่แตะ · ไม่พิมพ์ secret ออกจอ
set -euo pipefail
cd "$(dirname "$0")/.."
HOST=${EC2_HOST:-ubuntu@ec2-18-141-63-220.ap-southeast-1.compute.amazonaws.com}
KEY=${EC2_KEY:-$HOME/Documents/AWS/app-server-key.pem}
KEYS=(LINE_CHANNEL_ACCESS_TOKEN LINE_CHANNEL_SECRET LINE_CHANNEL_ID LINE_OA_ID LINE_LOGIN_CHANNEL_ID LINE_LOGIN_CHANNEL_SECRET LINE_LOGIN_SAME_PROVIDER GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET)
OPTIONAL=(SLIP_PROVIDER SLIP_API_KEY SLIP_RECEIVER_NAME SLIP_AUTO_APPROVE)   # ส่งเฉพาะที่มีค่าในเครื่อง

lines=""
for k in "${KEYS[@]}"; do
  v=$(grep -E "^${k}=" .env | head -1 | cut -d= -f2-)
  [ -n "$v" ] || { echo "!! $k ว่างใน .env เครื่องนี้"; exit 1; }
  lines+="${k}=${v}"$'\n'
done
for k in "${OPTIONAL[@]}"; do
  v=$(grep -E "^${k}=" .env | head -1 | cut -d= -f2-)
  if [ -n "$v" ]; then lines+="${k}=${v}"$'\n'; fi   # (ห้ามใช้ [ ] && … เพราะ set -e จะหยุดเงียบ ๆ เมื่อค่าสุดท้ายว่าง)
done

echo "→ อัปเดต .env บน EC2 (สำรองเป็น .env.bak-<เวลา>)"
# ฝังค่าลงในสคริปต์ฝั่ง remote โดยตรง (ส่งทาง stdin ทางเดียว — ห้ามใช้ pipe + heredoc พร้อมกัน ไม่งั้น bash -s กินสคริปต์เป็นข้อมูล)
remote=$(cat <<REMOTE
set -e
cd /var/www/bigcat
cp .env ".env.bak-\$(date +%Y%m%d-%H%M)"
cat > /tmp/.env.new <<'VALUES'
${lines}VALUES
python3 - <<'PY'
import re
s = open('.env').read()
for line in open('/tmp/.env.new').read().splitlines():
    if not line.strip(): continue
    k = line.split('=', 1)[0]
    if re.search(rf'(?m)^{re.escape(k)}=', s): s = re.sub(rf'(?m)^{re.escape(k)}=.*$', lambda m: line, s)
    else: s = s.rstrip('\n') + '\n' + line + '\n'
open('.env', 'w').write(s)
PY
rm -f /tmp/.env.new
chmod 600 .env
echo "  .env: \$(grep -cE '^(LINE_|GOOGLE_)' .env) บรรทัด LINE_/GOOGLE_ · LINE_OA_ID=\$(grep -E '^LINE_OA_ID=' .env | cut -d= -f2)"

echo "→ สร้างโปรเซส pm2 ใหม่ทั้งสองตัว"
pm2 delete bigcat-api bigcat-web >/dev/null 2>&1 || true
pm2 start ecosystem.config.cjs >/dev/null
pm2 save >/dev/null
sleep 4
pm2 ls | grep -E 'bigcat'

echo "→ ล้าง line_user_id ของ OA เดิมทุกตาราง (ตั้ง NULL ไม่ลบรายการ)"
node -e "
import('./server/db.js').then(async ({ q }) => {
  for (const t of ['users', 'orders', 'bookings', 'registrations', 'donations']) {
    const r = await q('UPDATE ' + t + ' SET line_user_id=NULL WHERE line_user_id IS NOT NULL');
    console.log('  ' + t + ': ล้าง ' + r.affectedRows + ' แถว');
  }
  process.exit(0);
}).catch(e => { console.error('DB error', e.message); process.exit(1); });"
REMOTE
)
ssh -i "$KEY" "$HOST" 'sudo -n -u deploy -H bash -s' <<< "$remote"

echo "→ ตรวจจากภายนอก"
sleep 3
curl -s https://bigcathouse.com/api/me; echo
echo "เสร็จ — providers ต้องเป็น line:true google:true"
