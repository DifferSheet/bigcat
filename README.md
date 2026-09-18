# BIGCAT

Next.js (App Router) website for Nobi, Boota, and Shiba. Thai-first responsive layout, scroll parallax, reveal animations, member dialogs, filterable event listings, activity details, a mock merchandise cart with local storage, and a gallery lightbox.

## Run (Next.js + API + MySQL)

ต้องมี MySQL รันอยู่บนเครื่อง (Homebrew: `brew services start mysql`, user `root` ไม่มีรหัส — แก้ได้ใน `.env`)

```sh
npm install
cp .env.example .env     # ครั้งแรก
npm run db:seed          # สร้าง database `bigcat` + ตาราง + ข้อมูลตัวอย่าง (ล้างของเดิม)
npm run dev              # Next :3100 + API/Socket.IO :3001 พร้อมกัน
```

Production: `npm run build` แล้ว `npm start` (รัน `next start` + Express พร้อมกัน)
พอร์ต Next เปลี่ยนได้ที่ `WEB_PORT` ใน `.env` (ค่าเริ่มต้น 3100 เพื่อไม่ชนกับโปรเจกต์อื่นที่ใช้ 3000)

หน้าที่มี: `/` หน้าแรก · `/shop` ร้านค้า · `/shop/:slug` สินค้า · `/cart` ตะกร้า · `/checkout` ชำระเงิน · `/order/:code` ติดตามคำสั่งซื้อ · `/admin/shop` จัดการร้าน · `/events` รายการ · `/events/:slug` หน้ากิจกรรม (โมดูลตามประเภท) · `/events/:slug/draw` จอสุ่ม Lucky Fan · `/ticket/:code` บัตร/ใบอนุโมทนา · `/admin` ทีมงาน (รหัสจาก `ADMIN_KEY`)

## Event system

- `server/` — Express + Socket.IO + mysql2. `schema.sql` ตาราง, `seed.js` ข้อมูลตัวอย่าง, `routes/public.js` API ผู้ใช้, `routes/admin.js` API ทีมงาน (header `x-admin-key`), `lib.js` สรุปข้อมูล + emit realtime
- กิจกรรม 1 งาน = `type` (fanmeet / merit / busking / workshop / popup) + `config` JSON (ผังที่นั่ง, หมวดบุญ, milestones, กำหนดการ, FAQ) → `src/pages/EventPage.jsx` เลือกโมดูลจาก `src/modules/` ตาม type และโหลดแยก chunk ด้วย `@loadable/component`
- Realtime: client `join` ห้อง `event:<slug>` แล้วรับ `seats` / `donations` / `registrations` / `draw` / `songs` / `event` (ดู `src/lib/socket.js`)
- ที่นั่ง: hold 10 นาทีต่อเบราว์เซอร์ (`SELECT … FOR UPDATE` กันจองชน) → booking `pending` → ทีมงานอนุมัติสลิป → QR ใช้เช็คอิน
- สลิปที่อัปโหลดเก็บใน `server/uploads/` (ไม่ commit)

### ตรวจสลิปอัตโนมัติ (`server/slip.js`)
`.env` → `SLIP_PROVIDER=none|mock|slipok|easyslip|thunder` · `mock` ผ่านทุกสลิป (ทดสอบบนเครื่อง) · Thunder (thunder.in.th, ใช้อยู่ตอนนี้) ใส่ `SLIP_API_KEY` อย่างเดียว + whitelist IP ของ EC2 ในแดชบอร์ด · SlipOK ฟรี 100 สลิป/เดือน ต้องใส่ `SLIP_API_KEY` + `SLIP_BRANCH_ID` · EasySlip ใส่ `SLIP_API_KEY`
เงื่อนไขอนุมัติอัตโนมัติ: ยอดในสลิป ≥ ที่แจ้ง, ชื่อผู้รับตรง `SLIP_RECEIVER_NAME` (ถ้าตั้ง), เลขอ้างอิงไม่ซ้ำ, สลิปไม่เก่ากว่า `SLIP_MAX_AGE_DAYS` — ไม่ผ่านข้อใดจะเป็น `pending` พร้อม `verify_note` ให้ทีมงานดูใน `/admin`
**ตาข่ายชั้นสอง (ค่าเริ่มต้น)**: `SLIP_AUTO_APPROVE` ไม่ตั้ง/`false` → ต่อให้ตรวจผ่าน รายการยังเป็น `pending` (บันทึก `trans_ref`+`verified_at` ไว้แล้ว กันสลิปซ้ำ) ให้แอดมินกดอนุมัติเองทุกใบ · มั่นใจแล้วค่อยตั้ง `SLIP_AUTO_APPROVE=true`
ถ้า `SLIP_PROVIDER=slipok` แต่ยังไม่ใส่ key → ไม่ยิง API, ทุกรายการเป็น `pending` พร้อมโน้ต «รอตั้งค่า slipok» · สลิปที่ `trans_ref` ซ้ำของเดิมจะได้ 409 «สลิปใบนี้ถูกใช้ยืนยันไปแล้ว»

### LINE Messaging API (`server/line.js`)
1. สร้าง LINE Official Account → เปิด Messaging API → ใส่ `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`, `LINE_OA_ID`
2. ตั้ง Webhook URL เป็น `https://<โดเมน>/api/line/webhook` (ทดสอบบนเครื่องใช้ ngrok/cloudflared)
3. แฟนคลับเพิ่มเพื่อน OA แล้วส่งรหัส 8 หลัก → ระบบผูกกับรายการ → แจ้งเตือนเมื่ออนุมัติยอด/บัตร, เป็น Lucky Fan, และปุ่ม "ส่งขอบคุณ" ใน admin
4. `LINE_STAFF_TARGET` = userId/groupId ทีมงาน จะได้รับแจ้งรายการที่ตรวจอัตโนมัติไม่ผ่าน

### งานทำบุญ (`config` ใน `server/seed.js`)
- `categories` ใส่ `unit_name`/`unit_price` = หน่วยของจริง (เทียน 1 ต้น = 500) หรือเว้นว่าง = ใส่ยอดเอง
- `donateUntil` ปิดรับยอดออนไลน์ (นับถอยหลังแยกจากวันงาน) · `attend.enabled` เปิดลงทะเบียน "ไปวัดด้วย"
- `milestones[].reward` = `{ type: image|link|text|poll }` ปลดล็อกเมื่อยอดถึง % · `report` = ข้อความความโปร่งใส; ใบเสร็จ/ภาพส่งมอบอัปโหลดจาก `/admin`
- ใบอนุโมทนาเป็นภาพ 1080×1920 สร้างจากหน้า `/ticket/:code` (canvas ฝั่ง client)

### คำอธิบายสินค้าแบบ Rich text
- เก็บเป็น **HTML** ในคอลัมน์ `products.description` รองรับ ตัวหนา ตัวเอียง ขีดเส้นใต้ หัวข้อย่อย (h3/h4) bullet list เลขลำดับ ลิงก์ blockquote
- **sanitize ทุกครั้งก่อนบันทึก** ที่ `server/richtext.js` (ใช้ `sanitize-html`) — ตัด `<script>`, event handler (`onclick`), `javascript:` และ inline style ออกหมด; ลิงก์ภายนอกเติม `target=_blank rel=noopener` ให้อัตโนมัติ
- วางข้อความดิบได้เลย ระบบแปลงให้เอง: บรรทัดขึ้นต้น `- ` → bullet, `1.` → เลขลำดับ, บรรทัดสั้นลงท้าย `:` หรือขึ้นต้นด้วย "จุดเด่น/รายละเอียด/วิธี…" → หัวข้อย่อย
- แก้ไขในหน้า `/admin/shop` → แท็บสินค้า → ปุ่ม B / I / U / H / • / 1. / 🔗 (`src/components/RichText.jsx`)
- meta description และ OG ใช้ข้อความล้วน (ตัดแท็กด้วย `src/lib/html.js`)
- แปลงข้อมูลเก่าเป็น HTML: `node server/migrate-descriptions.js` (รันซ้ำได้ ข้ามรายการที่แปลงแล้ว)

### นำเข้าสินค้าจาก TikTok Shop
ข้อมูลสินค้าจริง 20 รายการ (ชื่อ คำอธิบาย ราคา สต็อก ตัวเลือก และรูป 172 ไฟล์) ดึงมาจาก TikTok Seller Center ของร้าน BootaStore
- ไฟล์ต้นทาง: `data/tiktok-import/p1..p20.json` (หนึ่งไฟล์ต่อสินค้า) · รูปอยู่ใน `public/images/products/<tiktok_id>_NN.jpg`
- นำเข้าใหม่: `node server/import-products.js data/tiktok-import --replace` (ไม่ใส่ `--replace` = เพิ่มต่อท้าย)
- สคริปต์ย่อหมวดหมู่ TikTok เป็นหมวดของหน้าร้าน, ตั้ง slug ภาษาอังกฤษต่อสินค้า (ดูตาราง `SLUGS`), และแปลงตัวเลือกเป็น `product_variants` โดยเก็บราคาต่ำสุดเป็นราคาหลักและส่วนต่างเป็น `price_delta`
- อัปเดตสินค้าหลังจากนี้ทำผ่านหน้า `/admin/shop` ได้เลย ไม่ต้องรันสคริปต์ซ้ำ

### ร้านค้า (`server/routes/shop.js`, `shopAdmin.js`)
- ตาราง `products` / `product_variants` (ไซส์-สี นับสต็อกที่ variant) / `orders` / `order_items` / `settings` (ค่าส่ง, ส่งฟรีเมื่อครบ, รับหน้างาน, QR รับเงิน, ขนส่ง)
- สั่งซื้อ: ตรวจสต็อกด้วย `SELECT … FOR UPDATE` แล้วตัดสต็อกทันที (ยกเลิก = คืนสต็อก) · ราคาคำนวณฝั่ง server · สลิปตรวจอัตโนมัติเหมือนงานทำบุญ · แนบสลิปทีหลังได้ที่ `/order/:code`
- สถานะ `pending → paid → packing → shipped → completed` (หรือ `cancelled`) เปลี่ยนจาก `/admin/shop` ใส่เลขพัสดุแล้วระบบแจ้ง LINE ลูกค้าและทำลิงก์ติดตามพัสดุให้
- ตะกร้าอยู่ใน localStorage (`src/lib/cart.js`) และ sync กับสต็อกล่าสุดทุกครั้งที่เปิดหน้าร้าน/ตะกร้า · สต็อก broadcast realtime ผ่าน socket room `shop`

## SEO (Next.js)

- `src/app/` = route ทั้งหมด (App Router) · `src/views/` = component ของแต่ละหน้า (client) · `src/lib/nav.jsx` = shim ให้โค้ดสไตล์ react-router ใช้กับ Next ได้
- หน้าสาธารณะ (`/`, `/events`, `/events/[slug]`, `/shop`, `/shop/[slug]`) ดึงข้อมูลฝั่ง server + ISR 60 วิ → HTML มีเนื้อหาครบตั้งแต่ไบต์แรก, Google/LINE/Facebook อ่านได้ทันที
- `generateMetadata()` ทำ title/description/OG ต่อหน้า — แชร์ลิงก์งานทำบุญขึ้นโปสเตอร์งานนั้น, ลิงก์สินค้าขึ้นรูปสินค้า
- JSON-LD: `Organization` (ทุกหน้า), `Event` (หน้ากิจกรรม), `Product` + `Offer` (หน้าสินค้า), `BreadcrumbList`
- `src/app/sitemap.js` + `robots.js` สร้างอัตโนมัติจากข้อมูลใน DB · หน้า cart/checkout/order/ticket/admin เป็น `noindex`
- ฟอนต์โหลดผ่าน `next/font` (self-host ไม่ยิง Google ตอน runtime) — CSS ใช้ `var(--font-body|head|display|hand)`
- Socket.IO ต่อตรงไปที่ Express ผ่าน `NEXT_PUBLIC_API_ORIGIN` (Next rewrites ไม่ proxy WebSocket upgrade)

## Files

- `src/views/`, `src/components/`, `src/modules/`: UI ทั้งหมด (client components)
- `src/styles.css`: responsive styling and reduced-motion support.
- `public/images/bigcat-hero.png`: generated character campaign artwork.
- `public/images/bigcat-merch.png`: generated merchandise mockup.
- `bigcat-website-preview.png`: initial visual direction.
- `index-original.html`, `index-vite.html.bak`: ไฟล์เดิมก่อนย้ายมา Next (เก็บไว้อ้างอิง)

## Before publishing

This is a working frontend prototype. Event dates, descriptions, character copy, product pricing, and product designs are sample content. Shop orders reserve stock in MySQL and use PromptPay + slip upload (auto-verified when SLIP_PROVIDER is set). Event booking/donation uses PromptPay + slip upload verified by staff — no payment gateway yet. Social buttons explain that official account URLs are pending. Replace the sample data with approved content and connect real inventory, registration, payment, and social links before launching those services. No personal data is collected.

## Artwork

Images were created with the built-in imagegen tool, using the supplied character references. Shiba appears head-first behind a pillow in the hero because a full 3D model was not supplied. Source references are retained under `public/images/` for the design handoff; the page uses the two campaign assets.

Hero prompt: “Premium 3D collectible campaign photograph, three faithful Bigcat characters together on a cream sofa, Nobi in the pink floral dress in the center, Boota with gold round glasses on the left, Shiba's gray head and paws peeking above a butter-yellow pillow on the right, peach studio background, soft natural light, no text or interface.”

Merchandise prompt: “Premium studio mockup of a cream Bigcat canvas tote featuring the three mascot faces and gold-ring enamel character keychains on peach display blocks, blush-pink background, soft daylight, restrained material detail, no UI or prices.”

## Deploy (GitHub Actions → EC2)

push ไป `main` = deploy อัตโนมัติ (`.github/workflows/deploy.yml`)
build บน runner arm64 → rsync โฟลเดอร์ `release/` ไป `/var/www/bigcat` บน EC2 → `pm2 startOrReload`

**ครั้งแรกบน EC2** (ทำครั้งเดียว): ติดตั้ง Node 20 + pm2 · สร้าง user `deploy` ที่เขียน `/var/www/bigcat` ได้ ·
สร้าง `/var/www/bigcat/.env` ด้วยมือ (rsync ไม่แตะไฟล์นี้) · สร้าง DB `bigcat` แล้วรัน `node server/seed.js` จากโฟลเดอร์ release ·
`pm2 startup` แล้ว `pm2 save`

**แก้ `.env` บน EC2 แล้วต้องสร้างโปรเซสใหม่** — pm2 จำ env ตอน start ครั้งแรกไว้ และ dotenv ไม่ทับค่าที่มีอยู่แล้ว
`pm2 restart --update-env` จึง**ไม่**เห็นค่าใหม่: `cd /var/www/bigcat && pm2 delete bigcat-api && pm2 start ecosystem.config.cjs --only bigcat-api && pm2 save`
(ทำแบบเดียวกันกับ `bigcat-web` ถ้าแก้ค่าที่ Next ใช้)

**Secrets ใน GitHub** (Settings → Secrets → Actions): `EC2_HOST` · `EC2_USER` · `EC2_SSH_KEY` · `EC2_KNOWN_HOSTS`
โฟลเดอร์ `server/uploads/` (สลิป) ถูก exclude จาก rsync — ไม่ถูกลบตอน deploy

## อัลบั้มรูปงาน + ค้นหาใบหน้า (18 ก.ย. 2026)
* แอดมินอัปโหลดรูปทั้งงานทีเดียวในหน้าจัดการ (หรือ `node server/import-album.js <slug> "<โฟลเดอร์>" [--limit N] [--wait]`) → เก็บ 3 ขนาดที่ `server/uploads/albums/<eventId>/` → คิวสแกนหลังบ้าน (`server/album.js`)
* ขั้นคัด: นับหน้าทุกขนาดบนเครื่องเรา (face-api/WASM) — รูป 1–3 คนที่มีหน้าใหญ่พอเท่านั้นถูก "จำ" เพื่อจับคู่ · รูปหมู่/ไม่มีหน้า = `skipped`
* ผู้ให้บริการจับคู่ `FACE_PROVIDER=local|rekognition|none` (`server/faces.js`) — prod ตั้ง `rekognition` ได้ทันทีเมื่อใส่ AWS credentials (collection เดียว เก็บทั้งใบหน้าอัลบั้ม `p:<id>` และสมาชิก `u:<id>`)
* สมาชิก opt-in ที่ `/account` → ยินยอม PDPA → อัปโหลดหน้า 1 รูป → เก็บเฉพาะเวกเตอร์/FaceId ลบเซลฟี่ทันที → `/api/me/face` (GET/POST/DELETE)
* สิทธิ์ดูอัลบั้ม: เช็คอินงานนั้น (registration/booking ที่ผูกบัญชี) หรือแอดมิน · คนอื่นเห็นพรีวิว 3 รูป (`featured` หรือ 3 รูปแรก)
* Passport: รูปคู่ = ไฟล์ที่อัปโหลดเอง > รูปที่เลือกจากอัลบั้ม > อัตโนมัติจากการจับคู่ (รูป 2 หน้าก่อน) — `PUT /api/passport/:slug/portrait`
* เมนู **อัลบั้ม** ในหน้าจัดการ (`/admin/albums`): ภาพรวมทุกงาน (จำนวนรูป · พื้นที่ · คิวสแกน · คำขอลบ) · หน้าอัลบั้มรายงาน = ลากทั้งโฟลเดอร์มาอัป (ชุดละ 8 · ไฟล์ซ้ำถูกข้ามด้วย sha1 · ลองใหม่เฉพาะชุดที่ล้ม) · เลือกหลายรูปแล้วตั้งพรีวิว/สแกนใหม่/ลบ · ปุ่มเผยแพร่-ซ่อนอัลบั้ม · ทบทวนใบหน้า
* **สถานะเผยแพร่** (`config.album.published`): อัลบั้มใหม่เริ่มที่ยังไม่เผยแพร่ (แฟนไม่เห็นเลยแม้เช็คอินแล้ว) · อัลบั้มเดิมก่อนมีฟีเจอร์นี้ถือว่าเผยแพร่แล้ว
* **ทบทวนใบหน้า**: ใบหน้าที่ระบบยังไม่รู้ว่าใคร → ทีมผูกกับสมาชิกได้เฉพาะคนที่เช็คอินงานนั้น (สถานะ `confirmed`) หรือกด «ไม่ใช่คน» (`rejected`) · เจ้าตัวกด «ไม่ใช่ฉัน» ถอนได้เสมอ · ภาพหน้าตัดมาจากรูป view แล้วแคชที่ temp
* คำขอเอารูปออก (`photo_removals`) ดูในหน้าจัดการ → ลบรูป/ไม่ลบ
* หน้าบัญชีสมาชิกแบ่ง 3 แท็บ (`/account` · `?tab=photos` · `?tab=history`) — แท็บ «รูปของฉัน» = ลงทะเบียนใบหน้าแบบ 3 ขั้น (เลือกรูป → ยอมรับข้อกำหนด → ค้นหา) แล้วดู/ยืนยัน/ปฏิเสธรูปที่ระบบจับคู่ · ดึงเข้า Passport · ดาวน์โหลด · เปลี่ยนรูปหน้า/ลบข้อมูลใบหน้า (`GET /api/me/photos`)
* dev: ใส่ `DEV_LOGIN=1` ใน `.env` ของเครื่อง แล้วเปิด `/api/dev/login?u=<user id>&next=/account` เพื่อเข้าสู่ระบบเป็นสมาชิกคนนั้นบนเครื่อง (OAuth จริงใช้บน localhost ไม่ได้) — ปิดอัตโนมัติเมื่อ `NODE_ENV=production` และสคริปต์ sync ไม่ส่งค่านี้ขึ้น EC2
* ที่เก็บรูป (`server/storage.js`): ไม่ตั้ง `MEDIA_BUCKET` = ดิสก์ (`server/uploads/albums/`, rsync ตอน deploy ไม่แตะ) · ตั้งแล้ว = S3 (`s3:<key>` ใน DB, เสิร์ฟด้วย presigned URL อายุ `MEDIA_URL_TTL` 6 ชม.) — bucket ต้องปิด public access · EC2 ใช้ IAM role `bigcat-app-role` ไม่ต้องมี access key
* ย้ายรูปเดิมขึ้น S3: `node server/migrate-album-s3.js [--dry] [--keep]` (ดูขั้นตอนเปิด AWS ที่ `tools/aws/README.md`)
