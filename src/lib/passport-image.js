// รูป passport สำหรับแชร์ (IG Story 1080×1920) — วาดด้วย canvas ฝั่ง client
// แสตมป์ที่ได้ = วงกลมภาพ (ลายแอดมิน หรือภาพปก) ขอบสีงาน · งานที่พลาด = วงเทาจาง · แสตมป์พิเศษ = ตราสี
import { eventStampArt, SPECIAL_STAMP_ART } from './stamp-art.js';
import { eventMemory } from './passport-memory.js';
import { eventDate } from './format.js';
const W = 1080, H = 1920;
const loadImage = (src) => new Promise((resolve) => { if (!src) return resolve(null); const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => resolve(im); im.onerror = () => resolve(null); im.src = src; });
const TONE = { pink: '#df8190', yellow: '#e2b53c', sage: '#7fa66f' };

// Preview exactly the photographs selected in this memory before saving/sharing.
export async function drawEventMemoryImage(ev) {
  const m = eventMemory(ev), c = document.createElement('canvas');
  c.width = 1080; c.height = 1350;
  const x = c.getContext('2d');
  const font = getComputedStyle(document.documentElement).getPropertyValue('--font-body').trim() || 'sans-serif';
  await Promise.all([400, 600].map(weight => document.fonts.load(`${weight} 40px ${font}`)));
  // วาดด้วยรูปที่เสิร์ฟจากโดเมนเรา (ลิงก์ S3 เป็น cross-origin วาดลง canvas ไม่ได้)
  const own = (kind) => `/api/passport/${encodeURIComponent(ev.slug)}/image/${kind}`;
  const sources = [m.group ? own('group') : null, m.portrait ? own('portrait') : null].filter(Boolean);
  if (!sources.length) sources.push(eventStampArt(ev) || ev.cover);
  const [photos, stamp, logo] = await Promise.all([Promise.all(sources.map(loadImage)), loadImage(eventStampArt(ev)), loadImage('/images/bigcat-mark-pink.webp')]);
  if (photos.some(im => !im)) throw new Error('โหลดภาพไม่สำเร็จ — ลองรีเฟรชหน้าแล้วกดอีกครั้ง');
  const box = (left, top, width, height, color, radius = 12) => {
    x.beginPath(); x.roundRect(left, top, width, height, radius); x.fillStyle = color; x.fill();
  };
  const fit = (im, left, top, width, height) => {
    const scale = Math.min(width / im.width, height / im.height);
    x.drawImage(im, left + (width - im.width * scale) / 2, top + (height - im.height * scale) / 2, im.width * scale, im.height * scale);
  };
  const lines = (text, left, top, width, size, maxLines = 2) => {
    x.font = `600 ${size}px ${font}`; x.textAlign = 'left';
    const chars = Array.from(text || ''); let line = '', row = 0;
    for (let i = 0; i < chars.length; i++) {
      if (x.measureText(line + chars[i]).width > width) {
        if (row === maxLines - 1) { x.fillText(line.slice(0, -1) + '…', left, top + row * size * 1.5); return; }
        x.fillText(line, left, top + row++ * size * 1.5); line = '';
      }
      line += chars[i];
    }
    x.fillText(line, left, top + row * size * 1.5);
  };
  const bg = x.createLinearGradient(0, 0, 1080, 1350); bg.addColorStop(0, '#ead8cc'); bg.addColorStop(1, '#f7eee1');
  x.fillStyle = bg; x.fillRect(0, 0, 1080, 1350);
  x.save(); x.shadowColor = '#65453226'; x.shadowBlur = 32; x.shadowOffsetY = 14;
  box(36, 30, 1008, 1274, '#dcc5a4', 22); box(30, 22, 1008, 1274, '#fff9ed', 22); x.restore();
  // Fine paper ruling and binding details keep the exported card part of the passport.
  x.strokeStyle = '#b49b7220'; x.lineWidth = 1;
  for (let y = 44; y < 1280; y += 8) { x.beginPath(); x.moveTo(48, y); x.lineTo(1020, y); x.stroke(); }
  x.strokeStyle = '#d5b995'; x.beginPath(); x.moveTo(65, 65); x.lineTo(65, 1260); x.stroke();
  if (logo) fit(logo, 95, 66, 85, 66);
  x.fillStyle = '#94724d'; x.font = '19px Georgia'; x.textAlign = 'left'; x.fillText('MY BIGCAT PASSPORT', 205, 97); x.fillText('A DAY TO REMEMBER', 205, 125);
  x.fillStyle = '#674735'; lines(m.heading, 95, 192, 715, 40, 2);
  x.fillStyle = '#96734f'; lines(ev.title, 95, 296, 740, 25, 1);
  x.font = `400 21px ${font}`; x.fillText(eventDate(ev).long, 95, 334, 740);
  if (stamp) { x.save(); x.translate(903, 192); x.rotate(.12); fit(stamp, -85, -90, 170, 180); x.restore(); }
  const captions = [m.group && m.groupCaption, m.portrait && m.portraitCaption].filter(Boolean);
  photos.forEach((im, i) => {
    const two = photos.length === 2, width = two ? 790 : 820, height = two ? 353 : 738;
    const top = two ? 390 + i * 385 : 390;
    x.save(); x.translate(two ? (i ? 568 : 510) : 540, top + height / 2); x.rotate(two ? (i ? .025 : -.025) : -.015);
    x.shadowColor = '#684b3430'; x.shadowBlur = 18; x.shadowOffsetY = 8;
    box(-width / 2, -height / 2, width, height, '#fffefd', 3); x.shadowColor = 'transparent';
    box(-width / 2 + 18, -height / 2 + 18, width - 36, height - 76, '#f3eee7', 0);
    fit(im, -width / 2 + 18, -height / 2 + 18, width - 36, height - 76);
    x.fillStyle = '#79563d'; x.textAlign = 'center'; x.font = `400 25px ${font}`; x.fillText(captions[i] || m.caption, 0, height / 2 - 22, width - 60);
    x.globalAlpha = .76; box(-83, -height / 2 - 14, 166, 34, i ? '#c8dbe5' : '#e9c7c2', 1); x.restore();
  });
  x.fillStyle = '#855c4b'; lines(m.caption, 100, 1202, 875, 26, 2);
  x.textAlign = 'center'; x.font = '17px Georgia'; x.fillStyle = '#a28663'; x.fillText('LITTLE MOMENTS, BIG LOVE  ·  BIGCAT', 540, 1270);
  return c;
}

function perforated(x, cx, cy, r, fill, stroke) {
  x.save();
  x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fillStyle = fill; x.fill();
  // ขอบหยัก: เจาะวงกลมเล็กรอบขอบ
  x.globalCompositeOperation = 'destination-out';
  const n = 36; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; x.beginPath(); x.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, r * 0.065, 0, Math.PI * 2); x.fill(); }
  x.globalCompositeOperation = 'source-over';
  if (stroke) { x.beginPath(); x.arc(cx, cy, r * 0.74, 0, Math.PI * 2); x.strokeStyle = stroke; x.lineWidth = 3; x.stroke(); }
  x.restore();
}

export async function drawPassportImage(data) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const cs = getComputedStyle(document.documentElement);
  const F = { head: cs.getPropertyValue('--font-head').trim() || 'sans-serif', body: cs.getPropertyValue('--font-body').trim() || 'sans-serif', display: cs.getPropertyValue('--font-display').trim() || 'sans-serif' };
  await Promise.all([`700 120px ${F.display}`, `600 44px ${F.head}`, `500 34px ${F.body}`].map(f => document.fonts.load(f).catch(() => {})));

  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#fff1ef'); g.addColorStop(1, '#fcf8f1');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const mark = await loadImage('/images/bigcat-mark-pink.webp');
  if (mark) x.drawImage(mark, W / 2 - 70, 120, 140, 104);
  x.textAlign = 'center'; x.fillStyle = '#33332f';
  x.font = `700 120px ${F.display}`; x.fillText('PASSPORT', W / 2, 360);
  x.font = `600 44px ${F.head}`; x.fillStyle = '#7d7062'; x.fillText(data.user.display_name, W / 2, 430);
  x.font = `500 34px ${F.body}`; x.fillStyle = '#a3485a'; x.fillText(`สะสมแล้ว ${data.total} ดวง`, W / 2, 490);

  // ตารางแสตมป์: งานที่ผ่านมา/กำลังจัด (ได้ = ภาพ · พลาด = เงา) เรียงตามวัน + แสตมป์พิเศษต่อท้าย
  const slots = [];
  for (const b of data.books) for (const ev of b.events) if (ev.earned || ev.phase !== 'upcoming') slots.push({ ev, earned: !!ev.earned });
  const specials = [];
  for (const b of data.books) for (const ev of b.events) for (const s of ev.extras || []) specials.push({ kind: s.kind, meta: s.meta });
  if (data.friend) specials.push({ kind: 'friend', meta: data.friend.meta });
  // น้อยดวง → 2 คอลัมน์ดวงใหญ่ · หลายดวง → 3 คอลัมน์ · แถวสุดท้ายจัดกึ่งกลาง
  const cols = slots.length <= 4 ? 2 : 3, cell = cols === 2 ? 420 : 300, r = cols === 2 ? 160 : 118, top = 640;
  const imgs = await Promise.all(slots.map(s => loadImage(s.earned ? (eventStampArt(s.ev) || s.ev.cover) : null)));
  slots.forEach((s, i) => {
    const row = Math.floor(i / cols), inRow = Math.min(cols, slots.length - row * cols);
    const cx = (W - inRow * cell) / 2 + cell / 2 + (i % cols) * cell, cy = top + row * (cell + 40);
    const tone = TONE[s.ev.tone] || TONE.pink;
    if (s.earned) {
      perforated(x, cx, cy, r, '#ffffff', s.ev.stamp?.image ? null : tone);
      const im = imgs[i];
      if (im) {
        x.save(); if (!s.ev.stamp?.image) { x.beginPath(); x.arc(cx, cy, r * 0.72, 0, Math.PI * 2); x.clip(); }
        const side = Math.min(im.width, im.height), sx = (im.width - side) / 2, sy = (im.height - side) / 2, R = s.ev.stamp?.image ? r * 0.88 : r * 0.72;
        if (s.ev.stamp?.image) x.drawImage(im, cx - R, cy - R, R * 2, R * 2); else x.drawImage(im, sx, sy, side, side, cx - R, cy - R, R * 2, R * 2);
        x.restore();
      }
    } else {
      perforated(x, cx, cy, r, '#ebe4d9', null);
      x.font = `700 ${Math.round(r * 0.75)}px ${F.display}`; x.fillStyle = '#cfc5b7'; x.textAlign = 'center'; x.fillText('?', cx, cy + r * 0.27);
    }
    x.font = `500 ${cols === 2 ? 30 : 24}px ${F.body}`; x.fillStyle = s.earned ? '#33332f' : '#b3a897'; x.textAlign = 'center';
    const t = s.ev.title.length > (cols === 2 ? 24 : 18) ? s.ev.title.slice(0, cols === 2 ? 23 : 17) + '…' : s.ev.title;
    x.fillText(t, cx, cy + r + 44);
  });
  // แสตมป์พิเศษ (ตราเล็ก) แถวล่าง
  if (specials.length) {
    const y = top + Math.ceil(slots.length / cols) * (cell + 40) + 40;
    x.font = `600 30px ${F.head}`; x.fillStyle = '#7d7062'; x.textAlign = 'center'; x.fillText('แสตมป์พิเศษ', W / 2, y);
    const label = { lucky: 'LUCKY FAN', tier: 'ร่วมบุญ ✦', dayone: 'DAY ONE', first: 'มาครั้งแรก', friend: 'พามาเจอ' };
    const color = { lucky: '#c99a2e', tier: '#c99a2e', dayone: '#df8190', first: '#7fa66f', friend: '#5b8fd6' };
    const sw = 200, sl = (W - Math.min(specials.length, 5) * sw) / 2 + sw / 2;
    const arts = await Promise.all(specials.slice(0, 5).map(s => loadImage(SPECIAL_STAMP_ART[s.kind])));
    specials.slice(0, 5).forEach((s, i) => {
      const cx = sl + i * sw, cy = y + 110;
      if (arts[i]) {   // ลายวาดจริง (ถ้ามีไฟล์) + ป้ายตัวเลข
        x.drawImage(arts[i], cx - 85, cy - 85, 170, 170);
        x.font = `600 20px ${F.head}`; x.fillStyle = '#7d6250'; x.fillText(label[s.kind] || s.kind, cx, cy + 112);
        if (s.kind === 'friend' && s.meta?.count) { x.font = `700 20px ${F.head}`; x.fillStyle = '#33332f'; x.fillText(`×${s.meta.count}`, cx + 55, cy + 80); }
        if (s.kind === 'lucky' && s.meta?.round) { x.font = `700 20px ${F.head}`; x.fillStyle = '#33332f'; x.fillText(`รอบ ${s.meta.round}`, cx + 45, cy + 80); }
        return;
      }
      x.beginPath(); for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2, rr = k % 2 ? 62 : 72; x[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath();
      x.fillStyle = ['lucky', 'tier'].includes(s.kind) ? '#f2d27a' : '#fff'; x.fill(); x.strokeStyle = color[s.kind] || '#df8190'; x.lineWidth = 3; x.stroke();
      x.font = `700 22px ${F.head}`; x.fillStyle = color[s.kind] || '#df8190'; x.fillText(label[s.kind] || s.kind, cx, cy + 8);
      if (s.kind === 'friend' && s.meta?.count) { x.font = `700 20px ${F.head}`; x.fillText(`×${s.meta.count}`, cx, cy + 36); }
    });
  }
  x.font = `500 30px ${F.body}`; x.fillStyle = '#958779'; x.textAlign = 'center';
  x.fillText('bigcathouse.com/passport', W / 2, H - 120);
  x.font = `600 36px ${F.head}`; x.fillStyle = '#df8190'; x.fillText('Big cats. Lighter days.', W / 2, H - 170);
  return c;
}
