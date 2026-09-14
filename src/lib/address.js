'use client';
// ที่อยู่ไทย — ฐานข้อมูล ตำบล/อำเภอ/จังหวัด/รหัสไปรษณีย์ (public/data/thai-address.json, ~60KB gzip)
// รูปแบบไฟล์: [[จังหวัด, [[อำเภอ, [[ตำบล, รหัส | [รหัส...]] ...]] ...]] ...]
// โหลดครั้งเดียวตอนผู้ใช้เลือก "ส่งไปรษณีย์" แล้วแชร์ทั้งแอป
let dbPromise = null;
export const loadAddressDB = () => (dbPromise ??= fetch('/data/thai-address.json').then(r => r.json()).then(build).catch(err => { dbPromise = null; throw err; }));

const collator = typeof Intl !== 'undefined' ? new Intl.Collator('th') : { compare: (a, b) => (a < b ? -1 : a > b ? 1 : 0) };
const BKK = 'กรุงเทพมหานคร';

function build(raw) {
  const tree = new Map();      // province → Map(district → Map(subdistrict → zips[]))
  const flat = [];             // ทุกตำบล สำหรับค้นหา
  for (const [p, districts] of raw) {
    const dm = new Map();
    for (const [d, subs] of districts) {
      const sm = new Map();
      for (const [s, z] of subs) { const zips = Array.isArray(z) ? z.map(String) : [String(z)]; sm.set(s, zips); flat.push({ province: p, district: d, subdistrict: s, zips }); }
      dm.set(d, sm);
    }
    tree.set(p, dm);
  }
  const provinces = [BKK, ...[...tree.keys()].filter(p => p !== BKK).sort(collator.compare)];
  return { tree, flat, provinces };
}

export const isBangkok = (province) => province === BKK;
export const districtsOf = (db, province) => (db && province && db.tree.get(province) ? [...db.tree.get(province).keys()].sort(collator.compare) : []);
export const subdistrictsOf = (db, province, district) => { const dm = db?.tree.get(province); const sm = dm?.get(district); return sm ? [...sm.keys()].sort(collator.compare) : []; };
export const zipsOf = (db, province, district, subdistrict) => db?.tree.get(province)?.get(district)?.get(subdistrict) || [];

// ค้นหาแบบพิมพ์ทีเดียว: ตำบล / อำเภอ / จังหวัด / รหัสไปรษณีย์ — ขึ้นต้นด้วยคำค้นก่อน แล้วค่อยที่มีคำค้นอยู่ข้างใน
export function searchAddress(db, query, limit = 8) {
  const q = String(query || '').trim().replace(/^(ต\.|ตำบล|แขวง|อ\.|อำเภอ|เขต|จ\.|จังหวัด)\s*/, '');
  if (!db || q.length < 2) return [];
  const isZip = /^\d+$/.test(q);
  const hits = [];
  for (const row of db.flat) {
    let score = 0;
    if (isZip) { if (row.zips.some(z => z.startsWith(q))) score = 3; }
    else {
      if (row.subdistrict.startsWith(q)) score = 4;
      else if (row.district.startsWith(q)) score = 3;
      else if (row.subdistrict.includes(q)) score = 2;
      else if (row.district.includes(q) || row.province.startsWith(q)) score = 1;
    }
    if (score) { hits.push({ row, score }); }
  }
  hits.sort((a, b) => b.score - a.score || collator.compare(a.row.subdistrict, b.row.subdistrict));
  return hits.slice(0, limit).map(h => h.row);
}

// ประกอบเป็นข้อความบรรทัดเดียวสำหรับเก็บใน DB / แสดงผล
// "99/1 ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110" · ต่างจังหวัดใช้ ต./อ./จ.
export function composeAddress(a) {
  if (!a) return '';
  const { line1 = '', province = '', district = '', subdistrict = '', zip = '' } = a;
  if (!province) return line1.trim();
  const bkk = isBangkok(province);
  const area = [subdistrict && `${bkk ? 'แขวง' : 'ต.'}${subdistrict}`, district && `${bkk ? 'เขต' : 'อ.'}${district}`, `${bkk ? '' : 'จ.'}${province}`, zip].filter(Boolean).join(' ');
  return [line1.trim(), area].filter(Boolean).join(' ');
}

// แยกข้อความกลับเป็นโครงสร้าง (รองรับรูปแบบที่ composeAddress สร้าง + ที่คนพิมพ์เองแบบใกล้เคียง)
// ถ้าแยกไม่ได้หรือไม่ตรงฐานข้อมูล → ทั้งก้อนไปอยู่ line1 ให้ผู้ใช้เลือกพื้นที่เอง
export function parseAddress(db, text) {
  const t = String(text || '').trim();
  const empty = { line1: '', province: '', district: '', subdistrict: '', zip: '' };
  if (!t) return empty;
  const m = t.match(/^(.*?)\s*(?:แขวง|ต\.|ตำบล)\s*(\S+)\s+(?:เขต|อ\.|อำเภอ)\s*(\S+)\s+(?:จ\.|จังหวัด)?\s*(\S+?)\s*(\d{5})?$/);
  if (m && db) {
    const [, line1, subdistrict, district, province, zip] = m;
    const zips = zipsOf(db, province, district, subdistrict);
    if (zips.length) return { line1: line1.trim(), province, district, subdistrict, zip: zip && zips.includes(zip) ? zip : zips[0] };
  }
  return { ...empty, line1: t };
}

export const isAddressComplete = (a) => !!(a && a.line1.trim() && a.province && a.district && a.subdistrict && a.zip);
