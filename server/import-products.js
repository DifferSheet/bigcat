// นำเข้าสินค้าจากไฟล์ JSON ที่ดึงมาจาก TikTok Shop → ตาราง products / product_variants
// ใช้: node server/import-products.js <โฟลเดอร์ที่มี p*.json> [--replace]
//   --replace = ลบสินค้าเดิมทั้งหมดก่อนนำเข้า (ออเดอร์เดิมยังอยู่ เพราะ order_items เก็บชื่อ/ราคาไว้แล้ว)
import fs from 'node:fs';
import path from 'node:path';
import { migrate, pool, q, one } from './db.js';
import { cleanHtml, textToHtml } from './richtext.js';

const dir = process.argv[2];
const replace = process.argv.includes('--replace');
if (!dir) { console.error('ระบุโฟลเดอร์ JSON ด้วย'); process.exit(1); }

// หมวดหมู่ TikTok ยาวเกินไปสำหรับหน้าร้าน — ย่อเป็นหมวดของเราเอง
const CATEGORY = [
  [/หมวก/i, 'หมวก'],
  [/เสื้อยืด|Baby Tee|Oversize/i, 'เสื้อผ้า'],
  [/กระเป๋า|ถุงผ้า/i, 'กระเป๋า'],
  [/แก้ว|ภาชนะ|เครื่องครัว/i, 'ของใช้'],
  [/กระจก|ความงาม/i, 'ของใช้'],
  [/พวงกุญแจ|ฟิกเกอร์|ของเล่น|Standee|Keychain/i, 'ของสะสม'],
  [/สติกเกอร์|กระดาษ|เครื่องเขียน|โน้ต|การ์ดโฮลเดอร์|ป้าย/i, 'เครื่องเขียน'],
  [/ยางรัดผม|กิ๊บ|เครื่องประดับผม/i, 'เครื่องประดับ'],
  [/โทรศัพท์|Griptok/i, 'อุปกรณ์มือถือ'],
];
const shortCategory = (row) => {
  const hay = `${row.name} ${row.category}`;
  for (const [re, label] of CATEGORY) if (re.test(hay)) return label;
  return 'ของสะสม';
};

// slug ตั้งเองให้สื่อความหมายและดีต่อ SEO (คีย์คือ product id ของ TikTok)
const SLUGS = {
  '1737204871346882374': 'bigcat-satin-scrunchie',
  '1736637379384805190': 'boota-nobi-embroidered-cap',
  '1730780471196617542': 'boota-friends-tumbler-20oz',
  '1731425100173641542': 'boota-baby-tee-boo-best-luck',
  '1731607634459658054': 'boota-oversize-tee-call-me-my-boo',
  '1733650902546417478': 'bigcat-tee-anywhere-with-you',
  '1734921786116441926': 'bigcat-memo-sticky-notes',
  '1734440901405738822': 'bigcat-secret-garden-pocket-mirror',
  '1734295306660120390': 'bigcat-daily-dazzle-blind-box',
  '1733355872100976454': 'bigcat-card-holder-lanyard-set',
  '1732455557856855878': 'bigcat-griptok-blind-bag',
  '1732456034756691782': 'bigcat-hairclip-blind-bag',
  '1732752210893244230': 'bigcat-acrylic-standee-blind-bag',
  '1732713700555851590': 'bigcat-acrylic-keychain-blind-bag',
  '1731212270194494278': 'boota-puffy-chubby-boo-bag',
  '1731440482852375366': 'boota-baby-boo-plush-keychain',
  '1730729692243921734': 'boota-friends-canvas-tote',
  '1730797369115839302': 'boota-chubby-charm-stickers',
  '1731477732961717062': 'nu-thongtai-x-boota-boxset',
  '1730780092368653126': 'boota-friends-drawstring-bag',
};
const slugify = (row) => SLUGS[row.id] || `bigcat-${row.id.slice(-6)}`;

// ชื่อรองใต้ชื่อสินค้า — เว้นว่างถ้าซ้ำกับชื่อหลัก (ไม่งั้นการ์ดจะอ่านซ้ำสองบรรทัด)
const subName = (name) => {
  const short = name.split(/\s[|\[(]/)[0].trim();
  return short && short !== name ? null : null;
};

await migrate();

if (replace) {
  await q('SET FOREIGN_KEY_CHECKS = 0');
  await q('DELETE FROM product_variants');
  await q('DELETE FROM products');
  await q('SET FOREIGN_KEY_CHECKS = 1');
  console.log('ลบสินค้าเดิมแล้ว');
}

const files = fs.readdirSync(dir).filter(f => /^p\d+\.json$/.test(f))
  .sort((a, b) => Number(a.slice(1, -5)) - Number(b.slice(1, -5)));

let n = 0;
for (const [i, file] of files.entries()) {
  const row = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const images = row.imgs.map((_, k) => `/images/products/${row.id}_${String(k + 1).padStart(2, '0')}.jpg`)
    .filter(p => fs.existsSync(path.join(process.cwd(), 'public', p)));
  if (!images.length) { console.warn(`ข้าม ${row.name} (ไม่มีรูป)`); continue; }

  const prices = row.variants.map(v => v.price).filter(Boolean);
  const price = prices.length ? Math.min(...prices) : 0;
  const hasVariants = row.variants.length > 1 || (row.variants[0]?.name || '') !== '';
  const stock = hasVariants ? 0 : (row.variants[0]?.stock ?? 0);

  let slug = slugify(row);
  if (await one('SELECT id FROM products WHERE slug=?', [slug])) slug = `${slug}-${row.id.slice(-4)}`;

  const res = await q('INSERT INTO products SET ?', [{
    slug, name: row.name.slice(0, 160), name_th: subName(row.name),
    description: row.description ? cleanHtml(textToHtml(row.description)) : null, category: shortCategory(row),
    price, stock, status: 'active',
    image: images[0], images: JSON.stringify(images),
    featured: i < 4 ? 1 : 0, sort: i + 1,
  }]);

  if (hasVariants) {
    for (const [k, v] of row.variants.entries()) {
      await q('INSERT INTO product_variants SET ?', [{
        product_id: res.insertId, name: (v.name || 'แบบมาตรฐาน').slice(0, 80),
        price_delta: v.price - price, stock: v.stock, sku: v.sku || null, sort: k,
      }]);
    }
  }
  n++;
  console.log(`✓ ${String(n).padStart(2)} ${row.name.slice(0, 50)} · ${images.length} รูป · ${hasVariants ? row.variants.length + ' ตัวเลือก' : 'สต็อก ' + stock} · ฿${price}`);
}

const total = await one('SELECT COUNT(*) c FROM products');
const tv = await one('SELECT COUNT(*) c FROM product_variants');
console.log(`\n✓ นำเข้าแล้ว ${n} สินค้า (รวมในระบบ ${total.c} รายการ, ${tv.c} ตัวเลือก)`);
await pool.end();
