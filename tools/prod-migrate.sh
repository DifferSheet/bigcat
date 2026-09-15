#!/usr/bin/env bash
# รันสคริปต์แก้ข้อมูล (server/migrate-*.js) บน EC2 production
# ใช้: bash tools/prod-migrate.sh migrate-copy-15sep.js
#      bash tools/prod-migrate.sh migrate-merit-17sep.js --reset-donations
#      bash tools/prod-migrate.sh            ← ไม่ใส่อะไร = รันตัวล่าสุด (migrate-images-15sep.js)
set -euo pipefail
HOST=${EC2_HOST:-ubuntu@ec2-18-141-63-220.ap-southeast-1.compute.amazonaws.com}
KEY=${EC2_KEY:-$HOME/Documents/AWS/app-server-key.pem}
if [ $# -eq 0 ]; then
  set -- migrate-images-15sep.js
  EXTRA=""
else
  EXTRA=""
fi
script=$1; shift || true
ssh -i "$KEY" "$HOST" "cd /var/www/bigcat && sudo -n -u deploy -H node server/$script $* $EXTRA"
