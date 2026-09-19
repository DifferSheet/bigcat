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
  const [photos, stamp, logo, note] = await Promise.all([Promise.all(sources.map(loadImage)), loadImage(eventStampArt(ev)), loadImage('/images/bigcat-mark-pink.webp'), loadImage(m.noteImage ? own('note') : null)]);
  if (photos.some(im => !im)) throw new Error('โหลดภาพไม่สำเร็จ — ลองรีเฟรชหน้าแล้วกดอีกครั้ง');
  if (m.noteImage && !note) throw new Error('โหลดข้อความจากน้องไม่สำเร็จ กรุณาลองอีกครั้ง');
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
  box(35, 35, 1010, 1280, '#bca078', 26);
  box(32, 29, 1010, 1278, '#e6d5b8', 24);
  box(29, 23, 1010, 1278, '#cdb58e', 24);
  box(26, 18, 1010, 1278, '#fff9ed', 24); x.restore();
  // Two upright landscape pages, joined at a horizontal fold.
  x.strokeStyle = '#b49b7220'; x.lineWidth = 1;
  for (let y = 42; y < 1280; y += 8) { x.beginPath(); x.moveTo(46, y); x.lineTo(1016, y); x.stroke(); }
  const fold = x.createLinearGradient(0, 610, 0, 710);
  fold.addColorStop(0, '#96744900'); fold.addColorStop(.43, '#96744922'); fold.addColorStop(.5, '#64442160'); fold.addColorStop(.53, '#fffdf6'); fold.addColorStop(.62, '#96744922'); fold.addColorStop(1, '#96744900');
  x.fillStyle = fold; x.fillRect(27, 610, 1008, 100);
  x.strokeStyle = '#d7c3a5'; x.strokeRect(65, 53, 930, 562); x.strokeRect(65, 709, 930, 548);
  if (logo) fit(logo, 92, 78, 65, 50);
  x.fillStyle = '#94724d'; x.font = '18px Georgia'; x.textAlign = 'left'; x.fillText('MY BIGCAT PASSPORT', 182, 110);
  x.fillStyle = '#674735'; lines(ev.title, 94, 177, 880, 36, 2);
  x.fillStyle = '#96734f'; x.font = `400 21px ${font}`; x.fillText(eventDate(ev).long, 95, 265, 840);
  if (stamp) { x.save(); x.translate(273, 431); x.rotate(-.07); fit(stamp, -150, -147, 300, 294); x.restore(); }
  x.save(); x.shadowColor = '#684b3420'; x.shadowBlur = 12; x.shadowOffsetY = 5;
  box(485, 303, 463, 280, '#fffcf4', 3); x.restore();
  box(647, 289, 130, 28, '#e8c6bca0', 1);
  x.fillStyle = '#a48663'; x.font = '17px Georgia'; x.fillText('A LITTLE NOTE FOR YOU', 513, 345);
  if (note) fit(note, 510, 362, 412, 160);
  else { x.fillStyle = '#765643'; lines(m.noteText || 'กำลังรวบรวมความทรงจำวันของเราอยู่นะ', 513, 390, 407, 25, 4); }
  x.fillStyle = '#a07762'; x.textAlign = 'right'; x.font = `400 21px ${font}`;
  if (note || m.noteText) x.fillText(`จาก ${m.author} ♡`, 918, 558);
  x.textAlign = 'left'; x.font = '16px Georgia'; x.fillStyle = '#ac9474'; x.fillText('01  /  A DAY TO REMEMBER', 93, 601);
  x.fillStyle = '#674735'; lines(m.heading, 94, 763, 880, 30, 2);
  const captions = [m.group && m.groupCaption, m.portrait && m.portraitCaption].filter(Boolean);
  photos.forEach((im, i) => {
    const two = photos.length === 2;
    const scale = Math.min(((two ? 400 : 760) - 36) / im.width, (327 - 76) / im.height);
    const photoWidth = im.width * scale, photoHeight = im.height * scale;
    // Size the paper to the actual photograph, keeping only the white border and caption strip.
    const width = photoWidth + 36, height = photoHeight + 76;
    const top = two ? (i ? 848 : 826) : 830;
    x.save(); x.translate(two ? (i ? 756 : 309) : 540, top + height / 2); x.rotate(two ? (i ? .04 : -.04) : -.015);
    x.shadowColor = '#684b3430'; x.shadowBlur = 18; x.shadowOffsetY = 8;
    box(-width / 2, -height / 2, width, height, '#fffefd', 3); x.shadowColor = 'transparent';
    x.drawImage(im, -width / 2 + 18, -height / 2 + 18, photoWidth, photoHeight);
    x.fillStyle = '#79563d'; x.textAlign = 'center'; x.font = `400 22px ${font}`; x.fillText(captions[i] || m.caption, 0, height / 2 - 22, width - 60);
    const tapeWidth = Math.min(166, width * .55);
    x.globalAlpha = .76; box(-tapeWidth / 2, -height / 2 - 14, tapeWidth, 34, i ? '#c8dbe5' : '#e9c7c2', 1); x.restore();
  });
  x.fillStyle = '#855c4b'; lines(m.caption, 100, 1210, 875, 22, 1);
  x.textAlign = 'left'; x.font = '16px Georgia'; x.fillStyle = '#a28663'; x.fillText('02  /  LITTLE MOMENTS, BIG LOVE', 93, 1246);
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
