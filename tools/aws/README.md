# เปิด S3 + Rekognition ให้ bigcathouse (ทำครั้งเดียว · ~20 นาที · ทำในเบราว์เซอร์ทั้งหมด)

ทุกอย่างอยู่ **region Singapore (ap-southeast-1)** เดียวกับ EC2 — เลือก region นี้ที่มุมขวาบนของ AWS Console ก่อนทุกขั้น

## 1. S3 bucket (ที่เก็บรูปอัลบั้ม)
1. S3 → **Create bucket** · ชื่อ `bigcathouse-media` · Region ap-southeast-1
2. **Block all public access = เปิดไว้ (ติ๊กทั้ง 4)** — รูปจะถูกเสิร์ฟผ่านลิงก์ชั่วคราวที่ API เซ็นให้ ไม่เปิดสาธารณะ (เพราะอัลบั้มดูได้เฉพาะคนเช็คอิน)
3. Bucket Versioning: Disable · Default encryption: SSE-S3 (ค่าเริ่มต้น) · Create
4. (แนะนำ) Management → Lifecycle rule: ย้าย object ที่อายุ > 90 วัน ไป **Standard-IA** — อัลบั้มเก่าถูกลง ~45%

## 2. สิทธิ์ (IAM) — ใช้ **role ผูกกับ EC2** ไม่ต้องมี access key ใน .env บน prod
1. IAM → Policies → **Create policy** → แท็บ JSON → วางเนื้อหาจาก `tools/aws/bigcat-media-policy.json` → ชื่อ `bigcat-media-policy` → Create
2. IAM → Roles → **Create role** → Trusted entity: AWS service → Use case: **EC2** → Next → ติ๊ก `bigcat-media-policy` → ชื่อ `bigcat-app-role` → Create
3. EC2 → Instances → เลือกเครื่อง bigcat → Actions → Security → **Modify IAM role** → เลือก `bigcat-app-role` → Update
   * มีผลทันที ไม่ต้อง reboot · แอปบน EC2ใช้ credentials จาก instance เอง (AWS SDK อ่านให้อัตโนมัติ)

### สำหรับเครื่องแด๊ด (dev/local) — ถ้าอยากทดสอบ Rekognition จาก local
IAM → Users → Create user `bigcat-dev` (ไม่ต้องให้เข้า Console) → Attach policy `bigcat-media-policy` → Security credentials → **Create access key** (Use case: Application running outside AWS) → ใส่ใน `.env` บนเครื่อง:
```
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=AKIA…
AWS_SECRET_ACCESS_KEY=…
```
(อย่าวางคีย์ในแชต/commit — ถ้าหลุดให้ Deactivate แล้วสร้างใหม่ทันที)

## 3. Rekognition
ไม่มีปุ่ม "เปิด" — ใช้ได้เมื่อมีสิทธิ์ตามข้อ 2 · collection `bigcat-faces` ถูกสร้างอัตโนมัติครั้งแรกที่ API เรียก
* ครั้งแรกที่บัญชีใช้ Rekognition อาจขึ้นหน้าให้ยอมรับเงื่อนไข AI service — กดยอมรับ
* ตรวจว่าเปิดได้: Rekognition → Collections (ในเมนูซ้าย, region Singapore) — หลัง API รันครั้งแรกจะเห็น `bigcat-faces`

## 4. งบและการแจ้งเตือน (กันบิลช็อก · 2 นาที)
Billing → Budgets → Create budget → Cost budget → รายเดือน **$5** → แจ้งเตือนที่ 80% ไปอีเมลแด๊ด · การใช้งานจริงของเรา: อัลบั้ม 500 รูป + สมาชิก 200 คน ≈ ไม่ถึง $1/เดือน

## 5. ตั้งค่าในแอป
`.env` บน EC2 (แล้วสร้าง pm2 ใหม่ตามวิธีใน README หลัก):
```
FACE_PROVIDER=rekognition
AWS_REGION=ap-southeast-1
REKOGNITION_COLLECTION=bigcat-faces
MEDIA_BUCKET=bigcathouse-media      # เมื่อเปิดใช้ S3 storage (ดูหมายเหตุ)
```
**หมายเหตุ**: ตอนนี้ (18 ก.ย.) โค้ดเก็บรูปอัลบั้มบนดิสก์ EC2 (`server/uploads/albums/`) · ส่วน S3 storage adapter + presigned URL เป็นงานถัดไป — เปิด bucket/role ไว้ก่อนได้เลย ไม่มีค่าใช้จ่ายถ้ายังไม่มี object

## ถ้าอยากทำผ่าน CLI แทน (ต้องติดตั้ง `brew install awscli` แล้ว `aws configure` ด้วย user ที่มีสิทธิ์ admin)
```bash
aws s3api create-bucket --bucket bigcathouse-media --region ap-southeast-1 --create-bucket-configuration LocationConstraint=ap-southeast-1
aws s3api put-public-access-block --bucket bigcathouse-media --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws iam create-policy --policy-name bigcat-media-policy --policy-document file://tools/aws/bigcat-media-policy.json
aws iam create-role --role-name bigcat-app-role --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
aws iam attach-role-policy --role-name bigcat-app-role --policy-arn arn:aws:iam::<ACCOUNT_ID>:policy/bigcat-media-policy
aws iam create-instance-profile --instance-profile-name bigcat-app-role
aws iam add-role-to-instance-profile --instance-profile-name bigcat-app-role --role-name bigcat-app-role
aws ec2 associate-iam-instance-profile --instance-id <INSTANCE_ID> --iam-instance-profile Name=bigcat-app-role
```
