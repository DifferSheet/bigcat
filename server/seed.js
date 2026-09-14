// ข้อมูลตัวอย่างสำหรับรันบนเครื่อง: npm run db:seed
import { migrate, pool, q, one } from './db.js';

const HERO = '/images/bigcat-hero.png';
const MERCH = '/images/bigcat-merch.png';

const events = [
  {
    slug: 'meet-and-hug-2026', type: 'fanmeet', status: 'open', category: 'Meet & greet', tone: 'pink',
    title: 'BIGCAT Meet & Hug', subtitle: 'วันนัดพบของคนรักแมวตัวโต',
    description: 'มาทักทาย ถ่ายรูป และรับความน่ารักกลับบ้าน โนบิ บูตะ และชิบะ รอเจอทุกคนในบรรยากาศอบอุ่นแบบใกล้ชิด ที่นั่งมีจำนวนจำกัด จองล่วงหน้าได้เลย',
    place: 'Lido Connect Hall 2, สยามสแควร์', map_url: 'https://maps.google.com/?q=Lido+Connect',
    starts_at: '2026-10-24 10:00:00', ends_at: '2026-10-24 18:00:00', cover: HERO,
    config: {
      seatMap: { rows: ['A', 'B', 'C', 'D', 'E', 'F'], cols: 10, maxPerBooking: 4, holdMinutes: 10, zones: { A: { name: 'Nobi Zone', price: 890, perk: 'ถ่ายรูปคู่ + ลายเซ็น' }, B: { name: 'Nobi Zone', price: 890, perk: 'ถ่ายรูปคู่ + ลายเซ็น' }, default: { name: 'Standard', price: 590, perk: 'ของที่ระลึก' } } },
      payment: { promptpay: '0812345678', accountName: 'BIGCAT Studio' },
      schedule: [['10:00', 'เปิดประตู · รับของที่ระลึก'], ['11:00', 'Talk กับโนบิ'], ['13:00', 'Photo session โซน Nobi'], ['15:30', 'Mini game & ลุ้นรางวัล'], ['17:00', 'Group photo ปิดงาน']],
      faq: [['ซื้อบัตรหน้างานได้ไหม', 'ได้ถ้าที่นั่งเหลือ แต่แนะนำจองล่วงหน้าเพราะโซน Nobi เต็มเร็วมาก'], ['จองแล้วยกเลิกได้ไหม', 'ยกเลิกได้ก่อนวันงาน 7 วัน คืนเงิน 80%'], ['เด็กเข้าได้ไหม', 'เด็กอายุต่ำกว่า 6 ปี เข้าฟรีเมื่อมากับผู้ปกครองที่มีที่นั่ง']],
    },
  },
  {
    slug: 'merit-vassa-2026', type: 'merit', status: 'open', category: 'ทำบุญ', tone: 'yellow',
    title: 'ร่วมบุญช่วงเข้าพรรษา กับมหาบูตะ', subtitle: 'เข้าพรรษา สร้างบุญ สร้างใจ ไปด้วยกัน',
    description: 'บุญครั้งนี้มาร่วมกันนะมัม ♥ มหาบูตะชวนมัมป๊าและแฟนคลับทุกคนไปร่วมทำบุญช่วงเข้าพรรษาที่วัดวชิรธรรมสาธิต วันเสาร์ที่ 19 กันยายน 2569\n\nมาไม่ได้ก็ร่วมบุญออนไลน์ได้ เลือกหมวดที่อยากร่วม แจ้งยอดพร้อมสลิป พี่ ๆ ที่ดูแลบูตะตรวจสอบแล้ว ยอดจะขึ้นบนหน้านี้ทันที และเมื่อยอดรวมถึงแต่ละขั้น มหาบูตะจะปลดล็อกของขวัญพิเศษให้ทุกคน\n\nแล้วมาสร้างบุญไปด้วยกันนะมัมป๊า 🧡',
    place: 'วัดวชิรธรรมสาธิต (ซอย 101/1 สุดซอยตรง 3 แยกเลี้ยวซ้าย)', map_url: 'https://maps.google.com/?q=วัดวชิรธรรมสาธิต',
    starts_at: '2026-09-19 09:00:00', ends_at: '2026-09-19 12:00:00', cover: '/images/merit-vassa-2026.png',
    config: {
      payment: { qrImage: '/images/qr-merit.png', accountName: 'บัญชีน้องบูตะน้องโนบิ' },
      // ปิดรับยอดออนไลน์ก่อนวันไปวัด 1 วัน (นับถอยหลังแยกจากวันงาน)
      donateUntil: '2026-09-18 20:00:00',
      // ลงทะเบียน "ไปวัดด้วย" สำหรับคนที่จะไปวันงาน
      attend: { enabled: true, note: 'นัดพบหน้าวัด 09:00 น. แต่งกายสุภาพ มีของที่ระลึกสำหรับผู้ที่เช็คอินหน้างาน' },
      // milestone แบบ interactive: ปลดล็อกแล้วมีของจริงให้ดู/ทำ
      milestones: [
        { percent: 25, title: 'ปล่อยภาพลับมหาบูตะชุดขาวทอง', reward: { type: 'image', src: '/images/merit-vassa-2026.png', caption: 'มหาบูตะในชุดขาวทอง เตรียมไปวัดกับทุกคน' } },
        { percent: 50, title: 'Live พิเศษกับแก๊งจากวัด 1 ชั่วโมง', reward: { type: 'link', url: 'https://www.youtube.com/@bigcat', label: 'ดู Live / ย้อนหลัง' } },
        { percent: 75, title: 'โหวตบุญครั้งถัดไปที่แก๊งจะไป', reward: { type: 'poll', key: 'next-merit', question: 'บุญครั้งหน้าอยากให้แก๊ง BIGCAT ไปที่ไหน', options: ['วัดป่าในต่างจังหวัด', 'บ้านพักแมวจร', 'โรงพยาบาลสัตว์ (ค่ารักษาแมวป่วย)'] } },
        { percent: 100, title: 'แก๊ง BIGCAT ถวายสังฆทานในนามแฟนคลับทุกคน + ถ่ายทอดสด', reward: { type: 'text', body: 'ครบเป้าแล้ว! วันงานจะถ่ายทอดสดตอนถวายสังฆทาน และอ่านชื่อผู้ร่วมบุญทุกคนในคำอธิษฐาน' } },
      ],
      // ความโปร่งใส: แสดงบนหน้าเว็บตลอด
      report: {
        accountNote: 'บัญชีรับเงินเป็นบัญชีของ BIGCAT ที่ทำหน้าที่รวบรวมยอดแทนแฟนคลับ ไม่ใช่บัญชีของวัด',
        excessPolicy: 'ยอดที่เกินเป้าทั้งหมดจะถวายวัดวชิรธรรมสาธิตในวันงาน และแสดงใบอนุโมทนาจากวัดในหน้านี้',
        taxNote: 'เนื่องจากเงินผ่านบัญชีตัวแทน จึงใช้ลดหย่อนภาษีไม่ได้ หากต้องการลดหย่อน กรุณาบริจาคผ่าน e-Donation ของวัดโดยตรงแล้วแจ้งยอดมาเพื่อนับรวมได้',
      },
      schedule: [['09:00', 'พบกันหน้าวัด · รับสายสิญจน์'], ['09:30', 'ถวายสังฆทาน / เทียนพรรษา'], ['10:30', 'ถ่ายรูปกับมหาบูตะ'], ['11:30', 'อนุโมทนาบุญร่วมกัน · ปิดงาน']],
      faq: [['ไปวัดอย่างไร', 'วัดวชิรธรรมสาธิต ซอย 101/1 เข้าซอยสุดซอยตรง 3 แยกเลี้ยวซ้าย กดที่ชื่อสถานที่เพื่อเปิดแผนที่'], ['มาไม่ได้ร่วมบุญได้ไหม', 'ได้ เลือกหมวดที่ต้องการแล้วแจ้งยอดพร้อมสลิปได้ในหน้านี้ ปิดรับยอดออนไลน์ 18 ก.ย. 20:00 น.'], ['ได้ใบอนุโมทนาไหม', 'ได้ ระบบออกใบอนุโมทนาดิจิทัลให้หลังยืนยันยอด บันทึกเป็นภาพแชร์ได้'], ['ยอดขึ้นเมื่อไหร่', 'ถ้าแนบสลิปแล้วระบบตรวจผ่าน ยอดขึ้นทันที ถ้าไม่ผ่าน พี่ ๆ ที่ดูแลจะตรวจให้ภายใน 24 ชั่วโมง']],
    },
    // [ชื่อหมวด, คำอธิบาย, เป้า(บาท), ชื่อหน่วย, ราคาต่อหน่วย] — หน่วยว่าง = ใส่ยอดเอง
    categories: [
      ['ถวายสังฆทาน', 'ชุดสังฆทานถวายพระสงฆ์', 30000, 'ชุด', 300],
      ['เทียนพรรษา + ผ้าอาบน้ำฝน', 'ถวายเทียนและผ้าอาบน้ำฝนช่วงเข้าพรรษา', 20000, 'ชุด', 500],
      ['ภัตตาหารเพล', 'ภัตตาหารถวายพระวันงาน', 15000, 'ที่', 150],
      ['บูรณะวัด', 'สมทบทุนซ่อมแซมศาลาและอุโบสถ (ใส่ยอดได้ตามศรัทธา)', 35000, null, null],
    ],
  },
  {
    slug: 'busking-siam-2026', type: 'busking', status: 'live', category: 'Busking', tone: 'sage',
    title: 'BIGCAT Busking @ Siam', subtitle: 'เจอกันริมถนน ฟังเพลง ถ่ายรูป ลุ้น Lucky Fan',
    description: 'แก๊ง BIGCAT ยกวงมาเล่นข้างถนนแบบสบายๆ ใครมาเจอก็ลงทะเบียนแล้วเช็คอินหน้างาน ตอนท้ายจะสุ่ม Lucky Fan มาถ่ายรูปคู่กับโนบิ',
    place: 'ลานหน้า Siam Center', map_url: 'https://maps.google.com/?q=Siam+Center',
    starts_at: '2026-10-10 17:00:00', ends_at: '2026-10-10 20:00:00', cover: HERO,
    config: {
      drawRounds: 3,
      setlist: ['Little Moments', 'Big Happiness', 'Sunday Nap', 'Cover: ขอเพลงจากแฟนๆ'],
      faq: [['ต้องลงทะเบียนไหม', 'ไม่ลงก็ดูได้ แต่ถ้าอยากลุ้น Lucky Fan ต้องลงทะเบียนและเช็คอินหน้างาน'], ['เช็คอินอย่างไร', 'เปิดหน้าลงทะเบียนของคุณ แล้วกด "ฉันมาถึงแล้ว" ระหว่างเวลางาน']],
    },
    songs: [['Little Moments', 'BIGCAT', 12], ['Sunday Nap', 'BIGCAT', 8], ['ทุกวันฉันคิดถึงเธอ', 'Cover', 5]],
    registrations: 18,
  },
  {
    slug: 'little-flower-day', type: 'workshop', status: 'upcoming', category: 'Workshop', tone: 'yellow',
    title: 'A Little Flower Day', subtitle: 'ใช้วันสบายๆ แต่งเติมดอกไม้ไปกับโนบิ',
    description: 'เวิร์กช็อปจัดดอกไม้ชิ้นเล็กที่มีความหมาย รับจำนวนจำกัด 20 ที่',
    place: 'สถานที่จะแจ้งให้ทราบ', starts_at: '2026-11-08 13:00:00', ends_at: '2026-11-08 16:00:00', cover: HERO,
    config: { capacity: 20, schedule: [['13:00', 'ลงทะเบียน'], ['13:30', 'เริ่มเวิร์กช็อป'], ['15:30', 'ถ่ายรูปกับผลงาน']] },
  },
  {
    slug: 'little-things-popup', type: 'popup', status: 'upcoming', category: 'Pop-up store', tone: 'sage',
    title: 'Little Things Pop-up', subtitle: 'ของสะสมจากแก๊ง BIGCAT',
    description: 'พบกับไอเดียของสะสมจากแก๊ง BIGCAT ที่จะเติมความน่ารักให้ทุกวัน',
    place: 'สถานที่จะแจ้งให้ทราบ', starts_at: '2026-11-21 10:00:00', ends_at: '2026-11-21 20:00:00', cover: MERCH,
    config: {},
  },
];

const rand = (n) => Math.floor(Math.random() * n);
const code = () => Math.random().toString(36).slice(2, 8).toUpperCase();

await migrate();
// reset ข้อมูลเดิม
await q('SET FOREIGN_KEY_CHECKS = 0');
for (const t of ['order_items', 'orders', 'product_variants', 'products', 'settings', 'poll_votes', 'report_items', 'song_requests', 'lucky_draws', 'registrations', 'donations', 'donation_categories', 'bookings', 'seats', 'events']) await q(`DROP TABLE IF EXISTS ${t}`);
await q('SET FOREIGN_KEY_CHECKS = 1');
await migrate(); // สร้างตารางใหม่ตาม schema ล่าสุด

for (const ev of events) {
  const { categories, songs, registrations, ...row } = ev;
  const res = await q('INSERT INTO events SET ?', [{ ...row, config: JSON.stringify(row.config || {}) }]);
  const eventId = res.insertId;

  if (ev.type === 'fanmeet') {
    const { rows, cols, zones } = ev.config.seatMap;
    const values = [];
    for (const r of rows) for (let c = 1; c <= cols; c++) {
      const zone = zones[r] || zones.default;
      // จำลองที่นั่งที่ถูกจองไปแล้วบางส่วน
      const status = Math.random() < 0.18 ? 'booked' : 'available';
      values.push([eventId, `${r}${c}`, r, c, zone.name, zone.price, status]);
    }
    await q('INSERT INTO seats (event_id, label, row_label, col_num, zone, price, status) VALUES ?', [values]);
  }

  if (categories) {
    const donors = ['มัมแนน', 'Fah', 'ป๊าต้น', 'Mild', 'บ้านแมวส้ม', 'Ploy', 'มัมเจ'];
    const msgs = ['สาธุ ร่วมบุญกับมหาบูตะ', 'ขอให้แก๊งแข็งแรงนะ', 'อนุโมทนาบุญด้วยค่ะ', 'สาธุ', 'มัมมาร่วมบุญแล้วนะ'];
    const dedications = [null, null, 'ในนามน้องส้ม', 'อุทิศให้น้องมะลิ', null, 'ในนามครอบครัวแมวบ้านฟ้า'];
    for (const [i, [name, description, goal, unit_name, unit_price]] of categories.entries()) {
      const c = await q('INSERT INTO donation_categories SET ?', [{ event_id: eventId, name, description, goal, unit_name, unit_price, sort: i }]);
      const n = 4 + rand(5);
      for (let k = 0; k < n; k++) {
        const units = unit_price ? 1 + rand(4) : null;
        const amount = units ? units * unit_price : [100, 200, 300, 500, 1000, 2000][rand(6)];
        await q('INSERT INTO donations SET ?', [{ code: code(), event_id: eventId, category_id: c.insertId, donor_name: donors[rand(donors.length)], dedication: dedications[rand(dedications.length)], message: msgs[rand(msgs.length)], anonymous: Math.random() < .2 ? 1 : 0, amount, units, status: 'approved' }]);
      }
    }
    await q('INSERT INTO donations SET ?', [{ code: code(), event_id: eventId, category_id: (await one('SELECT id FROM donation_categories WHERE event_id=? ORDER BY sort LIMIT 1', [eventId])).id, donor_name: 'รอตรวจสอบ', amount: 500, status: 'pending' }]);
  }

  if (registrations) {
    const names = ['ณัฐ', 'พิม', 'เบล', 'ต้น', 'ฟ้า', 'มิว', 'ปอ', 'เจน', 'บีม', 'ไอซ์', 'นุ่น', 'กัน', 'แพร', 'ตาล', 'ออม', 'เก้า', 'น้ำ', 'ขวัญ'];
    for (let i = 0; i < registrations; i++) {
      await q('INSERT INTO registrations SET ?', [{ code: code(), event_id: eventId, number: i + 1, name: names[i % names.length], nickname: names[i % names.length], social: `@${names[i % names.length]}_bigcat`, checked_in_at: i < 11 ? new Date() : null }]);
    }
  }
  if (songs) for (const [title, artist, votes] of songs) await q('INSERT INTO song_requests SET ?', [{ event_id: eventId, title, artist, votes }]);
}

/* ---------- ร้านค้า ---------- */
const products = [
  { slug: 'everyday-together-tote', name: 'Everyday Together Tote', name_th: 'กระเป๋าผ้า แก๊งนี้ไปด้วยกัน', category: 'กระเป๋า', price: 490, compare_price: 590, image: MERCH, stock: 40, featured: 1, sort: 1,
    description: 'กระเป๋าผ้าแคนวาสสีครีม พิมพ์หน้าโนบิ บูตะ ชิบะ ขนาด 35×40 ซม. หูหิ้วยาวสะพายไหล่ได้ ซักเครื่องได้' },
  { slug: 'little-friend-keychain', name: 'Little Friend Keychain', name_th: 'พวงกุญแจ เพื่อนตัวจิ๋ว', category: 'ของสะสม', price: 290, image: MERCH, stock: 0, featured: 1, sort: 2,
    description: 'พวงกุญแจอีนาเมลห่วงทอง เลือกได้ 3 แบบ โนบิ บูตะ ชิบะ ขนาด 4 ซม.',
    variants: [['โนบิ', 0, 25], ['บูตะ', 0, 30], ['ชิบะ', 0, 18]] },
  { slug: 'bigcat-tee', name: 'BIGCAT Gang Tee', name_th: 'เสื้อยืดแก๊ง BIGCAT', category: 'เสื้อผ้า', price: 590, image: HERO, stock: 0, featured: 0, sort: 3,
    description: 'เสื้อยืดคอกลม cotton 100% สีครีม สกรีนลายแก๊งสามตัวด้านหน้า',
    variants: [['S', 0, 10], ['M', 0, 15], ['L', 0, 15], ['XL', 20, 8]] },
  { slug: 'nobi-sticker-pack', name: 'Nobi Sticker Pack', name_th: 'สติกเกอร์โนบิ 12 ชิ้น', category: 'ของสะสม', price: 120, image: HERO, stock: 200, featured: 0, sort: 4,
    description: 'สติกเกอร์ไวนิลกันน้ำ 12 ลาย ติดโน้ตบุ๊ก ขวดน้ำ ได้หมด' },
  { slug: 'merit-set-2026', name: 'Merit Day Set', name_th: 'เซ็ตวันทำบุญ (รับหน้างาน)', category: 'ของสะสม', price: 350, image: '/images/merit-vassa-2026.png', stock: 30, featured: 1, sort: 5,
    description: 'สายสิญจน์ + โปสการ์ดมหาบูตะ + เข็มกลัด รับได้ที่วัดวันที่ 19 ก.ย. หรือส่งไปรษณีย์' },
];
for (const { variants, ...p } of products) {
  const r = await q('INSERT INTO products SET ?', [{ ...p, images: JSON.stringify([p.image]) }]);
  if (variants) for (const [i, [name, price_delta, stock]] of variants.entries()) await q('INSERT INTO product_variants SET ?', [{ product_id: r.insertId, name, price_delta, stock, sort: i }]);
}
await q('INSERT INTO settings (`key`, value) VALUES (?, ?)', ['shop', JSON.stringify({
  shippingFee: 50, freeShippingOver: 1000, pickup: { enabled: true, label: 'รับหน้างาน (วันทำบุญ 19 ก.ย. / Fan Meet 24 ต.ค.)' },
  payment: { qrImage: '/images/qr-merit.png', accountName: 'บัญชีน้องบูตะน้องโนบิ' },
  carriers: ['Kerry', 'Flash', 'J&T', 'ไปรษณีย์ไทย'],
})]);
// ออเดอร์ตัวอย่าง
const tote = await one("SELECT id, name, price, image FROM products WHERE slug='everyday-together-tote'");
const o = await q('INSERT INTO orders SET ?', [{ code: code() + 'X', status: 'paid', name: 'มัมแนน', phone: '0891112222', delivery: 'ship', address: '99/1 ถ.สุขุมวิท 101/1 บางจาก พระโขนง กรุงเทพฯ 10260', subtotal: 980, shipping_fee: 50, total: 1030 }]);
await q('INSERT INTO order_items SET ?', [{ order_id: o.insertId, product_id: tote.id, name: tote.name, image: tote.image, price: tote.price, qty: 2 }]);
await q('UPDATE products SET stock = stock - 2 WHERE id=?', [tote.id]);

console.log(`✓ seeded ${products.length} products`);
console.log(`✓ seeded ${events.length} events into database "${(await one('SELECT DATABASE() AS d')).d}"`);
await pool.end();
